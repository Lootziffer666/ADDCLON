// Grok 視頻下載器 - Content Script
// 自動在 Grok 頁面上運行

// 防止重複注入
if (window.__grokVideoDownloaderLoaded) {
    console.log('Content script already loaded, skipping...');
} else {
window.__grokVideoDownloaderLoaded = true;

// Reference SystemLogger from window (exported by logger.js)
const SystemLogger = window.SystemLogger;

const STORAGE_KEY = 'grok_video_downloader';
const HISTORY_KEY = 'grok_video_download_history';

// Story Mode 狀態追蹤（Side Panel 是否連接）
let storyModeActive = false;

// Queue Mode 狀態追蹤（Queue Side Panel 是否連接）
let queueModeActive = false;

// HD 升級狀態追蹤
let upgradeInProgress = false;
let upgradeAbortRequested = false;
let upgradeCurrentProgress = { current: 0, total: 0, success: 0, fail: 0 };
let upgradeScanCache = null; // cached scan results: { videos, timestamp }

// Queue processing state
let queueProcessingActive = false;
let queueWaitingForResult = false; // Set after prompt submission, prevents re-submission on SPA navigation
let _queueResultPending = false;

// 下載狀態追蹤
let downloadInProgress = false;
let downloadAbortRequested = false;
let downloadCurrentProgress = { phase: '', current: 0, total: 0, success: 0, fail: 0 };
const VIDEO_DOWNLOAD_RATE_LIMIT = 250; // 影片下載數量限制，超過此數量自動暫停以避免 rate limit

// 使用 chrome.storage.local 替代 localStorage（更可靠）
async function saveState(state) {
    return chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadState() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || null;
}

async function clearState() {
    return chrome.storage.local.remove(STORAGE_KEY);
}

// 取得下載路徑設定
const DEFAULT_PATHS = {
    images: 'grok_downloads/images',
    videos: 'grok_downloads/videos',
    stream: 'grok_downloads/stream',
    frames: 'grok_downloads/frames'
};

async function getDownloadPaths() {
    const result = await chrome.storage.sync.get(['pathImages', 'pathVideos', 'pathStream', 'pathFrames']);
    return {
        images: result.pathImages || DEFAULT_PATHS.images,
        videos: result.pathVideos || DEFAULT_PATHS.videos,
        stream: result.pathStream || DEFAULT_PATHS.stream,
        frames: result.pathFrames || DEFAULT_PATHS.frames
    };
}

// 下載歷史管理（永久記錄）— 使用 Set 快取避免 OOM
let historyCache = null; // Set<string>, loaded once

async function ensureHistoryCache() {
    if (historyCache) return historyCache;
    const result = await chrome.storage.local.get(HISTORY_KEY);
    historyCache = new Set(result[HISTORY_KEY] || []);
    return historyCache;
}

async function getDownloadHistory() {
    const cache = await ensureHistoryCache();
    return [...cache];
}

async function addToHistory(videoId) {
    const cache = await ensureHistoryCache();
    cache.add(videoId);
}

async function isInHistory(videoId) {
    const cache = await ensureHistoryCache();
    return cache.has(videoId);
}

async function flushHistory() {
    if (!historyCache) return;
    await chrome.storage.local.set({ [HISTORY_KEY]: [...historyCache] });
}

async function clearHistory() {
    historyCache = null;
    return chrome.storage.local.remove(HISTORY_KEY);
}

// ==========================================
// Last Frame Extraction (for AI video extension workflows)
// ==========================================

/**
 * Extract a frame from a video at a specific position
 * @param {string} videoUrl - URL of the video to extract frame from
 * @param {string} videoId - ID for naming the output file
 * @param {string} position - 'first' or 'last' frame
 * @returns {Promise<{success: boolean, dataUrl?: string, filename?: string, error?: string}>}
 */
async function extractVideoFrame(videoUrl, videoId, position = 'last') {
    // Fetch video directly in content script (inherits page cookies)
    // This avoids the overhead of base64 encoding/decoding through background script
    let blobUrl = null;

    try {
        const response = await fetch(videoUrl, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
    } catch (error) {
        console.log('  ⚠️ Video fetch failed:', error.message);
        return {
            success: false,
            error: `Failed to fetch video: ${error.message}`
        };
    }

    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'metadata'; // Only load metadata first for faster seek

        const cleanup = () => {
            video.remove();
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };

        // Timeout to prevent hanging
        const timeout = setTimeout(() => {
            cleanup();
            resolve({
                success: false,
                error: 'Frame extraction timed out'
            });
        }, 30000); // 30 second timeout

        video.onloadedmetadata = () => {
            // Seek to the desired position (like ffmpeg -ss before -i for fast seek)
            if (position === 'first') {
                video.currentTime = 0.01;
            } else {
                // Seek to last frame (slightly before end to ensure we get a frame)
                video.currentTime = Math.max(0, video.duration - 0.1);
            }
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);

                // Convert to PNG data URL
                const dataUrl = canvas.toDataURL('image/png');

                clearTimeout(timeout);
                cleanup();

                const suffix = position === 'first' ? 'first_frame' : 'last_frame';

                resolve({
                    success: true,
                    dataUrl: dataUrl,
                    width: canvas.width,
                    height: canvas.height,
                    filename: `grok_video_${videoId}_${suffix}.png`
                });
            } catch (error) {
                clearTimeout(timeout);
                cleanup();
                resolve({
                    success: false,
                    error: error.message || 'Failed to draw frame to canvas'
                });
            }
        };

        video.onerror = (e) => {
            clearTimeout(timeout);
            cleanup();
            resolve({
                success: false,
                error: 'Failed to load video for frame extraction'
            });
        };

        video.src = blobUrl;
        video.load();
    });
}

/**
 * Download the last frame of a video as PNG
 * @param {string} videoUrl - URL of the video
 * @param {string} videoId - ID for naming
 * @param {string} position - 'first' or 'last'
 */
async function downloadVideoFrame(videoUrl, videoId, position = 'last') {
    console.log(`  📸 正在提取${position === 'first' ? '首' : '末'}幀...`);

    const result = await extractVideoFrame(videoUrl, videoId, position);

    if (result.success) {
        try {
            const paths = await getDownloadPaths();
            await chrome.runtime.sendMessage({
                action: 'download',
                url: result.dataUrl,
                filename: `${paths.videos}/${result.filename}`
            });
            console.log(`  ✓ ${position === 'first' ? '首' : '末'}幀已下載: ${result.filename}`);
            return true;
        } catch (error) {
            console.error(`  ⚠️ ${position === 'first' ? '首' : '末'}幀下載失敗:`, error);
            return false;
        }
    } else {
        console.error(`  ⚠️ 幀提取失敗:`, result.error);
        return false;
    }
}

// 使用 GrokUtils.flattenPosts 替代本地實作

// 生成媒體列表（圖片和視頻）
async function generateMediaList(options = { includeImages: true, includeVideos: true }) {
    console.log('='.repeat(60));
    console.log('📋 生成媒體下載列表');
    console.log('='.repeat(60));
    console.log('');

    await SystemLogger.info('Generate List started', `Mode: ${options.downloadMode || 'standard'}`);

    const allPosts = [];
    let cursor = null;
    const API_URL = 'https://grok.com/rest/media/post/list';

    try {
        while (true) {
            const payload = {
                limit: 40,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            };

            if (cursor) {
                payload.cursor = cursor;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) break;

            const data = await response.json();
            const posts = data.posts || [];

            if (posts.length === 0) break;

            allPosts.push(...posts);
            console.log(`  ✓ ${allPosts.length} 個項目`);

            // Notify popup of scan progress
            chrome.runtime.sendMessage({
                action: 'generateListProgress',
                count: allPosts.length
            }).catch(() => {}); // popup may be closed

            if (!data.nextCursor) break;
            cursor = data.nextCursor;

            await new Promise(resolve => setTimeout(resolve, 300));
        }

    } catch (error) {
        console.error('❌ 獲取數據失敗:', error);
        await SystemLogger.fail('Generate List failed', error.message);
        return null;
    }

    await SystemLogger.info('API scan completed', `Found ${allPosts.length} posts`);

    // 遞歸提取所有帖子（包括子帖子）
    const flattenedPosts = GrokUtils.flattenPosts(allPosts);

    // 按 createTime 升序排列（舊→新）
    flattenedPosts.sort((a, b) => {
        const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
        const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
        return ta - tb;
    });

    console.log(`  📊 總項目（含子項目）: ${flattenedPosts.length}`);

    // 分離圖片和視頻
    let { images, videos } = ContentUtils.separateByMediaType(flattenedPosts);
    const allImagesUnfiltered = [...images];
    const allVideosUnfiltered = [...videos];

    // 如果有日期過濾，應用過濾
    if (options.fromDate || options.toDate) {
        const fromTimestamp = options.fromDate || null;
        const toTimestamp = options.toDate || null;
        const beforeCount = { images: images.length, videos: videos.length };

        // 檢查第一個項目是否有 createTime
        const sampleItem = images[0] || videos[0];
        if (sampleItem && !sampleItem.createTime) {
            console.warn('⚠️  警告: createTime 欄位不存在');
            console.log('📋 可用欄位:', Object.keys(sampleItem));
            console.log('');
        }

        // 過濾函數：檢查是否在日期範圍內
        const isInDateRange = (itemTimestamp) => {
            if (fromTimestamp && itemTimestamp < fromTimestamp) return false;
            if (toTimestamp && itemTimestamp > toTimestamp) return false;
            return true;
        };

        images = images.filter(img => {
            if (!img.createTime) {
                console.warn(`⚠️  圖片 ${img.id} 缺少 createTime，將被排除`);
                return false;
            }
            const itemTimestamp = new Date(img.createTime).getTime();
            return isInDateRange(itemTimestamp);
        });

        videos = videos.filter(vid => {
            if (!vid.createTime) {
                console.warn(`⚠️  視頻 ${vid.id} 缺少 createTime，將被排除`);
                return false;
            }
            const itemTimestamp = new Date(vid.createTime).getTime();
            return isInDateRange(itemTimestamp);
        });

        console.log('📅 日期過濾:');
        if (fromTimestamp) console.log(`  From: ${new Date(fromTimestamp).toLocaleString()}`);
        if (toTimestamp) console.log(`  To: ${new Date(toTimestamp).toLocaleString()}`);
        console.log(`  圖片: ${beforeCount.images} → ${images.length}`);
        console.log(`  視頻: ${beforeCount.videos} → ${videos.length}`);

        // 顯示過濾後的第一個和最後一個項目的時間
        const allFiltered = [...images, ...videos];
        if (allFiltered.length > 0) {
            const times = allFiltered.map(item => new Date(item.createTime).getTime());
            const earliest = new Date(Math.min(...times));
            const latest = new Date(Math.max(...times));

            console.log('');
            console.log('📊 過濾結果時間範圍:');
            console.log(`  最早: ${earliest.toLocaleString()}`);
            console.log(`  最晚: ${latest.toLocaleString()}`);
        }
        console.log('');
    }

    // 如果有小時限制，應用過濾
    if (options.hoursLimit) {
        const cutoffTime = Date.now() - (options.hoursLimit * 60 * 60 * 1000);
        const beforeCount = { images: images.length, videos: videos.length };
        images = images.filter(img => {
            if (!img.createTime) return false;
            return new Date(img.createTime).getTime() >= cutoffTime;
        });
        videos = videos.filter(v => {
            if (!v.createTime) return false;
            return new Date(v.createTime).getTime() >= cutoffTime;
        });
        console.log(`🕐 時間過濾 (${options.hoursLimit}h): 圖片 ${beforeCount.images}→${images.length}, 影片 ${beforeCount.videos}→${videos.length}`);
    }

    console.log('');
    console.log(`✅ 找到 ${images.length} 個圖片, ${videos.length} 個視頻`);
    console.log('');

    // 根據選項過濾
    let imageData = [];
    let videoData = [];

    // 使用 GrokUtils.formatDateYYYYMMDD, GrokUtils.formatDateWithTime, GrokUtils.sanitizePromptForFilename

    if (options.includeImages) {
        imageData = images.map(img => ContentUtils.mapImageToDownloadData(img, options));
    }

    if (options.includeVideos) {
        videoData = videos.map(v => ContentUtils.mapVideoToDownloadData(v, options));
    }

    // 建立未過濾的完整資料（用於 popup 狀態顯示）
    const allImageData = options.includeImages
        ? allImagesUnfiltered.map(img => ContentUtils.mapImageToDownloadData(img, options))
        : [];
    const allVideoData = options.includeVideos
        ? allVideosUnfiltered.map(v => ContentUtils.mapVideoToDownloadData(v, options))
        : [];

    // 檢查歷史記錄，使用 ContentUtils 計算統計
    const history = await getDownloadHistory();
    const hdPriority = options.hdPriority !== false;

    const imageStats = ContentUtils.calculateImageStats(imageData, history);
    const videoStats = ContentUtils.calculateVideoStats(videoData, history, hdPriority);

    console.log('📊 下載統計:');
    if (options.includeImages) {
        console.log(`  🖼️  圖片: ${imageStats.total} 個`);
        console.log(`     已下載: ${imageStats.alreadyDownloaded} 個（將跳過）`);
        console.log(`     待下載: ${imageStats.needDownload} 個`);
    }
    if (options.includeVideos) {
        console.log(`  🎬 視頻: ${videoStats.totalFiles} 個檔案 (含 HD)`);
        console.log(`     已下載: ${videoStats.alreadyDownloadedFiles} 個檔案（將跳過）`);
        console.log(`     待下載: ${videoStats.needDownloadFiles} 個檔案`);
    }
    console.log('');

    // 建立專案分組（用於 Project 模式）
    // 注意：不對 parent 進行時間過濾，而是在下載時對 children 進行過濾
    // 這樣可以支援「parent 是舊的，但最近新增了 children」的情況
    // 無論下載模式，都計算專案數量供狀態顯示
    const allProjects = GrokUtils.groupPostsByProject(allPosts);
    const projectCount = allProjects.length;
    console.log(`📂 專案總數: ${projectCount}`);
    let projects = [];
    if (options.downloadMode === 'project') {
        projects = allProjects;
        console.log(`📂 專案模式: 建立了 ${projects.length} 個專案資料夾`);
        if (options.fromDate || options.toDate) {
            console.log(`📅 將在下載時對 children 進行時間過濾`);
        }
    }

    const state = {
        images: imageData,
        videos: videoData,
        allImages: allImageData,
        allVideos: allVideoData,
        projects: projects, // 專案分組資料（Project 模式使用）
        projectCount: projectCount, // 專案總數（所有模式都顯示）
        currentPhase: 'images', // 'images' or 'videos' or 'projects'
        currentIndex: 0,
        downloadedImages: [], // 本次已下載的圖片
        downloadedVideos: [], // 本次已下載的視頻
        downloadedProjects: [], // 本次已下載的專案
        failed: [],
        startTime: Date.now(),
        skipDownloaded: true, // 默認跳過已下載
        completed: false, // 是否完成
        // 保存生成時的過濾條件
        filterOptions: {
            includeImages: options.includeImages,
            includeVideos: options.includeVideos,
            fromDate: options.fromDate || null,
            fromDateString: options.fromDate ? new Date(options.fromDate).toLocaleDateString() : null,
            toDate: options.toDate || null,
            toDateString: options.toDate ? new Date(options.toDate).toLocaleDateString() : null,
            hdPriority: options.hdPriority !== false, // 預設為 true
            saveMetadata: options.saveMetadata === true, // 預設為 false
            promptAsFilename: options.promptAsFilename === true, // 預設為 false
            downloadMode: options.downloadMode || 'standard', // 下載模式: 'standard' or 'project'
            hoursLimit: options.hoursLimit || null
        }
    };

    await saveState(state);

    // 記錄生成完成
    if (options.downloadMode === 'project') {
        await SystemLogger.ok('Generate List completed', `Projects: ${projectCount}, Images: ${imageStats.needDownload}, Videos: ${videoStats.needDownloadFiles}`);
    } else {
        await SystemLogger.ok('Generate List completed', `Images: ${imageStats.needDownload}/${imageStats.total}, Videos: ${videoStats.needDownloadFiles}/${videoStats.totalFiles}`);
    }

    console.log('✅ 媒體列表已保存');
    console.log('');
    console.log('💡 點擊擴展圖標，然後點擊「開始下載」');
    console.log('');

    // 發送消息給 popup
    chrome.runtime.sendMessage({
        action: 'mediaGenerated',
        imageCount: imageStats.total,
        videoCount: videoStats.totalFiles, // 發送檔案數量
        alreadyDownloadedImages: imageStats.alreadyDownloaded,
        alreadyDownloadedVideos: videoStats.alreadyDownloadedFiles,
        needDownloadImages: imageStats.needDownload,
        needDownloadVideos: videoStats.needDownloadFiles,
        rateLimitWarning: videoStats.needDownloadFiles > VIDEO_DOWNLOAD_RATE_LIMIT
    });

    return { images: imageData, videos: videoData };
}

// 批量下載圖片
async function downloadImages() {
    const state = await loadState();

    if (!state || !state.images || state.images.length === 0) {
        console.log('⊘ 沒有圖片需要下載');
        // 圖片下載完成，檢查是否需要下載視頻
        if (state && state.videos && state.videos.length > 0) {
            console.log('');
            console.log('🎬 開始下載視頻...');
            console.log('');
            await startVideoDownload();
        } else {
            await finishAllDownloads();
        }
        return;
    }

    const cache = await ensureHistoryCache();
    const needDownload = state.images.filter(img => !cache.has(img.id));

    console.log('='.repeat(60));
    console.log('🖼️  開始批量下載圖片');
    console.log('='.repeat(60));
    console.log(`總圖片: ${state.images.length} 個`);
    console.log(`已下載: ${state.images.length - needDownload.length} 個（將跳過）`);
    console.log(`待下載: ${needDownload.length} 個`);
    console.log('');

    await SystemLogger.info('Image download started', `Total: ${needDownload.length} images`);

    if (needDownload.length === 0) {
        console.log('✅ 所有圖片都已下載！');
        console.log('');

        // 圖片下載完成，檢查是否需要下載視頻
        if (state.videos && state.videos.length > 0) {
            console.log('🎬 開始下載視頻...');
            console.log('');
            await startVideoDownload();
        } else {
            await finishAllDownloads();
        }
        return;
    }

    // 批量下載圖片
    let successCount = 0;
    let failCount = 0;
    const paths = await getDownloadPaths();

    // 更新下載進度
    downloadCurrentProgress = { phase: 'images', current: 0, total: needDownload.length, success: 0, fail: 0 };

    for (let i = 0; i < needDownload.length; i++) {
        // 檢查是否被中斷
        if (downloadAbortRequested) {
            console.log('⚠️ 下載被使用者中斷（圖片階段）');
            await saveState(state);
            await handleDownloadAbort(successCount, failCount, 'images');
            return;
        }

        const img = needDownload[i];
        // 更新進度
        downloadCurrentProgress = { phase: 'images', current: i + 1, total: needDownload.length, success: successCount, fail: failCount };
        console.log(`[${i + 1}/${needDownload.length}] ${img.id}`);

        try {
            // 使用 chrome.downloads API 下載圖片
            await chrome.runtime.sendMessage({
                action: 'download',
                url: img.url,
                filename: `${paths.images}/${img.filename}`
            });

            // 如果啟用了 saveMetadata，同時下載 .json 檔案
            if (state.filterOptions?.saveMetadata) {
                const metadata = {
                    id: img.id,
                    type: img.type,
                    url: img.url,
                    filename: img.filename,
                    userId: img.userId,
                    createTime: img.createTime,
                    prompt: img.prompt,
                    originalPrompt: img.originalPrompt,
                    downloadedAt: new Date().toISOString()
                };
                const jsonFilename = img.filename.replace(/\.[^.]+$/, '.json');
                const jsonDataUrl = GrokUtils.generateJsonDataUrl(metadata);
                await chrome.runtime.sendMessage({
                    action: 'download',
                    url: jsonDataUrl,
                    filename: `${paths.images}/${jsonFilename}`
                });
            }

            // 添加到歷史記錄
            await addToHistory(img.id);
            if (!state.downloadedImages.includes(img.id)) {
                state.downloadedImages.push(img.id);
            }

            // 更新圖片的下載狀態
            const imageIndex = state.images.findIndex(image => image.id === img.id);
            if (imageIndex !== -1) {
                state.images[imageIndex].downloaded = true;
                state.images[imageIndex].downloadedAt = Date.now();
            }

            console.log('  ✓ 下載成功');
            await SystemLogger.ok('Image downloaded', img.id);
            successCount++;

            // 每 10 個項目或最後一個才寫入狀態和歷史
            if ((i + 1) % 10 === 0 || i === needDownload.length - 1) {
                await saveState(state);
                await flushHistory();
            }

            // 延遲以避免過快請求
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.log('  ✗ 下載失敗:', error.message);
            await SystemLogger.fail('Image download failed', `${img.id} - ${error.message}`);
            state.failed.push({
                id: img.id,
                type: 'image',
                error: error.message
            });
            failCount++;
            // 錯誤時立即保存狀態以保留失敗記錄
            if ((i + 1) % 10 === 0 || i === needDownload.length - 1) {
                await saveState(state);
                await flushHistory();
            }
        }
    }

    console.log('');
    console.log('📊 圖片下載完成');
    console.log(`  成功: ${successCount}/${needDownload.length}`);
    console.log(`  失敗: ${failCount}/${needDownload.length}`);
    console.log('');
    await SystemLogger.info('Image download phase completed', `Success: ${successCount}, Failed: ${failCount}`);

    // 圖片下載完成，檢查是否需要下載視頻
    if (state.videos && state.videos.length > 0) {
        const videoCache = await ensureHistoryCache();
        const needDownloadVideos = state.videos.filter(v => {
            const isNative720p = !v.hdUrl && v.resolutionName === '720p';
            if (isNative720p) {
                return !videoCache.has(`${v.id}_hd`);
            }
            const sdMissing = !videoCache.has(v.id) && !videoCache.has(`${v.id}_sd`);
            const hdMissing = v.hdUrl ? !videoCache.has(v.id + '_hd') : false;
            return sdMissing || hdMissing;
        });

        if (needDownloadVideos.length > 0) {
            console.log('🎬 開始下載視頻...');
            console.log('');
            await startVideoDownload();
        } else {
            await finishAllDownloads();
        }
    } else {
        await finishAllDownloads();
    }
}

// 開始視頻下載
async function startVideoDownload() {
    const state = await loadState();

    if (!state || !state.videos || state.videos.length === 0) {
        console.log('⊘ 沒有視頻需要下載');
        await finishAllDownloads();
        return;
    }

    const history = await ensureHistoryCache();
    const historyArray = [...history]; // Array for GrokUtils compatibility
    const hdPriority = state.filterOptions?.hdPriority !== false; // 預設為 true

    // 是否使用 prompt 作為檔名
    const promptAsFilename = state.filterOptions?.promptAsFilename === true;

    // 過濾出需要下載的視頻（使用 GrokUtils）
    const needDownload = GrokUtils.filterVideosForHdPriority(state.videos, historyArray, hdPriority);

    // 計算總檔案數（使用 GrokUtils）
    const totalFiles = GrokUtils.calculateTotalVideoFiles(state.videos, hdPriority);
    const downloadedFiles = totalFiles - needDownload.length;

    console.log('='.repeat(60));
    console.log('🎬 開始批量下載視頻');
    console.log('='.repeat(60));
    console.log(`HD 優先模式: ${hdPriority ? '✅ 開啟' : '❌ 關閉'}`);
    console.log(`總視頻: ${state.videos.length} 個`);
    console.log(`已下載: ${downloadedFiles} 個（將跳過）`);
    console.log(`待下載: ${needDownload.length} 個`);
    console.log('');

    await SystemLogger.info('Video download started', `Total: ${needDownload.length} videos, HD Priority: ${hdPriority}`);

    if (needDownload.length === 0) {
        console.log('✅ 所有視頻都已下載！');
        await finishAllDownloads();
        return;
    }

    // 更新狀態為視頻下載階段
    state.currentPhase = 'videos';
    await saveState(state);

    // 批量下載視頻
    let successCount = 0;
    let failCount = 0;
    const paths = await getDownloadPaths();

    // 更新下載進度
    downloadCurrentProgress = { phase: 'videos', current: 0, total: needDownload.length, success: 0, fail: 0 };

    for (let i = 0; i < needDownload.length; i++) {
        // 檢查是否被中斷
        if (downloadAbortRequested) {
            console.log('⚠️ 下載被使用者中斷（視頻階段）');
            await saveState(state);
            await handleDownloadAbort(successCount, failCount, 'videos');
            return;
        }

        const video = needDownload[i];
        // 更新進度
        downloadCurrentProgress = { phase: 'videos', current: i + 1, total: needDownload.length, success: successCount, fail: failCount };
        const dateStr = GrokUtils.formatDateYYYYMMDD(video.createTime);
        console.log(`[${i + 1}/${needDownload.length}] ${video.id} (${dateStr})`);

        try {
            if (hdPriority) {
                // HD 優先模式：只下載一個版本
                const hasHd = !!video.hdUrl;
                const isNative720p = !hasHd && video.resolutionName === '720p';
                const downloadUrl = hasHd ? video.hdUrl : video.url;
                const quality = (hasHd || isNative720p) ? 'hd' : 'sd';
                const historyKey = `${video.id}_${quality}`;

                // 決定副檔名（使用 GrokUtils）
                const ext = GrokUtils.getExtFromMediaUrl(downloadUrl, 'mp4');

                // 根據 promptAsFilename 設定決定檔名格式
                let filename;
                if (promptAsFilename) {
                    const dateTimeStr = GrokUtils.formatDateWithTime(video.createTime);
                    const effectivePrompt = video.originalPrompt || video.prompt;
                    const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, video.id);
                    filename = `${paths.videos}/${quality}_${dateTimeStr}_${sanitizedPrompt}.${ext}`;
                } else {
                    filename = `${paths.videos}/grok_video_${quality}_${dateStr}_${video.id}.${ext}`;
                }

                console.log(`  ⬇️  下載 ${quality.toUpperCase()} 畫質...`);
                await chrome.runtime.sendMessage({
                    action: 'download',
                    url: downloadUrl,
                    filename: filename
                });

                await addToHistory(historyKey);
                console.log(`  ✓ ${quality.toUpperCase()} 版本下載完成`);

            } else {
                // 非 HD 優先模式：下載所有版本 (舊邏輯)
                const isNative720p = !video.hdUrl && video.resolutionName === '720p';

                if (isNative720p) {
                    // 原生 720p：只有一個版本，直接以 HD 品質下載
                    const hdKey = `${video.id}_hd`;
                    if (!history.has(hdKey)) {
                        const ext = GrokUtils.getExtFromMediaUrl(video.url, 'mp4');
                        let filename;
                        if (promptAsFilename) {
                            const dateTimeStr = GrokUtils.formatDateWithTime(video.createTime);
                            const effectivePrompt = video.originalPrompt || video.prompt;
                            const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, video.id);
                            filename = `${paths.videos}/hd_${dateTimeStr}_${sanitizedPrompt}.${ext}`;
                        } else {
                            filename = `${paths.videos}/grok_video_hd_${dateStr}_${video.id}.${ext}`;
                        }
                        console.log(`  ⬇️  下載 720p (原生 HD)...`);
                        await chrome.runtime.sendMessage({
                            action: 'download',
                            url: video.url,
                            filename: filename
                        });
                        await addToHistory(hdKey);
                        console.log(`  ✓ 720p 版本下載完成`);
                    }
                } else {
                    // SD 版本
                    const sdKey = `${video.id}_sd`;
                    if (!history.has(video.id) && !history.has(sdKey)) {
                        const ext = GrokUtils.getExtFromMediaUrl(video.url, 'mp4');

                        // 根據 promptAsFilename 設定決定檔名格式
                        let filename;
                        if (promptAsFilename) {
                            const dateTimeStr = GrokUtils.formatDateWithTime(video.createTime);
                            const effectivePrompt = video.originalPrompt || video.prompt;
                            const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, video.id);
                            filename = `${paths.videos}/sd_${dateTimeStr}_${sanitizedPrompt}.${ext}`;
                        } else {
                            filename = `${paths.videos}/grok_video_sd_${dateStr}_${video.id}.${ext}`;
                        }
                        console.log(`  ⬇️  下載 SD 畫質...`);
                        await chrome.runtime.sendMessage({
                            action: 'download',
                            url: video.url,
                            filename: filename
                        });
                        await addToHistory(sdKey);
                        console.log(`  ✓ SD 版本下載完成`);
                    }
                }

                // HD 版本（只有非原生 720p 才需要檢查）
                if (video.hdUrl && !history.has(video.id + '_hd')) {
                    const hdExt = GrokUtils.getExtFromMediaUrl(video.hdUrl, 'mp4');

                    // 根據 promptAsFilename 設定決定檔名格式
                    let hdFilename;
                    if (promptAsFilename) {
                        const dateTimeStr = GrokUtils.formatDateWithTime(video.createTime);
                        const effectivePrompt = video.originalPrompt || video.prompt;
                        const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, video.id);
                        hdFilename = `${paths.videos}/hd_${dateTimeStr}_${sanitizedPrompt}.${hdExt}`;
                    } else {
                        hdFilename = `${paths.videos}/grok_video_hd_${dateStr}_${video.id}.${hdExt}`;
                    }
                    console.log(`  ⬇️  下載 HD 畫質...`);
                    await chrome.runtime.sendMessage({
                        action: 'download',
                        url: video.hdUrl,
                        filename: hdFilename
                    });
                    await addToHistory(video.id + '_hd');
                    console.log(`  ✓ HD 版本下載完成`);
                }
            }

            if (!state.downloadedVideos.includes(video.id)) {
                state.downloadedVideos.push(video.id);
            }

            // 如果啟用了 saveMetadata，同時下載 .json 檔案
            if (state.filterOptions?.saveMetadata) {
                const quality = hdPriority ? ((video.hdUrl || video.resolutionName === '720p') ? 'hd' : 'sd') : 'sd';
                const metadata = {
                    id: video.id,
                    type: video.type,
                    url: video.url,
                    hdUrl: video.hdUrl,
                    detailUrl: video.detailUrl,
                    userId: video.userId,
                    createTime: video.createTime,
                    prompt: video.prompt,
                    originalPrompt: video.originalPrompt,
                    downloadedQuality: quality,
                    downloadedAt: new Date().toISOString()
                };
                let jsonFilename;
                if (promptAsFilename) {
                    const dateTimeStr = GrokUtils.formatDateWithTime(video.createTime);
                    const effectivePrompt = video.originalPrompt || video.prompt;
                    const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, video.id);
                    jsonFilename = `${quality}_${dateTimeStr}_${sanitizedPrompt}.json`;
                } else {
                    jsonFilename = `grok_video_${quality}_${dateStr}_${video.id}.json`;
                }
                const jsonDataUrl = GrokUtils.generateJsonDataUrl(metadata);
                await chrome.runtime.sendMessage({
                    action: 'download',
                    url: jsonDataUrl,
                    filename: `${paths.videos}/${jsonFilename}`
                });
            }

            // 更新單個項目狀態
            const videoIndex = state.videos.findIndex(v => v.id === video.id);
            if (videoIndex !== -1) {
                state.videos[videoIndex].downloaded = true;
                state.videos[videoIndex].downloadedAt = Date.now();
            }

            console.log('  ✓ 下載成功');
            await SystemLogger.ok('Video downloaded', video.id);
            successCount++;

            // Rate limit protection: pause after every VIDEO_DOWNLOAD_RATE_LIMIT successful downloads
            if (successCount > 0 && successCount % VIDEO_DOWNLOAD_RATE_LIMIT === 0) {
                console.log(`⏸️ Rate limit: ${successCount} videos downloaded, pausing...`);
                await saveState(state);
                await flushHistory();
                await handleRateLimitPause(successCount, failCount, 'videos');
                return;
            }

            // 只有在 Story Mode 活跃時才自動提取末幀
            if (storyModeActive) {
                console.log('  📸 Story Mode 活躍，提取末幀...');
                const frameSourceUrl = video.hdUrl || video.url;
                await downloadVideoFrame(frameSourceUrl, video.id, 'last');
            }

            // 每 10 個項目或最後一個才寫入狀態和歷史
            if ((i + 1) % 10 === 0 || i === needDownload.length - 1) {
                await saveState(state);
                await flushHistory();
            }

            // 延遲以避免過快請求
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.log('  ✗ 下載失敗:', error.message);
            await SystemLogger.fail('Video download failed', `${video.id} - ${error.message}`);
            state.failed.push({
                id: video.id,
                type: 'video',
                error: error.message
            });
            failCount++;
            // 錯誤時也按批次保存
            if ((i + 1) % 10 === 0 || i === needDownload.length - 1) {
                await saveState(state);
                await flushHistory();
            }
        }
    }

    console.log('');
    console.log('📊 視頻下載完成');
    console.log(`  成功: ${successCount}/${needDownload.length}`);
    console.log(`  失敗: ${failCount}/${needDownload.length}`);
    console.log('');
    await SystemLogger.info('Video download phase completed', `Success: ${successCount}, Failed: ${failCount}`);

    await finishAllDownloads();
}

