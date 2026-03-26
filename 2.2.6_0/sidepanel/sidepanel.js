// Story Mode Helper - Side Panel JavaScript
// Storyboard Manager for AI Video Extension Workflow

// i18n helper function
function i18n(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
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

// Localize all elements with data-i18n attributes
function localizeUI() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });

    // Title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.title = message;
        }
    });

    // Placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.placeholder = message;
        }
    });

    // Update document title
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
        const key = titleEl.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            document.title = message;
        }
    }
}

// State
let storyboard = {
    segments: [], // { videoId, order, metadata, addedIndex }
    currentFrameDataUrl: null,
    nextAddedIndex: 1,  // Counter for fixed segment numbering
    selectedVideoId: null  // Currently selected segment for frame preview
};
let resultVideoId = null;
let draggedItem = null;
let isPro = false; // Pro license status

// Generation state
let batchState = {
    isActive: false,
    targetCount: 1,  // Default to 1 video
    completedCount: 0,
    prompt: '',
    videoMode: 'custom',  // Video generation mode: custom/normal/extremely-crazy/extremely-spicy-or-crazy
    videoLength: 6,       // Video duration in seconds (6 or 10)
    resolutionName: '480p', // Video resolution (480p or 720p)
    frameDataUrl: null,
    uploadResolvers: []  // Resolvers for each tab's upload completion
};

// Update generate button text based on count
function updateGenerateButtonText(count) {
    const label = document.getElementById('generateCountLabel');
    if (label) {
        label.textContent = count;
    }
    // Update "Video" vs "Videos"
    const btn = document.getElementById('generateBtn');
    if (btn) {
        const videoText = count === 1 ? 'Video' : 'Videos';
        btn.innerHTML = `<span>🚀</span> <span>Generate</span> <span id="generateCountLabel">${count}</span> <span>${videoText}</span>`;
    }
}

// Check Pro license status
async function checkProStatus() {
    try {
        const result = await chrome.storage.sync.get(['isPro', 'licenseKey']);
        isPro = !!result.isPro;
        return isPro;
    } catch (error) {
        console.error('[SidePanel] Failed to check Pro status:', error);
        isPro = false;
        return false;
    }
}

// Track connected tabs to avoid duplicate connections
const connectedTabIds = new Set();

// Helper: Master video is always the first segment in the storyboard
function getMasterVideoId() {
    return storyboard.segments[0]?.videoId || null;
}

function getMasterMetadata() {
    return storyboard.segments[0]?.metadata || null;
}

// DOM Elements
let dropZone, fileInput, addFileInput;
let storyboardSection, storyboardEl;
let framePreviewSection, frameImage;
let actionSection, exportBtn;
let progressSection, progressStage, progressPercent, progressFill, progressMessage;
let resultSection, downloadBtn, newProjectBtn;
let errorSection, errorMessage, retryBtn;
let storageText, storageFill;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    localizeUI(); // Apply i18n translations
    initializeElements();
    setupEventListeners();
    setupMessageListener();
    setupTabUpdateListener(); // Listen for tab URL changes
    await checkProStatus(); // Check Pro license status
    loadStorageUsage();
    loadSavedStoryboard();
    connectToGrokTabs(); // Establish port connections to favorites and post detail pages
});

// Check if URL is a supported Grok page for studio buttons
function isSupportedGrokUrl(url) {
    if (!url) return false;
    return url.includes('grok.com/imagine/saved') || url.includes('grok.com/imagine/post/');
}

// Connect to a single tab
function connectToTab(tabId) {
    if (connectedTabIds.has(tabId)) {
        console.log(`[SidePanel] Tab ${tabId} already connected, skipping`);
        return;
    }

    try {
        const port = chrome.tabs.connect(tabId, { name: 'sidepanel-studio' });
        connectedTabIds.add(tabId);

        port.onDisconnect.addListener(() => {
            console.log(`[SidePanel] Port disconnected from tab ${tabId}`);
            connectedTabIds.delete(tabId);
        });

        port.postMessage({ action: 'showStudioButtons' });
        console.log(`[SidePanel] Connected to Grok tab ${tabId}`);
    } catch (e) {
        console.log(`[SidePanel] Could not connect to tab ${tabId}:`, e.message);
        connectedTabIds.delete(tabId);
    }
}

// Listen for tab URL changes - connect when navigating to supported pages
function setupTabUpdateListener() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Only act when URL changes and page is loaded
        if (changeInfo.status === 'complete' && tab.url) {
            if (isSupportedGrokUrl(tab.url)) {
                console.log(`[SidePanel] Tab ${tabId} navigated to supported page:`, tab.url);
                connectToTab(tabId);
            } else if (connectedTabIds.has(tabId)) {
                // Tab navigated away from supported page
                console.log(`[SidePanel] Tab ${tabId} left supported page`);
                connectedTabIds.delete(tabId);
            }
        }
    });

    // Also listen for tab removal to clean up
    chrome.tabs.onRemoved.addListener((tabId) => {
        connectedTabIds.delete(tabId);
    });

    console.log('[SidePanel] Tab update listener set up');
}

// Connect to Grok tabs (favorites and post detail pages) using ports
async function connectToGrokTabs() {
    try {
        // Query for both favorites and post detail pages
        const [favoritesTabs, postDetailTabs] = await Promise.all([
            chrome.tabs.query({ url: '*://grok.com/imagine/saved*' }),
            chrome.tabs.query({ url: '*://grok.com/imagine/post/*' })
        ]);

        const allTabs = [...favoritesTabs, ...postDetailTabs];

        for (const tab of allTabs) {
            connectToTab(tab.id);
        }
    } catch (error) {
        console.error('[SidePanel] Failed to connect to Grok tabs:', error);
    }
}

