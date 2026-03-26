// Popup UI 邏輯

function buildMarketingUrl(path, content, campaign = 'pro_upgrade') {
    const base = 'https://grokmedia.kario-studio.com';
    const params = new URLSearchParams({
        utm_source: 'extension',
        utm_medium: 'referral',
        utm_campaign: campaign,
        utm_content: content
    });
    return `${base}/${path}?${params}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const generateBtn = document.getElementById('generateBtn');
    const startBtn = document.getElementById('startBtn');
    const clearBtn = document.getElementById('clearBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const fromDate = document.getElementById('fromDate');
    const toDate = document.getElementById('toDate');
    const message = document.getElementById('message');
    const filterWarning = document.getElementById('filterWarning');
    const storyModeHelperBtn = document.getElementById('storyModeHelperBtn');
    let messageTimeout = null;
    let wrongPageMessageShown = false;  // 追蹤錯誤頁面訊息是否已顯示
    let completionMessageShown = false; // 避免完成訊息重複顯示導致 scroll to top
    let rateLimitMessageShown = false; // 避免 rate limit paused 訊息重複顯示

    // Story Mode Helper button - opens Side Panel
    storyModeHelperBtn.addEventListener('click', async () => {
        try {
            // Get current tab to open side panel in context
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                // Ensure story mode sidepanel is set
                await chrome.runtime.sendMessage({
                    action: 'switchSidePanel',
                    path: 'sidepanel/sidepanel.html'
                });
                await chrome.sidePanel.open({ tabId: tab.id });
            }
            window.close(); // Close popup after opening side panel
        } catch (error) {
            console.error('Failed to open side panel:', error);
            // Fallback: try to set panel behavior and let user click extension icon again
            try {
                await chrome.sidePanel.setOptions({
                    tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id,
                    path: 'sidepanel/sidepanel.html',
                    enabled: true
                });
                showMessage('Right-click extension icon and select "Open side panel"', 'info');
            } catch (e) {
                showMessage('Failed to open Story Mode Helper: ' + error.message, 'error');
            }
        }
    });

    // Queue Panel button - opens Queue sidepanel
    const queuePanelBtn = document.getElementById('queuePanelBtn');
    queuePanelBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.runtime.sendMessage({
                    action: 'switchSidePanel',
                    path: 'sidepanel/queue.html'
                });
                await chrome.sidePanel.open({ tabId: tab.id });
            }
            window.close();
        } catch (error) {
            console.error('Failed to open queue panel:', error);
            showMessage('Failed to open Queue panel: ' + error.message, 'error');
        }
    });

    // View Logs link - opens logs page in new tab
    const viewLogsLink = document.getElementById('viewLogsLink');
    if (viewLogsLink) {
        viewLogsLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
        });
    }

    // Batch Select Delete button - enters selection mode on favorites page
    const batchSelectDeleteBtn = document.getElementById('batchSelectDeleteBtn');
    batchSelectDeleteBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('grok.com/imagine/saved')) {
                showMessage(chrome.i18n.getMessage('msgWrongPageFav') || 'Please navigate to Grok Favorites page first', 'error');
                return;
            }

            // Inject content script if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/logger.js', 'src/utils.js', 'src/content-utils.js', 'content.js']
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('Content script may already exist:', e.message);
            }

            // Send message to enter batch select mode
            const response = await sendMessageToContentScript(tab.id, {
                action: 'enterBatchSelectMode'
            });

            if (response && response.success) {
                window.close(); // Close popup, user will interact with page
            } else {
                showMessage(chrome.i18n.getMessage('msgOperationFailed') || 'Failed to enter selection mode', 'error');
            }
        } catch (error) {
            console.error('Batch select failed:', error);
            showMessage(chrome.i18n.getMessage('msgOperationFailed') + ': ' + error.message, 'error');
        }
    });

    // 初始化國際化
    function localizeHtml() {
        // 替換 data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            let msg = chrome.i18n.getMessage(key);

            if (key === 'footerVersion') {
                const version = chrome.runtime.getManifest().version;
                msg = chrome.i18n.getMessage(key, [version]);
            }

            if (msg) element.textContent = msg;
        });

        // 替換 data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const msg = chrome.i18n.getMessage(key);
            if (msg) element.placeholder = msg;
        });

        // 替換 data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const msg = chrome.i18n.getMessage(key);
            if (msg) element.title = msg;
        });
    }

    localizeHtml();

    // 摺疊區塊狀態管理
    const collapsibleSections = document.querySelectorAll('.collapsible-section');

    // 載入已儲存的摺疊狀態
    async function loadCollapseState() {
        const result = await chrome.storage.local.get(['collapseState', 'isPro']);
        const state = result.collapseState || {};
        const isPro = result.isPro || false;

        collapsibleSections.forEach(section => {
            const id = section.id;
            // 如果未啟動授權，強制展開 License 區塊
            if (id === 'licenseDetailsSection' && !isPro) {
                section.open = true;
            } else if (id && state[id] !== undefined) {
                section.open = state[id];
            }
        });
    }

    // 儲存摺疊狀態
    async function saveCollapseState() {
        const result = await chrome.storage.sync.get(['isPro']);
        const isPro = result.isPro || false;

        const state = {};
        collapsibleSections.forEach(section => {
            if (section.id) {
                // 如果未啟動授權，不保存 License 區塊的折疊狀態（強制保持展開）
                if (section.id === 'licenseDetailsSection' && !isPro) {
                    state[section.id] = true; // 強制記錄為展開
                } else {
                    state[section.id] = section.open;
                }
            }
        });
        await chrome.storage.local.set({ collapseState: state });
    }

    // 監聽摺疊變更
    collapsibleSections.forEach(section => {
        section.addEventListener('toggle', async (e) => {
            // 如果是 License 區塊且未啟動授權，阻止折疊
            if (section.id === 'licenseDetailsSection') {
                const result = await chrome.storage.sync.get(['isPro']);
                if (!result.isPro && !section.open) {
                    // 用戶嘗試折疊，但未授權，強制重新展開
                    section.open = true;
                    return;
                }
            }
            saveCollapseState();
        });
    });

    // 初始化載入摺疊狀態
    loadCollapseState();

    // ==========================================
    // Compact Mode (精簡模式)
    // ==========================================
    const compactToggle = document.getElementById('compactToggle');
    const compactIcon = document.getElementById('compactIcon');
    const compactLabel = document.getElementById('compactLabel');

    // 載入精簡模式狀態
    async function loadCompactMode() {
        const result = await chrome.storage.local.get(['compactMode']);
        const proResult = await chrome.storage.sync.get(['isPro']);
        let isCompact = result.compactMode || false;

        // 如果未授權，強制關閉精簡模式（確保 License 區塊可見）
        if (!proResult.isPro && isCompact) {
            isCompact = false;
            await chrome.storage.local.set({ compactMode: false });
        }

        applyCompactMode(isCompact);
    }

    // 應用精簡模式
    function applyCompactMode(isCompact) {
        if (isCompact) {
            document.body.classList.add('compact-mode');
            compactToggle.classList.add('active');
            compactIcon.textContent = '📂';
            compactLabel.textContent = chrome.i18n.getMessage('btnExpand') || '全';
        } else {
            document.body.classList.remove('compact-mode');
            compactToggle.classList.remove('active');
            compactIcon.textContent = '📦';
            compactLabel.textContent = chrome.i18n.getMessage('btnCompact') || '簡';
        }
    }

    // 切換精簡模式
    compactToggle.addEventListener('click', async () => {
        const isCurrentlyCompact = document.body.classList.contains('compact-mode');
        const newState = !isCurrentlyCompact;

        // 如果未授權，不允許進入精簡模式（因為會隱藏 License 區塊）
        if (newState) {
            const result = await chrome.storage.sync.get(['isPro']);
            if (!result.isPro) {
                // 未授權，阻止進入精簡模式
                return;
            }
        }

        applyCompactMode(newState);
        await chrome.storage.local.set({ compactMode: newState });
    });

    // 初始化載入精簡模式
    loadCompactMode();

    // Handle download date filter radio buttons
    document.querySelectorAll('input[name="downloadDateFilter"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const val = document.querySelector('input[name="downloadDateFilter"]:checked').value;
            fromDate.disabled = val !== 'dateRange';
            toDate.disabled = val !== 'dateRange';
            document.getElementById('downloadHours').disabled = val !== 'lastHours';
            if (val !== 'dateRange') {
                fromDate.value = '';
                toDate.value = '';
            }
        });
    });

    // Clamp hours inputs to 1-240 on blur
    ['downloadHours', 'hdUpgradeHours', 'removeHours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => {
                let v = parseInt(el.value);
                if (isNaN(v) || v < 1) v = 1;
                if (v > 240) v = 240;
                el.value = v;
            });
        }
    });

    // 更新狀態顯示
    async function updateStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('grok.com/imagine')) {
                // 只在第一次顯示錯誤訊息，避免重複滾動到頂部
                if (!wrongPageMessageShown) {
                    wrongPageMessageShown = true;
                    showMessageWithLink(
                        chrome.i18n.getMessage('msgWrongPage'),
                        'https://grok.com/imagine/saved',
                        chrome.i18n.getMessage('msgWrongPageLink'),
                        'error'
                    );
                }
                generateBtn.disabled = true;
                startBtn.disabled = true;
                return;
            } else {
                wrongPageMessageShown = false;  // 重置標記，下次進入錯誤頁面時可再顯示
            }

            const response = await sendMessageToContentScript(tab.id, { action: 'getStatus' }, { silent: true });

            if (response && response.state) {
                const state = response.state;

                // 顯示當前列表的過濾條件
                const filterInfo = document.getElementById('filterInfo');
                const filterInfoText = document.getElementById('filterInfoText');
                if (!filterInfo) return; // DOM already torn down
                if (state.filterOptions) {
                    filterInfo.style.display = 'block';
                    const parts = [];
                    if (state.filterOptions.fromDate || state.filterOptions.toDate) {
                        const fromStr = state.filterOptions.fromDateString || '∞';
                        const toStr = state.filterOptions.toDateString || '∞';
                        parts.push(chrome.i18n.getMessage('msgDateRange', [fromStr, toStr]));
                    } else {
                        parts.push(chrome.i18n.getMessage('msgDateAll'));
                    }
                    filterInfoText.textContent = parts.join(' | ');
                } else {
                    filterInfo.style.display = 'none';
                }

                // 更新圖片和視頻統計
                const isProjectMode = state.filterOptions?.downloadMode === 'project';
                const historySet = new Set(response.history || []);

                // Use unfiltered counts for display (allImages/allVideos), filtered for download
                const displayImages = state.allImages || state.images || [];
                const displayVideos = state.allVideos || state.videos || [];

                // Image stats
                const imageTotal = displayImages.length;
                const imageDownloadedCount = displayImages.filter(img => historySet.has(img.id)).length;
                document.getElementById('imageTotal').textContent = imageTotal;
                document.getElementById('imageDownloaded').textContent = imageDownloadedCount;
                document.getElementById('imageNeed').textContent = imageTotal - imageDownloadedCount;

                // Classify videos into SD / native 720p / HD
                const sdVideos = displayVideos.filter(v => !v.hdUrl && v.resolutionName !== '720p');
                const native720pVideos = displayVideos.filter(v => !v.hdUrl && v.resolutionName === '720p');
                const hdVideos = displayVideos.filter(v => v.hdUrl);

                // SD Video stats
                const sdVideoDownloadedCount = sdVideos.filter(v => {
                    return historySet.has(`${v.id}_sd`) || historySet.has(v.id);
                }).length;
                document.getElementById('sdVideoTotal').textContent = sdVideos.length;
                document.getElementById('sdVideoDownloaded').textContent = sdVideoDownloadedCount;
                document.getElementById('sdVideoNeed').textContent = sdVideos.length - sdVideoDownloadedCount;

                // Native 720p Video stats (stored as _hd in history)
                const v720pDownloadedCount = native720pVideos.filter(v => historySet.has(`${v.id}_hd`)).length;
                document.getElementById('v720pTotal').textContent = native720pVideos.length;
                document.getElementById('v720pDownloaded').textContent = v720pDownloadedCount;
                document.getElementById('v720pNeed').textContent = native720pVideos.length - v720pDownloadedCount;

                // HD Video stats
                const hdVideoDownloadedCount = hdVideos.filter(v => historySet.has(`${v.id}_hd`)).length;
                document.getElementById('hdVideoTotal').textContent = hdVideos.length;
                document.getElementById('hdVideoDownloaded').textContent = hdVideoDownloadedCount;
                document.getElementById('hdVideoNeed').textContent = hdVideos.length - hdVideoDownloadedCount;

                // Project count
                const projectCountEl = document.getElementById('projectCount');
                if (projectCountEl) {
                    const pCount = state.projectCount || state.projects?.length || 0;
                    projectCountEl.textContent = pCount > 0 ? pCount : '-';
                }

                // Compute filtered need-download counts (matching scanForDownload logic)
                const filteredImages = state.images || [];
                const filteredVideos = state.videos || [];
                const hdPriority = state.filterOptions?.hdPriority !== false;
                const historyArray = [...historySet];

                const filteredImageNeed = filteredImages.filter(img => !historySet.has(img.id)).length;

                // Use GrokUtils.filterVideosForHdPriority — same as scanForDownload & actual download
                const needDownloadVideos = GrokUtils.filterVideosForHdPriority(filteredVideos, historyArray, hdPriority);
                let filteredSdNeed, filtered720pNeed, filteredHdNeed;
                if (hdPriority) {
                    // HD priority: one file per video (HD if available, SD otherwise)
                    filteredHdNeed = needDownloadVideos.filter(v => v.hdUrl).length;
                    filtered720pNeed = needDownloadVideos.filter(v => !v.hdUrl && v.resolutionName === '720p').length;
                    filteredSdNeed = needDownloadVideos.length - filteredHdNeed - filtered720pNeed;
                } else {
                    // Non-HD priority: SD + 720p + HD counted separately
                    filteredSdNeed = filteredVideos.filter(v => {
                        return !v.hdUrl && v.resolutionName !== '720p' && !historySet.has(`${v.id}_sd`) && !historySet.has(v.id);
                    }).length;
                    filtered720pNeed = filteredVideos.filter(v => {
                        return !v.hdUrl && v.resolutionName === '720p' && !historySet.has(`${v.id}_hd`);
                    }).length;
                    filteredHdNeed = filteredVideos.filter(v => {
                        return v.hdUrl && !historySet.has(`${v.id}_hd`);
                    }).length;
                }

                // 顯示當前階段 (phase text with mode + progress)
                const totalItems = isProjectMode ?
                    (state.projects?.length || 0) :
                    (filteredImages.length + filteredVideos.length);

                let phaseText = '-';
                const modeLabel = isProjectMode ?
                    chrome.i18n.getMessage('statusPhaseProject') :
                    chrome.i18n.getMessage('statusPhaseStandard');

                // Build filtered summary: 🖼️ N / 🎬 SD N / 🎥 720p N / ✨ HD N
                const summary = chrome.i18n.getMessage('statusPhaseSummary', [
                    String(filteredImageNeed), String(filteredSdNeed), String(filtered720pNeed), String(filteredHdNeed)
                ]);

                let showSummary = false;
                let summaryText = summary;
                if (state.completed) {
                    phaseText = modeLabel + ' — ' + chrome.i18n.getMessage('statusPhaseComplete');
                    // Show downloaded counts instead of need counts (which are 0 after completion)
                    const doneImages = state.downloadedImages?.length || 0;
                    const doneVideoIds = new Set(state.downloadedVideos || []);
                    const doneVideos = filteredVideos.filter(v => doneVideoIds.has(v.id));
                    const doneHd = hdPriority ? doneVideos.filter(v => v.hdUrl).length : 0;
                    const done720p = hdPriority ? doneVideos.filter(v => !v.hdUrl && v.resolutionName === '720p').length : 0;
                    const doneSd = hdPriority ? (doneVideos.length - doneHd - done720p) : doneVideos.length;
                    summaryText = chrome.i18n.getMessage('statusPhaseSummary', [
                        String(doneImages), String(doneSd), String(done720p), String(doneHd)
                    ]);
                    showSummary = true;
                } else if (response.downloadProgress && response.downloadProgress.phase !== 'idle' && response.downloadProgress.phase !== 'starting') {
                    const dp = response.downloadProgress;
                    let progressText = '';
                    if (dp.phase === 'images') {
                        progressText = chrome.i18n.getMessage('statusDownloadingImages', [String(dp.current), String(dp.total)]);
                    } else if (dp.phase === 'videos') {
                        progressText = chrome.i18n.getMessage('statusDownloadingVideos', [String(dp.current), String(dp.total)]);
                    } else if (dp.phase === 'projects') {
                        progressText = chrome.i18n.getMessage('statusDownloadingProjects', [String(dp.current), String(dp.total)]);
                    }
                    phaseText = modeLabel + ' — ' + progressText;
                    showSummary = true;
                } else if (state.currentPhase) {
                    let progressText = '';
                    if (isProjectMode) {
                        const projectTotal = state.projects?.length || 0;
                        const projectDownloaded = state.downloadedProjects?.length || 0;
                        progressText = chrome.i18n.getMessage('statusDownloadingProjects', [String(projectDownloaded), String(projectTotal)]);
                    } else if (state.currentPhase === 'images') {
                        const current = (state.currentIndex || 0) + 1;
                        progressText = chrome.i18n.getMessage('statusDownloadingImages', [String(current), String(filteredImageNeed)]);
                    } else if (state.currentPhase === 'videos') {
                        const current = (state.currentIndex || 0) + 1;
                        progressText = chrome.i18n.getMessage('statusDownloadingVideos', [String(current), String(filteredSdNeed + filteredHdNeed)]);
                    }
                    phaseText = modeLabel + ' — ' + progressText;
                    showSummary = true;
                } else if (totalItems > 0) {
                    phaseText = modeLabel + ' — ' + summary;
                }
                document.getElementById('currentPhase').textContent = phaseText;

                // Show/hide summary row below phase
                const summaryRow = document.getElementById('phaseSummaryRow');
                if (showSummary && summaryRow) {
                    summaryRow.style.display = '';
                    document.getElementById('phaseSummary').textContent = summaryText;
                } else if (summaryRow) {
                    summaryRow.style.display = 'none';
                }

                // 更新進度條 (based on need-download counts)
                const needTotal = isProjectMode
                    ? (state.projects?.length || 0)
                    : (filteredImageNeed + filteredSdNeed + filtered720pNeed + filteredHdNeed);

                if (needTotal > 0 || state.completed) {
                    const progress = document.getElementById('progress');
                    const progressFill = document.getElementById('progressFill');
                    const progressText = document.getElementById('progressText');

                    progress.style.display = 'block';

                    let totalDownloaded, percentage;
                    if (state.completed) {
                        percentage = 100;
                    } else if (isProjectMode) {
                        totalDownloaded = state.downloadedProjects?.length || 0;
                        percentage = Math.round((totalDownloaded / needTotal) * 100);
                    } else {
                        totalDownloaded = (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);
                        percentage = Math.round((totalDownloaded / needTotal) * 100);
                    }

                    progressFill.style.width = percentage + '%';
                    progressText.textContent = percentage + '%';
                } else {
                    document.getElementById('progress').style.display = 'none';
                }

                if (state.completed) {
                    generateBtn.disabled = false;
                    generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                    startBtn.disabled = false;
                    startBtn.textContent = chrome.i18n.getMessage('btnStartDone');
                    startBtn.classList.remove('btn-success');
                    startBtn.classList.add('btn-secondary');
                    isDownloadInProgress = false;
                    const resumeInfoDone = document.getElementById('resumeInfo');
                    if (resumeInfoDone) resumeInfoDone.style.display = 'none';

                    let totalDownloaded;
                    if (isProjectMode) {
                        totalDownloaded = state.downloadedProjects?.length || 0;
                    } else {
                        totalDownloaded = (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);
                    }
                    if (!completionMessageShown) {
                        completionMessageShown = true;
                        showMessage(chrome.i18n.getMessage('msgDownloadComplete', [totalDownloaded, needTotal]), 'info');
                    }
                } else {
                    completionMessageShown = false;
                    // 用 content.js 的 downloadProgress 作為下載中的判斷依據
                    const downloading = isDownloadInProgress || (response.downloadProgress && response.downloadProgress.phase !== 'idle');
                    if (downloading) {
                        isDownloadInProgress = true;
                        startBtn.classList.remove('btn-success');
                        startBtn.classList.add('btn-secondary');
                        startBtn.textContent = chrome.i18n.getMessage('btnStopDownload');
                        startBtn.disabled = false;
                        generateBtn.disabled = true;
                        const resumeInfoDl = document.getElementById('resumeInfo');
                        if (resumeInfoDl) resumeInfoDl.style.display = 'none';
                    } else {
                        startBtn.classList.remove('btn-secondary');
                        startBtn.classList.add('btn-success');
                        // Show rate limit paused message if applicable (once)
                        if (state.rateLimitPaused && !state.completed && !rateLimitMessageShown) {
                            rateLimitMessageShown = true;
                            showMessage(chrome.i18n.getMessage('rateLimitPaused', ['250']), 'info');
                        } else if (!state.rateLimitPaused) {
                            rateLimitMessageShown = false;
                        }

                        // Show resume progress indicator and change button text if partial download exists
                        const resumeInfo = document.getElementById('resumeInfo');
                        let hasPartialDownload = false;
                        if (needTotal > 0) {
                            let downloaded;
                            if (isProjectMode) {
                                downloaded = state.downloadedProjects?.length || 0;
                            } else {
                                downloaded = (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);
                            }
                            if (downloaded > 0 && downloaded < needTotal) {
                                hasPartialDownload = true;
                                if (resumeInfo) {
                                    resumeInfo.textContent = chrome.i18n.getMessage('resumeProgress', [downloaded, needTotal]);
                                    resumeInfo.style.display = '';
                                }
                            }
                        }
                        if (!hasPartialDownload && resumeInfo) {
                            resumeInfo.style.display = 'none';
                        }

                        // Button text: "Continue Download" if partial, otherwise "Start Download"
                        startBtn.textContent = hasPartialDownload
                            ? chrome.i18n.getMessage('btnContinueDownload')
                            : chrome.i18n.getMessage('btnStart');
                    }

                    // 檢查過濾條件是否改變
                    let filterChanged = false;
                    if (state.filterOptions) {
                        const currentFilterMode = document.querySelector('input[name="downloadDateFilter"]:checked').value;
                        const currentFromDate = fromDate.value;
                        const currentToDate = toDate.value;

                        // 檢查過濾模式是否改變
                        const savedHasDateRange = !!(state.filterOptions.fromDate || state.filterOptions.toDate);
                        const savedHasHoursLimit = !!state.filterOptions.hoursLimit;

                        if (currentFilterMode === 'all') {
                            // 當前是全部，但列表有過濾
                            if (savedHasDateRange || savedHasHoursLimit) {
                                filterChanged = true;
                            }
                        } else if (currentFilterMode === 'dateRange') {
                            if (currentFromDate || currentToDate) {
                                const currentFromTimestamp = currentFromDate ? new Date(currentFromDate).setUTCHours(0, 0, 0, 0) : null;
                                const currentToTimestamp = currentToDate ? new Date(currentToDate).setUTCHours(23, 59, 59, 999) : null;
                                if (currentFromTimestamp !== state.filterOptions.fromDate ||
                                    currentToTimestamp !== state.filterOptions.toDate) {
                                    filterChanged = true;
                                }
                            } else if (!savedHasDateRange) {
                                filterChanged = true;
                            }
                        } else if (currentFilterMode === 'lastHours') {
                            const currentHours = parseInt(document.getElementById('downloadHours').value) || 24;
                            if (currentHours !== state.filterOptions.hoursLimit) {
                                filterChanged = true;
                            }
                        }
                    }

                    // 啟用/禁用按鈕
                    if ((state.images && state.images.length > 0) ||
                        (state.videos && state.videos.length > 0)) {
                        if (filterChanged) {
                            startBtn.disabled = true;
                            // 使用固定警告區塊，而不是暫時性訊息
                            filterWarning.textContent = chrome.i18n.getMessage('msgFilterChanged');
                            filterWarning.style.display = 'block';
                        } else {
                            startBtn.disabled = false;
                            filterWarning.style.display = 'none';
                        }
                    } else {
                        startBtn.disabled = true;
                        filterWarning.style.display = 'none';
                    }
                }
            } else {
                // 沒有狀態
                document.getElementById('imageTotal').textContent = '-';
                document.getElementById('imageDownloaded').textContent = '-';
                document.getElementById('sdVideoTotal').textContent = '-';
                document.getElementById('sdVideoDownloaded').textContent = '-';
                document.getElementById('v720pTotal').textContent = '-';
                document.getElementById('v720pDownloaded').textContent = '-';
                document.getElementById('hdVideoTotal').textContent = '-';
                document.getElementById('hdVideoDownloaded').textContent = '-';
                document.getElementById('currentPhase').textContent = '-';
                document.getElementById('progress').style.display = 'none';
                startBtn.disabled = true;
            }
        } catch (error) {
            console.error('更新狀態失敗:', error);
        }
    }

    // 顯示消息
    function showMessage(text, type = 'info') {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (!message) {
            console.error('❌ message 元素不存在！');
            return;
        }

        // 清除之前的計時器
        if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }

        message.textContent = text;
        message.className = `message ${type} show`;

        messageTimeout = setTimeout(() => {
            message.classList.remove('show');
            messageTimeout = null;
        }, 3000);
    }

    // 顯示帶連結的消息
    function showMessageWithLink(text, url, linkText, type = 'info') {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (!message) {
            console.error('❌ message 元素不存在！');
            return;
        }

        // 清除之前的計時器
        if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }

        // 使用 innerHTML 來支援連結
        message.innerHTML = `${text} <a href="${url}" target="_blank" style="color: inherit; font-weight: bold;">${linkText}</a>`;
        message.className = `message ${type} show`;

        // 帶連結的訊息不自動消失，讓使用者有時間點擊
    }

    // 檢查是否為連接錯誤
    function isConnectionError(error) {
        return error && error.message && (
            error.message.includes('Receiving end does not exist') ||
            error.message.includes('Could not establish connection')
        );
    }

    // 向 content script 發送訊息，如果連接失敗會自動嘗試注入並重試
    async function sendMessageToContentScript(tabId, message, options = {}) {
        const { silent = false, retried = false } = options;

        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            if (isConnectionError(error) && !retried) {
                // 嘗試注入 content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['src/logger.js', 'src/utils.js', 'src/content-utils.js', 'content.js']
                    });
                    // 等待 content script 初始化
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // 重試發送訊息
                    return await sendMessageToContentScript(tabId, message, { ...options, retried: true });
                } catch (injectError) {
                    console.error('Failed to inject content script:', injectError);
                }
            }

            // 如果不是靜默模式，顯示錯誤訊息
            if (!silent && isConnectionError(error)) {
                showMessage(chrome.i18n.getMessage('msgRefreshRetry'), 'error');
            }

            throw error;
        }
    }

    // 生成媒體列表
    generateBtn.addEventListener('click', async () => {
        // 讀取複選框狀態
        const includeImages = document.getElementById('includeImages').checked;
        const includeVideos = document.getElementById('includeVideos').checked;

        if (!includeImages && !includeVideos) {
            showMessage(chrome.i18n.getMessage('msgSelectMediaType'), 'error');
            return;
        }

        // 讀取日期過濾
        const downloadDateFilter = document.querySelector('input[name="downloadDateFilter"]:checked').value;
        const fromDateValue = fromDate.value;
        const toDateValue = toDate.value;

        // 日期範圍篩選：至少需要填一個日期
        if (downloadDateFilter === 'dateRange' && !fromDateValue && !toDateValue) {
            showMessage(chrome.i18n.getMessage('msgSelectDate'), 'error');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = chrome.i18n.getMessage('btnGenerateLoading');
        startBtn.disabled = true;  // 生成列表時禁用下載按鈕，避免誤按

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('grok.com/imagine/saved')) {
                showMessage(chrome.i18n.getMessage('msgWrongPageFav'), 'error');
                generateBtn.disabled = false;
                generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                // startBtn 保持禁用，因為沒有生成列表
                return;
            }

            // 先嘗試注入 content script（如果還沒注入）
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/logger.js', 'src/utils.js', 'src/content-utils.js', 'content.js']
                });
                console.log('Content script 已注入');
                // 等待一下讓 script 初始化
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('Content script 可能已經存在:', e.message);
            }

            // 準備選項
            const hdPriority = document.getElementById('hdPriority').checked;
            const saveMetadata = document.getElementById('saveMetadata').checked;
            const promptAsFilename = document.getElementById('promptAsFilename').checked;
            const downloadMode = document.getElementById('downloadModeProject')?.checked ? 'project' : 'standard';
            const options = {
                includeImages,
                includeVideos,
                hdPriority,
                saveMetadata,
                promptAsFilename,
                downloadMode
            };

            // 如果啟用日期過濾，轉換為時間戳
            if (downloadDateFilter === 'dateRange') {
                if (fromDateValue) {
                    const fromDateObj = new Date(fromDateValue);
                    fromDateObj.setUTCHours(0, 0, 0, 0); // 設為當天開始
                    options.fromDate = fromDateObj.getTime();
                }
                if (toDateValue) {
                    const toDateObj = new Date(toDateValue);
                    toDateObj.setUTCHours(23, 59, 59, 999); // 設為當天結束
                    options.toDate = toDateObj.getTime();
                }
            } else if (downloadDateFilter === 'lastHours') {
                options.hoursLimit = parseInt(document.getElementById('downloadHours').value) || 24;
            }

            // 先清除舊的 generateResult
            await chrome.storage.local.remove('generateResult');

            const response = await sendMessageToContentScript(tab.id, {
                action: 'generateMedia',
                options: options
            });

            if (response && response.success && response.status === 'generating') {
                // 顯示生成中狀態，等待 storage 通知
                showMessage(chrome.i18n.getMessage('msgGenerating') || 'Generating list...', 'info');

                // Listen for real-time scan progress from content script
                const progressListener = (msg) => {
                    if (msg.action === 'generateListProgress' && msg.count) {
                        generateBtn.textContent = chrome.i18n.getMessage('msgGenerateListProgress', [String(msg.count)]);
                    }
                };
                chrome.runtime.onMessage.addListener(progressListener);

                // 監聽 storage 變化
                const storageListener = async (changes, areaName) => {
                    if (areaName !== 'local' || !changes.generateResult) return;

                    const result = changes.generateResult.newValue;
                    if (!result) return;

                    // 移除監聽器
                    chrome.storage.onChanged.removeListener(storageListener);
                    chrome.runtime.onMessage.removeListener(progressListener);

                    // 處理結果
                    if (result.success) {
                        const parts = [];
                        if (includeImages && result.imageCount > 0) {
                            parts.push(`${result.imageCount} ${chrome.i18n.getMessage('mediaTypeImages').replace('🖼️ ', '')}`);
                        }
                        if (includeVideos && result.videoCount > 0) {
                            parts.push(`${result.videoCount} ${chrome.i18n.getMessage('mediaTypeVideos').replace('🎬 ', '')}`);
                        }
                        if (parts.length > 0) {
                            showMessage(chrome.i18n.getMessage('msgFoundMedia', [parts.join(' & ')]), 'info');
                            startBtn.disabled = false;
                        } else {
                            showMessage(chrome.i18n.getMessage('msgNoMediaFound') || 'No media found', 'info');
                        }
                        await updateStatus();

                        // Scan and show confirm dialog after generate
                        if (parts.length > 0) {
                            await scanAndConfirmDownload(tab);
                        }
                    } else {
                        showMessage(chrome.i18n.getMessage('msgGenerateFailed') + (result.error ? ': ' + result.error : ''), 'error');
                    }

                    // Only re-enable generate button if download didn't start
                    if (!isDownloadInProgress) {
                        generateBtn.disabled = false;
                        generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                    }
                };

                chrome.storage.onChanged.addListener(storageListener);

                // 設置超時保護（5 分鐘）
                setTimeout(() => {
                    chrome.storage.onChanged.removeListener(storageListener);
                    chrome.runtime.onMessage.removeListener(progressListener);
                    // 檢查是否已經完成
                    chrome.storage.local.get('generateResult', (data) => {
                        if (!data.generateResult) {
                            showMessage(chrome.i18n.getMessage('msgGenerateFailed') + ': Timeout', 'error');
                            generateBtn.disabled = false;
                            generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                        }
                    });
                }, 300000);

            } else if (response && response.success) {
                // 舊版回應格式（向下相容）
                const parts = [];
                if (includeImages && response.imageCount > 0) {
                    parts.push(`${response.imageCount} ${chrome.i18n.getMessage('mediaTypeImages').replace('🖼️ ', '')}`);
                }
                if (includeVideos && response.videoCount > 0) {
                    parts.push(`${response.videoCount} ${chrome.i18n.getMessage('mediaTypeVideos').replace('🎬 ', '')}`);
                }
                showMessage(chrome.i18n.getMessage('msgFoundMedia', [parts.join(' & ')]), 'info');
                startBtn.disabled = false;
                await updateStatus();
                generateBtn.disabled = false;
                generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
            } else {
                showMessage(chrome.i18n.getMessage('msgGenerateFailed'), 'error');
                generateBtn.disabled = false;
                generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
            }
        } catch (error) {
            console.error('生成失敗:', error);
            if (error.message.includes('Receiving end does not exist')) {
                showMessage(chrome.i18n.getMessage('msgRefreshRetry'), 'error');
            } else {
                showMessage(chrome.i18n.getMessage('msgGenerateFailed') + ': ' + error.message, 'error');
            }
            generateBtn.disabled = false;
            generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
        }
    });

    // 下載狀態追蹤
    let isDownloadInProgress = false;

    // 檢查下載狀態並更新按鈕
    async function checkAndUpdateDownloadStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('grok.com')) return;

            const status = await sendMessageToContentScript(tab.id, {
                action: 'getDownloadStatus'
            });

            if (status && status.inProgress) {
                isDownloadInProgress = true;
                const phaseText = status.phase === 'images' ? '🖼️' :
                                  status.phase === 'videos' ? '🎬' :
                                  status.phase === 'projects' ? '📂' : '';
                startBtn.textContent = chrome.i18n.getMessage('btnStopDownload');
                startBtn.disabled = false; // 允許點擊以中斷
                startBtn.classList.remove('btn-success');
                startBtn.classList.add('btn-secondary');
                generateBtn.disabled = true;
            } else {
                isDownloadInProgress = false;
            }
        } catch (e) {
            console.log('檢查下載狀態失敗:', e.message);
        }
    }

    // popup 開啟時檢查狀態
    checkAndUpdateDownloadStatus();

    // 掃描並確認下載（Generate List 完成後 / 手動按 Start 時共用）
    async function scanAndConfirmDownload(tab) {
        startBtn.disabled = true;
        startBtn.textContent = chrome.i18n.getMessage('msgDownloadScanning');

        let scanResult;
        try {
            scanResult = await sendMessageToContentScript(tab.id, { action: 'scanForDownload' });
        } catch (e) {
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
            return;
        }

        if (!scanResult || !scanResult.success) {
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
            return;
        }

        const vs = scanResult.videos;
        const totalNeed = scanResult.mode === 'project'
            ? scanResult.projects.need
            : scanResult.images.need + (vs.hdPriority ? vs.need : vs.needSd + vs.need720p + vs.needHd);

        if (totalNeed === 0) {
            const imageCount = scanResult.images.total;
            const videoCount = vs.hdPriority ? vs.total : vs.totalSd;
            const msg = chrome.i18n.getMessage('msgAllDownloaded', [imageCount.toString(), videoCount.toString()]);
            alert(msg);
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
            return;
        }

        // Build confirm message with stats
        let confirmMsg;
        if (scanResult.mode === 'project') {
            confirmMsg = chrome.i18n.getMessage('msgDownloadConfirmProject', [
                String(scanResult.projects.need), String(scanResult.projects.done)
            ]);
        } else if (vs.hdPriority) {
            // HD priority: show as single video row with HD/720p/SD breakdown
            confirmMsg = chrome.i18n.getMessage('msgDownloadConfirmHdPriority', [
                String(scanResult.images.need), String(scanResult.images.done),
                String(vs.need), String(vs.done),
                String(vs.needHd), String(vs.need720p), String(vs.needSd)
            ]);
        } else {
            confirmMsg = chrome.i18n.getMessage('msgDownloadConfirmStandard', [
                String(scanResult.images.need), String(scanResult.images.done),
                String(vs.needSd), String(vs.doneSd),
                String(vs.need720p), String(vs.done720p),
                String(vs.needHd), String(vs.doneHd)
            ]);
        }

        // Append rate limit warning if video count exceeds limit
        const videoNeedCount = scanResult.mode === 'project'
            ? 0 // projects track differently
            : (vs.hdPriority ? vs.need : vs.needSd + vs.need720p + vs.needHd);
        if (videoNeedCount > 250) {
            confirmMsg += '\n\n' + chrome.i18n.getMessage('rateLimitWarning', ['250']);
        }

        // Update popup status before showing confirm dialog (confirm blocks JS thread)
        await updateStatus();

        if (!confirm(confirmMsg)) {
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
            return;
        }

        // Confirmed — start download
        startBtn.textContent = chrome.i18n.getMessage('btnStartLoading');

        try {
            const response = await sendMessageToContentScript(tab.id, { action: 'startDownload' });

            if (response && response.success) {
                showMessage(chrome.i18n.getMessage('msgStartDownload'), 'info');
                isDownloadInProgress = true;
                // Disable generate, enable start as abort button
                generateBtn.disabled = true;
                startBtn.disabled = false;
                startBtn.textContent = chrome.i18n.getMessage('btnStopDownload');
                startBtn.classList.remove('btn-success');
                startBtn.classList.add('btn-secondary');
            } else if (response && response.reason === 'all_downloaded') {
                const msg = chrome.i18n.getMessage('msgAllDownloaded', [
                    (response.imageCount || 0).toString(), (response.videoCount || 0).toString()
                ]);
                alert(msg);
                startBtn.disabled = false;
                startBtn.textContent = chrome.i18n.getMessage('btnStart');
            } else {
                showMessage(chrome.i18n.getMessage('msgStartFailed'), 'error');
                startBtn.disabled = false;
                startBtn.textContent = chrome.i18n.getMessage('btnStart');
            }
        } catch (error) {
            console.error('開始失敗:', error);
            showMessage(chrome.i18n.getMessage('msgStartFailed') + ': ' + error.message, 'error');
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
        }
    }

    // 開始下載
    startBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // 檢查是否正在下載中
            const status = await sendMessageToContentScript(tab.id, {
                action: 'getDownloadStatus'
            });

            if (status && status.inProgress) {
                // 正在下載中，詢問是否要中斷
                const phaseText = status.phase === 'images' ? chrome.i18n.getMessage('mediaTypeImages') :
                                  status.phase === 'videos' ? chrome.i18n.getMessage('mediaTypeVideos') :
                                  status.phase === 'projects' ? chrome.i18n.getMessage('optionDownloadModeProject') : status.phase;
                const cancelMsg = chrome.i18n.getMessage('msgDownloadCancelConfirm', [phaseText, status.current, status.total]);
                if (confirm(cancelMsg)) {
                    await sendMessageToContentScript(tab.id, {
                        action: 'cancelDownload'
                    });
                    alert(chrome.i18n.getMessage('msgDownloadCancelled'));
                    startBtn.textContent = chrome.i18n.getMessage('btnStart');
                    startBtn.classList.remove('btn-secondary');
                    startBtn.classList.add('btn-success');
                    isDownloadInProgress = false;
                    generateBtn.disabled = false;
                    generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                }
                return;
            }

            await scanAndConfirmDownload(tab);
        } catch (error) {
            console.error('開始失敗:', error);
            showMessage(chrome.i18n.getMessage('msgStartFailed') + ': ' + error.message, 'error');
            startBtn.disabled = false;
            startBtn.textContent = chrome.i18n.getMessage('btnStart');
        }
    });

    // 監聽下載進度
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'downloadProgress') {
            if (request.status === 'aborted') {
                startBtn.textContent = chrome.i18n.getMessage('btnStart');
                startBtn.classList.remove('btn-secondary');
                startBtn.classList.add('btn-success');
                startBtn.disabled = false;
                isDownloadInProgress = false;
                generateBtn.disabled = false;
                generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
            } else if (request.status === 'rateLimitPaused') {
                // Rate limit pause: reset UI to allow user to click Start Download again
                startBtn.textContent = chrome.i18n.getMessage('btnStart');
                startBtn.classList.remove('btn-secondary');
                startBtn.classList.add('btn-success');
                startBtn.disabled = false;
                isDownloadInProgress = false;
                generateBtn.disabled = false;
                generateBtn.textContent = chrome.i18n.getMessage('btnGenerate');
                showMessage(chrome.i18n.getMessage('rateLimitPaused', [String(request.limit || 250)]), 'info');
            }
        }
    });

    // 清除狀態
    clearBtn.addEventListener('click', async () => {
        const confirmed = confirm(chrome.i18n.getMessage('msgConfirmClearState'));

        if (!confirmed) {
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await sendMessageToContentScript(tab.id, { action: 'clearState' });

            if (response && response.success) {
                showMessage(chrome.i18n.getMessage('msgStateCleared'), 'info');
                await updateStatus();
            }
        } catch (error) {
            console.error('清除失敗:', error);
            showMessage(chrome.i18n.getMessage('msgClearFailed') + ': ' + error.message, 'error');
        }
    });

    // 清除下載歷史
    clearHistoryBtn.addEventListener('click', async () => {
        const confirmed = confirm(chrome.i18n.getMessage('msgConfirmClearHistory'));

        if (!confirmed) {
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await sendMessageToContentScript(tab.id, { action: 'clearHistory' });

            if (response && response.success) {
                showMessage(chrome.i18n.getMessage('msgHistoryCleared'), 'info');
                await updateStatus();
            }
        } catch (error) {
            console.error('清除歷史失敗:', error);
            showMessage(chrome.i18n.getMessage('msgClearHistoryFailed') + ': ' + error.message, 'error');
        }
    });

    // 匯出數據
    exportBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await sendMessageToContentScript(tab.id, { action: 'exportData' });

            if (response && response.success) {
                const data = response.data;

                // 創建下載連結
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // 生成文件名（包含日期）
                const date = new Date().toISOString().split('T')[0];
                a.download = `grok_media_export_${date}.json`;

                a.click();
                URL.revokeObjectURL(url);

                showMessage(chrome.i18n.getMessage('msgExportSuccess', [data.statistics.historyCount]), 'info');
            } else {
                showMessage(chrome.i18n.getMessage('msgExportFailed'), 'error');
            }
        } catch (error) {
            console.error('匯出失敗:', error);
            showMessage(chrome.i18n.getMessage('msgExportFailed') + ': ' + error.message, 'error');
        }
    });

    // 匯入數據
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await sendMessageToContentScript(tab.id, {
                action: 'importData',
                data: data
            });

            if (response && response.success) {
                const merged = response.merged;
                showMessage(
                    chrome.i18n.getMessage('msgImportSuccess', [merged.newItems, merged.historyBefore, merged.historyAfter]),
                    'info'
                );
                await updateStatus();
            } else {
                showMessage(chrome.i18n.getMessage('msgImportFailed') + ': ' + (response?.error || '未知錯誤'), 'error');
            }
        } catch (error) {
            console.error('匯入失敗:', error);
            showMessage(chrome.i18n.getMessage('msgImportFailed') + ': ' + error.message, 'error');
        } finally {
            // 清除文件選擇
            importFile.value = '';
        }
    });

    // 批量移除收藏
    const removeBtn = document.getElementById('removeBtn');
    const removeFromDate = document.getElementById('removeFromDate');
    const removeToDate = document.getElementById('removeToDate');

    // Handle remove date filter radio buttons
    document.querySelectorAll('input[name="removeDateFilter"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const val = document.querySelector('input[name="removeDateFilter"]:checked').value;
            removeFromDate.disabled = val !== 'dateRange';
            removeToDate.disabled = val !== 'dateRange';
            document.getElementById('removeHours').disabled = val !== 'lastHours';
            if (val !== 'dateRange') {
                removeFromDate.value = '';
                removeToDate.value = '';
            }
        });
    });

    function formatRemoveDateRange(filter, fromDate, toDate, hoursLimit) {
        if (filter === 'all') return chrome.i18n.getMessage('msgDateAll');
        if (filter === 'lastHours') {
            const last = chrome.i18n.getMessage('filterLastHours') || 'Last';
            const unit = chrome.i18n.getMessage('hdUpgradeHoursUnit') || 'hours';
            return `${last} ${hoursLimit || 24} ${unit}`;
        }
        return chrome.i18n.getMessage('msgDateRange', [fromDate || '∞', toDate || '∞']);
    }

    removeBtn.addEventListener('click', async () => {
        const deletePost = document.getElementById('deletePostCheckbox').checked;
        const removeDateFilter = document.querySelector('input[name="removeDateFilter"]:checked').value;
        const fromDateValue = removeFromDate.value;
        const toDateValue = removeToDate.value;

        // 如果是日期範圍，至少需要填一個日期
        if (removeDateFilter === 'dateRange' && !fromDateValue && !toDateValue) {
            showMessage(chrome.i18n.getMessage('msgSelectDate'), 'error');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('grok.com/imagine/saved')) {
                showMessage(chrome.i18n.getMessage('msgWrongPageFav'), 'error');
                return;
            }

            // 先嘗試注入 content script（如果還沒注入）
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/logger.js', 'src/utils.js', 'src/content-utils.js', 'content.js']
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('Content script 可能已經存在:', e.message);
            }

            removeBtn.disabled = true;
            removeBtn.textContent = chrome.i18n.getMessage('btnRemoveFavGenerating');

            console.log('發送移除請求...');

            // 準備日期範圍參數
            const removeOptions = {
                removeAll: removeDateFilter === 'all'
            };

            if (removeDateFilter === 'dateRange') {
                if (fromDateValue) {
                    const fromDateObj = new Date(fromDateValue);
                    fromDateObj.setUTCHours(0, 0, 0, 0);
                    removeOptions.fromDate = fromDateObj.getTime();
                }
                if (toDateValue) {
                    const toDateObj = new Date(toDateValue);
                    toDateObj.setUTCHours(23, 59, 59, 999);
                    removeOptions.toDate = toDateObj.getTime();
                }
            } else if (removeDateFilter === 'lastHours') {
                removeOptions.hoursLimit = parseInt(document.getElementById('removeHours').value) || 24;
            }

            // 首先生成移除列表
            const response = await sendMessageToContentScript(tab.id, {
                action: 'removeFavorites',
                options: removeOptions
            });

            console.log('收到回應:', response);

            removeBtn.disabled = false;
            removeBtn.textContent = chrome.i18n.getMessage('btnRemoveFav');

            if (!response) {
                console.error('沒有收到回應');
                showMessage(chrome.i18n.getMessage('msgNoResponse'), 'error');
                return;
            }

            if (!response.success) {
                console.error('操作失敗:', response.error);
                showMessage(chrome.i18n.getMessage('msgOperationFailed') + ': ' + (response.error || '未知錯誤'), 'error');
                return;
            }

            // 處理沒有項目需要移除的情況
            if (response.toRemove === 0 || response.toRemove === undefined) {
                console.log('沒有項目需要移除');
                const dateRange = formatRemoveDateRange(removeDateFilter, fromDateValue, toDateValue, removeOptions.hoursLimit);
                alert(chrome.i18n.getMessage('msgNoItemsToRemoveRange', [dateRange, response.total]));
                return;
            }

            console.log(`找到 ${response.toRemove} 個項目需要移除`);

            // 顯示詳細確認對話框
            const dateRange = formatRemoveDateRange(removeDateFilter, fromDateValue, toDateValue, removeOptions.hoursLimit);
            let confirmMsg = chrome.i18n.getMessage('msgConfirmRemoveRange', [dateRange, response.total, response.toRemove, response.total - response.toRemove]);
            if (deletePost) {
                confirmMsg += '\n\n' + chrome.i18n.getMessage('msgConfirmDeletePost');
            }

            const confirmed = confirm(confirmMsg);

            if (confirmed) {
                const startResponse = await sendMessageToContentScript(tab.id, {
                    action: 'startRemoveFavorites',
                    deletePost: deletePost
                });

                if (startResponse && startResponse.success) {
                    // 鎖住按鈕並顯示初始進度
                    removeBtn.disabled = true;
                    removeBtn.textContent = chrome.i18n.getMessage('msgRemovingProgress', ['0', String(response.toRemove)]);
                    showMessage(chrome.i18n.getMessage('msgStartRemove', [response.toRemove]), 'info');
                } else {
                    showMessage(chrome.i18n.getMessage('msgStartRemoveFailed'), 'error');
                    removeBtn.disabled = false;
                    removeBtn.textContent = chrome.i18n.getMessage('btnRemoveFav');
                }
            }
        } catch (error) {
            console.error('移除失敗:', error);
            showMessage(chrome.i18n.getMessage('msgOperationFailed') + ': ' + error.message, 'error');
            removeBtn.disabled = false;
            removeBtn.textContent = chrome.i18n.getMessage('btnRemoveFav');
        }
    });

    // 監聽移除進度更新
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'removeProgress') {
            // 更新按鈕顯示進度
            removeBtn.disabled = true;
            removeBtn.textContent = chrome.i18n.getMessage('msgRemovingProgress', [String(request.current), String(request.total)]);
        } else if (request.action === 'removeComplete') {
            // 移除完成，恢復按鈕
            removeBtn.disabled = false;
            removeBtn.textContent = chrome.i18n.getMessage('btnRemoveFav');
            showMessage(chrome.i18n.getMessage('msgRemoveComplete', [String(request.success), String(request.total)]), 'info');
        }
    });

    // HD 升級相關邏輯
    const upgradeBtn = document.getElementById('upgradeBtn');
    const hdUpgradeLock = document.getElementById('hdUpgradeLock');
    const hdUpgradeTimeFilterCheckbox = document.getElementById('hdUpgradeTimeFilter');
    const hdUpgradeHoursInput = document.getElementById('hdUpgradeHours');
    let isUpgradeInProgress = false;

    // Load HD upgrade time filter settings
    chrome.storage.sync.get(['hdUpgradeTimeFilter', 'hdUpgradeHours'], (result) => {
        if (hdUpgradeTimeFilterCheckbox) hdUpgradeTimeFilterCheckbox.checked = result.hdUpgradeTimeFilter === true;
        if (hdUpgradeHoursInput && result.hdUpgradeHours) hdUpgradeHoursInput.value = result.hdUpgradeHours;
    });

    // Auto-save HD upgrade time filter settings
    if (hdUpgradeTimeFilterCheckbox) {
        hdUpgradeTimeFilterCheckbox.addEventListener('change', () => {
            chrome.storage.sync.set({ hdUpgradeTimeFilter: hdUpgradeTimeFilterCheckbox.checked });
        });
    }
    if (hdUpgradeHoursInput) {
        hdUpgradeHoursInput.addEventListener('change', () => {
            let val = parseInt(hdUpgradeHoursInput.value) || 24;
            val = Math.max(1, Math.min(240, val));
            hdUpgradeHoursInput.value = val;
            chrome.storage.sync.set({ hdUpgradeHours: val });
        });
    }

    // 檢查升級狀態並更新按鈕
    async function checkAndUpdateUpgradeStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('grok.com')) return;

            const status = await sendMessageToContentScript(tab.id, {
                action: 'getUpgradeStatus'
            });

            if (status && status.inProgress) {
                isUpgradeInProgress = true;
                upgradeBtn.textContent = chrome.i18n.getMessage('btnStopUpgrade', [String(status.current), String(status.total)]);
                upgradeBtn.style.background = '#9e9e9e';
                upgradeBtn.disabled = false;
            } else {
                isUpgradeInProgress = false;
                upgradeBtn.textContent = chrome.i18n.getMessage('btnUpgradeHD');
                upgradeBtn.style.background = '#4caf50';
            }
        } catch (e) {
            console.log('檢查升級狀態失敗:', e.message);
        }
    }

    // popup 開啟時檢查狀態
    checkAndUpdateUpgradeStatus();

    upgradeBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('grok.com')) {
                alert(chrome.i18n.getMessage('msgWrongPage'));
                return;
            }

            // 先嘗試注入 content script
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/logger.js', 'src/utils.js', 'src/content-utils.js', 'content.js']
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                console.log('Content script 可能已經存在:', e.message);
            }

            // 檢查是否正在升級中
            const status = await sendMessageToContentScript(tab.id, {
                action: 'getUpgradeStatus'
            });

            if (status && status.inProgress) {
                // 正在升級中，詢問是否要中斷
                const cancelMsg = chrome.i18n.getMessage('msgUpgradeCancelConfirm', [status.current, status.total]);
                if (confirm(cancelMsg)) {
                    await sendMessageToContentScript(tab.id, {
                        action: 'cancelUpgrade'
                    });
                    alert(chrome.i18n.getMessage('msgUpgradeCancelled'));
                    upgradeBtn.textContent = chrome.i18n.getMessage('btnUpgradeHD');
                    upgradeBtn.style.background = '#4caf50';
                    isUpgradeInProgress = false;
                }
                return;
            }

            upgradeBtn.disabled = true;
            upgradeBtn.textContent = chrome.i18n.getMessage('msgUpgradeScanning');

            // Build options with time filter if enabled
            const upgradeOptions = {};
            if (hdUpgradeTimeFilterCheckbox && hdUpgradeTimeFilterCheckbox.checked) {
                upgradeOptions.hoursLimit = parseInt(hdUpgradeHoursInput?.value) || 24;
            }

            // 1. 先掃描獲取需要升級的數量
            const scanResult = await sendMessageToContentScript(tab.id, {
                action: 'scanFavoritesForUpgrade',
                ...upgradeOptions
            });

            if (!scanResult || !scanResult.success) {
                alert(chrome.i18n.getMessage('msgUpgradeFailed') + (scanResult?.error ? ': ' + scanResult.error : ''));
                return;
            }

            // 2. 顯示掃描結果對話框
            const effectiveCount = upgradeOptions.hoursLimit ? scanResult.needUpgradeFiltered : scanResult.needUpgrade;

            if (effectiveCount === 0) {
                // 沒有需要升級的
                if (upgradeOptions.hoursLimit && scanResult.needUpgrade > 0) {
                    // There are upgradeable videos but none in the time range
                    alert(chrome.i18n.getMessage('msgUpgradeNoNeedFiltered', [
                        scanResult.total,
                        scanResult.alreadyHD,
                        scanResult.needUpgrade,
                        upgradeOptions.hoursLimit
                    ]));
                } else {
                    alert(chrome.i18n.getMessage('msgUpgradeNoNeed', [scanResult.total, scanResult.alreadyHD]));
                }
                return;
            }

            // 有需要升級的，顯示確認對話框
            let confirmMsg;
            if (upgradeOptions.hoursLimit) {
                confirmMsg = chrome.i18n.getMessage('msgUpgradeConfirmFiltered', [
                    scanResult.total,
                    scanResult.alreadyHD,
                    scanResult.needUpgrade,
                    effectiveCount,
                    upgradeOptions.hoursLimit
                ]);
            } else {
                confirmMsg = chrome.i18n.getMessage('msgUpgradeConfirm', [
                    scanResult.total,
                    scanResult.alreadyHD,
                    scanResult.needUpgrade
                ]);
            }

            if (!confirm(confirmMsg)) {
                return;
            }

            // 3. 用戶確認後執行升級
            upgradeBtn.textContent = chrome.i18n.getMessage('msgUpgrading');
            isUpgradeInProgress = true;

            const response = await sendMessageToContentScript(tab.id, {
                action: 'upgradeFavoritesToHD',
                ...upgradeOptions
            });

            if (response && response.success) {
                alert(chrome.i18n.getMessage('msgUpgradeComplete', [response.upgradedCount, response.total]));
            } else if (response && response.aborted) {
                // 被中斷的情況在 cancelUpgrade 處理時已經顯示訊息
            } else {
                alert(chrome.i18n.getMessage('msgUpgradeFailed') + (response?.error ? ': ' + response.error : ''));
            }
        } catch (error) {
            console.error('升級失敗:', error);
            alert(chrome.i18n.getMessage('msgUpgradeFailed') + ': ' + error.message);
        } finally {
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = chrome.i18n.getMessage('btnUpgradeHD');
            upgradeBtn.style.background = '#4caf50';
            isUpgradeInProgress = false;
        }
    });

    // 監聽升級進度
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'upgradeProgress') {
            if (request.status === 'scanning') {
                upgradeBtn.textContent = chrome.i18n.getMessage('msgUpgradeScanning');
                isUpgradeInProgress = true;
            } else if (request.status === 'upgrading') {
                upgradeBtn.textContent = chrome.i18n.getMessage('btnStopUpgrade', [String(request.current), String(request.total)]);
                upgradeBtn.style.background = '#9e9e9e';
                upgradeBtn.disabled = false; // 允許點擊以中斷
                isUpgradeInProgress = true;
            } else if (request.status === 'idle') {
                upgradeBtn.textContent = chrome.i18n.getMessage('btnUpgradeHD');
                upgradeBtn.style.background = '#4caf50';
                upgradeBtn.disabled = false;
                isUpgradeInProgress = false;
            }
        }
    });

    // 串流擷取相關邏輯
    const streamToggle = document.getElementById('streamToggle');
    const downloadStreamBtn = document.getElementById('downloadStreamBtn');
    const clearStreamBtn = document.getElementById('clearStreamBtn');
    const streamCapturedCount = document.querySelector('[data-i18n="streamCapturedCount"]');
    const streamStatus = document.getElementById('streamStatus');
    let streamStatusTimeout = null;

    function showStreamStatus(text, type = 'info') {
        if (!streamStatus) return;
        streamStatus.textContent = text;
        streamStatus.style.display = 'block';
        streamStatus.style.color = type === 'error' ? '#e53935' : '#4caf50';
        if (streamStatusTimeout) clearTimeout(streamStatusTimeout);
        streamStatusTimeout = setTimeout(() => {
            streamStatus.style.display = 'none';
            streamStatusTimeout = null;
        }, 3000);
    }

    // 監聽來自 content script 的計數更新
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'streamImageCaptured') {
            // 這裡通常只更新計數，但如果 content script 傳來狀態也可以更新
            updateStreamCount(request.count, true);
        } else if (request.action === 'streamCaptureStopped') {
            streamToggle.checked = false;
            showStreamStatus(chrome.i18n.getMessage('msgStreamStopped'));
        }
    });

    async function updateStreamCount(count, isCapturing) {
        if (count === undefined || isCapturing === undefined) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const response = await sendMessageToContentScript(tab.id, { action: 'getCapturedImages' }, { silent: true });
                if (response && response.success) {
                    count = response.count;
                    isCapturing = response.isCapturing;
                }
            } catch (e) {
                count = 0;
                isCapturing = false;
            }
        }

        streamCapturedCount.textContent = chrome.i18n.getMessage('streamCapturedCount', [count.toString()]);
        downloadStreamBtn.disabled = count === 0;

        // 同步開關狀態
        if (isCapturing !== undefined) {
            streamToggle.checked = isCapturing;
        }
    }

    streamToggle.addEventListener('change', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const action = streamToggle.checked ? 'startStreamCapture' : 'stopStreamCapture';

            await sendMessageToContentScript(tab.id, { action: action });

            if (streamToggle.checked) {
                showStreamStatus(chrome.i18n.getMessage('msgStreamStarted'));
            } else {
                showStreamStatus(chrome.i18n.getMessage('msgStreamStopped'));
            }
        } catch (error) {
            console.error('串流切換失敗:', error);
            streamToggle.checked = !streamToggle.checked; // 回滾狀態
            if (isConnectionError(error)) {
                showStreamStatus(chrome.i18n.getMessage('msgRefreshRetry'), 'error');
            }
        }
    });

    downloadStreamBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await sendMessageToContentScript(tab.id, { action: 'getCapturedImages' });

            if (response && response.success && response.images.length > 0) {
                const images = response.images;

                // 取得下載路徑設定
                const pathResult = await chrome.storage.sync.get(['pathStream']);
                const streamPath = pathResult.pathStream || 'grok_downloads/stream';

                // 生成時間戳目錄名: YYYY-MM-DD_HH-mm-ss
                const now = new Date();
                const folderName = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + '-' +
                    String(now.getMinutes()).padStart(2, '0') + '-' +
                    String(now.getSeconds()).padStart(2, '0');

                // 逐一下載
                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    await chrome.runtime.sendMessage({
                        action: 'download',
                        url: img.src,
                        filename: `${streamPath}/${folderName}/${img.filename}`
                    });
                    // 小延遲避免瀏覽器卡住
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // 自動清除已下載的圖片並停止擷取
                await sendMessageToContentScript(tab.id, { action: 'clearCapturedImages' }, { silent: true });
                await sendMessageToContentScript(tab.id, { action: 'stopStreamCapture' }, { silent: true });

                updateStreamCount(0, false); // 更新計數為 0 且狀態為 false
                showStreamStatus(chrome.i18n.getMessage('msgDownloadComplete', [images.length, images.length]));
            }
        } catch (error) {
            console.error('下載失敗:', error);
            showStreamStatus(chrome.i18n.getMessage('msgStartFailed'), 'error');
        }
    });

    clearStreamBtn.addEventListener('click', async () => {
        if (!confirm(chrome.i18n.getMessage('msgConfirmClearStream'))) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await sendMessageToContentScript(tab.id, { action: 'clearCapturedImages' });
            updateStreamCount(0);
            showStreamStatus(chrome.i18n.getMessage('msgStateCleared'));
        } catch (error) {
            console.error('清除失敗:', error);
        }
    });

    // 初始化串流計數
    updateStreamCount();

    // ==========================================
    // 設定功能
    // ==========================================
    const pathImagesInput = document.getElementById('pathImages');
    const pathVideosInput = document.getElementById('pathVideos');
    const pathStreamInput = document.getElementById('pathStream');
    const pathFramesInput = document.getElementById('pathFrames');
    const pathProjectsInput = document.getElementById('pathProjects');
    const hdPriorityCheckbox = document.getElementById('hdPriority');
    const saveMetadataCheckbox = document.getElementById('saveMetadata');
    const promptAsFilenameCheckbox = document.getElementById('promptAsFilename');
    const downloadModeStandard = document.getElementById('downloadModeStandard');
    const downloadModeProject = document.getElementById('downloadModeProject');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsStatus = document.getElementById('settingsStatus');
    const footerImagesPath = document.getElementById('footerImagesPath');
    const footerVideosPath = document.getElementById('footerVideosPath');

    // 預設路徑
    const defaultPaths = {
        pathImages: 'grok_downloads/images',
        pathVideos: 'grok_downloads/videos',
        pathStream: 'grok_downloads/stream',
        pathFrames: 'grok_downloads/frames',
        pathProjects: 'grok_downloads/projects'
    };

    // 載入設定
    async function loadSettings() {
        const result = await chrome.storage.sync.get([
            'pathImages', 'pathVideos', 'pathStream', 'pathFrames', 'pathProjects',
            'hdPriority', 'saveMetadata', 'promptAsFilename', 'downloadMode'
        ]);

        if (pathImagesInput) pathImagesInput.value = result.pathImages || defaultPaths.pathImages;
        if (pathVideosInput) pathVideosInput.value = result.pathVideos || defaultPaths.pathVideos;
        if (pathStreamInput) pathStreamInput.value = result.pathStream || defaultPaths.pathStream;
        if (pathFramesInput) pathFramesInput.value = result.pathFrames || defaultPaths.pathFrames;
        if (pathProjectsInput) pathProjectsInput.value = result.pathProjects || defaultPaths.pathProjects;

        // 載入下載選項（hdPriority 預設為 true，saveMetadata/promptAsFilename 預設為 false）
        if (hdPriorityCheckbox) hdPriorityCheckbox.checked = result.hdPriority !== false;
        if (saveMetadataCheckbox) saveMetadataCheckbox.checked = result.saveMetadata === true;
        if (promptAsFilenameCheckbox) promptAsFilenameCheckbox.checked = result.promptAsFilename === true;

        // 載入下載模式（預設為 standard）
        const downloadMode = result.downloadMode || 'standard';
        if (downloadModeStandard) downloadModeStandard.checked = downloadMode === 'standard';
        if (downloadModeProject) downloadModeProject.checked = downloadMode === 'project';
        updateProjectModeHint();

        // 更新 footer 顯示
        if (footerImagesPath) footerImagesPath.textContent = result.pathImages || defaultPaths.pathImages;
        if (footerVideosPath) footerVideosPath.textContent = result.pathVideos || defaultPaths.pathVideos;
    }

    // 使用 GrokUtils.cleanPath 替代本地實作

    // 儲存下載路徑設定（checkbox/radio 已自動保存）
    async function saveSettings() {
        const settings = {
            pathImages: GrokUtils.cleanPath(pathImagesInput?.value, defaultPaths.pathImages),
            pathVideos: GrokUtils.cleanPath(pathVideosInput?.value, defaultPaths.pathVideos),
            pathStream: GrokUtils.cleanPath(pathStreamInput?.value, defaultPaths.pathStream),
            pathFrames: GrokUtils.cleanPath(pathFramesInput?.value, defaultPaths.pathFrames),
            pathProjects: GrokUtils.cleanPath(pathProjectsInput?.value, defaultPaths.pathProjects),
        };

        // 儲存到 storage
        await chrome.storage.sync.set(settings);

        // 更新輸入框
        if (pathImagesInput) pathImagesInput.value = settings.pathImages;
        if (pathVideosInput) pathVideosInput.value = settings.pathVideos;
        if (pathStreamInput) pathStreamInput.value = settings.pathStream;
        if (pathFramesInput) pathFramesInput.value = settings.pathFrames;
        if (pathProjectsInput) pathProjectsInput.value = settings.pathProjects;

        // 更新 footer
        if (footerImagesPath) footerImagesPath.textContent = settings.pathImages;
        if (footerVideosPath) footerVideosPath.textContent = settings.pathVideos;

        // 顯示成功訊息
        if (settingsStatus) {
            settingsStatus.textContent = chrome.i18n.getMessage('settingsSaved') || '✓ Settings saved!';
            settingsStatus.style.display = 'block';
            setTimeout(() => {
                settingsStatus.style.display = 'none';
            }, 2000);
        }
    }

    // 綁定事件
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }

    // 自動保存 checkbox 設定（當用戶改變時）
    if (hdPriorityCheckbox) {
        hdPriorityCheckbox.addEventListener('change', () => {
            chrome.storage.sync.set({ hdPriority: hdPriorityCheckbox.checked });
        });
    }
    if (saveMetadataCheckbox) {
        saveMetadataCheckbox.addEventListener('change', () => {
            chrome.storage.sync.set({ saveMetadata: saveMetadataCheckbox.checked });
        });
    }
    if (promptAsFilenameCheckbox) {
        promptAsFilenameCheckbox.addEventListener('change', () => {
            chrome.storage.sync.set({ promptAsFilename: promptAsFilenameCheckbox.checked });
        });
    }

    // 自動保存下載模式設定 + 顯示/隱藏提示
    const projectModeHint = document.getElementById('projectModeHint');
    function updateProjectModeHint() {
        if (projectModeHint) {
            projectModeHint.style.display = downloadModeProject?.checked ? 'block' : 'none';
        }
    }
    if (downloadModeStandard) {
        downloadModeStandard.addEventListener('change', () => {
            if (downloadModeStandard.checked) {
                chrome.storage.sync.set({ downloadMode: 'standard' });
            }
            updateProjectModeHint();
        });
    }
    if (downloadModeProject) {
        downloadModeProject.addEventListener('change', () => {
            if (downloadModeProject.checked) {
                chrome.storage.sync.set({ downloadMode: 'project' });
            }
            updateProjectModeHint();
        });
    }

    // 初始載入設定
    loadSettings();

    // 授權相關邏輯
    const licenseKeyInput = document.getElementById('licenseKey');
    const activateBtn = document.getElementById('activateBtn');
    const licenseStatus = document.getElementById('licenseStatus');
    const licenseMessage = document.getElementById('licenseMessage');
    const buySection = document.getElementById('buySection');
    const buyBtn = document.getElementById('buyBtn');

    // Pro 功能鎖定層
    const dateFilterLock = document.getElementById('dateFilterLock');
    const removeFavoritesLock = document.getElementById('removeFavoritesLock');
    const dataManageLock = document.getElementById('dataManageLock');
    const streamCaptureLock = document.getElementById('streamCaptureLock');
    const includeVideosCheckbox = document.getElementById('includeVideos');
    const videoLockIcon = document.getElementById('videoLockIcon');

    // 檢查授權狀態
    async function checkLicenseStatus() {
        const result = await chrome.storage.sync.get(['isPro', 'licenseKey']);
        if (result.isPro) {
            // 已激活
            licenseStatus.classList.remove('hidden');
            licenseKeyInput.style.display = 'none';
            activateBtn.style.display = 'none';
            if (buySection) buySection.style.display = 'none';

            // 解鎖 Pro 功能
            unlockProFeatures();
        } else {
            // 未激活
            licenseStatus.classList.add('hidden');
            licenseKeyInput.style.display = 'block';
            activateBtn.style.display = 'block';
            if (buySection) buySection.style.display = 'block';

            // 鎖定 Pro 功能
            lockProFeatures();
        }
    }

    function unlockProFeatures() {
        if (dateFilterLock) dateFilterLock.style.display = 'none';
        if (removeFavoritesLock) removeFavoritesLock.style.display = 'none';
        if (dataManageLock) dataManageLock.style.display = 'none';
        if (streamCaptureLock) streamCaptureLock.style.display = 'none';
        if (hdUpgradeLock) hdUpgradeLock.style.display = 'none';


        // 啟用輸入框和按鈕（根據 radio 狀態）
        const downloadFilterVal = document.querySelector('input[name="downloadDateFilter"]:checked').value;
        fromDate.disabled = downloadFilterVal !== 'dateRange';
        toDate.disabled = downloadFilterVal !== 'dateRange';
        document.getElementById('downloadHours').disabled = downloadFilterVal !== 'lastHours';
        const removeFilterVal = document.querySelector('input[name="removeDateFilter"]:checked').value;
        removeFromDate.disabled = removeFilterVal !== 'dateRange';
        removeToDate.disabled = removeFilterVal !== 'dateRange';
        document.getElementById('removeHours').disabled = removeFilterVal !== 'lastHours';
        removeBtn.disabled = false;
        exportBtn.disabled = false;
        importBtn.disabled = false;

        // 解鎖串流擷取
        streamToggle.disabled = false;
        downloadStreamBtn.disabled = streamCapturedCount.textContent.includes('0'); // 保持原有邏輯
        clearStreamBtn.disabled = false;

        // 解鎖 HD 升級
        upgradeBtn.disabled = false;

        // 解鎖視頻下載
        includeVideosCheckbox.disabled = false;
        if (videoLockIcon) videoLockIcon.style.display = 'none';
    }

    function lockProFeatures() {
        if (dateFilterLock) dateFilterLock.style.display = 'flex';
        if (removeFavoritesLock) removeFavoritesLock.style.display = 'flex';
        if (dataManageLock) dataManageLock.style.display = 'flex';
        if (streamCaptureLock) streamCaptureLock.style.display = 'flex';
        if (hdUpgradeLock) hdUpgradeLock.style.display = 'flex';


        // 禁用輸入框和按鈕
        fromDate.disabled = true;
        toDate.disabled = true;
        document.getElementById('downloadHours').disabled = true;
        removeFromDate.disabled = true;
        removeToDate.disabled = true;
        document.getElementById('removeHours').disabled = true;
        removeBtn.disabled = true;
        exportBtn.disabled = true;
        importBtn.disabled = true;

        // 鎖定串流擷取
        streamToggle.disabled = true;
        streamToggle.checked = false;
        downloadStreamBtn.disabled = true;
        clearStreamBtn.disabled = true;

        // 鎖定 HD 升級
        upgradeBtn.disabled = true;

        // 鎖定視頻下載
        includeVideosCheckbox.disabled = true;
        includeVideosCheckbox.checked = false;
        if (videoLockIcon) videoLockIcon.style.display = 'inline';
    }

    // 激活授權
    activateBtn.addEventListener('click', async () => {
        const key = licenseKeyInput.value.trim();
        if (!key) {
            showMessage(chrome.i18n.getMessage('msgEnterLicenseKey'), 'error');
            return;
        }

        activateBtn.disabled = true;
        activateBtn.textContent = chrome.i18n.getMessage('licenseVerifying');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'activateLicense',
                licenseKey: key
            });

            if (response.success) {
                showMessage(chrome.i18n.getMessage('msgActivateSuccess'), 'info');
                await checkLicenseStatus();
            } else {
                showMessage(chrome.i18n.getMessage('msgActivateFailed') + ': ' + (response.error || '無效的 Key'), 'error');
            }
        } catch (error) {
            console.error('激活錯誤:', error);
            showMessage(chrome.i18n.getMessage('msgActivateError') + ': ' + error.message, 'error');
        } finally {
            activateBtn.disabled = false;
            activateBtn.textContent = chrome.i18n.getMessage('licenseActivateBtn');
        }
    });

    // 購買按鈕
    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            chrome.tabs.create({
                url: buildMarketingUrl('pricing.html', 'popup_buy_btn')
            });
        });
    }

    // Pro 功能鎖定層點擊事件
    document.querySelectorAll('.pro-lock-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            chrome.tabs.create({
                url: buildMarketingUrl('pricing.html', 'feature_limit')
            });
        });
    });

    // 初始化時檢查授權
    await checkLicenseStatus();

    // 初始化時更新狀態
    await updateStatus();

    // 每 2 秒自動更新狀態
    window.__updateStatusInterval = setInterval(updateStatus, 2000);
});