// 開始自動下載（統一入口）
async function startAutoDownload() {
    // 檢查是否已在下載中
    if (downloadInProgress) {
        return {
            success: false,
            reason: 'download_already_in_progress',
            inProgress: true,
            ...downloadCurrentProgress
        };
    }

    const state = await loadState();

    if (!state) {
        console.log('❌ 沒有媒體列表');
        console.log('💡 請先生成下載列表');
        return { success: false, reason: 'no_list' };
    }

    if ((!state.images || state.images.length === 0) &&
        (!state.videos || state.videos.length === 0)) {
        console.log('❌ 沒有媒體需要下載');
        console.log('💡 請先生成下載列表');
        return { success: false, reason: 'no_media' };
    }

    // 預熱歷史快取
    const historySet = await ensureHistoryCache();
    const hdPriority = state.filterOptions?.hdPriority !== false;
    const downloadMode = state.filterOptions?.downloadMode || 'standard';

    // 檢查是否所有內容都已下載
    if (downloadMode === 'project' && state.projects && state.projects.length > 0) {
        // Project 模式：用 per-file history 檢查每個專案
        const needProjects = countProjectsNeedDownload(state.projects, historySet, state.filterOptions);
        if (needProjects === 0) {
            console.log('='.repeat(60));
            console.log('✅ 所有專案都已下載過');
            console.log('='.repeat(60));
            console.log(`專案: ${state.projects.length} 個（全部已下載）`);
            console.log('');
            console.log('💡 如需重新下載，請先清除歷史記錄');
            return {
                success: false,
                reason: 'all_downloaded',
                imageCount: state.images?.length || 0,
                videoCount: state.videos?.length || 0
            };
        }
    } else {
        // 標準模式：檢查圖片和視頻
        const needDownloadImages = state.images?.filter(img => !historySet.has(img.id)) || [];
        const historyArrayForUtils = [...historySet];
        const needDownloadVideos = GrokUtils.filterVideosForHdPriority(state.videos || [], historyArrayForUtils, hdPriority);

        if (needDownloadImages.length === 0 && needDownloadVideos.length === 0) {
            console.log('='.repeat(60));
            console.log('✅ 所有內容都已下載過');
            console.log('='.repeat(60));
            console.log(`圖片: ${state.images?.length || 0} 個（全部已下載）`);
            console.log(`視頻: ${state.videos?.length || 0} 個（全部已下載）`);
            console.log('');
            console.log('💡 如需重新下載，請先清除歷史記錄');
            return {
                success: false,
                reason: 'all_downloaded',
                imageCount: state.images?.length || 0,
                videoCount: state.videos?.length || 0
            };
        }
    }

    // 重置狀態
    state.currentIndex = 0;
    state.downloadedImages = []; // 重置本次圖片下載記錄
    state.downloadedVideos = []; // 重置本次視頻下載記錄
    state.downloadedProjects = []; // 重置本次專案下載記錄
    state.failed = [];
    state.startTime = Date.now();
    state.completed = false; // 重置完成標記
    state.rateLimitPaused = false; // Clear rate limit pause flag
    await saveState(state);

    // 設定下載狀態
    downloadInProgress = true;
    downloadAbortRequested = false;
    downloadCurrentProgress = { phase: 'starting', current: 0, total: 0, success: 0, fail: 0 };

    console.log('='.repeat(60));
    console.log('🚀 開始自動下載');
    console.log('='.repeat(60));
    console.log('');

    const imageCount = state.images?.length || 0;
    const videoCount = state.videos?.length || 0;
    const projectCount = state.projects?.length || 0;
    await SystemLogger.info('Download started', `Images: ${imageCount}, Videos: ${videoCount}, Projects: ${projectCount}`);

    // 檢查下載模式（downloadMode 已在上方宣告）
    if (downloadMode === 'project' && state.projects && state.projects.length > 0) {
        // Project 模式：按專案資料夾下載
        console.log(`📂 專案模式: ${state.projects.length} 個專案`);
        state.currentPhase = 'projects';
        await saveState(state);
        await downloadProjects();
    } else {
        // 標準模式：先下載圖片，再下載視頻
        if (state.images && state.images.length > 0) {
            state.currentPhase = 'images';
            await saveState(state);
            await downloadImages();
        } else if (state.videos && state.videos.length > 0) {
            state.currentPhase = 'videos';
            await saveState(state);
            await startVideoDownload();
        }
    }

    return { success: true };
}

// 在詳情頁找到並點擊下載按鈕
async function findAndClickDownloadButton() {
    console.log('🔍 尋找下載按鈕...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const buttons = document.querySelectorAll('button, [role="button"], a');

    for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        const title = btn.getAttribute('title')?.toLowerCase() || '';

        if (text.includes('download') || text.includes('下載') ||
            ariaLabel.includes('download') || ariaLabel.includes('下載') ||
            title.includes('download') || title.includes('下載')) {

            console.log('✓ 找到下載按鈕');
            console.log('🖱️  點擊下載按鈕...');
            btn.click();

            return true;
        }
    }

    console.log('  未找到直接的下載按鈕，尋找菜單...');

    for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';

        if (text === '...' || text === '⋯' ||
            ariaLabel.includes('more') || ariaLabel.includes('menu') ||
            ariaLabel.includes('更多') || ariaLabel.includes('選單')) {

            console.log('✓ 找到菜單按鈕');
            console.log('🖱️  點擊菜單...');
            btn.click();

            await new Promise(resolve => setTimeout(resolve, 500));

            const menuButtons = document.querySelectorAll('button, [role="button"], [role="menuitem"]');

            for (const menuBtn of menuButtons) {
                const menuText = menuBtn.textContent?.toLowerCase() || '';
                const menuAriaLabel = menuBtn.getAttribute('aria-label')?.toLowerCase() || '';

                if (menuText.includes('download') || menuText.includes('下載') ||
                    menuText.includes('save') || menuText.includes('儲存') ||
                    menuAriaLabel.includes('download') || menuAriaLabel.includes('下載')) {

                    console.log('✓ 在菜單中找到下載按鈕');
                    console.log('🖱️  點擊下載...');
                    menuBtn.click();

                    return true;
                }
            }
        }
    }

    console.log('❌ 未找到下載按鈕');
    return false;
}

// 升級收藏的視頻到 HD
async function upgradeFavoritesToHD(options = {}) {
    // 如果已經在進行中，返回當前狀態
    if (upgradeInProgress) {
        return {
            success: false,
            error: 'upgrade_already_in_progress',
            inProgress: true,
            ...upgradeCurrentProgress
        };
    }

    console.log('='.repeat(60));
    console.log('🚀 開始升級收藏視頻到 HD');
    console.log('='.repeat(60));
    console.log('');

    // 設定狀態
    upgradeInProgress = true;
    upgradeAbortRequested = false;
    upgradeCurrentProgress = { current: 0, total: 0, success: 0, fail: 0 };

    const API_UPSCALE_URL = 'https://grok.com/rest/media/video/upscale';

    // Use cached scan results if available (from scanFavoritesForUpgrade), otherwise rescan
    let videosNeedUpgrade;
    let allVideosCount;

    if (upgradeScanCache && (Date.now() - upgradeScanCache.timestamp < 5 * 60 * 1000)) {
        console.log('  ✅ 使用掃描緩存，跳過重複掃描');
        videosNeedUpgrade = upgradeScanCache.videos;
        allVideosCount = videosNeedUpgrade.length; // approximate, used only for logging
        upgradeScanCache = null; // clear cache after use
    } else {
        console.log('  ⚠️ 無緩存，重新掃描...');
        upgradeScanCache = null;

        await SystemLogger.info('HD upgrade started', 'Scanning favorites...');

        const API_LIST_URL = 'https://grok.com/rest/media/post/list';
        const allVideos = [];
        let cursor = null;

        chrome.runtime.sendMessage({
            action: 'upgradeProgress',
            status: 'scanning',
            message: 'scanning_favorites'
        });

        try {
            while (true) {
                const payload = {
                    limit: 40,
                    filter: {
                        source: "MEDIA_POST_SOURCE_LIKED"
                    }
                };

                if (cursor) {
                    payload.cursor = cursor;
                }

                const response = await fetch(API_LIST_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) break;

                const data = await response.json();
                const posts = data.posts || [];

                if (posts.length === 0) break;

                const flattened = GrokUtils.flattenPosts(posts);
                const videos = flattened.filter(p => p.mediaType === 'MEDIA_POST_TYPE_VIDEO');

                allVideos.push(...videos);

                console.log(`  ✓ 掃描中... 已找到 ${allVideos.length} 個視頻`);

                if (!data.nextCursor) break;
                cursor = data.nextCursor;

                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (error) {
            console.error('❌ 獲取收藏列表失敗:', error);
            upgradeInProgress = false;
            chrome.runtime.sendMessage({ action: 'upgradeProgress', status: 'idle' });
            return { success: false, error: error.message };
        }

        if (upgradeAbortRequested) {
            console.log('⚠️ 升級被使用者中斷（掃描階段）');
            upgradeInProgress = false;
            upgradeAbortRequested = false;
            chrome.runtime.sendMessage({ action: 'upgradeProgress', status: 'idle' });
            return { success: false, error: 'aborted', aborted: true };
        }

        videosNeedUpgrade = allVideos.filter(v => !v.hdMediaUrl && v.resolutionName !== '720p');
        allVideosCount = allVideos.length;
    }

    // Apply time filter if specified
    if (options.hoursLimit) {
        const cutoffTime = Date.now() - (options.hoursLimit * 60 * 60 * 1000);
        videosNeedUpgrade = videosNeedUpgrade.filter(v => {
            if (!v.createTime) return false;
            return new Date(v.createTime).getTime() >= cutoffTime;
        });
        console.log(`  🕐 時間過濾 (${options.hoursLimit}h): ${videosNeedUpgrade.length} 個`);
    }

    console.log(`  🔍 需要升級: ${videosNeedUpgrade.length} 個`);

    await SystemLogger.info('HD upgrade started', `${videosNeedUpgrade.length} videos to upgrade`);

    if (videosNeedUpgrade.length === 0) {
        upgradeInProgress = false;
        chrome.runtime.sendMessage({ action: 'upgradeProgress', status: 'idle' });
        await SystemLogger.ok('HD upgrade completed', 'All videos already have HD version');
        return { success: true, upgradedCount: 0, total: 0 };
    }

    // 3. 逐個升級
    let successCount = 0;
    let failCount = 0;

    // 更新總數
    upgradeCurrentProgress.total = videosNeedUpgrade.length;

    for (let i = 0; i < videosNeedUpgrade.length; i++) {
        // 檢查是否被中斷
        if (upgradeAbortRequested) {
            console.log('⚠️ 升級被使用者中斷');
            upgradeInProgress = false;
            upgradeAbortRequested = false;
            chrome.runtime.sendMessage({ action: 'upgradeProgress', status: 'idle' });
            return {
                success: false,
                error: 'aborted',
                aborted: true,
                upgradedCount: successCount,
                failCount: failCount,
                total: videosNeedUpgrade.length
            };
        }

        const video = videosNeedUpgrade[i];

        // 更新進度追蹤
        upgradeCurrentProgress = {
            current: i + 1,
            total: videosNeedUpgrade.length,
            success: successCount,
            fail: failCount
        };

        // 通知進度
        chrome.runtime.sendMessage({
            action: 'upgradeProgress',
            status: 'upgrading',
            current: i + 1,
            total: videosNeedUpgrade.length,
            success: successCount,
            fail: failCount
        });

        console.log(`[${i + 1}/${videosNeedUpgrade.length}] 升級視頻 ID: ${video.id}`);

        // Fire-and-forget: send request without waiting for response
        fetch(API_UPSCALE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: video.id })
        }).then(response => {
            if (response.ok) {
                console.log(`  ✓ 升級請求成功: ${video.id}`);
            } else {
                console.error(`  ✗ 升級請求失敗: ${video.id} - HTTP ${response.status}`);
            }
        }).catch(error => {
            console.error(`  ✗ 請求錯誤: ${video.id} - ${error.message}`);
        });
        successCount++;

        // 延遲 2 秒，避免過於頻繁
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 完成，重置狀態
    upgradeInProgress = false;
    chrome.runtime.sendMessage({ action: 'upgradeProgress', status: 'idle' });

    await SystemLogger.info('HD upgrade completed', `Success: ${successCount}, Failed: ${failCount}, Total: ${videosNeedUpgrade.length}`);

    // 重新整理頁面以更新 HD 狀態
    if (successCount > 0) {
        console.log('刷新頁面以更新 HD 狀態...');
        setTimeout(() => {
            window.location.href = 'https://grok.com/imagine/saved';
        }, 1500);
    }

    return {
        success: true,
        upgradedCount: successCount,
        failCount: failCount,
        total: videosNeedUpgrade.length
    };
}