function initializeElements() {
    dropZone = document.getElementById('dropZone');
    fileInput = document.getElementById('fileInput');
    addFileInput = document.getElementById('addFileInput');

    storyboardSection = document.getElementById('storyboardSection');
    storyboardEl = document.getElementById('storyboard');

    framePreviewSection = document.getElementById('framePreviewSection');
    frameImage = document.getElementById('frameImage');

    actionSection = document.getElementById('actionSection');
    exportBtn = document.getElementById('exportBtn');

    progressSection = document.getElementById('progressSection');
    progressStage = document.getElementById('progressStage');
    progressPercent = document.getElementById('progressPercent');
    progressFill = document.getElementById('progressFill');
    progressMessage = document.getElementById('progressMessage');

    resultSection = document.getElementById('resultSection');
    downloadBtn = document.getElementById('downloadBtn');
    newProjectBtn = document.getElementById('newProjectBtn');

    errorSection = document.getElementById('errorSection');
    errorMessage = document.getElementById('errorMessage');
    retryBtn = document.getElementById('retryBtn');

    storageText = document.getElementById('storageText');
    storageFill = document.getElementById('storageFill');

    console.log('[SidePanel] Elements initialized');
}

function setupEventListeners() {
    // Drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleMasterFileSelect);

    // Add file input
    addFileInput.addEventListener('change', handleAddFileSelect);

    // Buttons
    document.getElementById('clearStoryboardBtn')?.addEventListener('click', () => {
        if (storyboard.segments.length === 0) return;
        if (!confirm(i18n('storyModeClearConfirm') || 'Clear all videos from storyboard?')) return;
        clearStoryboard();
    });
    document.getElementById('generateBtn')?.addEventListener('click', startGeneration);
    document.getElementById('downloadFrameBtn')?.addEventListener('click', downloadCurrentFrame);

    // Mode selector (Custom, Normal, Fun, Spicy)
    document.querySelectorAll('.mode-selector:not(.compact) .mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-selector:not(.compact) .mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mode = e.target.dataset.mode;
            batchState.videoMode = mode;
            // Update prompt placeholder based on mode
            const promptInput = document.getElementById('videoPromptInput');
            if (promptInput) {
                if (mode === 'custom') {
                    promptInput.placeholder = i18n('storyModePromptPlaceholder') || 'Enter prompt for video generation...';
                } else {
                    promptInput.placeholder = i18n('storyModePromptOptional') || 'Optional — AI generates if empty';
                }
            }
        });
    });

    // Duration selector (6s, 10s)
    document.querySelectorAll('#storyDurationSelector .mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#storyDurationSelector .mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            batchState.videoLength = parseInt(e.target.dataset.duration);
        });
    });

    // Resolution selector (480p, 720p)
    document.querySelectorAll('#storyResolutionSelector .mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#storyResolutionSelector .mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            batchState.resolutionName = e.target.dataset.resolution;
        });
    });

    // Count selector (1, 3, 5, 10)
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const count = parseInt(e.target.dataset.count);
            batchState.targetCount = count;
            updateGenerateButtonText(count);
        });
    });

    // Add segment drop zone
    const addSegmentDropZone = document.getElementById('addSegmentDropZone');
    if (addSegmentDropZone) {
        addSegmentDropZone.addEventListener('click', () => addFileInput.click());
        addSegmentDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addSegmentDropZone.classList.add('dragover');
        });
        addSegmentDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addSegmentDropZone.classList.remove('dragover');
        });
        addSegmentDropZone.addEventListener('drop', handleAddSegmentDrop);
    }

    // Enter key to send frame (avoid triggering during IME composition)
    const promptInput = document.getElementById('videoPromptInput');
    let isComposing = false;
    promptInput?.addEventListener('compositionstart', () => { isComposing = true; });
    promptInput?.addEventListener('compositionend', () => { isComposing = false; });
    promptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isComposing) {
            e.preventDefault();
            startGeneration();
        }
    });

    exportBtn?.addEventListener('click', startExport);
    downloadBtn?.addEventListener('click', downloadResult);
    document.getElementById('continueEditBtn')?.addEventListener('click', continueEditing);
    newProjectBtn?.addEventListener('click', resetToInitial);
    retryBtn?.addEventListener('click', resetToInitial);

    console.log('[SidePanel] Event listeners set up');
}

function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[SidePanel] Received message:', message.action);

        switch (message.action) {
            case 'ffmpegProgress':
                updateProgress(message.stage, message.percent, message.message);
                break;
            case 'ffmpegComplete':
                handleExportComplete(message.videoId);
                break;
            case 'ffmpegError':
                handleError(message.error);
                break;
            case 'newVideoDetected':
                handleNewVideoDetected(message);
                break;
            case 'availablePresetsDetected':
                handleAvailablePresets(message.modes);
                break;
            case 'videoAddedFromFavorites':
                handleVideoAddedFromFavorites(message);
                sendResponse({ received: true });
                break;
        }

        // Also handle messages with 'type' field (from content script)
        if (message.type === 'batchUploadComplete') {
            handleBatchUploadComplete(message);
            sendResponse({ received: true });
        }
    });
}

