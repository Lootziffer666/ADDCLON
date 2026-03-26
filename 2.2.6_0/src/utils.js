/**
 * Grok Media Downloader - 工具函數模組
 * 支援 Node.js (測試) 和瀏覽器環境
 */

(function(root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js / CommonJS
        module.exports = factory();
    } else {
        // Browser
        root.GrokUtils = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    /**
     * 清理路徑字串
     * @param {string} path - 輸入路徑
     * @param {string} defaultPath - 預設路徑（當 path 為空時使用）
     * @returns {string} 清理後的路徑
     */
    function cleanPath(path, defaultPath) {
        if (typeof path !== 'string') {
            return defaultPath;
        }
        path = path.trim().replace(/^\/+|\/+$/g, '');
        return path || defaultPath;
    }

    /**
     * 展平巢狀的 posts 結構（遞迴）
     * @param {Array} posts - posts 陣列（可能包含 childPosts）
     * @returns {Array} 展平後的 posts 陣列
     */
    function flattenPosts(posts) {
        if (!Array.isArray(posts)) {
            return [];
        }
        let result = [];
        for (const post of posts) {
            result.push(post);
            if (post.childPosts && post.childPosts.length > 0) {
                result = result.concat(flattenPosts(post.childPosts));
            }
        }
        return result;
    }

    /**
     * 將 posts 按照 Project 分組（parent + children 為一組）
     * 用於 Project-Based Download 功能
     * @param {Array} posts - posts 陣列（可能包含 childPosts）
     * @returns {Array} 分組後的 project 陣列，每個 project 包含:
     *   - folderName: 資料夾名稱 ({date}_{prompt})
     *   - parent: 父貼文（可能為 null，如 text-to-video）
     *   - children: 子貼文陣列（生成的影片）
     *   - prompt: 用於命名的 prompt
     *   - createTime: 專案建立時間
     */
    function groupPostsByProject(posts) {
        if (!Array.isArray(posts)) {
            return [];
        }

        const projects = [];

        for (const post of posts) {
            // 資料夾名稱使用 parent 的 prompt（不用 originalPrompt，因為 parent 沒有）
            // 檔案名稱則在 downloadProjects 中使用 child 的 originalPrompt || prompt
            const prompt = post.prompt || '';

            // 取得建立時間（使用最早的時間）
            const createTime = post.createTime || new Date().toISOString();

            // 生成資料夾名稱: {date}_{prompt}_{postId}
            // 加入 postId 後 8 碼確保唯一性，避免 prompt 截斷後重複
            const dateStr = formatDateYYYYMMDD(createTime);
            const postId = post.postId || post.id || 'untitled';
            const shortId = postId.slice(-8);
            const sanitizedPrompt = sanitizePromptForFilename(prompt, 90, 'upload_image');
            const folderName = `${dateStr}_${sanitizedPrompt}_${shortId}`;

            // 判斷 parent 類型
            const isParentImage = post.mediaType === 'MEDIA_POST_TYPE_IMAGE' ||
                                  (post.mediaUrl && !post.mediaUrl.includes('.mp4'));

            // 判斷 post 本身是否為視頻
            const isPostVideo = post.mediaType === 'MEDIA_POST_TYPE_VIDEO' ||
                                (post.mediaUrl && post.mediaUrl.includes('.mp4'));

            // 處理 children
            let children = post.childPosts || [];

            // 如果 post 本身是視頻且沒有 childPosts，把 post 當作 child
            // 這處理 text-to-video 且視頻資訊在 post 本身的情況
            if (isPostVideo && children.length === 0) {
                children = [post];
            }

            projects.push({
                folderName: folderName,
                parent: isParentImage ? post : null,
                children: children,
                prompt: prompt,
                createTime: createTime
            });
        }

        return projects;
    }

    /**
     * 生成 Project 資料夾的 metadata
     * @param {Object} project - groupPostsByProject 返回的 project 物件
     * @returns {Object} metadata 物件（可直接序列化為 JSON）
     */
    function generateProjectMetadata(project) {
        const metadata = {
            folderName: project.folderName,
            prompt: project.prompt,
            createTime: project.createTime,
            generatedAt: new Date().toISOString(),
            parent: null,
            children: [],
            summary: {
                totalChildren: 0,
                imageChildren: 0,
                videoChildren: 0
            }
        };

        // Parent 資訊
        if (project.parent) {
            metadata.parent = {
                id: project.parent.postId || project.parent.id,
                mediaType: project.parent.mediaType,
                mediaUrl: project.parent.mediaUrl,
                createTime: project.parent.createTime
            };
        }

        // Children 資訊
        if (project.children && project.children.length > 0) {
            let imageIndex = 0;
            let videoIndex = 0;

            // 按 createTime asc 排序（舊的在前），確保新增 children 不會影響已有的編號
            const sortedChildren = [...project.children].sort((a, b) => {
                const timeA = new Date(a.createTime || 0).getTime();
                const timeB = new Date(b.createTime || 0).getTime();
                return timeA - timeB;
            });

            metadata.children = sortedChildren.map((child, index) => {
                const isImage = child.mediaType === 'MEDIA_POST_TYPE_IMAGE';
                if (isImage) {
                    imageIndex++;
                } else {
                    videoIndex++;
                }

                return {
                    index: index + 1,
                    typeIndex: isImage ? imageIndex : videoIndex,
                    id: child.postId || child.id,
                    mediaType: child.mediaType,
                    originalRefType: child.originalRefType || null,
                    mediaUrl: child.mediaUrl,
                    hdMediaUrl: child.hdMediaUrl,
                    prompt: child.originalPrompt || child.prompt,
                    originalPrompt: child.originalPrompt,
                    createTime: child.createTime
                };
            });

            metadata.summary.totalChildren = project.children.length;
            metadata.summary.imageChildren = imageIndex;
            metadata.summary.videoChildren = videoIndex;
        }

        return metadata;
    }

    /**
     * 將 DataURL 轉換為 File 物件
     * @param {string} dataUrl - Base64 編碼的 DataURL
     * @param {string} filename - 檔案名稱
     * @returns {File} File 物件
     */
    function dataURLtoFile(dataUrl, filename) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            throw new Error('Invalid dataUrl');
        }
        const arr = dataUrl.split(',');
        if (arr.length < 2) {
            throw new Error('Invalid dataUrl format');
        }
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
            throw new Error('Cannot extract MIME type from dataUrl');
        }
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }

    /**
     * 格式化日期為 YYYY-MM-DD 格式
     * @param {Date|number|string} date - 日期物件、時間戳或日期字串
     * @returns {string} 格式化後的日期字串
     */
    function formatDate(date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return '';
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 格式化日期時間為 YYYYMMDD_HHmmss 格式（適合檔名）
     * @param {Date|number|string} date - 日期物件、時間戳或日期字串
     * @returns {string} 格式化後的日期時間字串
     */
    function formatDateTimeForFilename(date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return '';
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    /**
     * 清理檔名中的非法字元
     * @param {string} filename - 原始檔名
     * @param {number} maxLength - 最大長度（預設 50）
     * @returns {string} 清理後的檔名
     */
    function sanitizeFilename(filename, maxLength = 50) {
        if (typeof filename !== 'string') {
            return '';
        }
        // 移除或替換非法字元
        let clean = filename
            .replace(/[<>:"/\\|?*]/g, '_')  // 替換非法字元
            .replace(/\s+/g, '_')            // 空白替換為底線
            .replace(/_+/g, '_')             // 多個底線合併
            .replace(/^_|_$/g, '');          // 移除首尾底線

        // 截斷長度
        if (clean.length > maxLength) {
            clean = clean.substring(0, maxLength);
        }

        return clean;
    }

    /**
     * 檢查是否為有效的 URL
     * @param {string} url - 要檢查的 URL
     * @returns {boolean} 是否為有效的 URL
     */
    function isValidUrl(url) {
        if (typeof url !== 'string') {
            return false;
        }
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 從 URL 提取檔案副檔名
     * @param {string} url - URL 字串
     * @returns {string} 副檔名（不含點）或空字串
     */
    function getExtensionFromUrl(url) {
        if (!isValidUrl(url)) {
            return '';
        }
        try {
            const pathname = new URL(url).pathname;
            const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
            return match ? match[1].toLowerCase() : '';
        } catch (e) {
            return '';
        }
    }

    /**
     * 判斷授權狀態下是否應該強制展開 License 區塊
     * @param {boolean} isPro - 是否為 Pro 用戶
     * @param {boolean} savedState - 儲存的折疊狀態
     * @returns {boolean} 是否應該展開
     */
    function shouldForceExpandLicense(isPro, savedState) {
        // 如果未授權，永遠展開
        if (!isPro) {
            return true;
        }
        // 已授權，尊重用戶的選擇
        return savedState;
    }

    /**
     * 判斷授權狀態下是否允許精簡模式
     * @param {boolean} isPro - 是否為 Pro 用戶
     * @param {boolean} requestedCompactMode - 請求的精簡模式狀態
     * @returns {boolean} 最終的精簡模式狀態
     */
    function getAllowedCompactMode(isPro, requestedCompactMode) {
        // 未授權時，不允許精簡模式
        if (!isPro && requestedCompactMode) {
            return false;
        }
        return requestedCompactMode;
    }

    // ==========================================
    // 日期處理函數（從 content.js 抽取）
    // ==========================================

    /**
     * 格式化日期為 YYYYMMDD 格式（無分隔符）
     * @param {string|Date|number} dateStr - 日期字串、Date 物件或時間戳
     * @returns {string} 格式化後的日期，失敗返回 'unknown'
     */
    function formatDateYYYYMMDD(dateStr) {
        if (!dateStr) return 'unknown';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'unknown';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * 格式化日期為 YYYYMMDDHHmmss 格式（含時間，無分隔符）
     * @param {string|Date|number} dateStr - 日期字串、Date 物件或時間戳
     * @returns {string} 格式化後的日期時間，失敗返回 'unknown'
     */
    function formatDateWithTime(dateStr) {
        if (!dateStr) return 'unknown';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'unknown';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            const second = String(d.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}${hour}${minute}${second}`;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * 檢查時間戳是否在指定日期範圍內
     * @param {number} itemTimestamp - 要檢查的時間戳
     * @param {number|null} fromTimestamp - 起始時間戳（可為 null）
     * @param {number|null} toTimestamp - 結束時間戳（可為 null）
     * @returns {boolean} 是否在範圍內
     */
    function isInDateRange(itemTimestamp, fromTimestamp, toTimestamp) {
        if (typeof itemTimestamp !== 'number' || isNaN(itemTimestamp)) {
            return false;
        }
        if (fromTimestamp && itemTimestamp < fromTimestamp) return false;
        if (toTimestamp && itemTimestamp > toTimestamp) return false;
        return true;
    }

    // ==========================================
    // 檔名處理函數（從 content.js 抽取）
    // ==========================================

    /**
     * 清理 AI prompt 作為檔名（移除特殊字元，截斷至指定長度）
     * 比 sanitizeFilename 更完整，專為 AI 生成的 prompt 設計
     * @param {string} prompt - AI prompt 字串
     * @param {number} maxLength - 最大長度（預設 120）
     * @param {string|null} fallbackId - 當 prompt 處理失敗時使用的備用 ID
     * @returns {string} 清理後的檔名
     */
    function sanitizePromptForFilename(prompt, maxLength = 120, fallbackId = null) {
        try {
            if (!prompt || typeof prompt !== 'string') {
                return fallbackId || 'untitled';
            }
            // 移除檔名不允許的字元: \ / : * ? " < > | 以及換行、Tab、控制字元
            let sanitized = prompt
                .replace(/[\\/:"*?<>|\r\n\t\x00-\x1f]/g, '')
                .replace(/\s+/g, '_')      // 空格轉底線
                .replace(/_{2,}/g, '_')    // 多個底線合併為一個
                .replace(/^_+|_+$/g, '')   // 移除開頭和結尾的底線
                .trim();
            // 截斷至指定長度
            if (sanitized.length > maxLength) {
                sanitized = sanitized.substring(0, maxLength);
                // 避免截斷在底線處
                sanitized = sanitized.replace(/_+$/, '');
            }
            // 確保不為空，使用 fallbackId 作為備用
            return sanitized || fallbackId || 'untitled';
        } catch (e) {
            return fallbackId || 'untitled';
        }
    }

    /**
     * 從媒體 URL 提取副檔名（更健壯的版本）
     * @param {string} url - 媒體 URL
     * @param {string} defaultExt - 預設副檔名（預設 'png'）
     * @returns {string} 副檔名（不含點）
     */
    function getExtFromMediaUrl(url, defaultExt = 'png') {
        if (!url || typeof url !== 'string') {
            return defaultExt;
        }
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const lastDotIndex = pathname.lastIndexOf('.');

            // 只有當點在最後一個斜線之後，才視為副檔名
            if (lastDotIndex !== -1 && lastDotIndex > pathname.lastIndexOf('/')) {
                const ext = pathname.substring(lastDotIndex + 1).toLowerCase();
                // 安全檢查：副檔名不應包含斜線或過長
                if (ext.length <= 5 && !ext.includes('/')) {
                    return ext;
                }
            }
            return defaultExt;
        } catch (e) {
            return defaultExt;
        }
    }

    // ==========================================
    // 視頻計算函數（從 popup.js 抽取）
    // ==========================================

    /**
     * 計算視頻檔案總數（HD 版本算額外一個）
     * @param {Array} videos - 視頻陣列，每個元素可能有 hdUrl 屬性
     * @returns {number} 視頻檔案總數
     */
    function countVideoFiles(videos) {
        if (!Array.isArray(videos)) {
            return 0;
        }
        return videos.reduce((acc, v) => acc + (v && v.hdUrl ? 2 : 1), 0);
    }

    /**
     * 根據日期範圍過濾項目
     * @param {Array} items - 項目陣列
     * @param {number|null} fromTimestamp - 起始時間戳
     * @param {number|null} toTimestamp - 結束時間戳
     * @param {string} timestampField - 時間戳欄位名稱（預設 'createTime'）
     * @returns {Array} 過濾後的項目陣列
     */
    function filterByDateRange(items, fromTimestamp, toTimestamp, timestampField = 'createTime') {
        if (!Array.isArray(items)) {
            return [];
        }
        return items.filter(item => {
            if (!item || !item[timestampField]) {
                return false;
            }
            const itemTimestamp = new Date(item[timestampField]).getTime();
            return isInDateRange(itemTimestamp, fromTimestamp, toTimestamp);
        });
    }

    /**
     * 計算已下載視頻檔案數（考慮 HD）
     * @param {Array} videos - 所有視頻陣列
     * @param {Array} downloadedIds - 已下載的視頻 ID 陣列
     * @returns {number} 已下載的視頻檔案數
     */
    function countDownloadedVideoFiles(videos, downloadedIds) {
        if (!Array.isArray(videos) || !Array.isArray(downloadedIds)) {
            return 0;
        }
        return videos.reduce((acc, v) => {
            if (v && downloadedIds.includes(v.id)) {
                return acc + (v.hdUrl ? 2 : 1);
            }
            return acc;
        }, 0);
    }

    // ==========================================
    // 統計計算函數
    // ==========================================

    /**
     * 計算下載任務的總項目數
     * @param {Object} state - 下載狀態物件
     * @returns {number} 總項目數
     */
    function calculateTotalItems(state) {
        if (!state) return 0;
        return (state.images?.length || 0) + (state.videos?.length || 0);
    }

    /**
     * 計算已下載的總數
     * @param {Object} state - 下載狀態物件
     * @returns {number} 已下載總數
     */
    function calculateTotalDownloaded(state) {
        if (!state) return 0;
        return (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);
    }

    /**
     * 計算從開始時間到現在的耗時（分鐘）
     * @param {number} startTime - 開始時間戳
     * @param {number} [endTime] - 結束時間戳（預設為現在）
     * @returns {string} 格式化的分鐘數（保留一位小數）
     */
    function calculateDurationMinutes(startTime, endTime = Date.now()) {
        if (typeof startTime !== 'number' || isNaN(startTime)) {
            return '0.0';
        }
        const duration = (endTime - startTime) / 1000 / 60;
        return duration.toFixed(1);
    }

    // ==========================================
    // URL 處理函數
    // ==========================================

    /**
     * 移除 URL 的 query string
     * @param {string} url - 原始 URL
     * @returns {string} 移除 query string 後的 URL
     */
    function removeQueryString(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        return url.split('?')[0];
    }

    // ==========================================
    // 檔名生成函數
    // ==========================================

    /**
     * 生成圖片檔名
     * @param {Object} options - 選項
     * @param {string} options.createTime - 建立時間
     * @param {string} options.id - 圖片 ID
     * @param {string} [options.prompt] - AI prompt
     * @param {string} [options.ext='png'] - 副檔名
     * @param {boolean} [options.usePrompt=false] - 是否使用 prompt 作為檔名
     * @returns {string} 生成的檔名
     */
    function generateImageFilename(options) {
        const { createTime, id, prompt, ext = 'png', usePrompt = false } = options;

        if (usePrompt && prompt) {
            const dateTimeStr = formatDateWithTime(createTime);
            const sanitizedPrompt = sanitizePromptForFilename(prompt, 120, id);
            return `img_${dateTimeStr}_${sanitizedPrompt}.${ext}`;
        } else {
            const dateStr = formatDateYYYYMMDD(createTime);
            return `grok_image_${dateStr}_${id}.${ext}`;
        }
    }

    /**
     * 生成視頻檔名
     * @param {Object} options - 選項
     * @param {string} options.createTime - 建立時間
     * @param {string} options.id - 視頻 ID
     * @param {string} [options.prompt] - AI prompt
     * @param {boolean} [options.isHd=false] - 是否為 HD 版本
     * @param {boolean} [options.usePrompt=false] - 是否使用 prompt 作為檔名
     * @returns {string} 生成的檔名
     */
    function generateVideoFilename(options) {
        const { createTime, id, prompt, isHd = false, usePrompt = false } = options;
        const hdSuffix = isHd ? '_hd' : '';

        if (usePrompt && prompt) {
            const dateTimeStr = formatDateWithTime(createTime);
            const sanitizedPrompt = sanitizePromptForFilename(prompt, 120, id);
            return `vid_${dateTimeStr}_${sanitizedPrompt}${hdSuffix}.mp4`;
        } else {
            const dateStr = formatDateYYYYMMDD(createTime);
            return `grok_video_${dateStr}_${id}${hdSuffix}.mp4`;
        }
    }

    // ==========================================
    // 歷史記錄檢查函數
    // ==========================================

    /**
     * 檢查視頻是否完全下載（包含 HD 版本）
     * @param {string} videoId - 視頻 ID
     * @param {string|null} hdUrl - HD URL（若無則為 null）
     * @param {Array} history - 下載歷史陣列
     * @returns {boolean} 是否完全下載
     */
    function isVideoFullyDownloaded(videoId, hdUrl, history) {
        if (!Array.isArray(history)) {
            return false;
        }
        const sdDownloaded = history.includes(videoId);
        // 如果沒有 HD URL，只檢查 SD
        if (!hdUrl) {
            return sdDownloaded;
        }
        // 有 HD URL，檢查 SD 和 HD 是否都下載
        const hdDownloaded = history.includes(videoId + '_hd');
        return sdDownloaded && hdDownloaded;
    }

    /**
     * 檢查視頻需要下載哪些版本
     * @param {string} videoId - 視頻 ID
     * @param {string|null} hdUrl - HD URL（若無則為 null）
     * @param {Array} history - 下載歷史陣列
     * @returns {Object} { needSd: boolean, needHd: boolean }
     */
    function getVideoDownloadNeeds(videoId, hdUrl, history) {
        if (!Array.isArray(history)) {
            return { needSd: true, needHd: !!hdUrl };
        }
        const sdDownloaded = history.includes(videoId);
        const hdDownloaded = hdUrl ? history.includes(videoId + '_hd') : true;
        return {
            needSd: !sdDownloaded,
            needHd: !!(hdUrl && !hdDownloaded)
        };
    }

    /**
     * 計算下載進度百分比
     * @param {number} current - 目前數量
     * @param {number} total - 總數量
     * @returns {number} 百分比（0-100）
     */
    function calculateProgress(current, total) {
        if (!total || total <= 0) return 0;
        if (current < 0) current = 0;
        const progress = Math.round((current / total) * 100);
        return Math.min(progress, 100);
    }

    // ==========================================
    // 視頻歷史統計函數
    // ==========================================

    /**
     * 計算視頻歷史記錄數量（考慮 HD/SD 版本和向後兼容）
     * @param {Array} videos - 視頻陣列
     * @param {Array} history - 下載歷史陣列
     * @returns {number} 歷史記錄數量
     */
    function calculateVideoHistoryCount(videos, history) {
        if (!Array.isArray(videos) || !Array.isArray(history)) {
            return 0;
        }
        return videos.reduce((acc, v) => {
            if (!v || !v.id) return acc;
            const hdKey = `${v.id}_hd`;
            const sdKey = `${v.id}_sd`;
            let count = 0;
            if (history.includes(hdKey)) count++;
            if (history.includes(sdKey)) count++;
            // 向後兼容：檢查舊格式（純 id）
            if (count === 0 && history.includes(v.id)) {
                count = v.hdUrl ? 2 : 1;
            }
            return acc + count;
        }, 0);
    }

    /**
     * 計算到指定索引為止的視頻檔案數量
     * @param {Array} videos - 視頻陣列
     * @param {number} index - 當前索引
     * @returns {number} 檔案數量
     */
    function calculateVideoFilesUpToIndex(videos, index) {
        if (!Array.isArray(videos) || index < 0) {
            return 0;
        }
        let count = 0;
        for (let i = 0; i <= index && i < videos.length; i++) {
            if (videos[i]) {
                count += videos[i].hdUrl ? 2 : 1;
            }
        }
        return count;
    }

    /**
     * 過濾需要下載的視頻
     * @param {Array} videos - 視頻陣列
     * @param {Array} history - 下載歷史陣列
     * @returns {Array} 需要下載的視頻陣列
     */
    function filterVideosNeedDownload(videos, history) {
        if (!Array.isArray(videos)) return [];
        if (!Array.isArray(history)) return videos;

        return videos.filter(v => {
            if (!v || !v.id) return false;
            const sdMissing = !history.includes(v.id);
            const hdMissing = v.hdUrl ? !history.includes(v.id + '_hd') : false;
            return sdMissing || hdMissing;
        });
    }

    // ==========================================
    // 資料處理函數
    // ==========================================

    /**
     * 合併兩個陣列並去重
     * @param {Array} arr1 - 第一個陣列
     * @param {Array} arr2 - 第二個陣列
     * @returns {Array} 合併後的去重陣列
     */
    function mergeArraysUnique(arr1, arr2) {
        const a1 = Array.isArray(arr1) ? arr1 : [];
        const a2 = Array.isArray(arr2) ? arr2 : [];
        return [...new Set([...a1, ...a2])];
    }

    /**
     * 驗證匯出資料格式是否有效
     * @param {Object} data - 要驗證的資料
     * @returns {Object} { valid: boolean, error?: string }
     */
    function validateExportDataFormat(data) {
        if (!data) {
            return { valid: false, error: '資料為空' };
        }
        if (!data.version) {
            return { valid: false, error: '缺少版本號' };
        }
        if (!data.history || !Array.isArray(data.history)) {
            return { valid: false, error: '缺少或無效的歷史記錄' };
        }
        return { valid: true };
    }

    /**
     * 建立匯出統計資訊
     * @param {Object} state - 下載狀態物件
     * @param {Array} history - 下載歷史陣列
     * @returns {Object} 統計資訊物件
     */
    function buildExportStatistics(state, history) {
        return {
            totalImages: state?.images?.length || 0,
            totalVideos: state?.videos?.length || 0,
            downloadedImages: state?.images?.filter(img => img?.downloaded).length || 0,
            downloadedVideos: state?.videos?.filter(vid => vid?.downloaded).length || 0,
            historyCount: Array.isArray(history) ? history.length : 0
        };
    }

    // ==========================================
    // 檔案檢測函數
    // ==========================================

    /**
     * 從檔案標頭 (magic bytes) 檢測是否為圖片
     * @param {Uint8Array} header - 檔案前 12 bytes
     * @returns {Object} { isImage: boolean, type?: string }
     */
    function detectImageFromHeader(header) {
        if (!header || header.length < 12) {
            return { isImage: false };
        }

        // JPEG: FF D8
        if (header[0] === 0xFF && header[1] === 0xD8) {
            return { isImage: true, type: 'jpeg' };
        }
        // PNG: 89 50 4E 47
        if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
            return { isImage: true, type: 'png' };
        }
        // GIF: 47 49 46
        if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
            return { isImage: true, type: 'gif' };
        }
        // WebP: offset 8-11 = WEBP
        if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
            return { isImage: true, type: 'webp' };
        }

        return { isImage: false };
    }

    /**
     * 從 URL 提取檔名
     * @param {string} url - URL 字串
     * @param {string} defaultName - 預設檔名
     * @returns {string} 提取的檔名
     */
    function extractFilenameFromUrl(url, defaultName = 'download') {
        if (!url || typeof url !== 'string') {
            return defaultName;
        }
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1];

            if (lastPart && lastPart.includes('.')) {
                return lastPart.split('?')[0];
            } else if (pathParts.length > 2) {
                // 從路徑建立有意義的名稱
                return `${pathParts.slice(-2).join('_')}`;
            }
            return defaultName;
        } catch (e) {
            return defaultName;
        }
    }

    // ==========================================
    // URL 解析函數（從 content.js 抽取）
    // ==========================================

    /**
     * 從 Grok 貼文 URL 解析貼文/視頻 ID
     * @param {string} url - Grok 貼文 URL (例如 https://grok.com/imagine/post/abc-123)
     * @returns {string|null} 貼文 ID，解析失敗返回 null
     */
    function parsePostIdFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        const match = url.match(/\/post\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
    }

    /**
     * 將物件轉換為 JSON Data URL（用於下載 JSON 檔案）
     * @param {Object} data - 要轉換的物件
     * @param {boolean} [pretty=true] - 是否格式化 JSON
     * @returns {string} Data URL 字串
     */
    function generateJsonDataUrl(data, pretty = true) {
        const jsonContent = pretty
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data);
        return 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
    }

    // ==========================================
    // HD 優先模式相關函數（從 content.js 抽取）
    // ==========================================

    /**
     * 取得 HD 優先模式下的歷史記錄 key
     * @param {string} videoId - 視頻 ID
     * @param {boolean} hasHd - 是否有 HD 版本
     * @param {boolean} [isNative720p] - 是否為原生 720p（無 hdUrl 但 resolutionName === '720p'）
     * @returns {string} 歷史記錄 key
     */
    function getHdPriorityHistoryKey(videoId, hasHd, isNative720p = false) {
        return (hasHd || isNative720p) ? `${videoId}_hd` : `${videoId}_sd`;
    }

    /**
     * 在 HD 優先模式下過濾需要下載的視頻
     * @param {Array} videos - 視頻陣列
     * @param {Array} history - 下載歷史陣列
     * @param {boolean} hdPriority - 是否啟用 HD 優先模式
     * @returns {Array} 需要下載的視頻陣列
     */
    function filterVideosForHdPriority(videos, history, hdPriority = true) {
        if (!Array.isArray(videos)) return [];
        if (!Array.isArray(history)) return videos;

        return videos.filter(v => {
            if (!v || !v.id) return false;

            if (hdPriority) {
                // HD 優先模式：每個視頻只下載一個版本
                const hasHd = !!v.hdUrl;
                const isNative720p = !hasHd && v.resolutionName === '720p';
                const targetKey = getHdPriorityHistoryKey(v.id, hasHd, isNative720p);
                return !history.includes(targetKey);
            } else {
                // 非 HD 優先：下載所有版本
                const sdKey = `${v.id}_sd`;
                const hdKey = `${v.id}_hd`;
                const sdDownloaded = history.includes(v.id) || history.includes(sdKey);
                const hdDownloaded = !v.hdUrl || history.includes(hdKey);
                return !sdDownloaded || !hdDownloaded;
            }
        });
    }

    /**
     * 計算已下載的視頻檔案數（考慮 HD 優先模式）
     * @param {Array} videos - 視頻陣列
     * @param {Array} history - 下載歷史陣列
     * @param {boolean} hdPriority - 是否啟用 HD 優先模式
     * @returns {number} 已下載的檔案數
     */
    function calculateDownloadedFilesCount(videos, history, hdPriority = true) {
        if (!Array.isArray(videos) || !Array.isArray(history)) {
            return 0;
        }

        return videos.reduce((acc, v) => {
            if (!v || !v.id) return acc;

            if (hdPriority) {
                // HD 優先模式：每個視頻只算一個檔案
                const hasHd = !!v.hdUrl;
                const isNative720p = !hasHd && v.resolutionName === '720p';
                const targetKey = getHdPriorityHistoryKey(v.id, hasHd, isNative720p);
                return acc + (history.includes(targetKey) ? 1 : 0);
            } else {
                // 非 HD 優先模式：SD 和 HD 分開計算
                let count = 0;
                const sdKey = `${v.id}_sd`;
                if (history.includes(v.id) || history.includes(sdKey)) count++;
                if (v.hdUrl && history.includes(`${v.id}_hd`)) count++;
                return acc + count;
            }
        }, 0);
    }

    /**
     * 計算視頻檔案總數（考慮 HD 優先模式）
     * @param {Array} videos - 視頻陣列
     * @param {boolean} hdPriority - 是否啟用 HD 優先模式
     * @returns {number} 視頻檔案總數
     */
    function calculateTotalVideoFiles(videos, hdPriority = true) {
        if (!Array.isArray(videos)) {
            return 0;
        }

        if (hdPriority) {
            // HD 優先模式：每個視頻只算一個檔案
            return videos.length;
        } else {
            // 非 HD 優先模式：有 HD 的算兩個
            return videos.reduce((acc, v) => acc + (v && v.hdUrl ? 2 : 1), 0);
        }
    }

    /**
     * 建立下載元數據物件（用於匯出 JSON 旁附檔）
     * @param {Object} item - 媒體項目（圖片或視頻）
     * @param {string} [quality] - 視頻品質 ('hd' 或 'sd')
     * @returns {Object} 元數據物件
     */
    function buildDownloadMetadata(item, quality = null) {
        const metadata = {
            id: item.id,
            type: item.type,
            url: item.url,
            filename: item.filename,
            userId: item.userId,
            createTime: item.createTime,
            prompt: item.prompt,
            originalPrompt: item.originalPrompt,
            downloadedAt: new Date().toISOString()
        };

        // 視頻特有欄位
        if (item.type === 'video' || item.hdUrl !== undefined) {
            metadata.hdUrl = item.hdUrl;
            metadata.detailUrl = item.detailUrl;
            if (quality) {
                metadata.downloadedQuality = quality;
            }
        }

        return metadata;
    }

    // 匯出所有函數
    return {
        // 路徑處理
        cleanPath,

        // 資料結構
        flattenPosts,
        groupPostsByProject,
        generateProjectMetadata,

        // 檔案處理
        dataURLtoFile,
        sanitizeFilename,
        sanitizePromptForFilename,
        getExtensionFromUrl,
        getExtFromMediaUrl,
        detectImageFromHeader,
        extractFilenameFromUrl,

        // 日期處理
        formatDate,
        formatDateTimeForFilename,
        formatDateYYYYMMDD,
        formatDateWithTime,
        isInDateRange,
        filterByDateRange,

        // URL 處理
        isValidUrl,
        removeQueryString,
        parsePostIdFromUrl,
        generateJsonDataUrl,

        // 檔名生成
        generateImageFilename,
        generateVideoFilename,

        // 統計計算
        calculateTotalItems,
        calculateTotalDownloaded,
        calculateDurationMinutes,
        calculateProgress,

        // 視頻計算
        countVideoFiles,
        countDownloadedVideoFiles,
        calculateVideoHistoryCount,
        calculateVideoFilesUpToIndex,
        filterVideosNeedDownload,
        calculateTotalVideoFiles,

        // HD 優先模式
        getHdPriorityHistoryKey,
        filterVideosForHdPriority,
        calculateDownloadedFilesCount,

        // 歷史記錄檢查
        isVideoFullyDownloaded,
        getVideoDownloadNeeds,

        // 資料處理
        mergeArraysUnique,
        validateExportDataFormat,
        buildExportStatistics,
        buildDownloadMetadata,

        // 授權邏輯
        shouldForceExpandLicense,
        getAllowedCompactMode
    };
}));