// 掃描收藏視頻，檢查有多少需要升級到 HD（不執行升級）
async function scanFavoritesForUpgrade(options = {}) {
    console.log('='.repeat(60));
    console.log('🔍 掃描收藏視頻 HD 升級狀態');
    console.log('='.repeat(60));
    console.log('');

    const API_LIST_URL = 'https://grok.com/rest/media/post/list';

    const allVideos = [];
    let cursor = null;

    try {
        while (true) {
            const payload = {
                limit: 40,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            };

            if (cursor) {
                payload.cursor = cursor;
            }

            const response = await fetch(API_LIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) break;

            const data = await response.json();
            const posts = data.posts || [];

            if (posts.length === 0) break;

            const flattened = GrokUtils.flattenPosts(posts);
            const videos = flattened.filter(p => p.mediaType === 'MEDIA_POST_TYPE_VIDEO');

            allVideos.push(...videos);

            console.log(`  ✓ 掃描中... 已找到 ${allVideos.length} 個視頻`);

            if (!data.nextCursor) break;
            cursor = data.nextCursor;

            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('❌ 掃描失敗:', error);
        return { success: false, error: error.message };
    }

    const videosNeedUpgrade = allVideos.filter(v => !v.hdMediaUrl && v.resolutionName !== '720p');
    const native720p = allVideos.filter(v => !v.hdMediaUrl && v.resolutionName === '720p').length;
    const alreadyHD = allVideos.length - videosNeedUpgrade.length;

    console.log(`  📊 掃描完成:`);
    console.log(`     總視頻數: ${allVideos.length}`);
    console.log(`     已是 HD: ${alreadyHD}`);
    if (native720p > 0) {
        console.log(`     原生 720p: ${native720p}`);
    }
    console.log(`     需要升級: ${videosNeedUpgrade.length}`);

    // Apply time filter if specified
    let needUpgradeFiltered = videosNeedUpgrade.length;
    if (options.hoursLimit) {
        const cutoffTime = Date.now() - (options.hoursLimit * 60 * 60 * 1000);
        const timeFiltered = videosNeedUpgrade.filter(v => {
            if (!v.createTime) return false;
            return new Date(v.createTime).getTime() >= cutoffTime;
        });
        needUpgradeFiltered = timeFiltered.length;
        console.log(`     時間過濾 (${options.hoursLimit}h): ${needUpgradeFiltered}`);
    }

    // Cache scan results for upgradeFavoritesToHD to reuse
    upgradeScanCache = { videos: videosNeedUpgrade, timestamp: Date.now() };

    return {
        success: true,
        total: allVideos.length,
        alreadyHD: alreadyHD,
        native720p: native720p,
        needUpgrade: videosNeedUpgrade.length,
        needUpgradeFiltered: needUpgradeFiltered,
        hoursLimit: options.hoursLimit || null
    };
}

// 處理當前視頻
async function handleCurrentVideo() {
    console.log('='.repeat(60));
    console.log('📥 處理當前視頻');
    console.log('='.repeat(60));
    console.log('');

    const state = await loadState();

    if (!state || !state.videos) {
        console.log('❌ 沒有狀態');
        return;
    }

    const currentUrl = window.location.href;
    const currentVideoId = ContentUtils.extractPostIdFromUrl(currentUrl);

    if (!currentVideoId) {
        console.log('❌ 不在詳情頁');
        return;
    }
    const videoIndex = state.videos.findIndex(v => v.id === currentVideoId);

    if (videoIndex === -1) {
        console.log('❌ 視頻不在列表中');
        return;
    }

    console.log(`當前視頻: ${videoIndex + 1}/${state.videos.length}`);
    console.log(`ID: ${currentVideoId}`);
    console.log('');

    state.currentIndex = videoIndex;
    await saveState(state);

    // 檢查是否已在歷史中
    const inHistory = await isInHistory(currentVideoId);

    if (inHistory && state.skipDownloaded !== false) {
        console.log('⊘ 已下載過，跳過');
        console.log('');

        // 直接跳到下一個
        await new Promise(resolve => setTimeout(resolve, 1000));
        await goToNextVideo();
        return;
    }

    const success = await findAndClickDownloadButton();

    if (success) {
        console.log('✅ 下載按鈕已點擊');

        // 添加到歷史記錄（永久保存）
        await addToHistory(currentVideoId);

        // 也添加到當前會話
        if (!state.downloadedVideos.includes(currentVideoId)) {
            state.downloadedVideos.push(currentVideoId);
        }

        // 更新視頻的下載狀態
        const videoIndex = state.videos.findIndex(video => video.id === currentVideoId);
        if (videoIndex !== -1) {
            state.videos[videoIndex].downloaded = true;
            state.videos[videoIndex].downloadedAt = Date.now();
        }

        await saveState(state);
    } else {
        console.log('❌ 無法找到或點擊下載按鈕');
        state.failed.push({
            id: currentVideoId,
            error: '找不到下載按鈕'
        });
        await saveState(state);
    }

    console.log('');

    await new Promise(resolve => setTimeout(resolve, 3000));

    await goToNextVideo();
}

// ==========================================
// Project 模式下載
// ==========================================

/**
 * 檢查單一專案是否有檔案需要下載
 * @param {Object} project - 專案物件
 * @param {Set} history - 下載歷史 Set
 * @param {Object} options - { hdPriority, includeImages, includeVideos, fromTimestamp, toTimestamp, hoursLimit }
 * @returns {boolean} 是否有檔案需要下載
 */
function projectHasFilesToDownload(project, history, options = {}) {
    const { hdPriority = true, includeImages = true, includeVideos = true } = options;
    const hoursCutoff = options.hoursLimit ? Date.now() - (options.hoursLimit * 60 * 60 * 1000) : null;

    const isInDateRange = (createTime) => {
        if (hoursCutoff) {
            if (!createTime) return true;
            return new Date(createTime).getTime() >= hoursCutoff;
        }
        if (!options.fromTimestamp && !options.toTimestamp) return true;
        if (!createTime) return true;
        const t = new Date(createTime).getTime();
        if (options.fromTimestamp && t < options.fromTimestamp) return false;
        if (options.toTimestamp && t > options.toTimestamp) return false;
        return true;
    };

    // 檢查 parent
    if (project.parent && project.parent.mediaUrl) {
        const parentId = project.parent.postId || project.parent.id;
        if (!history.has(parentId)) return true;
    }

    // 檢查 children
    const filteredChildren = (project.children || []).filter(child => isInDateRange(child.createTime));
    if ((options.fromTimestamp || options.toTimestamp) && filteredChildren.length === 0) return false;

    for (const child of filteredChildren) {
        const childId = child.postId || child.id;
        const isChildImage = child.mediaType === 'MEDIA_POST_TYPE_IMAGE';

        if (isChildImage && !includeImages) continue;
        if (!isChildImage && !includeVideos) continue;

        if (isChildImage) {
            if (child.mediaUrl && !history.has(childId)) return true;
        } else {
            if (hdPriority) {
                const hasHd = !!child.hdMediaUrl;
                const isNative720p = !hasHd && child.resolutionName === '720p';
                const quality = (hasHd || isNative720p) ? 'hd' : 'sd';
                if ((hasHd ? child.hdMediaUrl : child.mediaUrl) && !history.has(`${childId}_${quality}`)) return true;
            } else {
                const isNative720p = !child.hdMediaUrl && child.resolutionName === '720p';
                if (isNative720p) {
                    if (child.mediaUrl && !history.has(`${childId}_hd`)) return true;
                } else {
                    if (child.mediaUrl && !history.has(`${childId}_sd`)) return true;
                    if (child.hdMediaUrl && !history.has(`${childId}_hd`)) return true;
                }
            }
        }
    }

    return false;
}

/**
 * 計算需要下載的專案數量
 */
function countProjectsNeedDownload(projects, history, filterOptions) {
    const options = {
        hdPriority: filterOptions?.hdPriority !== false,
        includeImages: filterOptions?.includeImages !== false,
        includeVideos: filterOptions?.includeVideos !== false,
        fromTimestamp: filterOptions?.fromDate || null,
        toTimestamp: filterOptions?.toDate || null,
        hoursLimit: filterOptions?.hoursLimit || null
    };
    let count = 0;
    for (const project of projects) {
        if (projectHasFilesToDownload(project, history, options)) count++;
    }
    return count;
}

/**
 * 下載專案（Project 模式）
 * 每個專案包含：source image + generated videos + metadata.json
 */
async function downloadProjects() {
    const state = await loadState();

    if (!state || !state.projects || state.projects.length === 0) {
        console.log('⊘ 沒有專案需要下載');
        await finishAllDownloads();
        return;
    }

    const history = await ensureHistoryCache();
    const hdPriority = state.filterOptions?.hdPriority !== false;
    const includeImages = state.filterOptions?.includeImages !== false;
    const includeVideos = state.filterOptions?.includeVideos !== false;
    const fromTimestamp = state.filterOptions?.fromDate || null;
    const toTimestamp = state.filterOptions?.toDate || null;
    const hoursLimit = state.filterOptions?.hoursLimit || null;
    const hoursCutoff = hoursLimit ? Date.now() - (hoursLimit * 60 * 60 * 1000) : null;

    // Helper: 檢查時間是否在範圍內
    const isInDateRange = (createTime) => {
        if (hoursCutoff) {
            if (!createTime) return true;
            return new Date(createTime).getTime() >= hoursCutoff;
        }
        if (!fromTimestamp && !toTimestamp) return true; // 沒有時間限制
        if (!createTime) return true; // 沒有時間資訊，預設通過
        const itemTimestamp = new Date(createTime).getTime();
        if (fromTimestamp && itemTimestamp < fromTimestamp) return false;
        if (toTimestamp && itemTimestamp > toTimestamp) return false;
        return true;
    };

    console.log('='.repeat(60));
    console.log('📂 開始批量下載專案');
    console.log('='.repeat(60));
    console.log(`HD 優先模式: ${hdPriority ? '✅ 開啟' : '❌ 關閉'}`);
    if (fromTimestamp || toTimestamp) {
        console.log(`📅 時間過濾: ${fromTimestamp ? new Date(fromTimestamp).toLocaleDateString() : '不限'} ~ ${toTimestamp ? new Date(toTimestamp).toLocaleDateString() : '不限'}`);
    }
    console.log(`總專案: ${state.projects.length} 個`);
    console.log('');

    await SystemLogger.info('Project download started', `Total: ${state.projects.length} projects, HD Priority: ${hdPriority}`);

    // 批量下載專案
    let successCount = 0;
    let failCount = 0;
    let videoDownloadCount = 0; // Track video downloads across projects for rate limit
    let rateLimitHit = false;
    const paths = await getDownloadPaths();

    // 更新下載進度
    downloadCurrentProgress = { phase: 'projects', current: 0, total: state.projects.length, success: 0, fail: 0 };

    for (let i = 0; i < state.projects.length; i++) {
        // 檢查是否被中斷
        if (downloadAbortRequested) {
            console.log('⚠️ 下載被使用者中斷（專案階段）');
            // Save in-memory state before abort (downloadedProjects may not be persisted due to batched saves)
            await saveState(state);
            await handleDownloadAbort(successCount, failCount, 'projects');
            return;
        }

        const project = state.projects[i];
        // 更新進度
        downloadCurrentProgress = { phase: 'projects', current: i + 1, total: state.projects.length, success: successCount, fail: failCount };

        // 跳過已全部下載的專案（per-file history 檢查）
        if (!projectHasFilesToDownload(project, history, {
            hdPriority, includeImages, includeVideos,
            fromTimestamp, toTimestamp, hoursLimit
        })) {
            continue;
        }

        const projectFolder = `grok_downloads/projects/${project.folderName}`;

        console.log(`[${i + 1}/${state.projects.length}] 📂 ${project.folderName}`);

        try {
            // Helper: 取得檔案名稱用的 prompt 後綴（優先 originalPrompt，其次 prompt）
            const getPromptSuffix = (item, maxLen = 60) => {
                const prompt = item.originalPrompt || item.prompt || '';
                if (!prompt) return '';
                return '_' + GrokUtils.sanitizePromptForFilename(prompt, maxLen, '');
            };

            // 過濾符合時間範圍的 children
            const filteredChildren = (project.children || []).filter(child =>
                isInDateRange(child.createTime)
            );

            // 如果有時間過濾且沒有符合條件的 children，跳過此專案
            if ((fromTimestamp || toTimestamp) && filteredChildren.length === 0) {
                console.log(`  ⏭️  無符合時間範圍的 children，跳過`);
                continue;
            }

            // 1. 下載 parent（source image）
            // 只在有符合條件的 children 時才下載 parent
            if (project.parent && project.parent.mediaUrl) {
                const parentId = project.parent.postId || project.parent.id;
                const parentExt = GrokUtils.getExtFromMediaUrl(project.parent.mediaUrl, 'png');
                const parentPromptSuffix = getPromptSuffix(project.parent, 80);

                if (!history.has(parentId)) {
                    console.log(`  📷 下載來源圖片...`);
                    await chrome.runtime.sendMessage({
                        action: 'download',
                        url: project.parent.mediaUrl,
                        filename: `${projectFolder}/source${parentPromptSuffix}.${parentExt}`
                    });
                    await addToHistory(parentId);
                }
            }

            // 2. 下載 children（可能是 image edits 或 videos）
            // 檔名格式：[type]_[quality]_[prompt]_[postId後8碼].[ext]
            // 使用 postId 作為唯一標識，避免新增/刪除 children 時檔名變動
            if (filteredChildren.length > 0) {
                for (let j = 0; j < filteredChildren.length; j++) {
                    const child = filteredChildren[j];
                    const childId = child.postId || child.id;
                    const shortId = childId.slice(-8);
                    const isChildImage = child.mediaType === 'MEDIA_POST_TYPE_IMAGE';
                    const childPromptSuffix = getPromptSuffix(child, 60);

                    if (isChildImage && !includeImages) {
                        continue; // 使用者未選擇下載圖片，跳過
                    }
                    if (!isChildImage && !includeVideos) {
                        continue; // 使用者未選擇下載影片，跳過
                    }

                    if (isChildImage) {
                        // 處理 image edit children
                        // 格式：image_[prompt]_[postId後8碼].jpg
                        const imgExt = GrokUtils.getExtFromMediaUrl(child.mediaUrl, 'jpg');

                        if (child.mediaUrl && !history.has(childId)) {
                            console.log(`  🖼️  下載衍生圖片 ${shortId}...`);
                            await chrome.runtime.sendMessage({
                                action: 'download',
                                url: child.mediaUrl,
                                filename: `${projectFolder}/image${childPromptSuffix}_${shortId}.${imgExt}`
                            });
                            await addToHistory(childId);
                        }
                    } else {
                        // 處理 video children
                        // 格式：video_[sd/hd]_[prompt]_[postId後8碼].mp4
                        if (hdPriority) {
                            // HD 優先模式：只下載一個版本（優先 HD）
                            const hasHd = !!child.hdMediaUrl;
                            const isNative720p = !hasHd && child.resolutionName === '720p';
                            const downloadUrl = hasHd ? child.hdMediaUrl : child.mediaUrl;
                            const quality = (hasHd || isNative720p) ? 'hd' : 'sd';
                            const historyKey = `${childId}_${quality}`;

                            if (downloadUrl && !history.has(historyKey)) {
                                console.log(`  🎬 下載視頻 ${shortId} (${quality.toUpperCase()})...`);
                                await chrome.runtime.sendMessage({
                                    action: 'download',
                                    url: downloadUrl,
                                    filename: `${projectFolder}/video_${quality}${childPromptSuffix}_${shortId}.mp4`
                                });
                                await addToHistory(historyKey);
                                videoDownloadCount++;
                            }
                        } else {
                            // 非 HD 優先模式：下載兩個版本（SD + HD）
                            const isChildNative720p = !child.hdMediaUrl && child.resolutionName === '720p';

                            if (isChildNative720p) {
                                // 原生 720p：只有一個版本，以 HD 品質下載
                                if (child.mediaUrl && !history.has(`${childId}_hd`)) {
                                    console.log(`  🎬 下載視頻 ${shortId} (720p 原生 HD)...`);
                                    await chrome.runtime.sendMessage({
                                        action: 'download',
                                        url: child.mediaUrl,
                                        filename: `${projectFolder}/video_hd${childPromptSuffix}_${shortId}.mp4`
                                    });
                                    await addToHistory(`${childId}_hd`);
                                    videoDownloadCount++;
                                }
                            } else {
                                // 下載 SD 版本
                                if (child.mediaUrl && !history.has(`${childId}_sd`)) {
                                    console.log(`  🎬 下載視頻 ${shortId} (SD)...`);
                                    await chrome.runtime.sendMessage({
                                        action: 'download',
                                        url: child.mediaUrl,
                                        filename: `${projectFolder}/video_sd${childPromptSuffix}_${shortId}.mp4`
                                    });
                                    await addToHistory(`${childId}_sd`);
                                    videoDownloadCount++;
                                }

                                // 下載 HD 版本（如果有）
                                if (child.hdMediaUrl && !history.has(`${childId}_hd`)) {
                                    console.log(`  🎬 下載視頻 ${shortId} (HD)...`);
                                    await chrome.runtime.sendMessage({
                                        action: 'download',
                                        url: child.hdMediaUrl,
                                        filename: `${projectFolder}/video_hd${childPromptSuffix}_${shortId}.mp4`
                                    });
                                    await addToHistory(`${childId}_hd`);
                                    videoDownloadCount++;
                                }
                            }
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Check rate limit after each video download
                    if (videoDownloadCount > 0 && videoDownloadCount % VIDEO_DOWNLOAD_RATE_LIMIT === 0) {
                        rateLimitHit = true;
                        break; // break children loop
                    }
                }
            }

            // If rate limit hit during children download, break project loop
            if (rateLimitHit) {
                // Save progress for current project before pausing
                state.currentIndex = i;
                await saveState(state);
                await flushHistory();
                break;
            }

            // 3. 下載 metadata.json
            // 使用 parent.id + 過濾後的 children 數量作為 key
            const parentId = project.parent?.postId || project.parent?.id || project.folderName;
            const childrenCount = filteredChildren.length;
            const metadataKey = `project_${parentId}_c${childrenCount}`;

            if (!history.has(metadataKey)) {
                const metadata = GrokUtils.generateProjectMetadata(project);
                const metadataUrl = GrokUtils.generateJsonDataUrl(metadata);
                await chrome.runtime.sendMessage({
                    action: 'download',
                    url: metadataUrl,
                    filename: `${projectFolder}/metadata.json`,
                    overwrite: true
                });
                await addToHistory(metadataKey);
            }

            // 記錄已下載的專案
            if (!state.downloadedProjects) state.downloadedProjects = [];
            if (!state.downloadedProjects.includes(project.folderName)) {
                state.downloadedProjects.push(project.folderName);
            }

            console.log('  ✓ 專案下載成功');
            successCount++;
            await SystemLogger.ok('Project downloaded', `[${i + 1}/${state.projects.length}] ${project.folderName}`);

            // 每 10 個項目或最後一個才寫入狀態和歷史
            state.currentIndex = i;
            if ((i + 1) % 10 === 0 || i === state.projects.length - 1) {
                await saveState(state);
                await flushHistory();
            }

            // 延遲以避免過快請求
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.log('  ✗ 專案下載失敗:', error.message);
            state.failed.push({
                id: project.folderName,
                type: 'project',
                error: error.message
            });
            failCount++;
            await SystemLogger.fail('Project download failed', `${project.folderName} - ${error.message}`);
            // 錯誤時也按批次保存
            if ((i + 1) % 10 === 0 || i === state.projects.length - 1) {
                await saveState(state);
                await flushHistory();
            }
        }
    }

    // Rate limit pause triggered during project download
    if (rateLimitHit) {
        await handleRateLimitPause(videoDownloadCount, failCount, 'projects');
        return;
    }

    console.log('');
    console.log('📊 專案下載完成');
    console.log(`  成功: ${successCount}/${state.projects.length}`);
    console.log(`  失敗: ${failCount}/${state.projects.length}`);
    console.log('');

    await SystemLogger.info('Project download completed', `Success: ${successCount}, Failed: ${failCount}`);

    await finishAllDownloads();
}

// 完成所有下載
// 處理下載中斷
async function handleDownloadAbort(successCount, failCount, phase) {
    // 中斷時確保歷史快取寫入 storage
    await flushHistory();

    downloadInProgress = false;
    downloadAbortRequested = false;
    downloadCurrentProgress = { phase: 'idle', current: 0, total: 0, success: 0, fail: 0 };

    const state = await loadState();
    if (state) {
        state.completed = false;
        state.aborted = true;
        state.abortedAt = Date.now();
        await saveState(state);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('⚠️ 下載已中斷');
    console.log('='.repeat(60));
    console.log(`階段: ${phase}`);
    console.log(`成功: ${successCount}`);
    console.log(`失敗: ${failCount}`);
    console.log('');

    await SystemLogger.warn('Download cancelled by user', `Phase: ${phase}, Success: ${successCount}, Failed: ${failCount}`);

    // 通知 popup
    chrome.runtime.sendMessage({
        action: 'downloadProgress',
        status: 'aborted',
        phase: phase,
        success: successCount,
        fail: failCount
    });
}

async function handleRateLimitPause(successCount, failCount, phase) {
    // Rate limit pause: save progress and stop downloading so user can resume later
    await flushHistory();

    downloadInProgress = false;
    downloadCurrentProgress = { phase: 'idle', current: 0, total: 0, success: 0, fail: 0 };

    const state = await loadState();
    if (state) {
        state.completed = false;
        state.rateLimitPaused = true;
        state.rateLimitPausedAt = Date.now();
        await saveState(state);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`⏸️ Rate limit pause: ${successCount} videos downloaded`);
    console.log('='.repeat(60));
    console.log(`Phase: ${phase}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('💡 Click "Start Download" again to continue');
    console.log('');

    await SystemLogger.warn('Rate limit pause', `Phase: ${phase}, Downloaded: ${successCount}, Failed: ${failCount}. Click Start Download to continue.`);

    // Notify popup
    chrome.runtime.sendMessage({
        action: 'downloadProgress',
        status: 'rateLimitPaused',
        phase: phase,
        success: successCount,
        fail: failCount,
        limit: VIDEO_DOWNLOAD_RATE_LIMIT
    });
}

async function finishAllDownloads() {
    // 確保歷史快取寫入 storage
    await flushHistory();

    // 重置下載狀態
    downloadInProgress = false;
    downloadAbortRequested = false;
    downloadCurrentProgress = { phase: 'idle', current: 0, total: 0, success: 0, fail: 0 };

    const state = await loadState();

    if (!state) {
        return;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 所有下載已完成！');
    console.log('='.repeat(60));
    console.log('');

    const duration = ((Date.now() - state.startTime) / 1000 / 60).toFixed(1);

    const totalItems = (state.images?.length || 0) + (state.videos?.length || 0);
    const totalDownloaded = (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);

    console.log(`✓ 成功: ${totalDownloaded}/${totalItems}`);
    if (state.images?.length > 0) {
        console.log(`  🖼️  圖片: ${state.downloadedImages?.length || 0}/${state.images.length}`);
    }
    if (state.videos?.length > 0) {
        console.log(`  🎬 視頻: ${state.downloadedVideos?.length || 0}/${state.videos.length}`);
    }
    console.log(`✗ 失敗: ${state.failed.length}/${totalItems}`);
    console.log(`⏱️  耗時: ${duration} 分鐘`);
    console.log('');

    if (state.failed.length > 0) {
        console.log('失敗的項目:');
        state.failed.forEach(item => {
            const typeIcon = item.type === 'image' ? '🖼️' : '🎬';
            console.log(`  ${typeIcon} ${item.id}: ${item.error}`);
        });
        console.log('');
    }

    // 標記為完成
    state.completed = true;
    state.completedAt = Date.now();
    await saveState(state);

    await SystemLogger.info('Download completed', `Success: ${totalDownloaded}, Failed: ${state.failed.length}, Duration: ${duration} min`);

    console.log('下載完成，狀態保留直到使用者手動清除');
}

// 跳到下一個視頻
async function goToNextVideo() {
    const state = await loadState();

    if (!state || !state.videos) {
        return;
    }

    const nextIndex = state.currentIndex + 1;
    const historySet = await ensureHistoryCache();
    const remainingVideos = state.videos.slice(nextIndex).filter(v => !historySet.has(v.id));

    if (remainingVideos.length === 0) {
        console.log('');
        console.log('✅ 所有視頻已下載！');
        await finishAllDownloads();
        return;
    }

    const nextVideo = remainingVideos[0];
    const actualNextIndex = state.videos.findIndex(v => v.id === nextVideo.id);

    state.currentIndex = actualNextIndex;
    await saveState(state);

    console.log('➡️  導航到下一個視頻...');
    console.log(`下一個: ${actualNextIndex + 1}/${state.videos.length}`);
    console.log('');

    window.location.href = nextVideo.detailUrl;
}

// 自動運行
async function autoRun() {
    const currentUrl = window.location.href;

    if (currentUrl.includes('/imagine/post/')) {
        console.log('');
        console.log('🎬 Chrome Extension: 檢測到詳情頁');
        console.log('');



        // 如果沒有移除任務，檢查是否有下載任務
        const state = await loadState();

        if (state && state.videos && state.videos.length > 0) {
            console.log('🔄 下載模式啟動');
            console.log('');

            await handleCurrentVideo();
        }
    }
}

async function showStatus() {
    const state = await loadState();

    if (!state) {
        console.log('❌ 沒有進行中的任務');
        return state;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 當前狀態');
    console.log('='.repeat(60));
    console.log('');
    console.log(`總視頻數: ${state.videos?.length || 0}`);
    console.log(`當前進度: ${(state.currentIndex || 0) + 1}/${state.videos?.length || 0}`);
    console.log(`已處理: ${state.downloaded?.length || 0}`);
    console.log(`失敗: ${state.failed?.length || 0}`);
    console.log('');

    return state;
}

// 匯出數據
async function exportData() {
    const state = await loadState();
    const history = await getDownloadHistory();

    const exportData = {
        version: '1.1.0',
        exportTime: Date.now(),
        exportDate: new Date().toISOString(),
        history: history,
        currentState: state,
        statistics: {
            totalImages: state?.images?.length || 0,
            totalVideos: state?.videos?.length || 0,
            downloadedImages: state?.images?.filter(img => img.downloaded).length || 0,
            downloadedVideos: state?.videos?.filter(vid => vid.downloaded).length || 0,
            historyCount: history.length
        }
    };

    await SystemLogger.info('Data exported', `History: ${history.length} items`);

    return exportData;
}

// 匯入數據
async function importData(data) {
    try {
        // 驗證數據格式
        if (!data.version || !data.history) {
            throw new Error('無效的數據格式');
        }

        // 合併歷史記錄（去重）
        const currentHistory = await getDownloadHistory();
        const mergedHistory = [...new Set([...currentHistory, ...data.history])];
        await chrome.storage.local.set({ [HISTORY_KEY]: mergedHistory });
        // 重建快取以反映合併後的歷史
        historyCache = new Set(mergedHistory);

        // 如果有當前狀態，也匯入
        if (data.currentState) {
            await saveState(data.currentState);
        }

        console.log('✅ 數據匯入成功');
        console.log(`  歷史記錄: ${currentHistory.length} → ${mergedHistory.length}`);

        const newItems = mergedHistory.length - currentHistory.length;
        await SystemLogger.ok('Data imported', `History: ${currentHistory.length} → ${mergedHistory.length} (+${newItems})`);

        return {
            success: true,
            merged: {
                historyBefore: currentHistory.length,
                historyAfter: mergedHistory.length,
                newItems: newItems
            }
        };
    } catch (error) {
        console.error('❌ 數據匯入失敗:', error);
        await SystemLogger.fail('Data import failed', error.message);
        return { success: false, error: error.message };
    }
}

// 批量移除收藏
async function removeFavorites(options = {}) {
    console.log('='.repeat(60));
    console.log('🗑️  批量移除收藏');
    console.log('='.repeat(60));
    console.log('');

    await SystemLogger.info('Remove favorites scan started', 'Scanning favorites...');

    const { removeAll = false, fromDate = null, toDate = null, hoursLimit = null } = options;

    const API_URL = 'https://grok.com/rest/media/post/list';
    const allPosts = [];
    let cursor = null;

    // 1. 獲取所有收藏
    try {
        while (true) {
            const payload = {
                limit: 40,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            };

            if (cursor) {
                payload.cursor = cursor;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) break;

            const data = await response.json();
            const posts = data.posts || [];

            if (posts.length === 0) break;

            allPosts.push(...posts);
            console.log(`  ✓ 已獲取 ${allPosts.length} 個項目`);

            if (!data.nextCursor) break;
            cursor = data.nextCursor;

            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('❌ 獲取數據失敗:', error);
        return { success: false, error: error.message };
    }

    // 2. 過濾出要刪除的項目（根據日期範圍）
    let toRemove;
    if (removeAll) {
        // 移除全部
        toRemove = allPosts;
        console.log('📅 移除範圍: 全部');
    } else if (hoursLimit) {
        // 根據小時限制過濾
        const cutoffTime = Date.now() - (hoursLimit * 60 * 60 * 1000);
        toRemove = allPosts.filter(post => {
            if (!post.createTime) return false;
            return new Date(post.createTime).getTime() >= cutoffTime;
        });
        console.log(`🕐 移除範圍: 最近 ${hoursLimit} 小時`);
    } else {
        // 根據日期範圍過濾
        toRemove = allPosts.filter(post => {
            if (!post.createTime) return false;
            const itemTimestamp = new Date(post.createTime).getTime();

            // 檢查是否在日期範圍內
            if (fromDate && itemTimestamp < fromDate) return false;
            if (toDate && itemTimestamp > toDate) return false;

            return true;
        });

        const fromStr = fromDate ? new Date(fromDate).toLocaleDateString() : '∞';
        const toStr = toDate ? new Date(toDate).toLocaleDateString() : '∞';
        console.log(`📅 移除範圍: ${fromStr} ~ ${toStr}`);
    }

    console.log('');
    console.log(`📊 統計:`);
    console.log(`  總收藏數: ${allPosts.length}`);
    console.log(`  將移除: ${toRemove.length}`);
    console.log(`  保留: ${allPosts.length - toRemove.length}`);
    console.log('');

    if (toRemove.length === 0) {
        console.log('⊘ 沒有需要移除的收藏');
        return { success: true, toRemove: 0, total: allPosts.length };
    }

    // 3. 保存要移除的列表到狀態
    const removeState = {
        items: toRemove.map(item => ({
            id: item.id,
            type: item.mediaType === 'MEDIA_POST_TYPE_IMAGE' ? 'image' : 'video',
            createTime: item.createTime,
            detailUrl: `https://grok.com/imagine/post/${item.id}`
        })),
        currentIndex: 0,
        removed: [],
        failed: [],
        startTime: Date.now(),
        removeAll: removeAll,
        fromDate: fromDate,
        toDate: toDate,
        fromDateString: fromDate ? new Date(fromDate).toLocaleDateString() : null,
        toDateString: toDate ? new Date(toDate).toLocaleDateString() : null
    };

    await chrome.storage.local.set({ 'grok_remove_state': removeState });

    console.log('✅ 移除列表已生成');
    console.log('💡 請確認後開始移除操作');
    console.log('');

    await SystemLogger.ok('Remove favorites scan completed', `Found ${allPosts.length} favorites, ${toRemove.length} to remove`);

    return {
        success: true,
        toRemove: toRemove.length,
        total: allPosts.length,
        items: removeState.items
    };
}

// 開始移除收藏
async function startRemoveFavorites(deletePost = false) {
    const result = await chrome.storage.local.get('grok_remove_state');
    const state = result['grok_remove_state'];

    if (!state || !state.items || state.items.length === 0) {
        console.log('❌ 沒有移除列表');
        return { success: false, error: '沒有移除列表' };
    }

    // 保存選項
    state.deletePost = deletePost;

    console.log('='.repeat(60));
    console.log('🗑️  開始移除收藏 (API模式)');
    if (deletePost) {
        console.log('⚠️  同時刪除 POST');
    }
    console.log('='.repeat(60));
    console.log(`總數: ${state.items.length}`);
    console.log(`日期: ${state.beforeDateString} 之前`);
    console.log('');

    await SystemLogger.info('Remove favorites started', `Total: ${state.items.length}, Delete post: ${deletePost}`);

    // 重置進度
    state.currentIndex = 0;
    state.removed = [];
    state.failed = [];
    state.startTime = Date.now();
    await chrome.storage.local.set({ 'grok_remove_state': state });

    // 開始處理隊列 (不等待完成)
    processRemoveQueue();

    return { success: true };
}

// 處理移除隊列
async function processRemoveQueue() {
    const result = await chrome.storage.local.get('grok_remove_state');
    let state = result['grok_remove_state'];

    if (!state || !state.items || state.items.length === 0) {
        return;
    }

    const total = state.items.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = state.currentIndex; i < total; i++) {
        const item = state.items[i];
        console.log(`[${i + 1}/${total}] 正在處理 ID: ${item.id}`);

        try {
            // 1. Unlike (取消收藏)
            const unlikeResp = await fetch('https://grok.com/rest/media/post/unlike', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id })
            });

            if (unlikeResp.ok) {
                console.log('  ✓ 取消收藏成功');

                // 2. Delete Post (如果有勾選)
                if (state.deletePost) {
                    try {
                        const delResp = await fetch('https://grok.com/rest/media/post/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id })
                        });
                        if (delResp.ok) console.log('  ✓ Post 刪除成功');
                        else console.error('  ✗ Post 刪除失敗:', delResp.status);
                    } catch (e) {
                        console.error('  ✗ Post 刪除錯誤:', e);
                    }
                }

                state.removed.push(item.id);
                successCount++;
            } else {
                console.error(`  ✗ 取消收藏失敗: ${unlikeResp.status}`);
                state.failed.push(item.id);
                failCount++;
            }
        } catch (error) {
            console.error('  ✗ 請求錯誤:', error);
            state.failed.push(item.id);
            failCount++;
        }

        // 更新狀態
        state.currentIndex = i + 1;
        await chrome.storage.local.set({ 'grok_remove_state': state });

        // 發送進度更新給 popup
        chrome.runtime.sendMessage({
            action: 'removeProgress',
            current: i + 1,
            total: total,
            success: successCount,
            failed: failCount
        }).catch(() => {}); // 忽略錯誤（popup 可能已關閉）

        // 延遲以避免請求過於頻繁
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('='.repeat(60));
    console.log('🎉 移除任務完成');
    console.log(`成功: ${successCount}, 失敗: ${failCount}`);
    console.log('='.repeat(60));

    await SystemLogger.info('Remove favorites completed', `Success: ${successCount}, Failed: ${failCount}`);

    // 發送完成消息
    chrome.runtime.sendMessage({
        action: 'removeComplete',
        success: successCount,
        failed: failCount,
        total: total
    }).catch(() => {});

    // 清除狀態
    await chrome.storage.local.remove('grok_remove_state');

    // 重新載入頁面以更新列表
    console.log('刷新頁面...');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// ==========================================
// Batch Add: Fetch Recent IMAGE Posts
// ==========================================