// Handle available presets detected from post detail page
function handleAvailablePresets(modes) {
    console.log('[SidePanel] Available presets detected:', modes);
    if (!modes || !Array.isArray(modes)) return;

    const modeButtons = document.querySelectorAll('.mode-btn[data-mode]');
    if (modeButtons.length === 0) return;

    let hasActiveHidden = false;
    modeButtons.forEach(btn => {
        if (!modes.includes(btn.dataset.mode)) {
            if (btn.classList.contains('active')) hasActiveHidden = true;
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });

    // If active mode was hidden, fall back to 'custom'
    if (hasActiveHidden) {
        modeButtons.forEach(btn => btn.classList.remove('active'));
        const customBtn = document.querySelector('.mode-btn[data-mode="custom"]');
        if (customBtn) customBtn.classList.add('active');
        batchState.videoMode = 'custom';
        const promptInput = document.getElementById('videoPromptInput');
        if (promptInput) {
            promptInput.placeholder = i18n('storyModePromptPlaceholder') || 'Enter prompt for video generation...';
        }
    }
}

// Handle batch upload complete notification (upload done, video generation started)
function handleBatchUploadComplete(message) {
    console.log('[SidePanel] Batch upload complete:', message);

    const { batchIndex, success } = message;

    if (batchState.isActive && batchState.uploadResolvers[batchIndex]) {
        // Resolve the upload promise so next tab can start
        batchState.uploadResolvers[batchIndex](success);
    }
}

// Handle video added from Favorites page button
async function handleVideoAddedFromFavorites(message) {
    console.log('[SidePanel] Video added from favorites:', message.videoId);

    try {
        const videoId = message.videoId;

        // Analyze video specs
        const analyzeResult = await chrome.runtime.sendMessage({
            action: 'analyzeVideoFromDB',
            videoId: videoId
        });

        // Extract both first and last frames
        const [firstFrameResult, lastFrameResult] = await Promise.all([
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: videoId,
                position: 'first'
            }),
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: videoId,
                position: 'last'
            })
        ]);

        if (lastFrameResult.success) {
            storyboard.currentFrameDataUrl = lastFrameResult.dataUrl;
        }

        // Add segment with fixed addedIndex (first segment becomes master automatically)
        const addedIndex = storyboard.nextAddedIndex++;
        const newSegment = {
            videoId: videoId,
            order: storyboard.segments.length,
            addedIndex: addedIndex,  // Fixed number based on when it was added
            metadata: analyzeResult.success ? analyzeResult.info : {
                name: `Grok Video`,
                sourceUrl: message.videoUrl
            }
        };

        storyboard.segments.push(newSegment);
        storyboard.selectedVideoId = videoId; // Auto-select newly added segment

        await saveStoryboard();
        await renderStoryboard();
        updateUI();
        loadStorageUsage();

        // Update frame section title for new selection
        selectSegment(videoId);

        console.log('[SidePanel] Video added to storyboard successfully');

    } catch (error) {
        console.error('[SidePanel] Failed to add video from favorites:', error);
    }
}

// Storage Management
async function loadStorageUsage() {
    try {
        const result = await chrome.runtime.sendMessage({ action: 'getStorageUsage' });
        if (result.success) {
            updateStorageDisplay(result.usage);
        }
    } catch (error) {
        console.error('[SidePanel] Failed to load storage usage:', error);
    }
}

function updateStorageDisplay(usage) {
    const usedMB = (usage.used / 1024 / 1024).toFixed(1);
    const quotaMB = (usage.quota / 1024 / 1024).toFixed(0);
    storageText.textContent = `${usedMB} MB / ${quotaMB} MB`;

    const percent = usage.percentage || 0;
    storageFill.style.width = `${percent}%`;

    storageFill.classList.remove('warning', 'danger');
    if (percent >= 90) {
        storageFill.classList.add('danger');
    } else if (percent >= 70) {
        storageFill.classList.add('warning');
    }
}

// Load saved storyboard
async function loadSavedStoryboard() {
    try {
        const result = await chrome.runtime.sendMessage({ action: 'getSequence' });
        if (result.success && result.sequence) {
            storyboard.segments = result.sequence.videoRefs || [];
            storyboard.nextAddedIndex = result.sequence.nextAddedIndex ||
                (storyboard.segments.length > 0
                    ? Math.max(...storyboard.segments.map(s => s.addedIndex || 0)) + 1
                    : 1);

            if (storyboard.segments.length > 0) {
                await renderStoryboard();
                updateUI();
            }
        }
    } catch (error) {
        console.error('[SidePanel] Failed to load storyboard:', error);
    }
}

// Save storyboard
async function saveStoryboard() {
    try {
        await chrome.runtime.sendMessage({
            action: 'saveSequence',
            sequence: {
                // Master is always segments[0], no separate tracking needed
                videoRefs: storyboard.segments,
                nextAddedIndex: storyboard.nextAddedIndex
            }
        });
    } catch (error) {
        console.error('[SidePanel] Failed to save storyboard:', error);
    }
}

// Drag & Drop
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    // First check for local files
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) {
        addVideoFromFile(files[0]);
        return;
    }

    // Check for URLs (from dragging videos from web pages like Grok Favorites)
    const urlData = e.dataTransfer.getData('text/uri-list') ||
                    e.dataTransfer.getData('text/plain') ||
                    e.dataTransfer.getData('text/html');

    if (urlData) {
        // Extract URL from data
        const videoUrl = extractVideoUrl(urlData);
        if (videoUrl) {
            console.log('[SidePanel] Video URL dropped:', videoUrl.substring(0, 100) + '...');
            addVideoFromUrl(videoUrl);
        } else {
            console.log('[SidePanel] No video URL found in drop data:', urlData.substring(0, 200));
            // Show helpful message - likely dragging from Favorites page which only gives thumbnail
            alert(i18n('storyModeCannotGetUrl'));
        }
    }
}