async function fetchRecentImagePosts(hoursLimit = 24) {
    console.log('='.repeat(60));
    console.log('📥 Fetch Recent Image Posts for Queue');
    console.log(`   Time range: last ${hoursLimit} hours`);
    console.log('='.repeat(60));

    const API_URL = 'https://grok.com/rest/media/post/list';
    const cutoffTime = Date.now() - (hoursLimit * 60 * 60 * 1000);
    const imagePosts = [];
    let cursor = null;
    let totalScanned = 0;

    try {
        while (true) {
            const payload = {
                limit: 40,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            };

            if (cursor) {
                payload.cursor = cursor;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API returned HTTP ${response.status}`);
            }

            const data = await response.json();
            const posts = data.posts || [];

            if (posts.length === 0) break;

            let postsInRange = 0;

            for (const post of posts) {
                totalScanned++;

                if (!post.createTime) continue;
                const postTime = new Date(post.createTime).getTime();

                // Skip posts outside the time range (API may not return in strict chronological order)
                if (postTime < cutoffTime) continue;

                postsInRange++;

                // Only include top-level IMAGE posts (not children)
                // Child post IDs may redirect to parent page, causing URL mismatch in queue
                if (post.mediaType === 'MEDIA_POST_TYPE_IMAGE') {
                    imagePosts.push({ postId: post.id });
                }
            }

            console.log(`  ✓ Scanned ${totalScanned} posts, ${postsInRange} in range, found ${imagePosts.length} images so far`);

            // Stop if no posts in this batch were within range (all older than cutoff)
            if (postsInRange === 0) {
                console.log(`  ⏹ No posts in range in this batch, stopping scan`);
                break;
            }

            if (!data.nextCursor) break;
            cursor = data.nextCursor;

            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('❌ fetchRecentImagePosts failed:', error);
        return { success: false, error: error.message };
    }

    console.log(`📊 Result: ${imagePosts.length} image posts from last ${hoursLimit}h (scanned ${totalScanned} total)`);

    return {
        success: true,
        posts: imagePosts,
        totalScanned
    };
}

// 暴露全局函數
window.grokDownloader = {
    generateMediaList,
    startAutoDownload,
    showStatus,
    clearState,
    exportData,
    importData,
    removeFavorites,
    startRemoveFavorites
};

// 監聽來自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 定義此 listener 處理的 actions
    const handledActions = [
        'generateMedia', 'startDownload', 'getStatus', 'clearState', 'clearHistory',
        'getHistory', 'exportData', 'importData', 'removeFavorites', 'startRemoveFavorites',
        'getDownloadStatus', 'cancelDownload', 'getUpgradeStatus', 'cancelUpgrade',
        'scanFavoritesForUpgrade', 'upgradeFavoritesToHD', 'startStreamCapture', 'stopStreamCapture',
        'getCapturedImages', 'clearCapturedImages', 'enterBatchSelectMode', 'exitBatchSelectMode',
        'sendFrameToPage', 'captureVideo', 'findPageVideos', 'startVideoWatcher', 'stopVideoWatcher',
        'startQueue', 'pauseQueue', 'stopQueue', 'queueItemResult', 'queueResumeItem', 'queueProcessNext',
        'scanForDownload', 'fetchRecentImagePosts'
    ];

    // 如果不是此 listener 處理的 action，不返回 true，讓其他 listener 處理
    if (!handledActions.includes(request.action)) {
        return false;
    }

    (async () => {
        if (request.action === 'generateMedia') {
            // 立即回應，避免消息通道超時
            sendResponse({ success: true, status: 'generating' });

            // 異步執行生成列表
            try {
                const result = await generateMediaList(request.options);
                const hdPriority = request.options?.hdPriority !== false;

                if (result) {
                    const videoCount = hdPriority
                        ? result.videos.length
                        : result.videos.reduce((acc, v) => acc + (v.hdUrl ? 2 : 1), 0);

                    // 完成後存到 storage 通知 popup
                    await chrome.storage.local.set({
                        generateResult: {
                            success: true,
                            imageCount: result.images.length,
                            videoCount: videoCount,
                            timestamp: Date.now()
                        }
                    });
                } else {
                    await chrome.storage.local.set({
                        generateResult: {
                            success: false,
                            error: 'Generate failed',
                            timestamp: Date.now()
                        }
                    });
                }
            } catch (error) {
                console.error('generateMedia error:', error);
                await chrome.storage.local.set({
                    generateResult: {
                        success: false,
                        error: error.message,
                        timestamp: Date.now()
                    }
                });
            }
            return; // 已經 sendResponse 過了，直接返回
        } else if (request.action === 'startDownload') {
            const result = await startAutoDownload();
            sendResponse(result || { success: true });
        } else if (request.action === 'getStatus') {
            const state = await loadState();
            const history = await getDownloadHistory();
            sendResponse({
                state, history, historyCount: history.length,
                downloadProgress: downloadInProgress ? downloadCurrentProgress : null
            });
        } else if (request.action === 'clearState') {
            await clearState();
            sendResponse({ success: true });
        } else if (request.action === 'clearHistory') {
            await clearHistory();
            sendResponse({ success: true });
        } else if (request.action === 'getHistory') {
            const history = await getDownloadHistory();
            sendResponse({ history, count: history.length });
        } else if (request.action === 'exportData') {
            const data = await exportData();
            sendResponse({ success: true, data });
        } else if (request.action === 'importData') {
            const result = await importData(request.data);
            sendResponse(result);
        } else if (request.action === 'removeFavorites') {
            const result = await removeFavorites(request.options);
            sendResponse(result);
        } else if (request.action === 'startRemoveFavorites') {
            const result = await startRemoveFavorites(request.deletePost);
            sendResponse(result);
        } else if (request.action === 'getDownloadStatus') {
            sendResponse({
                inProgress: downloadInProgress,
                ...downloadCurrentProgress
            });
        } else if (request.action === 'cancelDownload') {
            if (downloadInProgress) {
                downloadAbortRequested = true;
                console.log('⚠️ 收到取消下載請求');
                sendResponse({ success: true, message: 'cancel_requested' });
            } else {
                sendResponse({ success: false, message: 'no_download_in_progress' });
            }
        } else if (request.action === 'getUpgradeStatus') {
            sendResponse({
                inProgress: upgradeInProgress,
                ...upgradeCurrentProgress
            });
        } else if (request.action === 'cancelUpgrade') {
            if (upgradeInProgress) {
                upgradeAbortRequested = true;
                console.log('⚠️ 收到取消升級請求');
                sendResponse({ success: true, message: 'cancel_requested' });
            } else {
                sendResponse({ success: false, message: 'no_upgrade_in_progress' });
            }
        } else if (request.action === 'scanFavoritesForUpgrade') {
            const result = await scanFavoritesForUpgrade({ hoursLimit: request.hoursLimit });
            sendResponse(result);
        } else if (request.action === 'upgradeFavoritesToHD') {
            const result = await upgradeFavoritesToHD({ hoursLimit: request.hoursLimit });
            sendResponse(result);
        } else if (request.action === 'startStreamCapture') {
            startStreamCapture();
            sendResponse({ success: true });
        } else if (request.action === 'stopStreamCapture') {
            stopStreamCapture();
            sendResponse({ success: true });
        } else if (request.action === 'getCapturedImages') {
            sendResponse({
                success: true,
                count: capturedImages.length,
                images: capturedImages,
                isCapturing: isCapturing
            });
        } else if (request.action === 'clearCapturedImages') {
            capturedImages = [];
            sendResponse({ success: true });
        }
        // Batch Select Delete handlers
        else if (request.action === 'enterBatchSelectMode') {
            const result = await enterBatchSelectMode();
            sendResponse(result);
        } else if (request.action === 'exitBatchSelectMode') {
            exitBatchSelectMode();
            sendResponse({ success: true });
        }
        // Video Studio handlers
        else if (request.action === 'sendFrameToPage') {
            // Download frame image for user to upload to Grok
            const result = await downloadFrameForUpload(request.dataUrl, request.filename);
            sendResponse(result);
        } else if (request.action === 'captureVideo') {
            // Capture video from page and store in IndexedDB
            const result = await captureVideoToStudio(request.videoUrl);
            sendResponse(result);
        } else if (request.action === 'findPageVideos') {
            // Find video elements on the page
            const videos = findPageVideos();
            sendResponse({
                success: true,
                videos: videos.map(v => ({
                    url: v.url,
                    width: v.width,
                    height: v.height,
                    duration: v.duration
                }))
            });
        } else if (request.action === 'startVideoWatcher') {
            startVideoWatcher();
            sendResponse({ success: true });
        } else if (request.action === 'stopVideoWatcher') {
            stopVideoWatcher();
            sendResponse({ success: true });
        }
        // ==========================================
        // Batch Add Recent Posts
        // ==========================================
        else if (request.action === 'fetchRecentImagePosts') {
            const result = await fetchRecentImagePosts(request.hoursLimit);
            sendResponse(result);
        }
        // ==========================================
        // Queue Processing Handlers
        // ==========================================
        else if (request.action === 'startQueue') {
            const result = await startQueueProcessing();
            sendResponse(result);
        } else if (request.action === 'pauseQueue') {
            pauseQueueProcessing();
            sendResponse({ success: true });
        } else if (request.action === 'stopQueue') {
            await stopQueueProcessing();
            sendResponse({ success: true });
        } else if (request.action === 'queueItemResult') {
            // Received from background.js after videoGenResult processing
            handleQueueItemResult(request);
            sendResponse({ success: true });
        } else if (request.action === 'queueResumeItem') {
            // Resume processing after error retry
            queueProcessingActive = true;
            await processQueueItem(request.queueItem, false);
            sendResponse({ success: true });
        } else if (request.action === 'queueProcessNext') {
            // Skip to next item after error skip
            if (request.nextItem) {
                await processQueueItem(request.nextItem, true);
            } else {
                queueProcessingActive = false;
                SystemLogger.info('Queue completed', 'All items processed');
                chrome.runtime.sendMessage({ action: 'queueProgressUpdate', allDone: true }).catch(() => {});
            }
            sendResponse({ success: true });
        } else if (request.action === 'scanForDownload') {
            const state = await loadState();
            const historySet = await ensureHistoryCache();
            const hdPriority = state.filterOptions?.hdPriority !== false;
            const isProjectMode = state.filterOptions?.downloadMode === 'project';

            const totalImages = state.images?.length || 0;
            const needImages = state.images?.filter(img => !historySet.has(img.id)).length || 0;

            // Use the same logic as actual download: GrokUtils.filterVideosForHdPriority
            const historyArray = Array.from(historySet);
            const needDownloadVideos = GrokUtils.filterVideosForHdPriority(state.videos || [], historyArray, hdPriority);

            let videoStats;
            if (hdPriority) {
                // HD priority: one file per video (HD if available, SD otherwise)
                const totalVideos = state.videos?.length || 0;
                const needVideos = needDownloadVideos.length;
                const needHd = needDownloadVideos.filter(v => v.hdUrl).length;
                const need720p = needDownloadVideos.filter(v => !v.hdUrl && v.resolutionName === '720p').length;
                const needSd = needVideos - needHd - need720p;
                const doneVideos = totalVideos - needVideos;
                videoStats = {
                    hdPriority: true,
                    total: totalVideos,
                    need: needVideos,
                    done: doneVideos,
                    needHd,
                    need720p,
                    needSd
                };
            } else {
                // Non-HD priority: SD + 720p + HD separately
                const allVideos = state.videos || [];
                const sdVideos = allVideos.filter(v => !v.hdUrl && v.resolutionName !== '720p');
                const native720pVideos = allVideos.filter(v => !v.hdUrl && v.resolutionName === '720p');
                const hdVideos = allVideos.filter(v => v.hdUrl);

                const totalSd = sdVideos.length;
                const needSd = sdVideos.filter(v => {
                    return !historySet.has(`${v.id}_sd`) && !historySet.has(v.id);
                }).length;
                const total720p = native720pVideos.length;
                const need720p = native720pVideos.filter(v => !historySet.has(`${v.id}_hd`)).length;
                const totalHd = hdVideos.length;
                const needHd = hdVideos.filter(v => !historySet.has(`${v.id}_hd`)).length;
                videoStats = {
                    hdPriority: false,
                    totalSd, needSd, doneSd: totalSd - needSd,
                    total720p, need720p, done720p: total720p - need720p,
                    totalHd, needHd, doneHd: totalHd - needHd
                };
            }

            const totalProjects = state.projects?.length || 0;
            // 用 per-file history 計算實際需要下載的專案數（不依賴 downloadedProjects 陣列）
            const needProjects = isProjectMode
                ? countProjectsNeedDownload(state.projects || [], historySet, state.filterOptions)
                : 0;
            const doneProjects = totalProjects - needProjects;

            sendResponse({
                success: true,
                mode: isProjectMode ? 'project' : 'standard',
                images: { total: totalImages, need: needImages, done: totalImages - needImages },
                videos: videoStats,
                projects: { total: totalProjects, need: needProjects, done: doneProjects }
            });
        }
    })();
    return true; // 保持消息通道開啟
});

// ==========================================
// Grok Video Studio - Video Capture & Frame Handling
// ==========================================

/**
 * Download a frame image for user to manually upload to Grok
 * @param {string} dataUrl - Base64 data URL of the frame
 * @param {string} filename - Suggested filename
 */
async function downloadFrameForUpload(dataUrl, filename = 'grok_frame.png') {
    try {
        const paths = await getDownloadPaths();
        await chrome.runtime.sendMessage({
            action: 'download',
            url: dataUrl,
            filename: `${paths.frames}/${filename}`
        });
        console.log(`[VideoStudio] Frame downloaded: ${filename}`);
        return { success: true, filename };
    } catch (error) {
        console.error('[VideoStudio] Failed to download frame:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Watch for new video elements on the page (MutationObserver)
 * Used to detect when Grok generates a new video
 */
let videoWatcher = null;
let watchedVideos = new Set();

function startVideoWatcher() {
    if (videoWatcher) return;

    console.log('[VideoStudio] Starting video watcher...');

    const callback = (mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        checkForNewVideos(node);
                    }
                });
            }
        }
    };

    videoWatcher = new MutationObserver(callback);
    videoWatcher.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    document.querySelectorAll('video').forEach(video => {
        trackVideoElement(video);
    });
}

function stopVideoWatcher() {
    if (videoWatcher) {
        videoWatcher.disconnect();
        videoWatcher = null;
        watchedVideos.clear();
        console.log('[VideoStudio] Video watcher stopped');
    }
}

function checkForNewVideos(node) {
    if (node.tagName === 'VIDEO') {
        trackVideoElement(node);
    }
    if (node.querySelectorAll) {
        node.querySelectorAll('video').forEach(trackVideoElement);
    }
}

function trackVideoElement(video) {
    const src = video.src || video.querySelector('source')?.src;
    if (!src || watchedVideos.has(src)) return;

    watchedVideos.add(src);
    console.log('[VideoStudio] New video detected:', src.substring(0, 100) + '...');

    // Notify background/sidepanel about new video
    chrome.runtime.sendMessage({
        action: 'newVideoDetected',
        videoUrl: src,
        timestamp: Date.now()
    }).catch(() => {});
}

/**
 * Capture a video from the current page and send to IndexedDB via background
 * @param {string} videoUrl - URL of the video to capture
 * @returns {Promise<{success: boolean, videoId?: string, error?: string}>}
 */
async function captureVideoToStudio(videoUrl) {
    console.log('[VideoStudio] Capturing video:', videoUrl.substring(0, 100) + '...');

    try {
        // Let background fetch and store the video directly (avoids 64MB message limit)
        const result = await chrome.runtime.sendMessage({
            action: 'captureVideoFromUrl',
            videoUrl: videoUrl,
            metadata: {
                sourceUrl: videoUrl,
                capturedAt: Date.now()
            }
        });

        if (result.success) {
            console.log(`[VideoStudio] Video stored with ID: ${result.videoId}, Size: ${result.size}`);
            await SystemLogger.ok('Video captured to studio', `ID: ${result.videoId}, Size: ${result.size}`);

            // Auto-extract last frame after capture
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: result.videoId,
                position: 'last'
            }).catch(() => {});

            return { success: true, videoId: result.videoId };
        } else {
            throw new Error(result.error || 'Failed to store video');
        }
    } catch (error) {
        console.error('[VideoStudio] Video capture failed:', error);
        await SystemLogger.fail('Video capture failed', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Find video elements on the current page
 * @returns {Array<{url: string, element: HTMLVideoElement}>}
 */
function findPageVideos() {
    const videos = [];
    document.querySelectorAll('video').forEach(video => {
        const src = video.src || video.querySelector('source')?.src;
        if (src) {
            videos.push({
                url: src,
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
                element: video
            });
        }
    });
    return videos;
}

// ==========================================
// Stream Capture Logic
// ==========================================
let streamObserver = null;
let capturedImages = [];
let isCapturing = false;
const MIN_IMAGE_SIZE_KB = 120; // 最小圖片大小 (KB)
const MAX_CAPTURED_IMAGES = 1000; // 最大暫存數量

function startStreamCapture() {
    if (isCapturing) return;

    if (capturedImages.length >= MAX_CAPTURED_IMAGES) {
        alert(chrome.i18n.getMessage('msgStreamLimitReached', [MAX_CAPTURED_IMAGES]));
        return;
    }

    console.log('👀 開始串流擷取模式...');
    isCapturing = true;
    SystemLogger.info('Stream capture started', 'Watching for new images...');

    const callback = function (mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) checkForStreamImages(node);
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                checkForStreamImages(mutation.target);
            }
        }
    };

    streamObserver = new MutationObserver(callback);
    streamObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['src']
    });

    // 初始掃描
    document.querySelectorAll('img').forEach(checkForStreamImages);
}

function stopStreamCapture() {
    if (!isCapturing) return;

    console.log('🛑 停止串流擷取模式');
    SystemLogger.info('Stream capture stopped', `Captured ${capturedImages.length} images`);
    if (streamObserver) {
        streamObserver.disconnect();
        streamObserver = null;
    }
    isCapturing = false;
}

function checkForStreamImages(node) {
    if (node.tagName === 'IMG') {
        processStreamImage(node);
    }

    if (node.querySelectorAll) {
        const images = node.querySelectorAll('img');
        images.forEach(processStreamImage);
    }
}

function processStreamImage(img) {
    if (!isCapturing) return; // 雙重檢查

    // 檢查是否達到上限
    if (capturedImages.length >= MAX_CAPTURED_IMAGES) {
        stopStreamCapture();
        alert(chrome.i18n.getMessage('msgStreamLimitReached', [MAX_CAPTURED_IMAGES]));
        // 通知 popup 更新狀態 (關閉開關)
        chrome.runtime.sendMessage({
            action: 'streamCaptureStopped',
            reason: 'limit_reached'
        }).catch(() => { });
        return;
    }

    const src = img.src;

    // 只處理 Base64 圖片
    if (src && src.startsWith('data:image/')) {
        // 計算大小 (KB)
        const sizeInKB = Math.round((src.length * 0.75) / 1024);

        // 過濾過小的圖片
        if (sizeInKB >= MIN_IMAGE_SIZE_KB) {
            // 改進指紋邏輯：長度 + 前 50 字元 + 後 50 字元
            // 這樣可以區分即使開頭相同的不同圖片
            const len = src.length;
            const signature = `${len}-${src.substring(0, 50)}-${src.substring(len - 50)}`;

            const exists = capturedImages.some(item => item.signature === signature);

            if (!exists) {
                // 生成檔名
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const ext = src.substring(11, src.indexOf(';')); // data:image/png;... -> png

                capturedImages.push({
                    signature: signature,
                    src: src,
                    sizeKB: sizeInKB,
                    filename: `grok_stream_${timestamp}_${capturedImages.length + 1}.${ext}`,
                    timestamp: Date.now()
                });

                console.log(`📸 [Stream] 捕獲新圖片: ${sizeInKB}KB (總計: ${capturedImages.length}/${MAX_CAPTURED_IMAGES})`);

                // 通知 popup 更新計數 (如果 popup 開著)
                chrome.runtime.sendMessage({
                    action: 'streamImageCaptured',
                    count: capturedImages.length
                }).catch(() => { }); // 忽略錯誤 (popup 可能沒開)
            }
        }
    }
}

console.log('');
console.log('='.repeat(60));
console.log('🎬 Grok 視頻下載器 - Chrome Extension');
console.log('='.repeat(60));
console.log('');
console.log('💡 點擊擴展圖標打開控制面板');
console.log('');

// 等待頁面加載完成後自動運行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRun);
} else {
    setTimeout(autoRun, 1000);
}

// ==========================================
// Auto-upload frame to Grok Imagine
// ==========================================

/**
 * Check if we're on grok.com/imagine and have a pending frame to upload
 */
async function checkPendingFrameUpload() {
    const currentUrl = window.location.href;

    // Only run on grok.com/imagine (not on post detail pages)
    if (!currentUrl.includes('grok.com/imagine') || currentUrl.includes('/imagine/post/')) {
        return;
    }

    console.log('[Content] Checking for pending frame upload...');

    try {
        // Check if this is a batch request (has #batch=N in URL)
        const hashMatch = window.location.hash.match(/batch=(\d+)/);
        const batchIndex = hashMatch ? parseInt(hashMatch[1]) : null;

        // Determine which storage key to use
        let storageKey = 'pendingFrameUpload';
        let batchStateKey = 'batchGenerationState';

        if (batchIndex !== null) {
            storageKey = `pendingFrameUpload_${batchIndex}`;
            batchStateKey = `batchGenerationState_${batchIndex}`;
            console.log(`[Content] Batch mode detected, index: ${batchIndex}`);
        }

        const result = await chrome.storage.local.get([storageKey, batchStateKey]);
        const frameData = result[storageKey];

        if (!frameData || !frameData.dataUrl) {
            console.log('[Content] No pending frame upload found');
            return;
        }

        // Check if the frame is recent (within 60 seconds for batch mode)
        const maxAge = batchIndex !== null ? 60000 : 30000;
        const age = Date.now() - frameData.timestamp;
        if (age > maxAge) {
            console.log('[Content] Pending frame is too old, clearing...');
            await chrome.storage.local.remove([storageKey, batchStateKey]);
            return;
        }

        console.log('[Content] Found pending frame upload, uploading via API...');

        // Small delay to ensure page is ready
        await new Promise(r => setTimeout(r, 1000));

        // Upload the frame via API
        await uploadFrameToGrok(frameData);

        // Clear the pending upload
        await chrome.storage.local.remove(storageKey);
        console.log('[Content] Frame upload completed, cleared pending data');

    } catch (error) {
        console.error('[Content] Error checking pending frame upload:', error);
    }
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}

/**
 * Wait for the attach button to appear (using text content search)
 */
function waitForAttachButton(timeout = 15000) {
    return new Promise((resolve, reject) => {
        const checkButton = () => {
            // Try multiple ways to find the attach button
            const button = findButtonByText('附加') ||
                          findButtonByText('Attach') ||
                          document.querySelector('button[aria-label="附加"]') ||
                          document.querySelector('button[aria-label="Attach"]');
            return button;
        };

        const button = checkButton();
        if (button) {
            console.log('[Content] Attach button found immediately');
            resolve(button);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const btn = checkButton();
            if (btn) {
                obs.disconnect();
                console.log('[Content] Attach button found via observer');
                resolve(btn);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            // One final check
            const btn = checkButton();
            if (btn) {
                resolve(btn);
            } else {
                reject(new Error('Timeout waiting for attach button'));
            }
        }, timeout);
    });
}

/**
 * Convert data URL to File object
 */
function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Upload frame to Grok Imagine page via API
 */
async function uploadFrameToGrok(frameData) {
    console.log('[Content] Starting frame upload to Grok via API...');

    try {
        // Extract base64 content from data URL
        const base64Content = frameData.dataUrl.split(',')[1];

        const payload = {
            fileName: frameData.filename,
            fileMimeType: 'image/png',
            content: base64Content
        };

        console.log('[Content] Uploading file:', payload.fileName);

        const response = await fetch('https://grok.com/rest/app-chat/upload-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Upload failed: HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('[Content] Upload response:', result);

        if (result.fileMetadataId) {
            console.log('[Content] ✅ Frame uploaded successfully! fileMetadataId:', result.fileMetadataId);

            // Get userId from cookie
            const userId = document.cookie.match(/x-userid=([^;]+)/)?.[1];
            const mediaUrl = `https://assets.grok.com/users/${userId}/${result.fileMetadataId}/content`;

            // Create media post
            console.log('[Content] Creating media post...');
            const createResponse = await fetch('https://grok.com/rest/media/post/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    mediaType: 'MEDIA_POST_TYPE_IMAGE',
                    mediaUrl: mediaUrl
                })
            });

            const createResult = await createResponse.json();
            console.log('[Content] Create post response:', createResult);

            // Get the postId from the response
            const postId = createResult.postId || createResult.id || result.fileMetadataId;

            // Trigger video generation if prompt is provided or non-custom mode selected
            if (frameData.prompt || (frameData.videoMode && frameData.videoMode !== 'custom')) {
                console.log('[Content] Triggering video generation with prompt:', frameData.prompt, 'videoMode:', frameData.videoMode);
                triggerVideoGeneration(postId, mediaUrl, frameData.prompt || '', frameData.mode || 'custom', frameData.batchIndex, frameData.videoMode || 'custom', frameData.videoLength, frameData.resolutionName);
            }

            // Like the post (don't wait for video generation)
            console.log('[Content] Liking post...');
            const likeResponse = await fetch('https://grok.com/rest/media/post/like', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    id: postId
                })
            });

            const likeResult = await likeResponse.json();
            console.log('[Content] Like post response:', likeResult);

            // Store the file metadata for use in the prompt
            await chrome.storage.local.set({
                uploadedFrameMetadata: {
                    fileMetadataId: result.fileMetadataId,
                    postId: postId,
                    mediaUrl: mediaUrl,
                    fileName: frameData.filename,
                    prompt: frameData.prompt,
                    timestamp: Date.now()
                }
            });

            // Show success notification (only for non-batch mode, batch will show after submit)
            if (frameData.mode !== 'batch') {
                const notifyMsg = frameData.prompt
                    ? '✅ Uploaded & Video Generation Started!'
                    : '✅ Uploaded! Post ID: ' + postId;
                showUploadNotification(notifyMsg, false, postId);
            }
            // Note: batchUploadComplete will be sent after prompt is submitted on post page
        }

        return result;

    } catch (error) {
        console.error('[Content] Error uploading frame:', error);
        showUploadNotification('❌ Upload failed: ' + error.message, true);
        return null;
    }
}

/**
 * Show a notification on the page
 */
function showUploadNotification(message, isError = false, fileMetadataId = null) {
    // Remove existing notification
    const existing = document.getElementById('grok-upload-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'grok-upload-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${isError ? '#ef4444' : '#22c55e'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        max-width: 400px;
        word-break: break-all;
    `;

    if (fileMetadataId) {
        notification.innerHTML = `
            <div>✅ Frame uploaded successfully!</div>
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">
                ID: <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="navigator.clipboard.writeText('${fileMetadataId}'); this.textContent='Copied!'; setTimeout(() => this.textContent='${fileMetadataId}', 1000);">${fileMetadataId}</code>
            </div>
            <div style="font-size: 11px; margin-top: 6px; opacity: 0.7;">Click ID to copy</div>
        `;
    } else {
        notification.textContent = message;
    }

    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds (longer to allow copying)
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 10000);
}

/**
 * Find a button by its text content
 */
function findButtonByText(text) {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        if (button.textContent.includes(text) || button.getAttribute('aria-label')?.includes(text)) {
            return button;
        }
    }
    return null;
}

/**
 * Find a menu item by its text content
 */
function findMenuItemByText(text) {
    // Try menuitem role first
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    for (const item of menuItems) {
        if (item.textContent.includes(text)) {
            return item;
        }
    }

    // Try any clickable element in a menu
    const menuElements = document.querySelectorAll('[role="menu"] *');
    for (const el of menuElements) {
        if (el.textContent.includes(text) && (el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.onclick)) {
            return el;
        }
    }

    return null;
}

// ==========================================
// Video Generation Helper (Manual Mode)
// ==========================================

/**
 * Show prompt notification for manual video generation
 * User needs to manually enter the prompt in Grok's input
 */
function showVideoGenPrompt(postId, prompt) {
    const existing = document.getElementById('grok-videogen-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'grok-videogen-notification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 16px 20px;
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        border-radius: 12px;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        max-width: 380px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const promptText = prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt;

    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 15px;">🎬 Ready for Video Generation</div>
            <button id="closeVideoGenNotif" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; opacity: 0.7;">&times;</button>
        </div>
        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 10px;">
            Your frame has been uploaded. Copy the prompt below and paste it in Grok's input:
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 10px 12px; border-radius: 8px; margin-bottom: 10px;">
            <div style="font-size: 12px; word-break: break-word; line-height: 1.4;">${promptText}</div>
        </div>
        <button id="copyPromptBtn" style="
            width: 100%;
            padding: 10px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 6px;
            color: white;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        ">📋 Copy Prompt</button>
    `;

    document.body.appendChild(notification);

    // Copy button handler
    document.getElementById('copyPromptBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(prompt).then(() => {
            const btn = document.getElementById('copyPromptBtn');
            btn.textContent = '✅ Copied!';
            btn.style.background = 'rgba(76, 175, 80, 0.4)';
            setTimeout(() => {
                btn.textContent = '📋 Copy Prompt';
                btn.style.background = 'rgba(255,255,255,0.2)';
            }, 2000);
        });
    });

    // Close button handler
    document.getElementById('closeVideoGenNotif').addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 60 seconds
    setTimeout(() => {
        if (document.getElementById('grok-videogen-notification')) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }
    }, 60000);
}

/**
 * Called after upload to navigate to post page and fill prompt
 */
async function triggerVideoGeneration(postId, mediaUrl, prompt, mode, batchIndex, videoMode = 'custom', videoLength, resolutionName) {
    console.log('[Content] Navigating to post page...');
    console.log('[Content] Post ID:', postId);
    console.log('[Content] Prompt:', prompt);
    console.log('[Content] Mode:', mode, 'Batch Index:', batchIndex, 'Video Mode:', videoMode);

    // Store prompt for the post page to pick up
    await chrome.storage.local.set({
        pendingVideoPrompt: {
            postId: postId,
            prompt: prompt,
            timestamp: Date.now(),
            mode: mode,
            batchIndex: batchIndex,    // Pass batch info to post page
            videoMode: videoMode,      // Video generation mode (custom/normal/fun/spicy)
            videoLength: videoLength,   // Duration override (6 or 10)
            resolutionName: resolutionName // Resolution override (480p or 720p)
        }
    });

    // Navigate to the post page
    window.location.href = `https://grok.com/imagine/post/${postId}`;
}

/**
 * Check for pending prompt and fill it into the input box
 */
async function checkPendingPrompt() {
    const currentUrl = window.location.href;

    // Only run on post detail pages
    if (!currentUrl.includes('/imagine/post/')) {
        return;
    }

    console.log('[Content] On post page, checking for pending prompt...');

    try {
        const result = await chrome.storage.local.get('pendingVideoPrompt');
        const promptData = result.pendingVideoPrompt;

        if (!promptData || (!promptData.prompt && (!promptData.videoMode || promptData.videoMode === 'custom'))) {
            console.log('[Content] No pending prompt found');
            return;
        }

        // Check if the prompt is recent (within 60 seconds)
        const age = Date.now() - promptData.timestamp;
        if (age > 60000) {
            console.log('[Content] Pending prompt is too old, clearing...');
            await chrome.storage.local.remove('pendingVideoPrompt');
            return;
        }

        // Check if we're on the correct post page
        if (!currentUrl.includes(promptData.postId)) {
            console.log('[Content] Post ID mismatch, skipping...');
            return;
        }

        console.log('[Content] Found pending prompt:', promptData.prompt);
        console.log('[Content] Mode:', promptData.mode, 'Batch Index:', promptData.batchIndex, 'Video Mode:', promptData.videoMode);

        // Check if this is batch mode (from promptData, not separate storage)
        const isBatchMode = promptData.mode === 'batch' && promptData.batchIndex !== undefined;
        const videoMode = promptData.videoMode || 'custom';

        // Wait for the input to be ready and submit
        await waitForInputAndFill(promptData.prompt || '', isBatchMode, promptData.batchIndex, promptData.postId, videoMode, promptData.videoLength, promptData.resolutionName);

        // Clear the pending prompt
        await chrome.storage.local.remove('pendingVideoPrompt');
        console.log('[Content] Prompt filled and cleared');

        // If batch mode, start watching for video generation completion
        if (isBatchMode) {
            console.log('[Content] Batch mode active, watching for video completion...');
            watchForVideoCompletion(promptData.batchIndex);
        }

    } catch (error) {
        console.error('[Content] Error checking pending prompt:', error);
    }
}

/**
 * Wait for input element and fill with prompt
 * Handles both V1 (textarea) and V2 (contenteditable/TipTap) UI versions,
 * mirroring the same logic as queueFillAndSubmit().
 * @param {string} prompt - The prompt to fill
 * @param {boolean} isBatchMode - Whether this is batch mode
 * @param {number} batchIndex - The batch candidate index
 * @param {string} postId - The post ID
 */
async function waitForInputAndFill(prompt, isBatchMode = false, batchIndex = null, postId = null, videoMode = 'custom', videoLength, resolutionName) {
    try {
        // Helper to find prompt input (textarea for V1, contenteditable for V2)
        const findInput = () => {
            const candidates = Array.from(document.querySelectorAll('textarea[placeholder], input[placeholder*="Enter"], input[placeholder*="輸入"], [contenteditable="true"], textarea'))
                .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
            return candidates.length > 0 ? candidates[0] : null;
        };

        // Wait initial delay for page load
        await new Promise(r => setTimeout(r, 1500));

        // Wait for input to appear (quick check first, 5s)
        let input = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            input = findInput();
            if (input) break;
            await new Promise(r => setTimeout(r, 500));
        }

        // V2: If no input found yet, page might be in Image mode (no contenteditable).
        // Try switching to Video mode first, then re-search.
        if (!input) {
            console.log('[Story] No input found — page may be in Image mode, attempting mode switch...');
            await new Promise(r => setTimeout(r, 1000));
            await switchToVideoModeIfNeeded();
            await new Promise(r => setTimeout(r, 1500));
            for (let attempt = 0; attempt < 10; attempt++) {
                input = findInput();
                if (input) break;
                await new Promise(r => setTimeout(r, 500));
            }
        }

        if (!input) {
            console.log('[Story] Could not find input element, showing prompt notification instead');
            showVideoGenPrompt(null, prompt);
            if (isBatchMode && batchIndex !== null) {
                chrome.runtime.sendMessage({
                    type: 'batchUploadComplete',
                    batchIndex: batchIndex,
                    postId: postId,
                    success: false
                }).catch(err => console.log('[Story] Could not send batchUploadComplete:', err));
            }
            return false;
        }

        const isV2 = input.tagName !== 'TEXTAREA' && input.tagName !== 'INPUT';
        console.log(`[Story] Found input element (${isV2 ? 'V2 contenteditable' : 'V1 ' + input.tagName}), filling prompt...`);

        // V2: Ensure video mode + apply settings via UI (same as Queue)
        if (isV2) {
            console.log('[Story] V2 detected, waiting for hydration...');
            await new Promise(r => setTimeout(r, 2000));
            await switchToVideoModeIfNeeded();

            // Find settings button near contenteditable
            const settingsBtn = (() => {
                const eds = Array.from(document.querySelectorAll('[contenteditable="true"]'))
                    .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
                if (eds.length === 0) return null;
                let p = eds[0].parentElement;
                for (let i = 0; i < 8 && p; i++) {
                    const btn = p.querySelector('button[aria-haspopup="menu"]');
                    if (btn) return btn;
                    p = p.parentElement;
                }
                return null;
            })();
            await applyVideoSettingsV2(settingsBtn, videoLength, resolutionName, videoMode);

            // Re-find input after mode switch (contenteditable may have been recreated)
            const freshInput = findInput();
            if (freshInput && freshInput !== input) {
                input = freshInput;
                console.log('[Story] Re-acquired input after mode switch');
            }
        }

        // Fill the prompt (for non-custom modes with empty prompt, use a space to enable submit)
        const fillText = prompt || (videoMode !== 'custom' ? ' ' : '');
        input.focus();

        if (!isV2) {
            // V1: Use native setter to trigger React state update (same as Queue)
            const proto = input.tagName === 'TEXTAREA'
                ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
            nativeSetter.call(input, fillText);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // V2: Use fillContentEditable (TipTap API via MAIN world, same as Queue)
            await fillContentEditable(input, fillText);
        }

        // Set video overrides via DOM data attributes for intercept.js
        document.documentElement.dataset.grokQueueVideoLength = String(videoLength || 6);
        document.documentElement.dataset.grokQueueResolution = resolutionName || '480p';
        document.documentElement.dataset.grokQueueMode = videoMode || 'custom';
        // Pass prompt to intercept.js as safety net
        document.documentElement.dataset.grokQueuePrompt = fillText;
        console.log(`[Story] Video overrides set: mode=${videoMode}, duration=${videoLength || 6}s, resolution=${resolutionName || '480p'}`);

        // Wait for framework to process the input
        await new Promise(r => setTimeout(r, 500));

        // Show notification (only for non-batch mode)
        if (!isBatchMode) {
            showPromptFilledNotification();
        }

        // Find the submit button with retry (same strategy as Queue)
        let submitBtn = null;
        for (let btnAttempt = 0; btnAttempt < 10; btnAttempt++) {
            // Strategy 1: aria-label (V2 submit button)
            submitBtn = document.querySelector('button[aria-label="Make video"]') ||
                       document.querySelector('button[aria-label="製作影片"]') ||
                       document.querySelector('button[aria-label="制作视频"]') ||
                       document.querySelector('button[aria-label="ビデオを作成"]') ||
                       document.querySelector('button[aria-label="비디오 만들기"]');
            // Strategy 2: V1 button class
            if (!submitBtn) {
                submitBtn = document.querySelector('button[data-slot="button"][class*="bg-button-filled"]');
            }
            // Strategy 3: SVG arrow-up path near input area
            if (!submitBtn) {
                const inputArea = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea[placeholder]');
                const inputContainer = inputArea?.closest('[class*="flex"]')?.parentElement?.parentElement;
                const searchScope = inputContainer || document;
                const allButtons = Array.from(searchScope.querySelectorAll('button'));
                submitBtn = allButtons.find(b => {
                    const paths = b.querySelectorAll('svg path');
                    for (const p of paths) {
                        if ((p.getAttribute('d') || '').includes('M12 5V19')) return true;
                    }
                    return false;
                }) || null;
            }
            if (submitBtn) break;
            console.log(`[Story] Submit button not found, retrying (${btnAttempt + 1}/10)...`);
            await new Promise(r => setTimeout(r, 500));
        }

        if (submitBtn) {
            // Wait for button to become enabled
            if (submitBtn.disabled) {
                console.log('[Story] Submit button found but disabled, waiting for enable...');
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    if (!submitBtn.disabled) break;
                    // After 3s, try re-filling the contenteditable (framework may not have registered)
                    if (i === 5 && isV2) {
                        console.log('[Story] Button still disabled after 3s, re-filling contenteditable...');
                        await fillContentEditable(input, fillText);
                    }
                }
            }

            if (!submitBtn.disabled) {
                console.log('[Story] Submitting prompt...');

                let submitted = false;
                // V2: Submit via Enter key in MAIN world (most reliable, same as Queue)
                if (isV2) {
                    console.log('[Story] V2: submitting via Enter key in MAIN world...');
                    const enterResult = await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            window.removeEventListener('message', handler);
                            resolve({ success: false, error: 'timeout' });
                        }, 2000);
                        function handler(event) {
                            if (event.source !== window || event.data?.type !== 'GROK_SUBMIT_EDITOR_RESULT') return;
                            clearTimeout(timeout);
                            window.removeEventListener('message', handler);
                            resolve(event.data.payload);
                        }
                        window.addEventListener('message', handler);
                        window.postMessage({ type: 'GROK_SUBMIT_EDITOR', payload: {} }, '*');
                    });
                    if (enterResult.success) {
                        console.log('[Story] V2: Submitted via Enter key in MAIN world');
                        submitted = true;
                    } else {
                        console.warn(`[Story] V2: Enter key submit failed: ${enterResult.error}, falling back to button click`);
                    }
                }

                // V1 or V2 fallback: Button click with full pointer event sequence
                if (!submitted) {
                    const evtOpts = { bubbles: true, cancelable: true, view: window };
                    submitBtn.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1 }));
                    submitBtn.dispatchEvent(new MouseEvent('mousedown', evtOpts));
                    submitBtn.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1 }));
                    submitBtn.dispatchEvent(new MouseEvent('mouseup', evtOpts));
                    submitBtn.dispatchEvent(new MouseEvent('click', evtOpts));
                }
            } else {
                console.warn('[Story] Submit button still disabled after waiting, dispatching Enter key fallback...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                    bubbles: true, cancelable: true
                });
                input.dispatchEvent(enterEvent);
            }
        } else {
            console.warn('[Story] Submit button not found, dispatching Enter key fallback...');
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true
            });
            input.dispatchEvent(enterEvent);
        }

        // If batch mode, notify sidepanel
        if (isBatchMode && batchIndex !== null) {
            console.log(`[Story] Batch ${batchIndex}: Prompt submitted, notifying sidepanel...`);
            await new Promise(r => setTimeout(r, 500));
            chrome.runtime.sendMessage({
                type: 'batchUploadComplete',
                batchIndex: batchIndex,
                postId: postId,
                success: true
            }).catch(err => console.log('[Story] Could not send batchUploadComplete:', err));
        }

        return true;

    } catch (error) {
        console.error('[Story] Error in waitForInputAndFill:', error);

        // Notify sidepanel on failure
        if (isBatchMode && batchIndex !== null) {
            chrome.runtime.sendMessage({
                type: 'batchUploadComplete',
                batchIndex: batchIndex,
                postId: postId,
                success: false
            }).catch(err => console.log('[Story] Could not send batchUploadComplete:', err));
        }

        return false;
    }
}

/**
 * Watch for video generation completion on post detail page
 * Uses MutationObserver to detect when video appears
 */
function watchForVideoCompletion(candidateIndex) {
    console.log('[Content] Starting video completion watcher for candidate:', candidateIndex);

    let videoFound = false;
    let checkCount = 0;
    const maxChecks = 180; // 3 minutes at 1 check per second

    const checkForVideo = () => {
        checkCount++;

        // Look for video element on the page
        const videoElements = document.querySelectorAll('video');
        for (const video of videoElements) {
            const src = video.src || video.querySelector('source')?.src;
            if (src && src.includes('generated') && !videoFound) {
                videoFound = true;
                console.log('[Content] Video found for batch candidate:', candidateIndex, src);

                // Notify sidepanel
                chrome.runtime.sendMessage({
                    action: 'batchVideoReady',
                    candidateIndex: candidateIndex,
                    videoUrl: src
                });

                // Clear batch state
                chrome.storage.local.remove('batchGenerationState');

                // Show success notification
                showBatchVideoReadyNotification(candidateIndex);
                return;
            }
        }

        // Also check for video in any data attributes or links
        const videoLinks = document.querySelectorAll('a[href*=".mp4"], a[href*="video"]');
        for (const link of videoLinks) {
            if (!videoFound && link.href.includes('generated')) {
                videoFound = true;
                console.log('[Content] Video link found for batch candidate:', candidateIndex, link.href);

                chrome.runtime.sendMessage({
                    action: 'batchVideoReady',
                    candidateIndex: candidateIndex,
                    videoUrl: link.href
                });

                chrome.storage.local.remove('batchGenerationState');
                showBatchVideoReadyNotification(candidateIndex);
                return;
            }
        }

        // Continue checking
        if (checkCount < maxChecks && !videoFound) {
            setTimeout(checkForVideo, 1000);
        } else if (!videoFound) {
            console.log('[Content] Timeout waiting for video generation');
            chrome.runtime.sendMessage({
                action: 'batchVideoReady',
                candidateIndex: candidateIndex,
                videoUrl: null,
                error: 'Timeout'
            });
            chrome.storage.local.remove('batchGenerationState');
        }
    };

    // Also use MutationObserver for faster detection
    const observer = new MutationObserver((mutations) => {
        if (videoFound) {
            observer.disconnect();
            return;
        }

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const videos = document.querySelectorAll('video[src*="generated"]');
                if (videos.length > 0 && !videoFound) {
                    const video = videos[0];
                    videoFound = true;
                    observer.disconnect();

                    console.log('[Content] MutationObserver detected video:', video.src);

                    chrome.runtime.sendMessage({
                        action: 'batchVideoReady',
                        candidateIndex: candidateIndex,
                        videoUrl: video.src
                    });

                    chrome.storage.local.remove('batchGenerationState');
                    showBatchVideoReadyNotification(candidateIndex);
                    return;
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Start periodic checking as backup
    setTimeout(checkForVideo, 2000);
}

/**
 * Show notification when batch video is ready
 */
function showBatchVideoReadyNotification(candidateIndex) {
    const existing = document.getElementById('grok-batch-ready-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'grok-batch-ready-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <div>✅ Candidate #${candidateIndex + 1} Ready!</div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Video generated successfully</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Show notification that prompt was filled
 */
function showPromptFilledNotification() {
    const existing = document.getElementById('grok-prompt-filled-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'grok-prompt-filled-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: #4CAF50;
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    notification.innerHTML = `
        <span>✅</span>
        <span>Prompt filled! Click send to generate video.</span>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Check for pending frame upload when page loads
if (window.location.href.includes('grok.com/imagine')) {
    console.log('[Content] On Grok Imagine page...');

    // Track if we've already processed this batch upload
    let batchUploadProcessed = false;

    const runPendingChecks = () => {
        if (!batchUploadProcessed || !window.location.hash.includes('batch=')) {
            checkPendingFrameUpload().then(() => {
                if (window.location.hash.includes('batch=')) {
                    batchUploadProcessed = true;
                }
            });
        }
        checkPendingPrompt();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runPendingChecks, 2000);
        });
    } else {
        setTimeout(runPendingChecks, 2000);
    }

    // For background tabs: check when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && window.location.hash.includes('batch=')) {
            console.log('[Content] Tab became visible, checking for pending batch upload...');
            setTimeout(runPendingChecks, 500);
        }
    });

    // Message listener for sidepanel to trigger upload check
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'triggerBatchUpload') {
            console.log('[Content] Received triggerBatchUpload message, index:', message.batchIndex);
            // Reset processed flag if we receive explicit trigger
            batchUploadProcessed = false;
            setTimeout(runPendingChecks, 500);
            sendResponse({ success: true });
            return true;
        }
        // 不處理其他消息類型，讓其他 listener 處理
        return false;
    });
}

// ==========================================
// Video Drag Handler for Side Panel
// Intercept drag events to include actual video URL
// ==========================================

function setupVideoDragHandler() {
    console.log('[Content] Setting up video drag handler...');

    // Handle dragstart on video elements
    document.addEventListener('dragstart', (e) => {
        const video = e.target.closest('video') || (e.target.tagName === 'VIDEO' ? e.target : null);

        if (video && video.src) {
            console.log('[Content] Video drag started, src:', video.src.substring(0, 100));

            // Set the video URL as text data
            e.dataTransfer.setData('text/plain', video.src);
            e.dataTransfer.setData('text/uri-list', video.src);

            // Also set as HTML for more context
            const html = `<video src="${video.src}"></video>`;
            e.dataTransfer.setData('text/html', html);

            // Set effect
            e.dataTransfer.effectAllowed = 'copy';

            console.log('[Content] Video URL set in dataTransfer:', video.src.substring(0, 80));
        }
    }, true);

    // Also handle videos that might be loaded dynamically
    // Make videos draggable if they aren't already
    const makeVideosDraggable = () => {
        document.querySelectorAll('video[src]').forEach(video => {
            if (!video.hasAttribute('draggable')) {
                video.setAttribute('draggable', 'true');
                video.style.cursor = 'grab';
                console.log('[Content] Made video draggable:', video.src.substring(0, 60));
            }
        });
    };

    // Run initially and observe for new videos
    makeVideosDraggable();

    const observer = new MutationObserver((mutations) => {
        let hasNewVideos = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'VIDEO' || node.querySelector?.('video')) {
                            hasNewVideos = true;
                            break;
                        }
                    }
                }
            }
        }
        if (hasNewVideos) {
            setTimeout(makeVideosDraggable, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Content] Video drag handler ready');
}

// Initialize drag handler on Grok pages
if (window.location.href.includes('grok.com')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupVideoDragHandler);
    } else {
        setupVideoDragHandler();
    }
}

// ==========================================
// Favorites Page: Add to Studio Button
// ==========================================

let favoritesVideoCache = new Map(); // Cache video URLs by post ID

async function setupFavoritesPageButtons() {
    if (!window.location.href.includes('grok.com/imagine/saved')) {
        return;
    }

    console.log('[Content] Setting up Favorites page buttons...');

    // Fetch favorites data to get video URLs
    await fetchAndCacheFavoritesData();

    // Wait a bit for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add buttons to existing video cards
    if (studioButtonsActive) {
        addStudioButtonsToCards();
    }

    // Watch for new cards being added (with debounce)
    if (studioButtonsObserver) {
        studioButtonsObserver.disconnect();
    }

    let debounceTimer = null;
    studioButtonsObserver = new MutationObserver(() => {
        // Only add buttons if still active
        if (!studioButtonsActive) return;

        // Debounce to prevent too many calls
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (studioButtonsActive) {
                addStudioButtonsToCards();
            }
        }, 300);
    });

    studioButtonsObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

async function fetchAndCacheFavoritesData() {
    try {
        console.log('[Content] Fetching favorites data for caching...');

        const API_URL = 'https://grok.com/rest/media/post/list';
        let cursor = null;
        let totalVideos = 0;

        do {
            const payload = {
                limit: 40,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            };

            if (cursor) {
                payload.cursor = cursor;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error('[Content] API error:', response.status);
                break;
            }

            const data = await response.json();
            const posts = data.posts || [];

            if (posts.length === 0) break;

            // Process posts recursively (including child posts)
            const processPost = (post) => {
                if (post.mediaType === 'MEDIA_POST_TYPE_VIDEO' && post.mediaUrl) {
                    favoritesVideoCache.set(post.id, {
                        url: post.mediaUrl,
                        hdUrl: post.hdMediaUrl || null
                    });
                    totalVideos++;
                }
                // Also check child posts
                if (post.childPosts && post.childPosts.length > 0) {
                    post.childPosts.forEach(processPost);
                }
            };

            posts.forEach(processPost);

            cursor = data.nextCursor;
            if (!cursor) break;

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (true);

        console.log(`[Content] Cached ${totalVideos} video URLs`);
        // Debug: show cached IDs
        console.log('[Content] Cached post IDs:', Array.from(favoritesVideoCache.keys()).slice(0, 10));
        await SystemLogger.info('Favorites cache built', `Cached ${totalVideos} videos from favorites API`);

    } catch (error) {
        console.error('[Content] Failed to fetch favorites:', error);
        await SystemLogger.fail('Favorites cache failed', `Error: ${error.message}`);
    }
}

function addStudioButtonsToCards() {
    // Try multiple selectors to find video cards
    let postLinks = document.querySelectorAll('a[href*="/imagine/post/"]');

    // If no links found, try other selectors
    if (postLinks.length === 0) {
        // Try finding by poster image URLs (which contain the post ID structure)
        const videoElements = document.querySelectorAll('video[poster], img[src*="assets.grok.com"]');
        console.log(`[Content] Found ${videoElements.length} video/img elements`);

        // Try finding grid items or cards
        const gridItems = document.querySelectorAll('[class*="grid"] > div, [class*="card"], [class*="relative"][class*="aspect"]');
        console.log(`[Content] Found ${gridItems.length} grid/card items`);
    }

    console.log(`[Content] Found ${postLinks.length} post links, cache has ${favoritesVideoCache.size} videos`);

    // Count how many posts have video data vs skipped
    let matchedCount = 0;
    let skippedNoVideo = 0;
    postLinks.forEach(link => {
        const m = link.href.match(/\/imagine\/post\/([^/?]+)/);
        if (m && favoritesVideoCache.has(m[1])) matchedCount++;
        else if (m) skippedNoVideo++;
    });
    SystemLogger.info('Studio buttons scan', `${postLinks.length} post links on page, ${matchedCount} have video data, ${skippedNoVideo} image-only (no button)`);

    // If still no links, try to match by video/image URLs in the DOM
    if (postLinks.length === 0 && favoritesVideoCache.size > 0) {
        console.log('[Content] No post links found, trying to match by media URLs...');
        addButtonsByMediaUrl();
        return;
    }

    // Debug: show first few post IDs from page
    if (postLinks.length > 0 && favoritesVideoCache.size > 0) {
        const pagePostIds = Array.from(postLinks).slice(0, 5).map(link => {
            const match = link.href.match(/\/imagine\/post\/([^/?]+)/);
            return match ? match[1] : 'no-match';
        });
        console.log('[Content] Page post IDs (first 5):', pagePostIds);
    }

    postLinks.forEach(link => {
        // Skip if already has button
        if (link.querySelector('.grok-studio-btn')) return;
        // Also check parent elements for button
        if (link.closest('div')?.querySelector('.grok-studio-btn')) return;

        // Get post ID from href
        const match = link.href.match(/\/imagine\/post\/([^/?]+)/);
        if (!match) return;

        const postId = match[1];

        // Check if we have video data for this post
        const videoData = favoritesVideoCache.get(postId);
        if (!videoData) {
            return;
        }

        console.log(`[Content] Adding button for post ${postId}`);

        // Find a good position for the button (look for the card container)
        const card = link.closest('div[class*="relative"]') || link;

        // Create the button
        const btn = document.createElement('button');
        btn.className = 'grok-studio-btn';
        btn.innerHTML = '📥';
        btn.title = chrome.i18n.getMessage('storyModeAddToStory') || 'Add to Story Mode';
        btn.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(76, 175, 80, 0.9);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            transition: transform 0.2s, background 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.background = 'rgba(76, 175, 80, 1)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.background = 'rgba(76, 175, 80, 0.9)';
        });

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Use HD URL if available, otherwise regular URL
            const videoUrl = videoData.hdUrl || videoData.url;

            console.log('[Content] Adding video to studio:', videoUrl.substring(0, 80));

            // Show loading state
            btn.innerHTML = '⏳';
            btn.style.pointerEvents = 'none';

            try {
                // Send to side panel via background
                const result = await chrome.runtime.sendMessage({
                    action: 'fetchAndStoreVideo',
                    url: videoUrl,
                    isMaster: false
                });

                if (result.success) {
                    btn.innerHTML = '✅';
                    btn.style.background = 'rgba(76, 175, 80, 1)';

                    // Show success notification
                    showStudioAddedNotification(postId);

                    // Reset after 2 seconds
                    setTimeout(() => {
                        btn.innerHTML = '📥';
                        btn.style.pointerEvents = 'auto';
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Failed to add video');
                }

            } catch (error) {
                console.error('[Content] Failed to add video:', error);
                btn.innerHTML = '❌';
                btn.style.background = 'rgba(244, 67, 54, 0.9)';

                setTimeout(() => {
                    btn.innerHTML = '📥';
                    btn.style.background = 'rgba(76, 175, 80, 0.9)';
                    btn.style.pointerEvents = 'auto';
                }, 2000);
            }
        });

        // Make sure parent has relative positioning
        if (card !== link) {
            const computedStyle = window.getComputedStyle(card);
            if (computedStyle.position === 'static') {
                card.style.position = 'relative';
            }
            card.appendChild(btn);
        } else {
            link.style.position = 'relative';
            link.appendChild(btn);
        }
    });
}

// Alternative method: add buttons by matching media URLs
function addButtonsByMediaUrl() {
    // Build a reverse lookup from media URL patterns to post data
    const urlToPostId = new Map();
    for (const [postId, data] of favoritesVideoCache.entries()) {
        // Extract the unique part from the URL (usually the UUID)
        if (data.url) {
            // URL format: https://assets.grok.com/users/{userId}/generated/{postId}/generated_video.mp4
            const match = data.url.match(/\/generated\/([^/]+)\//);
            if (match) {
                urlToPostId.set(match[1], { postId, ...data });
            }
            // Also try to match by full URL
            urlToPostId.set(GrokUtils.removeQueryString(data.url), { postId, ...data });
        }
    }

    console.log(`[Content] Built URL lookup with ${urlToPostId.size} entries`);

    // Find all video elements and images that might be thumbnails
    const mediaElements = document.querySelectorAll('video, img[src*="assets.grok.com"]');
    let buttonsAdded = 0;

    mediaElements.forEach(el => {
        const container = el.closest('div[class*="relative"]') || el.closest('div[class*="aspect"]') || el.parentElement;
        if (!container || container.querySelector('.grok-studio-btn')) return;

        // Get the src URL
        const src = el.tagName === 'VIDEO' ? (el.src || el.poster) : el.src;
        if (!src) return;

        // Try to find matching post data
        let postData = null;

        // Method 1: Direct URL match
        const cleanSrc = GrokUtils.removeQueryString(src);
        if (urlToPostId.has(cleanSrc)) {
            postData = urlToPostId.get(cleanSrc);
        }

        // Method 2: Extract UUID from URL and match
        if (!postData) {
            const uuidMatch = src.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i);
            if (uuidMatch) {
                const uuid = uuidMatch[1];
                // Check if this UUID is in our cache
                if (favoritesVideoCache.has(uuid)) {
                    postData = { postId: uuid, ...favoritesVideoCache.get(uuid) };
                }
                // Or check in the URL lookup
                if (!postData && urlToPostId.has(uuid)) {
                    postData = urlToPostId.get(uuid);
                }
            }
        }

        if (!postData) return;

        console.log(`[Content] Adding button for media element, post: ${postData.postId}`);
        buttonsAdded++;

        // Create and add the button
        const btn = createStudioButton(postData);
        container.style.position = 'relative';
        container.appendChild(btn);
    });

    console.log(`[Content] Added ${buttonsAdded} buttons via media URL matching`);
}

function createStudioButton(postData) {
    const btn = document.createElement('button');
    btn.className = 'grok-studio-btn';
    btn.innerHTML = '📥';
    btn.title = 'Add to Story Mode';
    btn.style.cssText = `
        position: absolute;
        bottom: 8px;
        left: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(76, 175, 80, 0.9);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        transition: transform 0.2s, background 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.background = 'rgba(76, 175, 80, 1)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.background = 'rgba(76, 175, 80, 0.9)';
    });

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const videoUrl = postData.hdUrl || postData.url;
        console.log('[Content] Adding video to studio:', videoUrl.substring(0, 80));

        btn.innerHTML = '⏳';
        btn.style.pointerEvents = 'none';

        try {
            // Store video in IndexedDB
            const result = await chrome.runtime.sendMessage({
                action: 'fetchAndStoreVideo',
                url: videoUrl,
                isMaster: false
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to add video');
            }

            // Notify Side Panel to add this video to storyboard
            await chrome.runtime.sendMessage({
                action: 'videoAddedFromFavorites',
                videoId: result.videoId,
                videoUrl: videoUrl,
                postId: postData.postId
            });

            btn.innerHTML = '✅';
            btn.style.background = 'rgba(76, 175, 80, 1)';
            showStudioAddedNotification(postData.postId);

            setTimeout(() => {
                btn.innerHTML = '📥';
                btn.style.pointerEvents = 'auto';
            }, 2000);

        } catch (error) {
            console.error('[Content] Failed to add video:', error);
            btn.innerHTML = '❌';
            btn.style.background = 'rgba(244, 67, 54, 0.9)';

            setTimeout(() => {
                btn.innerHTML = '📥';
                btn.style.background = 'rgba(76, 175, 80, 0.9)';
                btn.style.pointerEvents = 'auto';
            }, 2000);
        }
    });

    return btn;
}

function showStudioAddedNotification(postId) {
    const existing = document.getElementById('grok-studio-added-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'grok-studio-added-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: #4CAF50;
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    notification.innerHTML = `
        <span>✅</span>
        <span>Video added to Studio! Open Side Panel to manage.</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize on Favorites page - but only when Side Panel requests it
let studioButtonsActive = false;
let studioButtonsObserver = null;
let lastStudioButtonsUrl = null;

function showStudioButtons() {
    const currentUrl = window.location.href;

    // If URL changed, reset and re-setup
    if (studioButtonsActive && lastStudioButtonsUrl && lastStudioButtonsUrl !== currentUrl) {
        console.log('[Content] URL changed, resetting studio buttons');
        hideStudioButtons();
    }

    if (studioButtonsActive) return;
    studioButtonsActive = true;
    lastStudioButtonsUrl = currentUrl;

    console.log('[Content] Showing studio buttons, URL:', currentUrl);
    SystemLogger.info('Studio buttons show', `storyModeActive: ${storyModeActive}, URL: ${currentUrl.substring(0, 80)}`);

    if (currentUrl.includes('/imagine/post/')) {
        console.log('[Content] Detected: Post Detail page');
        setupPostDetailStudioButton();
    } else if (currentUrl.includes('grok.com/imagine/saved')) {
        console.log('[Content] Detected: Favorites page');
        setupFavoritesPageButtons();
    } else {
        console.log('[Content] Detected: Unknown page, no buttons');
        SystemLogger.warn('Studio buttons: unknown page', `URL does not match post or favorites: ${currentUrl.substring(0, 80)}`);
    }
}

// Monitor URL changes for SPA navigation
let lastCheckedUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== lastCheckedUrl) {
        console.log('[Content] SPA navigation detected:', window.location.href);
        lastCheckedUrl = window.location.href;

        // If studio buttons were active, re-setup for new page
        if (studioButtonsActive) {
            hideStudioButtons();
            showStudioButtons();
        }

        // Re-inject queue UI on SPA navigation (only if queue sidepanel is open)
        const oldQueueInject = document.getElementById('grok-queue-inject');
        if (oldQueueInject) oldQueueInject.remove();
        setTimeout(() => {
            if (queueModeActive) {
                injectAddToQueueUI();
            }
            checkQueueProcessingOnLoad();
        }, 500);
    }
}, 500);

function hideStudioButtons() {
    if (!studioButtonsActive) return;
    studioButtonsActive = false;
    console.log('[Content] Hiding studio buttons...');

    // Remove all studio buttons
    document.querySelectorAll('.grok-studio-btn').forEach(btn => btn.remove());

    // Stop the observers if they exist
    if (studioButtonsObserver) {
        studioButtonsObserver.disconnect();
        studioButtonsObserver = null;
    }

    // Clear post detail polling
    if (postDetailPollInterval) {
        clearInterval(postDetailPollInterval);
        postDetailPollInterval = null;
    }
    currentPostDetailVideoUrl = null;
}

// ==========================================
// Post Detail Page: Dynamic Studio Button
// ==========================================

let currentPostDetailVideoUrl = null;
let postDetailPollInterval = null;

function getCurrentVideoUrl() {
    const hdVideo = document.querySelector('#hd-video');
    const sdVideo = document.querySelector('#sd-video');

    // Debug: log both videos
    console.log('[Content] HD video src:', hdVideo?.src?.substring(0, 80) || 'none');
    console.log('[Content] HD video style:', hdVideo?.getAttribute('style'));
    console.log('[Content] SD video src:', sdVideo?.src?.substring(0, 80) || 'none');
    console.log('[Content] SD video style:', sdVideo?.getAttribute('style'));

    // Priority 1: #hd-video with src (HD version if available and visible)
    if (hdVideo && hdVideo.src && hdVideo.src.includes('.mp4')) {
        const style = hdVideo.getAttribute('style') || '';
        if (!style.includes('visibility: hidden')) {
            return hdVideo.src;
        }
    }

    // Priority 2: #sd-video with src (SD version)
    if (sdVideo && sdVideo.src && sdVideo.src.includes('.mp4')) {
        const style = sdVideo.getAttribute('style') || '';
        if (!style.includes('visibility: hidden')) {
            return sdVideo.src;
        }
    }

    return null;
}

function setupPostDetailStudioButton() {
    console.log('[Content] Setting up Post Detail page studio button...');

    // Clear any existing poll interval
    if (postDetailPollInterval) {
        clearInterval(postDetailPollInterval);
        postDetailPollInterval = null;
    }

    // Wait for video to be ready
    let retryCount = 0;
    const trySetup = () => {
        retryCount++;
        const videoUrl = getCurrentVideoUrl();

        if (!videoUrl) {
            if (retryCount < 20) {
                setTimeout(trySetup, 500);
            }
            return;
        }

        console.log('[Content] Found video URL:', videoUrl.substring(0, 60));

        // Find a container for the button (use the video's parent)
        const video = document.querySelector('#sd-video') || document.querySelector('#hd-video');
        const videoContainer = video?.closest('div[class*="relative"]') ||
                              video?.closest('div[class*="aspect"]') ||
                              video?.parentElement;

        if (!videoContainer) {
            console.log('[Content] No video container found');
            return;
        }

        // Create the button
        addOrUpdatePostDetailButton(videoContainer, videoUrl);

        // Use polling to detect video changes (when user clicks left/right arrows)
        postDetailPollInterval = setInterval(() => {
            if (!studioButtonsActive) {
                clearInterval(postDetailPollInterval);
                postDetailPollInterval = null;
                return;
            }

            const newVideoUrl = getCurrentVideoUrl();
            if (!newVideoUrl) return;

            if (newVideoUrl !== currentPostDetailVideoUrl) {
                console.log('[Content] Video changed to:', newVideoUrl.substring(0, 60));

                const video = document.querySelector('#sd-video') || document.querySelector('#hd-video');
                const container = video?.closest('div[class*="relative"]') ||
                                 video?.closest('div[class*="aspect"]') ||
                                 video?.parentElement;

                if (container) {
                    addOrUpdatePostDetailButton(container, newVideoUrl);
                }
            }
        }, 300);
    };

    trySetup();
}

function addOrUpdatePostDetailButton(container, videoUrl) {
    if (!videoUrl) return;

    currentPostDetailVideoUrl = videoUrl;

    // Remove existing button
    const existingBtn = container.querySelector('.grok-studio-btn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // Create new button with current video URL
    const postData = {
        postId: extractPostIdFromUrl(videoUrl) || 'unknown',
        url: videoUrl,
        hdUrl: null  // We use the current video src directly
    };

    const btn = createStudioButton(postData);

    // Position the button
    container.style.position = 'relative';
    btn.style.bottom = '60px';  // Higher position to avoid player controls
    btn.style.left = '8px';

    container.appendChild(btn);
    console.log('[Content] Studio button added/updated for:', videoUrl.substring(0, 80));
}

function extractPostIdFromUrl(url) {
    // Try to extract post ID from URL like:
    // https://assets.grok.com/users/{userId}/generated/{postId}/generated_video.mp4
    const match = url.match(/\/generated\/([^/]+)\//);
    return match ? match[1] : null;
}

// Check if current page supports studio buttons
function isStudioButtonsPage() {
    const url = window.location.href;
    return url.includes('grok.com/imagine/saved') || url.includes('/imagine/post/');
}

// Listen for port connections from Side Panel
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidepanel-studio') {
        console.log('[Content] Side Panel connected');
        SystemLogger.info('Studio Side Panel connected', `URL: ${window.location.href.substring(0, 80)}`);
        storyModeActive = true;

        // Listen for messages on this port
        port.onMessage.addListener((message) => {
            if (message.action === 'showStudioButtons') {
                if (isStudioButtonsPage()) {
                    showStudioButtons();
                }
            }
        });

        // On post detail pages, detect available video presets and notify sidepanel
        if (window.location.href.includes('/imagine/post/')) {
            setTimeout(async () => {
                const modes = await detectAvailablePresets();
                if (modes) {
                    chrome.runtime.sendMessage({
                        action: 'availablePresetsDetected',
                        modes: modes
                    }).catch(() => {});
                    console.log('[Content] Sent available presets to sidepanel:', modes);
                }
            }, 2500);
        }

        // When port disconnects (Side Panel closed), hide buttons
        port.onDisconnect.addListener(() => {
            console.log('[Content] Side Panel disconnected, hiding buttons');
            SystemLogger.info('Studio Side Panel disconnected', 'Hiding studio buttons');
            storyModeActive = false;
            hideStudioButtons();
        });
    }

    if (port.name === 'sidepanel-queue') {
        console.log('[Content] Queue Side Panel connected');
        SystemLogger.info('Queue Side Panel connected', `URL: ${window.location.href.substring(0, 80)}`);
        queueModeActive = true;

        port.onMessage.addListener((message) => {
            if (message.action === 'showQueueButtons') {
                if (window.location.href.includes('/imagine/post/')) {
                    injectAddToQueueUI();
                }
            }
        });

        port.onDisconnect.addListener(() => {
            console.log('[Content] Queue Side Panel disconnected, hiding queue UI');
            SystemLogger.info('Queue Side Panel disconnected', 'Hiding queue UI');
            queueModeActive = false;
            removeAddToQueueUI();
        });
    }
});

// ==========================================
// Batch Generation API Functions
// ==========================================

/**
 * Process a batch upload request - upload frame and trigger video generation
 */
async function processBatchUploadRequest(frameData) {
    console.log('[Content] Processing batch upload request:', frameData.batchIndex);

    try {
        const base64Content = frameData.dataUrl.split(',')[1];

        // Step 1: Upload the frame
        const uploadResponse = await fetch('https://grok.com/rest/app-chat/upload-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                fileName: frameData.filename,
                fileMimeType: 'image/png',
                content: base64Content
            })
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log('[Content] Batch upload result:', uploadResult);

        if (!uploadResult.fileMetadataId) {
            throw new Error('No fileMetadataId in response');
        }

        // Step 2: Get userId and construct mediaUrl
        const userId = document.cookie.match(/x-userid=([^;]+)/)?.[1];
        if (!userId) {
            throw new Error('User not logged in');
        }

        const mediaUrl = `https://assets.grok.com/users/${userId}/${uploadResult.fileMetadataId}/content`;

        // Step 3: Create media post
        const createResponse = await fetch('https://grok.com/rest/media/post/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                mediaType: 'MEDIA_POST_TYPE_IMAGE',
                mediaUrl: mediaUrl
            })
        });

        const createResult = await createResponse.json();
        console.log('[Content] Batch create post result:', createResult);

        const postId = createResult.postId || createResult.id || uploadResult.fileMetadataId;

        // Step 4: Like the post to add to favorites (optional, helps with tracking)
        await fetch('https://grok.com/rest/media/post/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: postId })
        });

        // Step 5: Navigate to post page and submit prompt (trigger video generation)
        // For batch mode, we'll use the API approach if available, or store for later
        if (frameData.prompt) {
            // Store the prompt request for the post detail page
            await chrome.storage.local.set({
                pendingVideoPrompt: {
                    postId: postId,
                    prompt: frameData.prompt,
                    batchIndex: frameData.batchIndex,
                    timestamp: Date.now()
                }
            });

            // Open post detail page in background to trigger video generation
            // The page will detect pendingVideoPrompt and auto-fill
            console.log('[Content] Triggering video generation for batch candidate', frameData.batchIndex);

            // Use the triggerVideoGeneration function if we're not already on the post page
            // For now, just return the postId and let polling handle the rest
        }

        return {
            success: true,
            postId: postId,
            fileMetadataId: uploadResult.fileMetadataId,
            mediaUrl: mediaUrl
        };

    } catch (error) {
        console.error('[Content] Batch upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if a video has been generated for a post
 */
async function checkVideoGenerationStatus(postId) {
    console.log('[Content] Checking video status for post:', postId);

    try {
        // Use POST method with proper payload (same as existing code)
        const response = await fetch('https://grok.com/rest/media/post/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                limit: 50,
                filter: {
                    source: "MEDIA_POST_SOURCE_LIKED"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch posts: HTTP ${response.status}`);
        }

        const result = await response.json();
        const posts = result.posts || result.results || [];

        // Find our post
        const post = posts.find(p => p.postId === postId || p.id === postId);

        if (post && post.videoUrl) {
            console.log('[Content] Video found for post:', postId, post.videoUrl);
            return {
                success: true,
                videoUrl: post.videoUrl,
                status: 'ready'
            };
        }

        // Video not ready yet
        return {
            success: true,
            videoUrl: null,
            status: 'generating'
        };

    } catch (error) {
        console.error('[Content] Check status error:', error);
        return { success: false, error: error.message };
    }
}

// Also keep the message listener for other actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showStudioButtons') {
        if (isStudioButtonsPage()) {
            showStudioButtons();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, reason: 'Not on supported page' });
        }
        return true;
    }

    if (message.action === 'hideStudioButtons') {
        hideStudioButtons();
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'checkStudioButtonsSupport') {
        sendResponse({
            supported: isStudioButtonsPage(),
            active: studioButtonsActive
        });
        return true;
    }

    // Handle batch upload request from sidepanel
    if (message.action === 'processBatchUpload') {
        (async () => {
            try {
                const result = await processBatchUploadRequest(message.frameData);
                sendResponse(result);
            } catch (error) {
                console.error('[Content] Batch upload error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep channel open for async response
    }

    // Check video generation status
    if (message.action === 'checkVideoStatus') {
        (async () => {
            try {
                const result = await checkVideoGenerationStatus(message.postId);
                sendResponse(result);
            } catch (error) {
                console.error('[Content] Check status error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 不處理其他消息，不返回 true
    return false;
});

// ==========================================
// Batch Select Delete Mode
// ==========================================

let batchSelectModeActive = false;
let selectedPosts = new Set();
let batchSelectToolbar = null;
let batchSelectStyles = null;
let batchSelectCache = null; // Cache for API data and URL mappings
const BATCH_SELECT_STORAGE_KEY = 'grokBatchSelectedPosts';

/**
 * Save selected posts to chrome.storage.local
 */
async function saveSelectedPostsToStorage() {
    try {
        await chrome.storage.local.set({
            [BATCH_SELECT_STORAGE_KEY]: {
                posts: Array.from(selectedPosts),
                timestamp: Date.now(),
                url: window.location.href
            }
        });
    } catch (e) {
        console.error('[BatchSelect] Failed to save selections:', e);
    }
}

/**
 * Load selected posts from chrome.storage.local
 */
async function loadSelectedPostsFromStorage() {
    try {
        const result = await chrome.storage.local.get(BATCH_SELECT_STORAGE_KEY);
        const data = result[BATCH_SELECT_STORAGE_KEY];

        // Only restore if saved within the last 30 minutes and on same base page
        if (data && data.posts && data.timestamp) {
            const isRecent = (Date.now() - data.timestamp) < 30 * 60 * 1000; // 30 minutes
            const isSamePage = data.url && data.url.includes('/saved');

            if (isRecent && isSamePage) {
                console.log(`[BatchSelect] Restoring ${data.posts.length} selections from storage`);
                return new Set(data.posts);
            }
        }
    } catch (e) {
        console.error('[BatchSelect] Failed to load selections:', e);
    }
    return new Set();
}

/**
 * Clear selected posts from storage
 */
async function clearSelectedPostsFromStorage() {
    try {
        await chrome.storage.local.remove(BATCH_SELECT_STORAGE_KEY);
    } catch (e) {
        console.error('[BatchSelect] Failed to clear selections:', e);
    }
}

/**
 * Enter batch select mode - show checkboxes on each post
 */
async function enterBatchSelectMode() {
    // Check if we're "in mode" but the UI was removed (e.g., SPA navigation)
    if (batchSelectModeActive) {
        const toolbarExists = batchSelectToolbar && document.body.contains(batchSelectToolbar);
        if (toolbarExists) {
            return { success: true, message: 'Already in selection mode' };
        }
        // UI was removed, reset the mode and re-enter
        console.log('[BatchSelect] Mode was active but UI gone, re-entering...');
        batchSelectModeActive = false;
        batchSelectToolbar = null;
        batchSelectStyles = null;
        batchSelectCache = null;
    }

    console.log('[BatchSelect] Entering batch select mode...');
    await SystemLogger.info('Batch select mode entered', 'Scanning posts...');

    // Load previously saved selections from storage
    const savedSelections = await loadSelectedPostsFromStorage();

    // Inject styles
    injectBatchSelectStyles();

    // Find all post cards on the favorites page
    const postCards = await findPostCards();
    if (postCards.length === 0) {
        return { success: false, error: 'No posts found on page' };
    }

    console.log(`[BatchSelect] Found ${postCards.length} posts`);

    // Mark mode as active first
    batchSelectModeActive = true;
    selectedPosts = savedSelections; // Restore saved selections

    // Add checkboxes to each post (will auto-check if in selectedPosts)
    postCards.forEach(card => {
        addCheckboxToPost(card);
    });

    // Create floating toolbar
    createBatchSelectToolbar();
    updateToolbarCount(); // Update count with restored selections

    // Set up mutation observer to handle dynamically loaded posts
    setupBatchSelectObserver();

    return { success: true, postCount: postCards.length, restoredSelections: savedSelections.size };
}

/**
 * Exit batch select mode
 */
async function exitBatchSelectMode() {
    if (!batchSelectModeActive) return;

    console.log('[BatchSelect] Exiting batch select mode...');
    await SystemLogger.info('Batch select mode exited', `${selectedPosts.size} posts were selected`);

    // Clear saved selections from storage
    await clearSelectedPostsFromStorage();

    // Remove all checkboxes
    document.querySelectorAll('.grok-batch-checkbox').forEach(cb => cb.remove());

    // Remove toolbar
    if (batchSelectToolbar) {
        batchSelectToolbar.remove();
        batchSelectToolbar = null;
    }

    // Remove styles
    if (batchSelectStyles) {
        batchSelectStyles.remove();
        batchSelectStyles = null;
    }

    // Stop observer
    if (batchSelectObserver) {
        batchSelectObserver.disconnect();
        batchSelectObserver = null;
    }

    batchSelectModeActive = false;
    selectedPosts.clear();
    batchSelectCache = null;
}

/**
 * Find post cards on the favorites page
 * Uses API data + DOM matching (similar to Story Mode approach)
 * @param {boolean} useCache - If true, use cached data instead of fetching from API
 */
async function findPostCards(useCache = false) {
    const cards = [];
    const seenPostIds = new Set();

    // Method 1: Try links first (fastest)
    const postLinks = document.querySelectorAll('a[href*="/imagine/post/"]');

    if (postLinks.length > 0) {
        console.log(`[BatchSelect] Found ${postLinks.length} post links`);
        postLinks.forEach(link => {
            const href = link.getAttribute('href');
            const match = href.match(/\/imagine\/post\/([^/?]+)/);
            if (!match) return;

            const postId = match[1];
            if (seenPostIds.has(postId)) return;
            seenPostIds.add(postId);

            const container = findCardContainerFromLink(link);
            if (container) {
                cards.push({ element: container, postId: postId });
            }
        });
        return cards;
    }

    // Method 2: Use API + media URL matching
    let postDataMap, urlToPostId;

    if (useCache && batchSelectCache) {
        // Use cached data
        postDataMap = batchSelectCache.postDataMap;
        urlToPostId = batchSelectCache.urlToPostId;
    } else {
        // Fetch from API
        console.log('[BatchSelect] Fetching from API...');
        postDataMap = await fetchFavoritesForBatchSelect();
        console.log(`[BatchSelect] API returned ${postDataMap.size} posts`);

        // Build URL to postId lookup
        urlToPostId = new Map();
        for (const [postId, data] of postDataMap.entries()) {
            if (data.mediaUrl) {
                const url = data.mediaUrl;

                // Pattern 1: UUID format
                const uuidMatch = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i);
                if (uuidMatch) {
                    urlToPostId.set(uuidMatch[1].toLowerCase(), postId);
                }

                // Pattern 2: /generated/{id}/ format
                const generatedMatch = url.match(/\/generated\/([^/]+)\//);
                if (generatedMatch) {
                    urlToPostId.set(generatedMatch[1], postId);
                }

                // Pattern 3: Store the post ID itself
                urlToPostId.set(postId, postId);

                // Pattern 4: Clean URL
                urlToPostId.set(GrokUtils.removeQueryString(url), postId);
            }
        }

        // Cache the data
        batchSelectCache = { postDataMap, urlToPostId };
        console.log(`[BatchSelect] Built ${urlToPostId.size} URL mappings`);

        // Debug: show sample API mediaUrls
        const sampleApiUrls = Array.from(postDataMap.entries()).slice(0, 2).map(([id, data]) => ({
            postId: id,
            mediaUrl: data.mediaUrl?.substring(0, 80)
        }));
        console.log(`[BatchSelect] Sample API data:`, sampleApiUrls);
    }

    if (postDataMap.size === 0) {
        return cards;
    }

    // Find media elements
    const mediaElements = document.querySelectorAll('video, img[src*="grok"], img[src*="x.ai"]');
    let matchedCount = 0;
    let unmatchedUrls = [];

    mediaElements.forEach(el => {
        const src = el.tagName === 'VIDEO' ? (el.src || el.poster) : el.src;
        if (!src) return;

        // Skip non-post images (profile pictures, icons, etc.)
        if (src.includes('profile-picture') || src.includes('avatar') || src.includes('icon')) {
            return;
        }

        let postId = null;

        // Method 1: Extract /generated/{postId}/ from URL (same as Story Mode)
        const generatedMatch = src.match(/\/generated\/([^/]+)\//);
        if (generatedMatch) {
            const extractedId = generatedMatch[1];
            if (postDataMap.has(extractedId)) {
                postId = extractedId;
            } else if (urlToPostId.has(extractedId)) {
                postId = urlToPostId.get(extractedId);
            }
        }

        // Method 2: Try UUID match anywhere in URL
        if (!postId) {
            const uuidMatches = src.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
            if (uuidMatches) {
                for (const uuid of uuidMatches) {
                    // Check both original case and lowercase
                    if (postDataMap.has(uuid)) {
                        postId = uuid;
                        break;
                    }
                    const lowerUuid = uuid.toLowerCase();
                    if (postDataMap.has(lowerUuid)) {
                        postId = lowerUuid;
                        break;
                    }
                    if (urlToPostId.has(uuid)) {
                        postId = urlToPostId.get(uuid);
                        break;
                    }
                    if (urlToPostId.has(lowerUuid)) {
                        postId = urlToPostId.get(lowerUuid);
                        break;
                    }
                }
            }
        }

        // Method 3: Try matching any postId found in the URL
        if (!postId) {
            for (const [key] of postDataMap.entries()) {
                if (src.includes(key)) {
                    postId = key;
                    break;
                }
            }
        }

        if (postId && !seenPostIds.has(postId)) {
            seenPostIds.add(postId);
            matchedCount++;
            const container = findCardContainerFromMedia(el);
            if (container) {
                // Make sure we don't reuse the same container
                const existingCard = cards.find(c => c.element === container);
                if (existingCard) {
                    console.log(`[BatchSelect] Container reused! PostId ${postId} same container as ${existingCard.postId}`);
                } else {
                    cards.push({ element: container, postId: postId });
                }
            }
        } else if (!postId) {
            // Track unmatched URLs for debugging
            unmatchedUrls.push(src.substring(0, 100));
        }
    });

    console.log(`[BatchSelect] Matched: ${matchedCount}, Unmatched: ${unmatchedUrls.length}`);
    if (unmatchedUrls.length > 0 && unmatchedUrls.length <= 5) {
        console.log(`[BatchSelect] Unmatched URLs:`, unmatchedUrls);
    } else if (unmatchedUrls.length > 5) {
        console.log(`[BatchSelect] Sample unmatched URLs:`, unmatchedUrls.slice(0, 3));
    }
    console.log(`[BatchSelect] Total cards found: ${cards.length}`);
    return cards;
}

/**
 * Fetch favorites data for batch select
 */
async function fetchFavoritesForBatchSelect() {
    const postDataMap = new Map();

    try {
        const API_URL = 'https://grok.com/rest/media/post/list';
        let cursor = null;

        do {
            const payload = {
                limit: 40,
                filter: { source: "MEDIA_POST_SOURCE_LIKED" }
            };
            if (cursor) payload.cursor = cursor;

            const response = await fetch(API_URL, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) break;

            const data = await response.json();
            const posts = data.posts || [];
            if (posts.length === 0) break;

            // Process posts (including child posts)
            const processPost = (post) => {
                postDataMap.set(post.id, {
                    mediaUrl: post.mediaUrl,
                    mediaType: post.mediaType
                });
                if (post.childPosts) {
                    post.childPosts.forEach(processPost);
                }
            };
            posts.forEach(processPost);

            cursor = data.nextCursor;
            if (!cursor) break;

            await new Promise(r => setTimeout(r, 100));
        } while (true);

    } catch (error) {
        console.error('[BatchSelect] API fetch error:', error);
    }

    return postDataMap;
}

/**
 * Find card container from a link element
 */
function findCardContainerFromLink(link) {
    let container = link;
    for (let i = 0; i < 10; i++) {
        const parent = container.parentElement;
        if (!parent || parent.tagName === 'MAIN' || parent.tagName === 'BODY') break;

        const grandparentStyle = parent.parentElement ? window.getComputedStyle(parent.parentElement) : null;
        if (grandparentStyle && grandparentStyle.display === 'grid') {
            return parent;
        }
        container = parent;
    }
    return link.closest('div[class*="relative"]') || link;
}

/**
 * Find card container from a media element
 * Each media element should have its own unique container
 */
function findCardContainerFromMedia(el) {
    // Strategy: Each post card should have its own <a> link or be in its own grid cell

    // First try: Find the closest <a> tag - each post has its own link
    const closestLink = el.closest('a');
    if (closestLink) {
        // Use the link's parent as the container (for proper positioning)
        const linkParent = closestLink.parentElement;
        if (linkParent && linkParent.children.length === 1) {
            // If the link is the only child, use the parent
            return linkParent;
        }
        return closestLink;
    }

    // Second try: Walk up until we find an element that's a direct grid child
    let current = el;
    while (current && current !== document.body) {
        const parent = current.parentElement;
        if (!parent) break;

        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'grid') {
            return current;
        }
        current = parent;
    }

    // Fallback: use the media element's immediate parent
    return el.parentElement;
}

/**
 * Extract post ID from an element (kept for compatibility)
 */
function extractPostId(element) {
    // Check href attribute
    const href = element.getAttribute('href') || element.querySelector('a')?.getAttribute('href');
    if (href) {
        const match = href.match(/\/imagine\/post\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    }

    // Check data attributes
    const dataId = element.getAttribute('data-post-id') || element.getAttribute('data-id');
    if (dataId) return dataId;

    return null;
}

/**
 * Find the appropriate card container element (kept for compatibility)
 */
function findCardContainer(element) {
    let current = element;
    for (let i = 0; i < 5; i++) {
        if (!current?.parentElement) break;
        const grandparentStyle = window.getComputedStyle(current.parentElement);
        if (grandparentStyle.display === 'grid') {
            return current;
        }
        current = current.parentElement;
    }
    return element.closest('a')?.parentElement || element.parentElement || element;
}

/**
 * Add checkbox to a post card
 */
function addCheckboxToPost(cardInfo) {
    const { element, postId } = cardInfo;

    // Check if already has checkbox
    if (element.querySelector('.grok-batch-checkbox')) return;

    // Check if this post was previously selected
    const isAlreadySelected = selectedPosts.has(postId);

    // Create checkbox container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'grok-batch-checkbox';
    checkboxContainer.setAttribute('data-post-id', postId);

    if (isAlreadySelected) {
        checkboxContainer.classList.add('selected');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isAlreadySelected; // Restore previous selection state

    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
            selectedPosts.add(postId);
            checkboxContainer.classList.add('selected');
        } else {
            selectedPosts.delete(postId);
            checkboxContainer.classList.remove('selected');
        }
        updateToolbarCount();
        saveSelectedPostsToStorage(); // Persist to storage
    });

    // Prevent click from propagating to parent link (but allow checkbox to toggle)
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Also handle mousedown to prevent link activation
    checkbox.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    // Handle container clicks to toggle checkbox
    checkboxContainer.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // If the click is on the container but not directly on checkbox, toggle it
        if (e.target === checkboxContainer) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });

    checkboxContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    checkboxContainer.appendChild(checkbox);

    // Make the card position relative if needed
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
        element.style.position = 'relative';
    }

    element.appendChild(checkboxContainer);
}

/**
 * Inject CSS styles for batch select mode
 */
function injectBatchSelectStyles() {
    if (batchSelectStyles) return;

    batchSelectStyles = document.createElement('style');
    batchSelectStyles.id = 'grok-batch-select-styles';
    batchSelectStyles.textContent = `
        .grok-batch-checkbox {
            position: absolute;
            top: 4px;
            left: 4px;
            z-index: 100;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.2s;
            /* Larger click area */
            min-width: 40px;
            min-height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .grok-batch-checkbox:hover {
            background: rgba(0, 0, 0, 0.9);
            transform: scale(1.1);
        }

        .grok-batch-checkbox.selected {
            background: rgba(102, 126, 234, 0.9);
        }

        .grok-batch-checkbox input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #667eea;
        }

        .grok-batch-toolbar {
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .grok-batch-toolbar-count {
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            min-width: 120px;
        }

        .grok-batch-toolbar-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .grok-batch-toolbar-btn:hover {
            transform: translateY(-1px);
        }

        .grok-batch-toolbar-btn.select-all {
            background: #4a5568;
            color: #fff;
        }

        .grok-batch-toolbar-btn.select-all:hover {
            background: #5a6578;
        }

        .grok-batch-toolbar-btn.delete {
            background: #e53e3e;
            color: #fff;
        }

        .grok-batch-toolbar-btn.delete:hover {
            background: #c53030;
        }

        .grok-batch-toolbar-btn.delete:disabled {
            background: #666;
            cursor: not-allowed;
            opacity: 0.5;
        }

        .grok-batch-toolbar-btn.cancel {
            background: transparent;
            color: #a0aec0;
            border: 1px solid #4a5568;
        }

        .grok-batch-toolbar-btn.cancel:hover {
            background: #4a5568;
            color: #fff;
        }

        /* Confirmation Modal */
        .grok-batch-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .grok-batch-modal {
            background: #1a1a2e;
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .grok-batch-modal h3 {
            color: #fff;
            font-size: 18px;
            margin: 0 0 16px 0;
        }

        .grok-batch-modal p {
            color: #a0aec0;
            font-size: 14px;
            margin: 0 0 20px 0;
            line-height: 1.5;
        }

        .grok-batch-modal-options {
            margin-bottom: 20px;
        }

        .grok-batch-modal-option {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            margin-bottom: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .grok-batch-modal-option:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .grok-batch-modal-option input[type="radio"] {
            margin-top: 2px;
            accent-color: #667eea;
        }

        .grok-batch-modal-option-content {
            flex: 1;
        }

        .grok-batch-modal-option-title {
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .grok-batch-modal-option-desc {
            color: #718096;
            font-size: 12px;
        }

        .grok-batch-modal-warning {
            color: #fc8181;
            font-size: 12px;
            margin-top: 4px;
        }

        .grok-batch-modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }

        .grok-batch-modal-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .grok-batch-modal-btn.cancel {
            background: #4a5568;
            color: #fff;
        }

        .grok-batch-modal-btn.confirm {
            background: #e53e3e;
            color: #fff;
        }

        .grok-batch-modal-btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }

        /* Progress indicator */
        .grok-batch-progress {
            color: #a0aec0;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .grok-batch-progress-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #4a5568;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(batchSelectStyles);
}

/**
 * Create the floating toolbar
 */
function createBatchSelectToolbar() {
    if (batchSelectToolbar) return;

    const selectAllText = chrome.i18n.getMessage('batchSelectSelectAll') || 'Select All';
    const deleteText = chrome.i18n.getMessage('batchSelectDelete') || '🗑️ Delete';
    const cancelText = chrome.i18n.getMessage('batchDeleteCancel') || 'Cancel';

    batchSelectToolbar = document.createElement('div');
    batchSelectToolbar.className = 'grok-batch-toolbar';
    batchSelectToolbar.innerHTML = `
        <span class="grok-batch-toolbar-count">Selected: 0</span>
        <button class="grok-batch-toolbar-btn select-all">${selectAllText}</button>
        <button class="grok-batch-toolbar-btn delete" disabled>${deleteText}</button>
        <button class="grok-batch-toolbar-btn cancel">${cancelText}</button>
    `;

    // Event listeners
    const selectAllBtn = batchSelectToolbar.querySelector('.select-all');
    const deleteBtn = batchSelectToolbar.querySelector('.delete');
    const cancelBtn = batchSelectToolbar.querySelector('.cancel');

    selectAllBtn.addEventListener('click', toggleSelectAll);
    deleteBtn.addEventListener('click', showDeleteConfirmation);
    cancelBtn.addEventListener('click', exitBatchSelectMode);

    document.body.appendChild(batchSelectToolbar);
}

/**
 * Update the selected count in toolbar
 */
function updateToolbarCount() {
    if (!batchSelectToolbar) return;

    const countSpan = batchSelectToolbar.querySelector('.grok-batch-toolbar-count');
    const deleteBtn = batchSelectToolbar.querySelector('.delete');
    const selectAllBtn = batchSelectToolbar.querySelector('.select-all');

    const count = selectedPosts.size;
    const totalPosts = batchSelectCache?.postDataMap?.size || 0;

    // Show selected count and total from API
    const selectedText = totalPosts > 0
        ? (chrome.i18n.getMessage('batchSelectSelected', [String(count), String(totalPosts)]) || `Selected: ${count} / ${totalPosts}`)
        : `Selected: ${count}`;
    countSpan.textContent = selectedText;
    deleteBtn.disabled = count === 0;

    // Update select all button text (based on total from API, not just visible)
    const selectAllText = chrome.i18n.getMessage('batchSelectSelectAll') || 'Select All';
    const deselectAllText = chrome.i18n.getMessage('batchSelectDeselectAll') || 'Deselect All';
    selectAllBtn.textContent = (totalPosts > 0 && count === totalPosts) ? deselectAllText : selectAllText;
}

/**
 * Toggle select all / deselect all
 * Uses API cache to select ALL posts, not just visible ones
 */
function toggleSelectAll() {
    // Get total posts from cache (includes non-visible ones)
    const totalPosts = batchSelectCache?.postDataMap?.size || 0;
    const allPostIds = batchSelectCache?.postDataMap ? Array.from(batchSelectCache.postDataMap.keys()) : [];

    // Check if all are selected (comparing against total from API, not just visible)
    const allSelected = totalPosts > 0 && selectedPosts.size === totalPosts;

    if (allSelected) {
        // Deselect all
        selectedPosts.clear();
    } else {
        // Select all (including non-visible ones)
        allPostIds.forEach(postId => {
            selectedPosts.add(postId);
        });
    }

    // Update visible checkboxes to reflect the selection state
    const checkboxes = document.querySelectorAll('.grok-batch-checkbox input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const container = cb.closest('.grok-batch-checkbox');
        const postId = container.getAttribute('data-post-id');
        const isSelected = selectedPosts.has(postId);

        cb.checked = isSelected;
        if (isSelected) {
            container.classList.add('selected');
        } else {
            container.classList.remove('selected');
        }
    });

    updateToolbarCount();
    saveSelectedPostsToStorage(); // Persist to storage
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation() {
    if (selectedPosts.size === 0) return;

    const i18n = (key, ...args) => {
        const msg = chrome.i18n.getMessage(key, args);
        return msg || key; // Fallback to key if message not found
    };

    const overlay = document.createElement('div');
    overlay.className = 'grok-batch-modal-overlay';
    overlay.innerHTML = `
        <div class="grok-batch-modal">
            <h3>${i18n('batchDeleteConfirmTitle')}</h3>
            <p>${i18n('batchDeleteConfirmMsg', String(selectedPosts.size))}</p>

            <div class="grok-batch-modal-options">
                <label class="grok-batch-modal-option">
                    <input type="radio" name="deleteOption" value="unfavorite" checked>
                    <div class="grok-batch-modal-option-content">
                        <div class="grok-batch-modal-option-title">${i18n('batchDeleteOptionUnfavorite')}</div>
                        <div class="grok-batch-modal-option-desc">${i18n('batchDeleteOptionUnfavoriteDesc')}</div>
                    </div>
                </label>
                <label class="grok-batch-modal-option">
                    <input type="radio" name="deleteOption" value="delete">
                    <div class="grok-batch-modal-option-content">
                        <div class="grok-batch-modal-option-title">${i18n('batchDeleteOptionDelete')}</div>
                        <div class="grok-batch-modal-option-desc">${i18n('batchDeleteOptionDeleteDesc')}</div>
                        <div class="grok-batch-modal-warning">${i18n('batchDeleteWarning')}</div>
                    </div>
                </label>
            </div>

            <div class="grok-batch-modal-actions">
                <button class="grok-batch-modal-btn cancel">${i18n('batchDeleteCancel')}</button>
                <button class="grok-batch-modal-btn confirm">${i18n('batchDeleteConfirm')}</button>
            </div>
        </div>
    `;

    const cancelBtn = overlay.querySelector('.grok-batch-modal-btn.cancel');
    const confirmBtn = overlay.querySelector('.grok-batch-modal-btn.confirm');

    cancelBtn.addEventListener('click', () => overlay.remove());

    confirmBtn.addEventListener('click', async () => {
        const deleteOption = overlay.querySelector('input[name="deleteOption"]:checked').value;
        const deletePost = deleteOption === 'delete';

        // Show progress in toolbar
        showDeleteProgress();

        overlay.remove();

        // Execute deletion
        await executeBatchDelete(Array.from(selectedPosts), deletePost);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

/**
 * Show delete progress in toolbar
 */
function showDeleteProgress() {
    if (!batchSelectToolbar) return;

    const progressMsg = chrome.i18n.getMessage('batchDeleteProgress', ['0', String(selectedPosts.size)]) || `Deleting... 0/${selectedPosts.size}`;
    const waitMsg = chrome.i18n.getMessage('batchDeletePleaseWait') || 'Please wait...';

    const toolbar = batchSelectToolbar;
    toolbar.innerHTML = `
        <div class="grok-batch-progress">
            <div class="grok-batch-progress-spinner"></div>
            <span>${progressMsg}</span>
        </div>
        <button class="grok-batch-toolbar-btn cancel" disabled>${waitMsg}</button>
    `;
}

/**
 * Update delete progress
 */
function updateDeleteProgress(current, total) {
    const progressText = batchSelectToolbar?.querySelector('.grok-batch-progress span');
    if (progressText) {
        const msg = chrome.i18n.getMessage('batchDeleteProgress', [String(current), String(total)]) || `Deleting... ${current}/${total}`;
        progressText.textContent = msg;
    }
}

/**
 * Execute batch deletion
 */
async function executeBatchDelete(postIds, deletePost = false) {
    console.log(`[BatchSelect] Starting batch delete: ${postIds.length} posts, deletePost: ${deletePost}`);
    await SystemLogger.info('Batch delete started', `Total: ${postIds.length}, Delete post: ${deletePost}`);

    const total = postIds.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < postIds.length; i++) {
        const postId = postIds[i];
        updateDeleteProgress(i + 1, total);

        try {
            // Step 1: Unfavorite the post
            const unfavResult = await unfavoritePost(postId);
            if (!unfavResult.success) {
                console.error(`[BatchSelect] Failed to unfavorite ${postId}:`, unfavResult.error);
                failCount++;
                continue;
            }

            // Step 2: Delete post if requested
            if (deletePost) {
                const deleteResult = await deletePostById(postId);
                if (!deleteResult.success) {
                    console.error(`[BatchSelect] Failed to delete ${postId}:`, deleteResult.error);
                    // Still count as partial success since unfavorite worked
                }
            }

            successCount++;

            // Remove the post element from DOM
            removePostFromDOM(postId);

            // Small delay between API calls
            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.error(`[BatchSelect] Error processing ${postId}:`, error);
            failCount++;
        }
    }

    console.log(`[BatchSelect] Batch delete complete: ${successCount} success, ${failCount} failed`);
    await SystemLogger.info('Batch delete completed', `Success: ${successCount}, Failed: ${failCount}`);

    // Show completion message and exit
    showDeleteComplete(successCount, failCount, total);
}

/**
 * Unfavorite a post via API (same as Bulk Remove)
 */
async function unfavoritePost(postId) {
    try {
        const response = await fetch('https://grok.com/rest/media/post/unlike', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: postId })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete a post via API (same as Bulk Remove)
 */
async function deletePostById(postId) {
    try {
        const response = await fetch('https://grok.com/rest/media/post/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: postId })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Remove a post element from the DOM
 */
function removePostFromDOM(postId) {
    const checkbox = document.querySelector(`.grok-batch-checkbox[data-post-id="${postId}"]`);
    if (checkbox) {
        const card = checkbox.parentElement;
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => card.remove(), 300);
        }
    }
}

/**
 * Show deletion complete message
 */
function showDeleteComplete(success, failed, total) {
    if (!batchSelectToolbar) return;

    const message = failed > 0
        ? (chrome.i18n.getMessage('batchDeleteCompleteWithFail', [String(success), String(failed)]) || `✅ Completed: ${success} deleted, ${failed} failed`)
        : (chrome.i18n.getMessage('batchDeleteComplete', [String(success)]) || `✅ Successfully deleted ${success} items`);

    const closeText = chrome.i18n.getMessage('batchDeleteClose') || 'Close';

    batchSelectToolbar.innerHTML = `
        <span class="grok-batch-toolbar-count">${message}</span>
        <button class="grok-batch-toolbar-btn cancel">${closeText}</button>
    `;

    const closeBtn = batchSelectToolbar.querySelector('.cancel');
    closeBtn.addEventListener('click', exitBatchSelectMode);

    // Auto close after 3 seconds
    setTimeout(exitBatchSelectMode, 3000);
}

/**
 * MutationObserver for dynamically loaded posts
 */
let batchSelectObserver = null;

function setupBatchSelectObserver() {
    if (batchSelectObserver) return;

    let debounceTimer = null;

    batchSelectObserver = new MutationObserver((mutations) => {
        if (!batchSelectModeActive) return;

        // Debounce to avoid too many calls
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (!batchSelectModeActive) return;

            // Find new cards using cached data (don't refetch from API)
            const newCards = await findPostCards(true);
            newCards.forEach(card => {
                if (!card.element.querySelector('.grok-batch-checkbox')) {
                    addCheckboxToPost(card);
                }
            });
        }, 1000); // Longer debounce to reduce API calls
    });

    batchSelectObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ==========================================
// Video Gen Queue - Processing Logic (DOM-based)
// ==========================================

/**
 * Fallback listener for video generation results via postMessage.
 * If the normal relay chain (intercept → bridge → background → content.js)
 * fails to deliver queueItemResult within 5 seconds, this fallback
 * checks the DB state directly and continues queue processing.
 */
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'GROK_VIDEO_GEN_RESULT') return;
    if (!queueProcessingActive) return;

    const moderated = event.data.payload?.moderated === true;
    _queueResultPending = true;
    queueWaitingForResult = false; // Result received, allow new actions
    if (window._queueSubmitTimeout) { clearTimeout(window._queueSubmitTimeout); window._queueSubmitTimeout = null; }

    // Wait 5s for the normal handleQueueItemResult to fire (via bridge → background → content)
    setTimeout(async () => {
        if (!_queueResultPending) return; // Normal chain handled it
        _queueResultPending = false;

        console.log('[Queue] Fallback: normal relay chain timeout, handling result directly...');
        SystemLogger.warn('Queue fallback triggered', `moderated: ${moderated}`);

        try {
            const resp = await chrome.runtime.sendMessage({ action: 'getActiveQueueItem' });

            if (!resp.success || !resp.item) {
                // Item was already handled — check for next pending item
                const nextResp = await chrome.runtime.sendMessage({ action: 'getNextPendingItem' });
                if (nextResp.success && nextResp.item) {
                    SystemLogger.info('Queue fallback: moving to next', `PostId: ${nextResp.item.postId}`);
                    await processQueueItem(nextResp.item, true);
                } else {
                    queueProcessingActive = false;
                    chrome.storage.local.set({
                        queueProcessingState: { isProcessing: false, currentItemId: null }
                    });
                    SystemLogger.info('Queue completed (fallback)', 'All items processed');
                    chrome.runtime.sendMessage({ action: 'queueProgressUpdate', allDone: true }).catch(() => {});
                }
                return;
            }

            const item = resp.item;

            // Update counts in DB
            const updates = { totalAttempts: item.totalAttempts + 1 };
            if (moderated) {
                updates.currentFailure = item.currentFailure + 1;
                SystemLogger.fail('Queue video moderated (fallback)', `PostId: ${item.postId}, Failure: ${updates.currentFailure}/${item.maxRetries}`);
            } else {
                updates.currentSuccess = item.currentSuccess + 1;
                SystemLogger.ok('Queue video generated (fallback)', `PostId: ${item.postId}, Success: ${updates.currentSuccess}/${item.targetSuccess}`);
            }

            // Update prompt stats
            await chrome.runtime.sendMessage({ action: 'upsertPromptStats', prompt: item.prompt, moderated });

            // Determine next action
            const newSuccess = updates.currentSuccess !== undefined ? updates.currentSuccess : item.currentSuccess;
            const newFailure = updates.currentFailure !== undefined ? updates.currentFailure : item.currentFailure;
            let shouldRetry = false;
            let shouldMoveNext = false;

            if (newSuccess >= item.targetSuccess) {
                updates.status = 'completed';
                shouldMoveNext = true;
                SystemLogger.ok('Queue item completed (fallback)', `PostId: ${item.postId}, Success: ${newSuccess}`);
            } else if (newFailure >= item.maxRetries) {
                updates.status = 'failed';
                shouldMoveNext = true;
                SystemLogger.fail('Queue item failed (fallback)', `PostId: ${item.postId}, Max retries reached`);
            } else {
                shouldRetry = true;
            }

            // Save updated item
            await chrome.runtime.sendMessage({ action: 'updateQueueItem', id: item.id, updates });

            // Get next item if moving on
            let nextItem = null;
            if (shouldMoveNext) {
                const nextResp = await chrome.runtime.sendMessage({ action: 'getNextPendingItem' });
                nextItem = nextResp.success ? nextResp.item : null;
            }

            // Notify sidepanel
            chrome.runtime.sendMessage({
                action: 'queueProgressUpdate',
                queueItem: { ...item, ...updates },
                moderated,
                shouldMoveNext,
                nextItem
            }).catch(() => {});

            // Handle retry or move next
            if (shouldRetry) {
                SystemLogger.info('Queue fallback: retrying', `PostId: ${item.postId}`);
                setTimeout(async () => {
                    if (!queueProcessingActive) return;
                    const fresh = await chrome.runtime.sendMessage({ action: 'getQueueItem', id: item.id });
                    if (fresh.success && fresh.item && fresh.item.status === 'active') {
                        await queueFillAndSubmit(fresh.item);
                    }
                }, 2000);
            } else if (shouldMoveNext) {
                if (nextItem) {
                    SystemLogger.info('Queue fallback: moving to next', `PostId: ${nextItem.postId}`);
                    await processQueueItem(nextItem, true);
                } else {
                    queueProcessingActive = false;
                    chrome.storage.local.set({
                        queueProcessingState: { isProcessing: false, currentItemId: null }
                    });
                    SystemLogger.info('Queue completed (fallback)', 'All items processed');
                    chrome.runtime.sendMessage({ action: 'queueProgressUpdate', allDone: true }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('[Queue] Fallback error:', error);
            SystemLogger.fail('Queue fallback error', error.message);
        }
    }, 5000);
});

/**
 * Listen for 429 rate limit from intercept.js — stop queue and notify user
 */
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'GROK_RATE_LIMITED') return;
    if (!queueProcessingActive) return;

    console.warn('[Queue] 429 Rate Limited — stopping queue');
    SystemLogger.fail('Queue rate limited', '429 Too Many Requests — queue stopped');

    queueProcessingActive = false;
    queueWaitingForResult = false;
    chrome.storage.local.set({
        queueProcessingState: { isProcessing: false, currentItemId: null }
    });

    // Set current active item to error status with rate limit message
    (async () => {
        const resp = await chrome.runtime.sendMessage({ action: 'getActiveQueueItem' });
        if (resp.success && resp.item) {
            await chrome.runtime.sendMessage({
                action: 'updateQueueItem',
                id: resp.item.id,
                updates: {
                    status: 'error',
                    errorMessage: chrome.i18n.getMessage('queueRateLimited') || '429 Too Many Requests — please wait and try again'
                }
            });
        }
        // Notify sidepanel
        chrome.runtime.sendMessage({
            action: 'queueItemError',
            error: chrome.i18n.getMessage('queueRateLimited') || '429 Too Many Requests — please wait and try again'
        }).catch(() => {});
    })();
});

/**
 * Start queue processing: get next pending item and begin
 */
async function startQueueProcessing() {
    try {
        // Check usage limit before starting
        const usage = await chrome.runtime.sendMessage({ action: 'getQueueUsage' });
        if (usage.success && !usage.isPro && usage.count >= usage.limit) {
            return { success: false, error: chrome.i18n.getMessage('queueUsageLimitReached') || 'Free usage limit reached (50). Upgrade to Pro for unlimited use.' };
        }

        const resp = await chrome.runtime.sendMessage({ action: 'getNextPendingItem' });
        if (!resp.success || !resp.item) {
            // Check if there's an active item to resume
            const activeResp = await chrome.runtime.sendMessage({ action: 'getActiveQueueItem' });
            if (activeResp.success && activeResp.item) {
                queueProcessingActive = true;
                SystemLogger.info('Queue resumed', `Resuming item: ${activeResp.item.postId}`);
                await processQueueItem(activeResp.item, false);
                return { success: true };
            }
            return { success: false, error: 'No pending items in queue' };
        }

        queueProcessingActive = true;

        // Count total pending
        const allResp = await chrome.runtime.sendMessage({ action: 'getAllQueueItems' });
        const pendingCount = (allResp.items || []).filter(i => i.status === 'pending').length;
        SystemLogger.info('Queue started', `Items: ${pendingCount}`);

        await processQueueItem(resp.item, true);
        return { success: true };
    } catch (error) {
        console.error('[Queue] Failed to start:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Process a single queue item — navigate to post page and fill prompt
 * @param {Object} item - Queue item to process
 * @param {boolean} navigate - Whether to navigate to the post page
 */
async function processQueueItem(item, navigate = true) {
    if (!queueProcessingActive) return;

    try {
        // Set item to active
        await chrome.runtime.sendMessage({
            action: 'updateQueueItem',
            id: item.id,
            updates: { status: 'active' }
        });

        const targetUrl = `https://grok.com/imagine/post/${item.postId}`;
        // Force navigate if current page doesn't match the target post detail page
        const onCorrectPage = window.location.pathname.includes(`/imagine/post/${item.postId}`);
        if (!navigate && !onCorrectPage) {
            console.log(`[Queue] Not on correct page (${window.location.pathname}), forcing navigation`);
            navigate = true;
        }
        SystemLogger.info('Queue item processing', `PostId: ${item.postId}, Navigate: ${navigate}, Prompt: "${item.prompt.substring(0, 50)}...", Target URL: ${targetUrl}`);

        if (navigate) {
            // Store queue processing state for cross-page resumption
            await chrome.storage.local.set({
                queueProcessingState: {
                    isProcessing: true,
                    currentItemId: item.id,
                    navigateTimestamp: Date.now()
                }
            });

            // Navigate to the post page
            SystemLogger.info('Queue navigating', `Navigating to: ${targetUrl}`);
            window.location.href = targetUrl;
        } else {
            // Already on the page — fill and submit
            await queueFillAndSubmit(item);
        }
    } catch (error) {
        console.error('[Queue] Error processing item:', error);
        SystemLogger.fail('Queue item error', `PostId: ${item.postId}, Error: ${error.message}`);
        await chrome.runtime.sendMessage({
            action: 'queueItemError',
            error: error.message
        });
        // Auto-advance to next item instead of stopping
        autoAdvanceQueue();
    }
}

/**
 * Auto-advance queue to the next pending item after an error.
 * Instead of stopping the queue, mark error and continue processing.
 */
async function autoAdvanceQueue(delayMs = 3000) {
    if (!queueProcessingActive) return;

    await new Promise(r => setTimeout(r, delayMs));

    if (!queueProcessingActive) return; // User may have paused/stopped during delay

    try {
        const resp = await chrome.runtime.sendMessage({ action: 'getNextPendingItem' });
        if (resp.success && resp.item) {
            SystemLogger.info('Queue auto-advancing', `Next PostId: ${resp.item.postId}`);
            await processQueueItem(resp.item, true);
        } else {
            // No more items
            queueProcessingActive = false;
            chrome.storage.local.set({
                queueProcessingState: { isProcessing: false, currentItemId: null }
            });
            SystemLogger.info('Queue completed', 'All items processed (after error)');
            chrome.runtime.sendMessage({ action: 'queueProgressUpdate', allDone: true }).catch(() => {});
        }
    } catch (error) {
        console.error('[Queue] Auto-advance failed:', error);
        queueProcessingActive = false;
    }
}

/**
 * V2 UI: Switch from image mode to video mode if needed.
 * Scenarios:
 *   A) Already on video post → submit "Make video" enabled → no-op
 *   B) On post with Video/Image toggle (has video child) → click "Video" toggle
 *   C) On fresh image post (no video yet) → Settings dropdown → "Make Video" menuitem
 */
async function switchToVideoModeIfNeeded() {
    // Check if already in video mode:
    // - Submit button has aria-label="Make video" (may still be disabled during hydration)
    // - OR contenteditable exists (V2 video mode always has one)
    const findSubmitBtn = () => Array.from(document.querySelectorAll('button')).find(b => {
        const paths = b.querySelectorAll('svg path');
        for (const p of paths) {
            if ((p.getAttribute('d') || '').includes('M12 5V19')) return true;
        }
        return false;
    });

    const svgBtn = findSubmitBtn();
    const svgLabel = svgBtn?.getAttribute('aria-label') || '';
    // Check button text content as fallback (some labels are in textContent, not aria-label)
    const svgText = svgBtn?.textContent?.trim() || '';

    // Only skip mode switch if we're SURE we're in video mode.
    // Check both aria-label and textContent for "make video" (case-insensitive, any language).
    // "video" keyword appears in video mode labels across languages but not in edit/image mode.
    const isVideoLabel = /video|影片|ビデオ|비디오/i.test(svgLabel + ' ' + svgText);
    if (svgBtn && isVideoLabel) {
        console.log(`[Queue] Already in video mode (label="${svgLabel}", text="${svgText}"), no switch needed`);
        return;
    }

    // For any other label (Edit/編輯/Submit/unknown), attempt mode switch.
    // If already in video mode with an unrecognized label, the switch function
    // will find no "Make Video" menuitem and return gracefully.
    console.log(`[Queue] V2: Attempting to switch to video mode (label="${svgLabel}", text="${svgText}")...`);

    // Strategy 1: Click "Video" toggle in Media type selection (post already has video child)
    const mediaSelection = document.querySelector('[aria-label="Media type selection"]');
    if (mediaSelection) {
        const videoToggle = Array.from(mediaSelection.querySelectorAll('button'))
            .find(b => b.textContent?.trim() === 'Video');
        if (videoToggle) {
            console.log('[Queue] V2: Found Video/Image toggle, clicking "Video"...');
            videoToggle.click();
            await new Promise(r => setTimeout(r, 1500));
            // Verify switch worked
            const btn = findSubmitBtn();
            if (btn && !btn.disabled && btn.getAttribute('aria-label') === 'Make video') {
                console.log('[Queue] V2: Switched to video mode via toggle');
                return;
            }
            console.log('[Queue] V2: Video toggle clicked but submit not ready, trying Settings dropdown...');
        }
    }

    // Strategy 2: Settings dropdown → "Make Video" menuitem (fresh image post, no video yet)
    let settingsBtn = null;
    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'))
        .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
    if (editables.length > 0) {
        let parent = editables[0].parentElement;
        for (let i = 0; i < 8 && parent; i++) {
            settingsBtn = parent.querySelector('button[aria-haspopup="menu"]');
            if (settingsBtn) break;
            parent = parent.parentElement;
        }
    }

    if (!settingsBtn) {
        console.log('[Queue] V2: Settings button not found, skipping mode switch');
        return;
    }

    // Try multiple click strategies with retry (page may still be hydrating)
    const evtOpts = { bubbles: true, cancelable: true, view: window };
    const simulateClick = (el) => {
        el.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1 }));
        el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
        el.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1 }));
        el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
        el.dispatchEvent(new MouseEvent('click', evtOpts));
    };

    let menu = null;
    for (let clickAttempt = 0; clickAttempt < 5; clickAttempt++) {
        if (clickAttempt === 0) {
            settingsBtn.click();
        } else if (clickAttempt === 1) {
            simulateClick(settingsBtn);
        } else {
            settingsBtn.focus();
            settingsBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            settingsBtn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 600));
        menu = document.querySelector('[role="menu"]');
        if (menu) break;
        console.log(`[Queue] V2: Menu not open, retrying (${clickAttempt + 1}/5)...`);
    }

    if (!menu) {
        console.log('[Queue] V2: Menu did not open after 5 attempts');
        return;
    }

    // Look for "Make Video" menuitem
    const items = menu.querySelectorAll('[role="menuitem"]');
    let makeVideoItem = null;
    for (const item of items) {
        const text = item.innerText?.trim();
        if (text && (text.startsWith('Make Video') || text.startsWith('製作影片'))) {
            makeVideoItem = item;
            break;
        }
    }

    if (makeVideoItem) {
        console.log('[Queue] V2: Found "Make Video" menuitem, clicking to switch mode...');
        makeVideoItem.click();
        await new Promise(r => setTimeout(r, 1000));
        console.log('[Queue] V2: Switched to video mode via Settings');
    } else {
        // No "Make Video" found — already in video mode (presets shown instead)
        console.log('[Queue] V2: "Make Video" not found in menu, already in video mode');
        // Close dropdown by clicking Settings button again (Escape navigates the page away!)
        settingsBtn.click();
        await new Promise(r => setTimeout(r, 200));
    }
}

/**
 * V2 UI: Apply video settings (duration, resolution, mode) by clicking the UI controls.
 * More reliable than relying solely on intercept.js request body patching.
 * Opens Settings dropdown, clicks the correct buttons/menuitems, then closes.
 */
async function applyVideoSettingsV2(settingsBtn, videoLength, resolutionName, mode) {
    if (!settingsBtn) return;

    const targetDuration = String(videoLength || 6) + 's'; // "6s" or "10s"
    const targetResolution = resolutionName || '480p';      // "480p" or "720p"

    // Mode → preset name mapping (reverse of PRESET_TO_MODE)
    const MODE_TO_PRESET = {
        'extremely-spicy-or-crazy': 'Spicy',
        'extremely-crazy': 'Fun',
        'normal': 'Normal'
    };
    const targetPreset = MODE_TO_PRESET[mode] || null; // null for 'custom' — no preset to click

    // Open Settings dropdown using full pointer event sequence (Radix needs pointer events, not just .click())
    const evtOpts = { bubbles: true, cancelable: true, view: window };
    const simulateClickFn = (el) => {
        el.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1 }));
        el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
        el.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1 }));
        el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
        el.dispatchEvent(new MouseEvent('click', evtOpts));
    };

    let menu = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        menu = document.querySelector('[role="menu"]');
        if (menu) break;
        simulateClickFn(settingsBtn);
        await new Promise(r => setTimeout(r, 600));
        menu = document.querySelector('[role="menu"]');
        if (menu) break;
        console.log(`[Queue] V2: Settings menu not open, retrying (${attempt + 1}/3)...`);
        await new Promise(r => setTimeout(r, 300));
    }
    if (!menu) {
        console.log('[Queue] V2: Could not open Settings to apply video settings');
        return;
    }

    // Click duration/resolution buttons
    const buttons = menu.querySelectorAll('button');
    let appliedDuration = false;
    let appliedResolution = false;

    for (const btn of buttons) {
        const text = btn.textContent?.trim();
        if (text === targetDuration && !appliedDuration) {
            btn.click();
            appliedDuration = true;
        }
        if (text === targetResolution && !appliedResolution) {
            btn.click();
            appliedResolution = true;
        }
    }

    // Click mode preset menuitem (Spicy/Fun/Normal) — skip for 'custom'
    let appliedMode = false;
    if (targetPreset) {
        const items = menu.querySelectorAll('[role="menuitem"]');
        for (const item of items) {
            const text = item.innerText?.trim();
            if (text && (text === targetPreset || text.startsWith(targetPreset + '\n') || text.startsWith(targetPreset + ' '))) {
                item.click();
                appliedMode = true;
                break;
            }
        }
    }

    // Close dropdown by clicking Settings button again (Escape navigates the page away!)
    // Must use simulateClickFn — Radix dropdowns ignore plain .click() from content scripts
    await new Promise(r => setTimeout(r, 200));
    const menuStillOpen = document.querySelector('[role="menu"]');
    if (menuStillOpen && settingsBtn) {
        simulateClickFn(settingsBtn);
        await new Promise(r => setTimeout(r, 300));
        // Verify closed
        if (document.querySelector('[role="menu"]')) {
            console.warn('[Queue] V2: Settings dropdown still open after close attempt, trying again...');
            simulateClickFn(settingsBtn);
            await new Promise(r => setTimeout(r, 300));
        }
    }

    console.log(`[Queue] V2: Applied settings — duration: ${appliedDuration ? targetDuration : 'skip'}, resolution: ${appliedResolution ? targetResolution : 'skip'}, mode: ${appliedMode ? targetPreset : (mode === 'custom' ? 'custom(no preset)' : 'not found')}`);
}