// Handle drop on add segment zone (for adding additional videos)
function handleAddSegmentDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('addSegmentDropZone');
    dropZone?.classList.remove('dragover');

    // Check for local files
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) {
        // Add all dropped video files
        for (const file of files) {
            addVideoFromFile(file);
        }
        return;
    }

    // Check for URLs (from dragging videos from web pages)
    const urlData = e.dataTransfer.getData('text/uri-list') ||
                    e.dataTransfer.getData('text/plain') ||
                    e.dataTransfer.getData('text/html');

    if (urlData) {
        const videoUrl = extractVideoUrl(urlData);
        if (videoUrl) {
            console.log('[SidePanel] Video URL dropped to add segment:', videoUrl.substring(0, 100) + '...');
            addVideoFromUrl(videoUrl);
        } else {
            console.log('[SidePanel] No video URL found in drop data:', urlData.substring(0, 200));
            alert(i18n('storyModeCannotGetUrl'));
        }
    }
}

// Extract video URL from various drag data formats
function extractVideoUrl(data) {
    console.log('[SidePanel] Extracting video URL from data length:', data.length);

    // Image extensions to exclude
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/i;

    // Priority 1: Look for .mp4 URLs (most reliable indicator of video)
    const mp4Match = data.match(/https?:\/\/[^\s<>"']+\.mp4[^\s<>"']*/gi);
    if (mp4Match) {
        for (const url of mp4Match) {
            const cleanUrl = url.replace(/['"<>]$/, '');
            console.log('[SidePanel] Found .mp4 URL:', cleanUrl.substring(0, 100));
            return cleanUrl;
        }
    }

    // Priority 2: Extract src attribute from <video> tag
    // Handle cases where src may come after other attributes
    const videoTagMatch = data.match(/<video[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
    if (videoTagMatch) {
        const url = videoTagMatch[1];
        console.log('[SidePanel] Found video src:', url.substring(0, 100));
        if (!imageExtensions.test(url)) {
            return url;
        }
    }

    // Priority 3: Try to extract from source element inside video
    const sourceSrcMatch = data.match(/<source[^>]+src=["']([^"']+)/i);
    if (sourceSrcMatch && !imageExtensions.test(sourceSrcMatch[1])) {
        console.log('[SidePanel] Found source src:', sourceSrcMatch[1].substring(0, 100));
        return sourceSrcMatch[1];
    }

    // Priority 4: Look for Grok generated video URLs
    const grokVideoMatch = data.match(/https?:\/\/assets\.grok\.com\/[^\s<>"']*\/generated[^\s<>"']*\.mp4[^\s<>"']*/i);
    if (grokVideoMatch) {
        const url = grokVideoMatch[0].replace(/['"<>]$/, '');
        console.log('[SidePanel] Found Grok generated video:', url.substring(0, 100));
        return url;
    }

    // Priority 5: If it's a plain URL, check if it looks like a video URL
    if (data.startsWith('http') && !data.includes(' ') && !data.includes('<')) {
        const cleanUrl = data.trim();
        // Skip obvious images
        if (imageExtensions.test(cleanUrl)) {
            console.log('[SidePanel] Skipping plain image URL');
            return null;
        }
        if (cleanUrl.includes('.mp4') || cleanUrl.includes('.webm') || cleanUrl.includes('.mov')) {
            console.log('[SidePanel] Found plain video URL:', cleanUrl.substring(0, 100));
            return cleanUrl;
        }
    }

    console.log('[SidePanel] No video URL found');
    return null;
}

// Add video from URL (fetched via background script)
async function addVideoFromUrl(url) {
    console.log('[SidePanel] Adding video from URL:', url.substring(0, 100) + '...');

    try {
        showProgress();
        updateProgress('loading', 10, i18n('storyModeFetchingVideo'));

        // Use background script to fetch (has credentials access)
        const result = await chrome.runtime.sendMessage({
            action: 'fetchAndStoreVideo',
            url: url
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch video');
        }

        console.log('[SidePanel] Video stored:', result.videoId);

        updateProgress('loading', 50, i18n('storyModeAnalyzing'));

        // Analyze video specs
        const analyzeResult = await chrome.runtime.sendMessage({
            action: 'analyzeVideoFromDB',
            videoId: result.videoId
        });

        updateProgress('loading', 70, i18n('storyModeExtractingFrames'));

        // Extract both first and last frames
        const [firstFrameResult, lastFrameResult] = await Promise.all([
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: result.videoId,
                position: 'first'
            }),
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: result.videoId,
                position: 'last'
            })
        ]);

        if (lastFrameResult.success) {
            storyboard.currentFrameDataUrl = lastFrameResult.dataUrl;
        }

        // Add segment with fixed addedIndex (first segment becomes master automatically)
        const addedIndex = storyboard.nextAddedIndex++;
        const newSegment = {
            videoId: result.videoId,
            order: storyboard.segments.length,
            addedIndex: addedIndex,
            metadata: analyzeResult.success ? analyzeResult.info : {
                name: `Grok Video`,
                sourceUrl: url
            }
        };

        storyboard.segments.push(newSegment);
        storyboard.selectedVideoId = result.videoId; // Auto-select newly added segment

        await saveStoryboard();
        await renderStoryboard();
        updateUI();
        loadStorageUsage();

        // Update frame section title for new selection
        selectSegment(result.videoId);

        updateProgress('loading', 100, i18n('storyModeDone'));
        setTimeout(() => {
            progressSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }, 500);

    } catch (error) {
        console.error('[SidePanel] Failed to add video from URL:', error);
        handleError(error.message);
    }
}

function handleMasterFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addVideoFromFile(files[0]);
    }
    fileInput.value = '';
}

function handleAddFileSelect(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
        addVideoFromFile(file);
    }
    addFileInput.value = '';
}

// Add video from local file
async function addVideoFromFile(file) {
    console.log('[SidePanel] Adding video:', file.name);

    try {
        showProgress();
        updateProgress('loading', 10, i18n('storyModeReadingFile'));

        const arrayBuffer = await file.arrayBuffer();

        updateProgress('loading', 30, i18n('storyModeStoringVideo'));

        // Store in IndexedDB
        const result = await chrome.runtime.sendMessage({
            action: 'storeVideoBlob',
            videoData: Array.from(new Uint8Array(arrayBuffer)),
            metadata: {
                name: file.name,
                size: file.size
            }
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to store video');
        }

        updateProgress('loading', 50, i18n('storyModeAnalyzing'));

        // Analyze video specs
        const analyzeResult = await chrome.runtime.sendMessage({
            action: 'analyzeVideoFromDB',
            videoId: result.videoId
        });

        updateProgress('loading', 70, i18n('storyModeExtractingFrames'));

        // Extract both first and last frames
        const [firstFrameResult, lastFrameResult] = await Promise.all([
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: result.videoId,
                position: 'first'
            }),
            chrome.runtime.sendMessage({
                action: 'extractFrameFromVideo',
                videoId: result.videoId,
                position: 'last'
            })
        ]);

        if (lastFrameResult.success) {
            storyboard.currentFrameDataUrl = lastFrameResult.dataUrl;
        }

        // Add segment with fixed addedIndex (first segment becomes master automatically)
        const addedIndex = storyboard.nextAddedIndex++;
        const newSegment = {
            videoId: result.videoId,
            order: storyboard.segments.length,
            addedIndex: addedIndex,
            metadata: analyzeResult.success ? analyzeResult.info : { name: file.name }
        };
        storyboard.segments.push(newSegment);
        storyboard.selectedVideoId = result.videoId; // Auto-select newly added segment

        await saveStoryboard();
        await renderStoryboard();
        updateUI();
        loadStorageUsage();

        // Update frame section title for new selection
        selectSegment(result.videoId);

        updateProgress('loading', 100, i18n('storyModeDone'));
        setTimeout(() => {
            progressSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        }, 500);

    } catch (error) {
        console.error('[SidePanel] Failed to add video:', error);
        handleError(error.message);
    }
}

// Render storyboard
async function renderStoryboard() {
    storyboardEl.innerHTML = '';

    for (let i = 0; i < storyboard.segments.length; i++) {
        const segment = storyboard.segments[i];
        const isMaster = i === 0; // First segment is always the master

        const item = document.createElement('div');
        const isSelected = segment.videoId === storyboard.selectedVideoId;
        item.className = `segment-item${isMaster ? ' master' : ''}${isSelected ? ' selected' : ''}`;
        item.draggable = true;
        item.dataset.videoId = segment.videoId;
        item.dataset.index = i;

        // Get both first and last frame thumbnails
        let firstFrameHtml = '<span class="frame-placeholder">1st</span>';
        let lastFrameHtml = '<span class="frame-placeholder">Last</span>';
        try {
            const [firstFrameResult, lastFrameResult] = await Promise.all([
                chrome.runtime.sendMessage({
                    action: 'getFrameFromDB',
                    videoId: segment.videoId,
                    position: 'first'
                }),
                chrome.runtime.sendMessage({
                    action: 'getFrameFromDB',
                    videoId: segment.videoId,
                    position: 'last'
                })
            ]);
            if (firstFrameResult.success && firstFrameResult.frame) {
                firstFrameHtml = `<img src="${firstFrameResult.frame.dataUrl}" alt="first frame">`;
            }
            if (lastFrameResult.success && lastFrameResult.frame) {
                lastFrameHtml = `<img src="${lastFrameResult.frame.dataUrl}" alt="last frame">`;
            }
        } catch (e) {}

        const meta = segment.metadata || {};
        // Highlight resolution mismatch for non-master segments
        const specs = formatSpecs(meta, !isMaster);
        // Use fixed addedIndex for segment name (not the dynamic order)
        const segmentLabel = segment.addedIndex ? `Clip ${segment.addedIndex}` : (meta.name || `Clip ${i + 1}`);

        item.innerHTML = `
            <span class="segment-order">${i + 1}</span>
            <div class="segment-frames">
                <div class="segment-frame first-frame" title="First frame">
                    ${firstFrameHtml}
                    <span class="frame-label">IN</span>
                </div>
                <div class="segment-frame last-frame" title="Last frame">
                    ${lastFrameHtml}
                    <span class="frame-label">OUT</span>
                </div>
            </div>
            <div class="segment-info">
                <div class="segment-name">${escapeHtml(segmentLabel)}</div>
                <div class="segment-meta">${specs}</div>
            </div>
            ${isMaster ? '<span class="segment-status ready">Master</span>' : ''}
            ${!isMaster && needsScaling(meta) ? '<span class="segment-status needs-scale">Scale</span>' : ''}
            <button class="segment-remove" data-video-id="${segment.videoId}">×</button>
        `;

        // Drag events
        item.addEventListener('dragstart', handleSegmentDragStart);
        item.addEventListener('dragover', handleSegmentDragOver);
        item.addEventListener('dragleave', handleSegmentDragLeave);
        item.addEventListener('drop', handleSegmentDrop);
        item.addEventListener('dragend', handleSegmentDragEnd);

        // Remove button
        item.querySelector('.segment-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeSegment(segment.videoId);
        });

        // Click to select segment and show its last frame
        item.addEventListener('click', (e) => {
            if (e.target.closest('.segment-remove')) return; // Ignore remove button clicks
            selectSegment(segment.videoId);
        });

        storyboardEl.appendChild(item);
    }

    // Update frame preview
    if (storyboard.currentFrameDataUrl) {
        frameImage.src = storyboard.currentFrameDataUrl;
        framePreviewSection.classList.remove('hidden');
    }
}

function formatSpecs(meta, highlightResolutionMismatch = false) {
    const parts = [];
    if (meta.resolution) {
        const resText = `${meta.resolution.width}x${meta.resolution.height}`;
        if (highlightResolutionMismatch && needsScaling(meta)) {
            parts.push(`<span class="resolution-warning">${resText}</span>`);
        } else {
            parts.push(resText);
        }
    }
    if (meta.duration) {
        parts.push(formatDuration(meta.duration));
    }
    if (meta.fps) {
        parts.push(`${Math.round(meta.fps)}fps`);
    }
    return parts.join(' • ') || i18n('storyModeUnknownSpecs');
}

function getResolutionText(meta) {
    if (meta?.resolution) {
        return `${meta.resolution.width}x${meta.resolution.height}`;
    }
    return 'Unknown';
}

function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function needsScaling(meta) {
    const masterMeta = getMasterMetadata();
    if (!masterMeta?.resolution || !meta.resolution) return false;
    return meta.resolution.width !== masterMeta.resolution.width ||
           meta.resolution.height !== masterMeta.resolution.height;
}

// Segment drag & drop
function handleSegmentDragStart(e) {
    draggedItem = e.target.closest('.segment-item');
    draggedItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleSegmentDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.segment-item');
    if (item && item !== draggedItem) {
        item.classList.add('drag-over');
    }
}

function handleSegmentDragLeave(e) {
    const item = e.target.closest('.segment-item');
    if (item) {
        item.classList.remove('drag-over');
    }
}

function handleSegmentDrop(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.segment-item');
    if (targetItem && draggedItem && targetItem !== draggedItem) {
        const draggedIndex = parseInt(draggedItem.dataset.index);
        const targetIndex = parseInt(targetItem.dataset.index);

        const [removed] = storyboard.segments.splice(draggedIndex, 1);
        storyboard.segments.splice(targetIndex, 0, removed);

        // Update order
        storyboard.segments.forEach((seg, i) => seg.order = i);

        saveStoryboard();
        renderStoryboard();

        // Refresh resolution info (master may have changed)
        if (storyboard.selectedVideoId) {
            const selectedSegment = storyboard.segments.find(s => s.videoId === storyboard.selectedVideoId);
            if (selectedSegment) {
                updateFrameResolutionInfo(selectedSegment);
            }
        }
    }
    targetItem?.classList.remove('drag-over');
}

function handleSegmentDragEnd() {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
    document.querySelectorAll('.segment-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// Remove segment
async function removeSegment(videoId) {
    // Don't allow removing the only segment
    if (storyboard.segments.length <= 1) {
        if (confirm(i18n('storyModeClearConfirm'))) {
            await clearStoryboard();
        }
        return;
    }

    // Clear selection if removing selected segment
    if (storyboard.selectedVideoId === videoId) {
        storyboard.selectedVideoId = null;
    }

    storyboard.segments = storyboard.segments.filter(s => s.videoId !== videoId);
    // Master automatically becomes segments[0] after removal

    // Delete from IndexedDB
    await chrome.runtime.sendMessage({
        action: 'deleteVideoFromDB',
        videoId
    });

    // Update order
    storyboard.segments.forEach((seg, i) => seg.order = i);

    // Update current frame to last segment and refresh selection
    if (storyboard.segments.length > 0) {
        const lastSegment = storyboard.segments[storyboard.segments.length - 1];
        storyboard.selectedVideoId = lastSegment.videoId;

        const frameResult = await chrome.runtime.sendMessage({
            action: 'getFrameFromDB',
            videoId: lastSegment.videoId,
            position: 'last'
        });
        if (frameResult.success && frameResult.frame) {
            storyboard.currentFrameDataUrl = frameResult.frame.dataUrl;
        }
    }

    await saveStoryboard();
    await renderStoryboard();
    updateUI();

    // Refresh resolution info with new master
    if (storyboard.selectedVideoId) {
        const selectedSegment = storyboard.segments.find(s => s.videoId === storyboard.selectedVideoId);
        if (selectedSegment) {
            updateFrameResolutionInfo(selectedSegment);
        }
    }
    loadStorageUsage();
}

// Clear storyboard
async function clearStoryboard() {
    // Clear all videos, frames, and sequence from IndexedDB
    await chrome.runtime.sendMessage({ action: 'clearAllDB' }).catch(() => {});
    resultVideoId = null;

    storyboard = {
        segments: [],
        currentFrameDataUrl: null,
        nextAddedIndex: 1,  // Reset counter
        selectedVideoId: null  // Reset selection
    };

    await renderStoryboard();
    updateUI();
    loadStorageUsage();
}

// Frame operations
async function selectSegment(videoId) {
    if (!videoId) return;

    // Find the segment
    const segment = storyboard.segments.find(s => s.videoId === videoId);
    if (!segment) return;

    storyboard.selectedVideoId = videoId;

    // Update visual selection in storyboard
    document.querySelectorAll('.segment-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.videoId === videoId);
    });

    // Get the last frame of selected segment
    const frameResult = await chrome.runtime.sendMessage({
        action: 'getFrameFromDB',
        videoId: videoId,
        position: 'last'
    });

    if (frameResult.success && frameResult.frame) {
        storyboard.currentFrameDataUrl = frameResult.frame.dataUrl;
        frameImage.src = frameResult.frame.dataUrl;
        framePreviewSection.classList.remove('hidden');

        // Update frame section title to show which clip is selected
        const segmentLabel = segment.addedIndex ? segment.addedIndex : (segment.metadata?.name || '');
        const titleEl = framePreviewSection.querySelector('.section-title');
        if (titleEl) {
            if (segmentLabel) {
                titleEl.innerHTML = `🖼️ <span data-i18n="storyModeLastFrame">${i18n('storyModeLastFrame')}</span> - Clip ${segmentLabel}`;
            } else {
                titleEl.innerHTML = `🖼️ <span data-i18n="storyModeLastFrame">${i18n('storyModeLastFrame')}</span>`;
            }
        }

        // Update resolution info
        updateFrameResolutionInfo(segment);
    }
}

function updateFrameResolutionInfo(segment) {
    let resolutionInfoEl = document.getElementById('frameResolutionInfo');

    // Create element if it doesn't exist
    if (!resolutionInfoEl) {
        resolutionInfoEl = document.createElement('div');
        resolutionInfoEl.id = 'frameResolutionInfo';
        resolutionInfoEl.className = 'frame-resolution-info';
        const framePreview = document.getElementById('framePreview');
        framePreview.parentNode.insertBefore(resolutionInfoEl, framePreview.nextSibling);
    }

    const meta = segment?.metadata;
    const resolution = getResolutionText(meta);
    const isMismatch = needsScaling(meta);
    const segmentIndex = storyboard.segments.findIndex(s => s.videoId === segment.videoId);
    const isMaster = segmentIndex === 0;

    if (isMismatch && !isMaster) {
        const masterMeta = getMasterMetadata();
        const masterRes = getResolutionText(masterMeta);
        resolutionInfoEl.innerHTML = `<span class="resolution-warning">⚠️ ${resolution}</span> <span class="resolution-hint">(Master: ${masterRes})</span>`;
    } else {
        resolutionInfoEl.innerHTML = `📐 ${resolution}${isMaster ? ' <span class="resolution-hint">(Master)</span>' : ''}`;
    }
}

async function downloadCurrentFrame() {
    if (!storyboard.currentFrameDataUrl) return;

    const paths = await getDownloadPaths();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await chrome.runtime.sendMessage({
        action: 'download',
        url: storyboard.currentFrameDataUrl,
        filename: `${paths.frames}/frame_${timestamp}.png`
    });
}

// ==========================================
// Video Generation Functions
// ==========================================

async function startGeneration() {
    console.log('[SidePanel] Starting video generation...');

    if (!storyboard.currentFrameDataUrl) {
        alert(i18n('storyModeNoFrameAlert') || 'No frame available');
        return;
    }

    const promptInput = document.getElementById('videoPromptInput');
    const prompt = promptInput?.value?.trim() || '';
    const videoMode = batchState.videoMode || 'custom';

    // Prompt is required only for custom mode
    if (!prompt && videoMode === 'custom') {
        alert(i18n('storyModePromptAlert') || 'Please enter a prompt');
        promptInput?.focus();
        return;
    }

    // Initialize state
    batchState.isActive = true;
    batchState.completedCount = 0;
    batchState.prompt = prompt;
    batchState.frameDataUrl = storyboard.currentFrameDataUrl;
    batchState.uploadResolvers = [];

    const count = batchState.targetCount;
    const generateBtn = document.getElementById('generateBtn');
    const progressEl = document.getElementById('generateProgress');
    const progressText = document.getElementById('generateProgressText');

    // Disable button during generation
    generateBtn.disabled = true;

    // Show progress for multiple tabs
    if (count > 1) {
        progressEl.classList.remove('hidden');
    }

    console.log(`[SidePanel] Opening ${count} tab(s)...`);

    for (let i = 0; i < count; i++) {
        try {
            if (count > 1) {
                progressText.textContent = chrome.i18n.getMessage('storyModeOpeningTabs', [String(i + 1), String(count)]) || `Opening tabs... ${i + 1}/${count}`;
            }
            console.log(`[SidePanel] Opening tab ${i + 1}/${count}`);
            await openGenerateTab(i);
            batchState.completedCount++;
            // Small delay between tabs (only if multiple)
            if (count > 1 && i < count - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (error) {
            console.error(`[SidePanel] Error opening tab ${i}:`, error);
        }
    }

    console.log('[SidePanel] All tabs opened, videos generating...');

    // Show completion message
    if (count > 1) {
        progressText.textContent = `✅ Opened ${batchState.completedCount} tabs`;
        setTimeout(() => {
            progressEl.classList.add('hidden');
        }, 3000);
    }

    // Re-enable button
    generateBtn.disabled = false;
    batchState.isActive = false;
}

async function openGenerateTab(index) {
    const timestamp = Date.now();
    const frameData = {
        dataUrl: batchState.frameDataUrl,
        timestamp: timestamp,
        filename: `grok_frame_${timestamp}_${index}.png`,
        prompt: batchState.prompt,
        videoMode: batchState.videoMode || 'custom',
        videoLength: batchState.videoLength || 6,
        resolutionName: batchState.resolutionName || '480p',
        mode: 'batch',
        batchIndex: index
    };

    // Use index-specific storage key
    const storageKey = `pendingFrameUpload_${index}`;

    await chrome.storage.local.set({
        [storageKey]: frameData
    });

    // Create a promise that resolves when upload is complete
    const uploadPromise = new Promise((resolve, reject) => {
        batchState.uploadResolvers[index] = resolve;
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Upload timeout')), 30000);
    });

    // Open Grok Imagine page
    await chrome.tabs.create({
        url: `https://grok.com/imagine#batch=${index}`,
        active: true
    });

    // Wait for upload & prompt submit to complete
    await uploadPromise;
    console.log(`[SidePanel] Tab ${index} ready, video generation started`);
}

// Handle new video detected from content script
async function handleNewVideoDetected(message) {
    console.log('[SidePanel] New video detected:', message.videoUrl);
    // Could show notification or auto-add option
}

// UI State
function updateUI() {
    const hasSegments = storyboard.segments.length > 0;
    const canExport = storyboard.segments.length >= 1;

    storyboardSection.classList.toggle('hidden', !hasSegments);
    framePreviewSection.classList.toggle('hidden', !storyboard.currentFrameDataUrl);
    actionSection.classList.toggle('hidden', !canExport);

    // Reset frame section title if no selection
    if (!storyboard.selectedVideoId) {
        const titleEl = framePreviewSection.querySelector('.section-title');
        if (titleEl) {
            titleEl.innerHTML = `🖼️ <span data-i18n="storyModeLastFrame">${i18n('storyModeLastFrame')}</span>`;
        }
    }

    // Update drop zone for master video display (first segment is master)
    if (hasSegments) {
        const masterMeta = getMasterMetadata();
        dropZone.classList.add('has-master');
        dropZone.innerHTML = `
            <div class="master-video-display">
                <div class="master-thumbnail">🎬</div>
                <div class="master-info">
                    <div class="master-name">${escapeHtml(masterMeta?.name || i18n('storyModeMasterVideo'))}</div>
                    <div class="master-specs">${formatSpecs(masterMeta || {})}</div>
                </div>
                <span class="master-badge">Master</span>
            </div>
        `;
    } else {
        dropZone.classList.remove('has-master');
        dropZone.innerHTML = `
            <div class="drop-zone-content">
                <div class="drop-icon">📁</div>
                <p class="drop-text" data-i18n="storyModeDropVideo">${i18n('storyModeDropVideo')}</p>
                <p class="drop-subtext" data-i18n="storyModeDropSubtext">${i18n('storyModeDropSubtext')}</p>
            </div>
        `;
    }
}

// Check if any segments need scaling
function getSegmentsNeedingScale() {
    const masterMeta = getMasterMetadata();
    if (!masterMeta?.resolution) return [];

    const mismatchedSegments = [];
    for (let i = 1; i < storyboard.segments.length; i++) {
        const segment = storyboard.segments[i];
        const meta = segment.metadata;
        if (meta?.resolution && needsScaling(meta)) {
            mismatchedSegments.push({
                index: i,
                name: meta.name || `Clip ${i + 1}`,
                resolution: `${meta.resolution.width}x${meta.resolution.height}`
            });
        }
    }
    return mismatchedSegments;
}

// Export
async function startExport() {
    if (storyboard.segments.length === 0) return;

    // Check Pro license status before export
    await checkProStatus();
    if (!isPro) {
        alert(i18n('storyModeExportProRequired'));
        return;
    }

    // Check for resolution mismatches before starting
    const mismatchedSegments = getSegmentsNeedingScale();
    if (mismatchedSegments.length > 0) {
        const masterMeta = getMasterMetadata();
        const masterRes = `${masterMeta.resolution.width}x${masterMeta.resolution.height}`;
        const mismatchList = mismatchedSegments
            .map(s => `  • ${s.name}: ${s.resolution}`)
            .join('\n');

        const confirmMessage = i18n('storyModeResolutionMismatch', [masterRes, mismatchList]);
        if (!confirm(confirmMessage)) {
            return; // User cancelled
        }
    }

    showProgress();
    updateProgress('loading', 0, i18n('storyModePreparingVideos'));

    try {
        const masterMeta = getMasterMetadata();

        // Collect video IDs and metadata (no large data transfer)
        const videoInfos = storyboard.segments.map((segment, i) => ({
            videoId: segment.videoId,
            metadata: segment.metadata,
            needsNormalization: i > 0 && segment.metadata?.resolution && needsScaling(segment.metadata)
        }));

        // Get audio option
        const includeAudio = document.getElementById('includeAudioCheckbox')?.checked ?? true;

        // Send only IDs to background - all heavy processing happens there
        // This avoids the 64MB message limit
        chrome.runtime.sendMessage({
            action: 'mergeVideosFromDB',
            videoInfos,
            targetWidth: masterMeta?.resolution?.width,
            targetHeight: masterMeta?.resolution?.height,
            includeAudio
        });

    } catch (error) {
        console.error('[SidePanel] Export failed:', error);
        handleError(error.message);
    }
}

function updateProgress(stage, percent, message) {
    progressStage.textContent = stage.charAt(0).toUpperCase() + stage.slice(1);
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    progressMessage.textContent = message;
}

function handleExportComplete(videoId) {
    resultVideoId = videoId;
    showResult();
}

function handleError(error) {
    errorMessage.textContent = error;
    errorSection.classList.remove('hidden');
    progressSection.classList.add('hidden');
}

function showProgress() {
    progressSection.classList.remove('hidden');
    actionSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}

function showResult() {
    resultSection.classList.remove('hidden');
    progressSection.classList.add('hidden');
}

async function downloadResult() {
    if (!resultVideoId) return;

    try {
        const paths = await getDownloadPaths();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        // Let background handle the download directly from IndexedDB
        // This avoids the 64MB message limit for large videos
        const result = await chrome.runtime.sendMessage({
            action: 'downloadVideoFromDB',
            videoId: resultVideoId,
            filename: `${paths.videos}/grok_video_${timestamp}.mp4`
        });

        if (!result.success) {
            throw new Error(result.error || 'Download failed');
        }

        // Clean up exported video from IndexedDB after successful download
        await chrome.runtime.sendMessage({
            action: 'deleteVideoFromDB',
            videoId: resultVideoId
        }).catch(() => {});
        resultVideoId = null;
    } catch (error) {
        console.error('[SidePanel] Download failed:', error);
        handleError(`Download failed: ${error.message}`);
    }
}

function continueEditing() {
    // Hide result section but keep resultVideoId for potential re-download
    resultSection.classList.add('hidden');
    updateUI();
}

async function resetToInitial() {
    // Confirm before clearing everything
    if (storyboard.segments.length > 0) {
        if (!confirm(i18n('storyModeConfirmNewProject') || 'Start a new project? This will clear all videos in the storyboard.')) {
            return;
        }
    }

    progressSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    // Clear storyboard completely (also cleans up resultVideoId)
    await clearStoryboard();
}

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('[SidePanel] Story Mode Helper initialized');