/**
 * Fill a contenteditable element with text.
 * ProseMirror/TipTap doesn't recognize execCommand or innerHTML from content scripts (ISOLATED world).
 * Uses MAIN world message passing to access TipTap's editor API (el.editor.commands.insertContent).
 */
async function fillContentEditable(el, text) {
    // Strategy 1: Use MAIN world TipTap API via intercept.js message handler
    // This is the only reliable way — content script can't access el.editor (page JS property)
    console.log(`[Queue] fillContentEditable: requesting MAIN world fill via postMessage (${text.length} chars)`);

    const fillResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ success: false, error: 'timeout' });
        }, 3000);

        function handler(event) {
            if (event.source !== window || event.data?.type !== 'GROK_FILL_EDITOR_RESULT') return;
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(event.data.payload);
        }
        window.addEventListener('message', handler);

        window.postMessage({
            type: 'GROK_FILL_EDITOR',
            payload: { text }
        }, '*');
    });

    if (fillResult.success) {
        console.log(`[Queue] ✅ contenteditable filled via TipTap API (${fillResult.length} chars)`);
        return;
    }
    console.warn(`[Queue] MAIN world fill failed: ${fillResult.error}, falling back to execCommand`);

    // Strategy 2: execCommand fallback (fills DOM but may not update ProseMirror state)
    el.click();
    await new Promise(r => setTimeout(r, 100));
    el.focus();
    await new Promise(r => setTimeout(r, 200));

    // Clear existing content
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    if (el.textContent?.trim()) {
        document.execCommand('delete', false);
        await new Promise(r => setTimeout(r, 100));
    }

    document.execCommand('insertText', false, text);
    await new Promise(r => setTimeout(r, 300));

    const filled = el.textContent?.trim();
    console.log(`[Queue] contenteditable filled via execCommand (${filled?.length || 0} chars, ProseMirror may not see it)`);
    // Set prompt as data attribute so intercept.js can patch the API request body as safety net
    document.documentElement.dataset.grokQueuePrompt = text;
}

/**
 * Fill prompt and submit for queue item on current page
 */
async function queueFillAndSubmit(item) {
    try {
        // Verify we're on a post detail page (URL may differ if post has edits/variants)
        if (!window.location.pathname.includes(`/imagine/post/${item.postId}`)) {
            if (window.location.pathname.includes('/imagine/post/')) {
                console.warn(`[Queue] URL redirected: expected /imagine/post/${item.postId}, got ${window.location.pathname} — continuing (post may have variants)`);
            } else {
                throw new Error(`Wrong page: expected /imagine/post/${item.postId}, got ${window.location.pathname}`);
            }
        }

        SystemLogger.info('Queue prompt submitted', `PostId: ${item.postId}, Attempt: ${item.totalAttempts + 1}/${item.maxRetries}`);

        // Helper to find prompt input (textarea for V1, contenteditable for V2)
        const findInput = () => {
            const candidates = Array.from(document.querySelectorAll('textarea[placeholder], input[placeholder*="Enter"], [contenteditable="true"]'))
                .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
            return candidates.length > 0 ? candidates[0] : null;
        };

        // Wait for input to appear (quick check first, 5s)
        let input = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            input = findInput();
            if (input) break;
            await new Promise(r => setTimeout(r, 500));
        }

        // V2: If no input found yet, page might be in Image mode (no contenteditable).
        // Try switching to Video mode first, then re-search.
        if (!input) {
            console.log('[Queue] V2: No input found — page may be in Image mode, attempting mode switch...');
            await new Promise(r => setTimeout(r, 1000));
            await switchToVideoModeIfNeeded();
            await new Promise(r => setTimeout(r, 1500));
            // Re-search after mode switch
            for (let attempt = 0; attempt < 10; attempt++) {
                input = findInput();
                if (input) break;
                await new Promise(r => setTimeout(r, 500));
            }
        }

        if (!input) {
            const pageTitle = document.title;
            const bodyText = document.body?.innerText?.substring(0, 200) || '(empty)';
            SystemLogger.fail('Queue input not found', `Page title: "${pageTitle}", Body preview: "${bodyText.substring(0, 100)}..."`);
            throw new Error('Could not find prompt input on page');
        }

        SystemLogger.info('Queue input found', `Tag: ${input.tagName}, Placeholder: "${input.placeholder || 'none'}", Page: ${window.location.href.substring(0, 80)}`);

        // V2: Ensure video mode + apply settings
        if (input.tagName !== 'TEXTAREA') {
            // Wait extra time for React hydration before trying to interact with UI
            console.log('[Queue] V2 detected (contenteditable), waiting for hydration...');
            await new Promise(r => setTimeout(r, 2000));
            await switchToVideoModeIfNeeded();

            // V2: Apply duration/resolution/mode via UI buttons
            const settingsBtn2 = (() => {
                const eds = Array.from(document.querySelectorAll('[contenteditable="true"]'))
                    .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
                if (eds.length === 0) return null;
                let p = eds[0].parentElement;
                for (let i = 0; i < 8 && p; i++) {
                    const btn = p.querySelector('button[aria-haspopup="menu"]');
                    if (btn) return btn;
                    p = p.parentElement;
                }
                return null;
            })();
            await applyVideoSettingsV2(settingsBtn2, item.videoLength, item.resolutionName, item.mode);

            // Clear stale preset cache (mode switch changes available presets)
            _cachedAvailablePresets = null;

            // Re-find input after mode switch (contenteditable may have been recreated)
            const freshInput = findInput();
            if (freshInput && freshInput !== input) {
                input = freshInput;
                console.log('[Queue] Re-acquired input after mode switch');
            }
        }

        // Fill the prompt using native setter to trigger React state update
        input.focus();
        if (input.tagName === 'TEXTAREA') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeSetter.call(input, item.prompt);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (input.tagName === 'INPUT') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(input, item.prompt);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // V2 UI: contenteditable — try multiple strategies to fill text
            await fillContentEditable(input, item.prompt);
        }

        // Wait for React to process the input
        await new Promise(r => setTimeout(r, 500));

        // Set video generation overrides via DOM data attributes (read by intercept.js in MAIN world)
        // Always set — use item values or defaults for items created before this feature
        const videoLength = item.videoLength || 6;
        const resolutionName = item.resolutionName || '480p';
        const mode = item.mode || 'custom';
        document.documentElement.dataset.grokQueueVideoLength = String(videoLength);
        document.documentElement.dataset.grokQueueResolution = resolutionName;
        document.documentElement.dataset.grokQueueMode = mode;
        // Always pass prompt to intercept.js as safety net (in case contenteditable fill didn't register with framework)
        document.documentElement.dataset.grokQueuePrompt = item.prompt;
        console.log(`[Queue] Video overrides set: ${videoLength}s, ${resolutionName}, mode=${mode}, prompt=${item.prompt.substring(0, 30)}...`);

        // Find the "Make Video" button with retry (page may still be rendering)
        // Strategy 1: aria-label match (most reliable, language-aware)
        // Strategy 2: button with bg-button-filled class (V1 UI)
        // Strategy 3: SVG arrow-up path near input area (filter out Video toggle etc.)
        let submitBtn = null;
        for (let btnAttempt = 0; btnAttempt < 10; btnAttempt++) {
            // Strategy 1: aria-label (V2 submit button always has this)
            submitBtn = document.querySelector('button[aria-label="Make video"]') ||
                       document.querySelector('button[aria-label="製作影片"]') ||
                       document.querySelector('button[aria-label="制作视频"]') ||
                       document.querySelector('button[aria-label="ビデオを作成"]') ||
                       document.querySelector('button[aria-label="비디오 만들기"]');
            // Strategy 2: V1 button class
            if (!submitBtn) {
                submitBtn = document.querySelector('button[data-slot="button"][class*="bg-button-filled"]');
            }
            // Strategy 3: SVG arrow-up path, but only near the input/contenteditable area
            if (!submitBtn) {
                const inputArea = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea[placeholder]');
                const inputContainer = inputArea?.closest('[class*="flex"]')?.parentElement?.parentElement;
                const searchScope = inputContainer || document;
                const allButtons = Array.from(searchScope.querySelectorAll('button'));
                submitBtn = allButtons.find(b => {
                    const paths = b.querySelectorAll('svg path');
                    for (const p of paths) {
                        if ((p.getAttribute('d') || '').includes('M12 5V19')) return true;
                    }
                    return false;
                }) || null;
            }
            if (submitBtn) break;
            console.log(`[Queue] Submit button not found, retrying (${btnAttempt + 1}/10)...`);
            await new Promise(r => setTimeout(r, 500));
        }

        if (submitBtn) {
            // Wait for button to become enabled (after text input is processed)
            if (submitBtn.disabled) {
                console.log('[Queue] Submit button found but disabled, waiting for enable...');
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    if (!submitBtn.disabled) break;
                    // After 3s, try re-filling the contenteditable (framework may not have registered)
                    if (i === 5 && input.tagName !== 'TEXTAREA' && input.tagName !== 'INPUT') {
                        console.log('[Queue] Button still disabled after 3s, re-filling contenteditable...');
                        await fillContentEditable(input, item.prompt);
                    }
                }
            }

            if (!submitBtn.disabled) {
                SystemLogger.info('Queue submit button found', `Text: "${submitBtn.textContent?.trim()}", AriaLabel: "${submitBtn.getAttribute('aria-label') || 'none'}", Class: "${submitBtn.className?.substring(0, 60)}"`);

                // V2 (contenteditable): Submit via Enter key in MAIN world — most reliable
                // V1 (textarea): Use button click with simulateClick
                let submitted = false;
                if (input.tagName !== 'TEXTAREA' && input.tagName !== 'INPUT') {
                    console.log('[Queue] V2: submitting via Enter key in MAIN world...');
                    const enterResult = await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            window.removeEventListener('message', handler);
                            resolve({ success: false, error: 'timeout' });
                        }, 2000);
                        function handler(event) {
                            if (event.source !== window || event.data?.type !== 'GROK_SUBMIT_EDITOR_RESULT') return;
                            clearTimeout(timeout);
                            window.removeEventListener('message', handler);
                            resolve(event.data.payload);
                        }
                        window.addEventListener('message', handler);
                        window.postMessage({ type: 'GROK_SUBMIT_EDITOR', payload: {} }, '*');
                    });
                    if (enterResult.success) {
                        console.log('[Queue] ✅ Submitted via Enter key in MAIN world');
                        submitted = true;
                    } else {
                        console.warn(`[Queue] Enter key submit failed: ${enterResult.error}, falling back to button click`);
                    }
                }

                if (!submitted) {
                    // Button click with full pointer event sequence
                    const evtOpts = { bubbles: true, cancelable: true, view: window };
                    submitBtn.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1 }));
                    submitBtn.dispatchEvent(new MouseEvent('mousedown', evtOpts));
                    submitBtn.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1 }));
                    submitBtn.dispatchEvent(new MouseEvent('mouseup', evtOpts));
                    submitBtn.dispatchEvent(new MouseEvent('click', evtOpts));
                    console.log('[Queue] Submitted via button click (simulateClick)');
                }

                queueWaitingForResult = true;
            } else {
                SystemLogger.fail('Queue submit button disabled', `Text: "${submitBtn.textContent?.trim()}", waited 5s`);
                throw new Error('Video generation button found but remained disabled');
            }
        } else {
            const allButtons = document.querySelectorAll('button');
            const btnInfo = Array.from(allButtons).slice(0, 10).map(b => `"${b.textContent?.trim().substring(0, 30)}" disabled=${b.disabled}`).join(', ');
            SystemLogger.fail('Queue submit button not found', `Buttons on page: [${btnInfo}]`);
            throw new Error('Could not find the video generation button');
        }

        console.log('[Queue] Prompt submitted, waiting for result...');

        // Timeout: if no result within 90s, treat as failure and auto-advance
        const submitTimeout = setTimeout(() => {
            if (!queueWaitingForResult) return; // Result already received
            console.warn('[Queue] Timeout: no video gen result after 90s');
            SystemLogger.fail('Queue submit timeout', `PostId: ${item.postId}, no result after 90s`);
            queueWaitingForResult = false;
            chrome.runtime.sendMessage({
                action: 'queueItemError',
                error: 'Timeout: no video generation result after 90s'
            });
            autoAdvanceQueue();
        }, 90000);

        // Store timeout ID so it can be cleared when result arrives
        window._queueSubmitTimeout = submitTimeout;
    } catch (error) {
        console.error('[Queue] Fill and submit error:', error);
        SystemLogger.fail('Queue fill & submit error', `PostId: ${item.postId}, Error: ${error.message}, URL: ${window.location.href.substring(0, 80)}`);
        queueWaitingForResult = false;
        await chrome.runtime.sendMessage({
            action: 'queueItemError',
            error: error.message
        });
        // Auto-advance to next item instead of stopping
        autoAdvanceQueue();
    }
}

/**
 * Handle result from background.js after video generation
 * (triggered by interceptor → bridge → background → queueItemResult)
 */
function handleQueueItemResult(data) {
    _queueResultPending = false; // Mark as handled by normal relay chain
    queueWaitingForResult = false; // Allow new submissions
    if (window._queueSubmitTimeout) { clearTimeout(window._queueSubmitTimeout); window._queueSubmitTimeout = null; }
    console.log('[Queue] handleQueueItemResult called:', { queueProcessingActive, shouldRetry: data.shouldRetry, shouldMoveNext: data.shouldMoveNext, moderated: data.moderated });
    SystemLogger.info('Queue result received', `moderated: ${data.moderated}, shouldRetry: ${data.shouldRetry}, shouldMoveNext: ${data.shouldMoveNext}, PostId: ${data.queueItem?.postId}`);

    if (!queueProcessingActive) {
        SystemLogger.warn('Queue result ignored', 'queueProcessingActive is false');
        return;
    }

    const { queueItem, moderated, shouldRetry, shouldMoveNext, nextItem, usageLimitReached } = data;

    if (usageLimitReached) {
        // Usage limit reached — stop queue
        queueProcessingActive = false;
        chrome.storage.local.set({
            queueProcessingState: { isProcessing: false, currentItemId: null }
        });
        SystemLogger.fail('Queue stopped', 'Free usage limit reached (50)');
        chrome.runtime.sendMessage({ action: 'queueProgressUpdate', usageLimitReached: true }).catch(() => {});
        return;
    }

    if (shouldRetry) {
        // Wait then refill and resubmit on the same page
        const reason = moderated ? 'Moderated' : 'Success but target not reached';
        SystemLogger.info('Queue retrying', `${reason}, retrying in 2s...`);
        setTimeout(async () => {
            if (!queueProcessingActive) {
                console.log('[Queue] Retry cancelled: queueProcessingActive became false');
                return;
            }
            try {
                // Refetch latest item state
                const resp = await chrome.runtime.sendMessage({ action: 'getQueueItem', id: queueItem.id });
                if (resp.success && resp.item && resp.item.status === 'active') {
                    console.log('[Queue] Retry: calling queueFillAndSubmit...');
                    await queueFillAndSubmit(resp.item);
                } else {
                    console.log('[Queue] Retry skipped: item not active', resp);
                }
            } catch (error) {
                console.error('[Queue] Retry error:', error);
                SystemLogger.fail('Queue retry error', error.message);
            }
        }, 2000);
    } else if (shouldMoveNext) {
        if (nextItem) {
            // Navigate to next item's post page
            SystemLogger.info('Queue moving to next', `PostId: ${nextItem.postId}`);
            processQueueItem(nextItem, true);
        } else {
            // All done
            queueProcessingActive = false;
            chrome.storage.local.set({
                queueProcessingState: { isProcessing: false, currentItemId: null }
            });
            SystemLogger.info('Queue completed', 'All items processed');
            chrome.runtime.sendMessage({ action: 'queueProgressUpdate', allDone: true }).catch(() => {});
        }
    }
}

/**
 * Pause queue processing
 */
function pauseQueueProcessing() {
    queueProcessingActive = false;
    queueWaitingForResult = false;
    chrome.storage.local.set({
        queueProcessingState: { isProcessing: false, currentItemId: null }
    });
    SystemLogger.warn('Queue paused', 'By user');
}

/**
 * Stop queue processing and reset active item to pending
 */
async function stopQueueProcessing() {
    queueProcessingActive = false;
    queueWaitingForResult = false;

    // Reset active item to pending
    const resp = await chrome.runtime.sendMessage({ action: 'getActiveQueueItem' });
    if (resp.success && resp.item) {
        await chrome.runtime.sendMessage({
            action: 'updateQueueItem',
            id: resp.item.id,
            updates: { status: 'pending' }
        });
    }

    await chrome.storage.local.set({
        queueProcessingState: { isProcessing: false, currentItemId: null }
    });
    SystemLogger.warn('Queue stopped', 'By user');
}

/**
 * Check for queue processing state on page load (resume after navigation)
 */
let _queueResumeInProgress = false;
async function checkQueueProcessingOnLoad() {
    const currentUrl = window.location.href;
    if (!currentUrl.includes('/imagine/post/')) return;

    // If we already submitted and are waiting for the interceptor result, don't re-submit
    if (queueWaitingForResult) {
        console.log('[Queue] checkQueueProcessingOnLoad skipped: waiting for video gen result');
        return;
    }

    // Prevent duplicate concurrent execution (called from both setTimeout and setInterval)
    if (_queueResumeInProgress) {
        console.log('[Queue] checkQueueProcessingOnLoad skipped: already in progress');
        return;
    }
    _queueResumeInProgress = true;

    try {
        const result = await chrome.storage.local.get('queueProcessingState');
        const state = result.queueProcessingState;

        if (!state || !state.isProcessing || !state.currentItemId) {
            console.log('[Queue] checkQueueProcessingOnLoad: no active processing state');
            return;
        }

        SystemLogger.info('Queue resume check', `State: isProcessing=${state.isProcessing}, itemId=${state.currentItemId}, URL: ${currentUrl.substring(0, 80)}`);

        // Get the current item to check if we're on the correct post page
        const resp = await chrome.runtime.sendMessage({ action: 'getQueueItem', id: state.currentItemId });
        if (!resp.success || !resp.item || resp.item.status !== 'active') {
            SystemLogger.warn('Queue resume skipped', `Item not found or not active: success=${resp.success}, status=${resp.item?.status}`);
            return;
        }

        // Check if we're on the correct post page for the active item
        const urlMatch = currentUrl.includes(resp.item.postId);
        if (!urlMatch) {
            // Grok may redirect child/alias posts to a canonical parent URL.
            // If the navigation was recent (within 15s), trust it and proceed.
            const elapsed = state.navigateTimestamp ? Date.now() - state.navigateTimestamp : Infinity;
            if (elapsed > 15000) {
                SystemLogger.warn('Queue resume URL mismatch', `Expected postId "${resp.item.postId}" in URL "${currentUrl.substring(0, 80)}" (stale, ${Math.round(elapsed / 1000)}s ago)`);
                return;
            }
            SystemLogger.warn('Queue resume URL redirected', `Expected "${resp.item.postId}" but got "${currentUrl.substring(0, 80)}" — proceeding (navigated ${Math.round(elapsed / 1000)}s ago)`);
        }

        SystemLogger.info('Queue resuming on page load', `PostId: ${resp.item.postId}, Prompt: "${resp.item.prompt?.substring(0, 50)}..."`);
        queueProcessingActive = true;

        // Wait for page to load then fill and submit
        await new Promise(r => setTimeout(r, 1500));
        await queueFillAndSubmit(resp.item);
    } catch (error) {
        console.error('[Queue] Error resuming queue on load:', error);
    } finally {
        _queueResumeInProgress = false;
    }
}

// ==========================================
// Video Gen Queue - "Add to Queue" UI
// ==========================================

/** Get active toggle value from a toggle row */
function getToggleValue(rowId) {
    const active = document.querySelector(`#${rowId} .grok-queue-toggle-btn.active`);
    return active ? active.dataset.value : null;
}

/** Set active toggle button by value */
function setToggleActive(rowId, value) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.querySelectorAll('.grok-queue-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
    });
}

/** Update prompt textarea placeholder based on selected mode */
function updatePromptHint(mode) {
    const promptEl = document.getElementById('grok-queue-prompt');
    if (!promptEl) return;
    if (mode === 'custom') {
        promptEl.placeholder = 'Enter video generation prompt...';
    } else {
        promptEl.placeholder = 'Optional — AI generates if empty';
    }
}

// Cache + lock to prevent race condition between duplicate detection calls
let _cachedAvailablePresets = null;
let _detectPresetsPromise = null;

/**
 * Detect available video generation presets from the Video Options dropdown.
 * Opens the dropdown invisibly, reads menuitem labels, maps to mode values, closes.
 * Results are cached. Concurrent calls share the same promise (no race condition).
 */
async function detectAvailablePresets() {
    if (_cachedAvailablePresets) {
        console.log('[Queue] Using cached presets:', _cachedAvailablePresets);
        return _cachedAvailablePresets;
    }

    // If another call is already running, wait for it instead of opening dropdown again
    if (_detectPresetsPromise) {
        console.log('[Queue] Waiting for in-progress preset detection...');
        return _detectPresetsPromise;
    }

    _detectPresetsPromise = _detectAvailablePresetsImpl();
    try {
        const result = await _detectPresetsPromise;
        return result;
    } finally {
        _detectPresetsPromise = null;
    }
}

async function _detectAvailablePresetsImpl() {
    const PRESET_TO_MODE = {
        'Spicy': 'extremely-spicy-or-crazy',
        'Fun': 'extremely-crazy',
        'Normal': 'normal'
    };
    const availableModes = ['custom']; // Custom is always available

    try {
        // Find Video Options / Settings button
        // V1: <textarea> parent has button[aria-haspopup="menu"]
        // V2: no textarea, uses <p contenteditable="true">; button is in a broader ancestor
        let videoOptsBtn = null;

        // V1 approach: find textarea → find button in its parent
        const textareas = Array.from(document.querySelectorAll('textarea[placeholder]'))
            .filter(t => t.id !== 'grok-queue-prompt' && !t.closest('#grok-queue-fab'));
        if (textareas.length > 0) {
            videoOptsBtn = textareas[0].parentElement?.querySelector('button[aria-haspopup="menu"]');
        }

        // V2 approach: find contenteditable, walk up ancestors to find button
        if (!videoOptsBtn) {
            const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'))
                .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
            if (editables.length > 0) {
                let parent = editables[0].parentElement;
                for (let i = 0; i < 8 && parent; i++) {
                    videoOptsBtn = parent.querySelector('button[aria-haspopup="menu"]');
                    if (videoOptsBtn) break;
                    parent = parent.parentElement;
                }
            }
        }

        if (!videoOptsBtn) {
            console.log('[Queue] Video Options/Settings button not found, showing all modes');
            return null;
        }

        // Hide the menu while we read it to avoid visual flash
        const hideStyle = document.createElement('style');
        hideStyle.textContent = '[role="menu"] { opacity: 0 !important; pointer-events: none !important; }';
        document.head.appendChild(hideStyle);

        // Radix requires full pointer event sequence, simple .click() won't work
        const evtOpts = { bubbles: true, cancelable: true, view: window };
        const simulateClick = (el) => {
            el.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1 }));
            el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
            el.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1 }));
            el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
            el.dispatchEvent(new MouseEvent('click', evtOpts));
        };

        // Open dropdown
        simulateClick(videoOptsBtn);
        await new Promise(r => setTimeout(r, 500));

        // Read preset menuitems — universal approach for both V1 and V2:
        // V1: leaf items (no children), innerText = "Fun", "Normal"
        // V2: items with children (img+text), innerText = "Fun\nHilarious results", "Spicy\nMight be NSFW"
        // Use innerText (respects block elements, adds \n) instead of textContent (concatenates without separator)
        const menu = document.querySelector('[role="menu"]');
        if (menu) {
            const items = menu.querySelectorAll('[role="menuitem"]');
            for (const item of items) {
                const text = item.innerText?.trim();
                if (!text) continue;
                for (const [presetName, modeValue] of Object.entries(PRESET_TO_MODE)) {
                    if (text === presetName || text.startsWith(presetName + ' ') || text.startsWith(presetName + '\n')) {
                        availableModes.push(modeValue);
                        break;
                    }
                }
            }
        }

        // Close dropdown
        simulateClick(videoOptsBtn);
        await new Promise(r => setTimeout(r, 100));

        // Remove hiding style
        hideStyle.remove();

        console.log('[Queue] Detected available presets:', availableModes);
    } catch (e) {
        console.warn('[Queue] Failed to detect available presets:', e);
        return null;
    }

    _cachedAvailablePresets = availableModes;
    return availableModes;
}

/**
 * Inject "Add to Queue" button on post detail pages
 */
function injectAddToQueueUI() {
    const currentUrl = window.location.href;
    console.log('[Queue] injectAddToQueueUI called, URL:', currentUrl);
    if (!currentUrl.includes('/imagine/post/')) {
        console.log('[Queue] Not a post detail page, skipping');
        return;
    }

    // Don't inject if already exists
    if (document.getElementById('grok-queue-inject')) {
        console.log('[Queue] Queue inject already exists, skipping');
        return;
    }

    // Extract postId from URL
    const postIdMatch = currentUrl.match(/\/imagine\/post\/([^/?#]+)/);
    if (!postIdMatch) {
        console.log('[Queue] Could not extract postId from URL');
        SystemLogger.warn('Queue UI inject failed', `Could not extract postId from URL: ${currentUrl.substring(0, 80)}`);
        return;
    }
    const postId = postIdMatch[1];
    console.log('[Queue] Injecting Add to Queue UI for postId:', postId);

    // Create floating button
    const container = document.createElement('div');
    container.id = 'grok-queue-inject';
    container.innerHTML = `
        <style>
            #grok-queue-inject {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #grok-queue-fab {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            #grok-queue-fab:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(0,0,0,0.4);
            }
            #grok-queue-panel {
                display: none;
                position: absolute;
                bottom: 56px;
                right: 0;
                width: 280px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                color: #e0e0e0;
            }
            #grok-queue-panel.open { display: block; }
            #grok-queue-panel h3 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: #fff;
            }
            #grok-queue-panel label {
                font-size: 12px;
                color: #aaa;
                display: block;
                margin-bottom: 4px;
            }
            #grok-queue-panel input[type="number"],
            #grok-queue-panel textarea {
                width: 100%;
                padding: 8px;
                border: 1px solid #444;
                border-radius: 6px;
                background: #222;
                color: #e0e0e0;
                font-size: 13px;
                margin-bottom: 10px;
                box-sizing: border-box;
            }
            #grok-queue-panel textarea {
                resize: vertical;
                min-height: 60px;
            }
            .grok-queue-row {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }
            .grok-queue-row > div { flex: 1; }
            .grok-queue-toggle-row {
                display: flex;
                gap: 4px;
                margin-bottom: 10px;
            }
            .grok-queue-toggle-btn {
                flex: 1;
                padding: 6px 8px;
                border: 1px solid #444;
                border-radius: 6px;
                background: #222;
                color: #888;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
            }
            .grok-queue-toggle-btn.active {
                background: #333;
                color: #fff;
                border-color: #667eea;
            }
            #grok-queue-add-btn {
                width: 100%;
                padding: 10px;
                border: none;
                border-radius: 6px;
                background: #4CAF50;
                color: white;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            #grok-queue-add-btn:hover { background: #388E3C; }
            #grok-queue-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            #grok-queue-status {
                font-size: 11px;
                text-align: center;
                margin-top: 8px;
                min-height: 16px;
            }
        </style>
        <div id="grok-queue-panel">
            <h3>🎯 Add to Queue</h3>
            <label>Prompt</label>
            <textarea id="grok-queue-prompt" placeholder="Enter video generation prompt..."></textarea>
            <div class="grok-queue-row">
                <div>
                    <label>Target Success</label>
                    <input type="number" id="grok-queue-target" min="1" max="100" value="1">
                </div>
                <div>
                    <label>Max Retries</label>
                    <input type="number" id="grok-queue-retries" min="1" max="100" value="5">
                </div>
            </div>
            <label>Mode</label>
            <div class="grok-queue-toggle-row" id="grok-queue-mode-row">
                <button type="button" class="grok-queue-toggle-btn active" data-value="custom">Custom</button>
                <button type="button" class="grok-queue-toggle-btn" data-value="normal">Normal</button>
                <button type="button" class="grok-queue-toggle-btn" data-value="extremely-crazy">Fun</button>
                <button type="button" class="grok-queue-toggle-btn" data-value="extremely-spicy-or-crazy">Spicy ⚡</button>
            </div>
            <label>Duration</label>
            <div class="grok-queue-toggle-row" id="grok-queue-duration-row">
                <button type="button" class="grok-queue-toggle-btn active" data-value="6">6s</button>
                <button type="button" class="grok-queue-toggle-btn" data-value="10">10s ⚡</button>
            </div>
            <label>Resolution</label>
            <div class="grok-queue-toggle-row" id="grok-queue-resolution-row">
                <button type="button" class="grok-queue-toggle-btn active" data-value="480p">480p</button>
                <button type="button" class="grok-queue-toggle-btn" data-value="720p">720p ⚡</button>
            </div>
            <div style="font-size:10px;color:#888;margin:-6px 0 10px 0;">⚡ = Requests override — require Super Grok. Wrong override may be flagged by Grok if ineligible.</div>
            <button id="grok-queue-add-btn">Add to Queue</button>
            <div id="grok-queue-status"></div>
        </div>
        <button id="grok-queue-fab" title="Video Gen Queue">🎯</button>
    `;

    if (!document.body) {
        console.warn('[Queue] document.body not available, retrying in 500ms');
        setTimeout(injectAddToQueueUI, 500);
        return;
    }
    document.body.appendChild(container);
    console.log('[Queue] FAB button injected successfully, postId:', postId);

    // Load defaults from settings
    chrome.storage.sync.get(['queueDefaultTarget', 'queueDefaultMaxRetries', 'queueDefaultVideoLength', 'queueDefaultResolution', 'queueDefaultMode'], (result) => {
        // Guard: elements may have been removed by page navigation before callback fires
        if (result.queueDefaultTarget) {
            const el = document.getElementById('grok-queue-target');
            if (el) el.value = result.queueDefaultTarget;
        }
        if (result.queueDefaultMaxRetries) {
            const el = document.getElementById('grok-queue-retries');
            if (el) el.value = result.queueDefaultMaxRetries;
        }
        // Set default duration toggle
        if (result.queueDefaultVideoLength) {
            setToggleActive('grok-queue-duration-row', String(result.queueDefaultVideoLength));
        }
        // Set default resolution toggle
        if (result.queueDefaultResolution) {
            setToggleActive('grok-queue-resolution-row', result.queueDefaultResolution);
        }
        // Set default mode toggle
        if (result.queueDefaultMode) {
            setToggleActive('grok-queue-mode-row', result.queueDefaultMode);
            updatePromptHint(result.queueDefaultMode);
        }
    });

    // Detect available presets from Video Options dropdown and filter mode buttons
    // Delay to ensure page is fully rendered (Video Options button must exist)
    setTimeout(async () => {
        const modes = await detectAvailablePresets();
        if (!modes) return; // null = detection failed, show all
        const modeRow = document.getElementById('grok-queue-mode-row');
        if (!modeRow) return;
        let hasActiveHidden = false;
        modeRow.querySelectorAll('.grok-queue-toggle-btn').forEach(btn => {
            if (!modes.includes(btn.dataset.value)) {
                if (btn.classList.contains('active')) hasActiveHidden = true;
                btn.style.display = 'none';
            }
        });
        // If the active mode was hidden, fall back to 'custom'
        if (hasActiveHidden) {
            setToggleActive('grok-queue-mode-row', 'custom');
            updatePromptHint('custom');
        }
    }, 2000);

    // Toggle button handlers for duration, resolution, and mode
    container.querySelectorAll('.grok-queue-toggle-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.grok-queue-toggle-btn');
            if (!btn) return;
            row.querySelectorAll('.grok-queue-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Update prompt hint when mode changes
            if (row.id === 'grok-queue-mode-row') {
                updatePromptHint(btn.dataset.value);
            }
        });
    });

    // Try to read prompt from page input (V1: textarea, V2: contenteditable)
    const getPageInputValue = () => {
        const ta = document.querySelector('textarea[placeholder], textarea');
        if (ta && ta.value) return ta.value;
        const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'))
            .filter(el => el.id !== 'grok-queue-prompt' && !el.closest('#grok-queue-fab'));
        if (editables.length > 0 && editables[0].textContent?.trim()) return editables[0].textContent.trim();
        return '';
    };

    setTimeout(() => {
        const queuePromptEl = document.getElementById('grok-queue-prompt');
        const val = getPageInputValue();
        if (queuePromptEl && val) {
            queuePromptEl.value = val;
        }
    }, 1000);

    // Toggle panel
    document.getElementById('grok-queue-fab').addEventListener('click', () => {
        const panel = document.getElementById('grok-queue-panel');
        if (panel) panel.classList.toggle('open');
        // Try to read prompt from page input again
        const queuePromptEl = document.getElementById('grok-queue-prompt');
        const val = getPageInputValue();
        if (queuePromptEl && val && !queuePromptEl.value) {
            queuePromptEl.value = val;
        }
    });

    // Add to queue
    document.getElementById('grok-queue-add-btn').addEventListener('click', async () => {
        const prompt = document.getElementById('grok-queue-prompt').value.trim();
        const target = parseInt(document.getElementById('grok-queue-target').value) || 1;
        const retries = parseInt(document.getElementById('grok-queue-retries').value) || 5;
        const videoLength = parseInt(getToggleValue('grok-queue-duration-row')) || 6;
        const resolutionName = getToggleValue('grok-queue-resolution-row') || '480p';
        const mode = getToggleValue('grok-queue-mode-row') || 'custom';
        const statusEl = document.getElementById('grok-queue-status');

        if (!prompt && mode === 'custom') {
            statusEl.textContent = '❌ Please enter a prompt';
            statusEl.style.color = '#f44336';
            return;
        }

        const addBtn = document.getElementById('grok-queue-add-btn');
        addBtn.disabled = true;

        try {
            const resp = await chrome.runtime.sendMessage({
                action: 'addQueueItem',
                item: { postId, prompt, targetSuccess: target, maxRetries: retries, videoLength, resolutionName, mode }
            });

            if (resp.success) {
                statusEl.textContent = '✅ Added to queue!';
                statusEl.style.color = '#4CAF50';
                setTimeout(() => {
                    statusEl.textContent = '';
                    document.getElementById('grok-queue-panel').classList.remove('open');
                }, 1500);
            } else {
                statusEl.textContent = '❌ ' + (resp.error || 'Failed');
                statusEl.style.color = '#f44336';
            }
        } catch (error) {
            statusEl.textContent = '❌ ' + error.message;
            statusEl.style.color = '#f44336';
        } finally {
            addBtn.disabled = false;
        }
    });
}

/**
 * Remove "Add to Queue" UI from page
 */
function removeAddToQueueUI() {
    const el = document.getElementById('grok-queue-inject');
    if (el) {
        el.remove();
        console.log('[Queue] Removed Add to Queue UI');
    }
}

// Check queue processing state on page load (queue processing works independently of sidepanel)
setTimeout(() => {
    checkQueueProcessingOnLoad();
}, 1000);

} // End of guard: window.__grokVideoDownloaderLoaded
