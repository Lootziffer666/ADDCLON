// Queue Sidepanel Logic

const connectedTabIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
    // i18n
    localizeHtml();

    // Load settings
    await loadSettings();

    // Load queue items
    await refreshQueueList();
    await refreshPromptStats();
    await updateUsageDisplay();

    // Set up event listeners
    setupEventListeners();

    // Connect to Grok tabs to inject "Add to Queue" buttons
    setupTabUpdateListener();
    connectToGrokTabs();

    // Listen for real-time updates from background
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'queueProgressUpdate') {
            refreshQueueList();
            refreshPromptStats();
            updateUsageDisplay();
            if (request.usageLimitReached) {
                setQueueStatus('idle');
                showFormStatus('addItemStatus', chrome.i18n.getMessage('queueUsageLimitReached') || 'Free usage limit reached (50). Upgrade to Pro for unlimited use.', '#f44336');
            } else if (request.allDone) {
                setQueueStatus('idle');
            }
        }
        if (request.action === 'queueItemError') {
            refreshQueueList();
            setQueueStatus('error');
        }
    });

    // Listen for storage changes to update usage display in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes.queueVideoGenCount || changes.isPro)) {
            updateUsageDisplay();
        }
    });
});

// ==========================================
// Tab Connection (inject "Add to Queue" UI)
// ==========================================

function connectToTab(tabId) {
    if (connectedTabIds.has(tabId)) return;

    try {
        const port = chrome.tabs.connect(tabId, { name: 'sidepanel-queue' });
        connectedTabIds.add(tabId);

        port.onDisconnect.addListener(() => {
            connectedTabIds.delete(tabId);
        });

        port.postMessage({ action: 'showQueueButtons' });
        console.log(`[QueuePanel] Connected to tab ${tabId}`);
    } catch (e) {
        console.log(`[QueuePanel] Could not connect to tab ${tabId}:`, e.message);
        connectedTabIds.delete(tabId);
    }
}

async function connectToGrokTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: '*://grok.com/imagine/post/*' });
        for (const tab of tabs) {
            connectToTab(tab.id);
        }
    } catch (error) {
        console.error('[QueuePanel] Failed to connect to Grok tabs:', error);
    }
}

function setupTabUpdateListener() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            if (tab.url.includes('grok.com/imagine/post/')) {
                connectToTab(tabId);
            } else if (connectedTabIds.has(tabId)) {
                connectedTabIds.delete(tabId);
            }
        }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        connectedTabIds.delete(tabId);
    });
}

// ==========================================
// i18n
// ==========================================

function localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.placeholder = msg;
    });
}

// ==========================================
// Settings
// ==========================================

async function loadSettings() {
    const result = await chrome.storage.sync.get(['queueDefaultTarget', 'queueDefaultMaxRetries', 'queueDefaultVideoLength', 'queueDefaultResolution', 'queueDefaultMode']);
    const defaultTarget = result.queueDefaultTarget || 1;
    const defaultRetries = result.queueDefaultMaxRetries || 5;
    const defaultVideoLength = result.queueDefaultVideoLength || '6';
    const defaultResolution = result.queueDefaultResolution || '480p';
    const defaultMode = result.queueDefaultMode || 'custom';

    document.getElementById('settingDefaultTarget').value = defaultTarget;
    document.getElementById('settingDefaultRetries').value = defaultRetries;
    document.getElementById('addTargetInput').value = defaultTarget;
    document.getElementById('addRetriesInput').value = defaultRetries;

    // Set toggle defaults
    setToggleActive('settingDurationToggle', defaultVideoLength);
    setToggleActive('settingResolutionToggle', defaultResolution);
    setToggleActive('addDurationToggle', defaultVideoLength);
    setToggleActive('addResolutionToggle', defaultResolution);
    setToggleActive('settingModeToggle', defaultMode);
    setToggleActive('addModeToggle', defaultMode);
    updatePromptPlaceholder(defaultMode);

    // Batch section defaults
    setToggleActive('batchDurationToggle', defaultVideoLength);
    setToggleActive('batchResolutionToggle', defaultResolution);
    setToggleActive('batchModeToggle', defaultMode);
    document.getElementById('batchTargetInput').value = defaultTarget;
    document.getElementById('batchRetriesInput').value = defaultRetries;
    updateBatchPromptPlaceholder(defaultMode);
}

/** Helper: set active toggle button by value */
function setToggleActive(rowId, value) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.querySelectorAll('.toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
    });
}

/** Helper: get active toggle value */
function getToggleValue(rowId) {
    const active = document.querySelector(`#${rowId} .toggle-btn.active`);
    return active ? active.dataset.value : null;
}

/** Update prompt placeholder based on selected mode */
function updatePromptPlaceholder(mode) {
    const promptEl = document.getElementById('addPromptInput');
    if (!promptEl) return;
    if (mode === 'custom') {
        promptEl.placeholder = 'Enter video generation prompt...';
    } else {
        promptEl.placeholder = 'Optional — AI generates if empty';
    }
}

function updateBatchPromptPlaceholder(mode) {
    const promptEl = document.getElementById('batchPromptInput');
    if (!promptEl) return;
    if (mode === 'custom') {
        promptEl.placeholder = 'Enter video generation prompt...';
    } else {
        promptEl.placeholder = 'Optional — AI generates if empty';
    }
}

function setupSettingsAutoSave() {
    const targetInput = document.getElementById('settingDefaultTarget');
    const retriesInput = document.getElementById('settingDefaultRetries');

    targetInput.addEventListener('change', () => {
        const val = parseInt(targetInput.value) || 1;
        chrome.storage.sync.set({ queueDefaultTarget: val });
        document.getElementById('addTargetInput').value = val;
        document.getElementById('batchTargetInput').value = val;
        showFormStatus('settingsStatus', '✓ Saved', '#4CAF50');
    });

    retriesInput.addEventListener('change', () => {
        const val = parseInt(retriesInput.value) || 5;
        chrome.storage.sync.set({ queueDefaultMaxRetries: val });
        document.getElementById('addRetriesInput').value = val;
        document.getElementById('batchRetriesInput').value = val;
        showFormStatus('settingsStatus', '✓ Saved', '#4CAF50');
    });

    // Toggle button handlers (settings + add form)
    document.querySelectorAll('.toggle-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (!btn) return;
            row.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Auto-save settings toggles and sync to add form
            if (row.id === 'settingDurationToggle') {
                chrome.storage.sync.set({ queueDefaultVideoLength: btn.dataset.value });
                setToggleActive('addDurationToggle', btn.dataset.value);
                setToggleActive('batchDurationToggle', btn.dataset.value);
                showFormStatus('settingsStatus', '✓ Saved', '#4CAF50');
            } else if (row.id === 'settingResolutionToggle') {
                chrome.storage.sync.set({ queueDefaultResolution: btn.dataset.value });
                setToggleActive('addResolutionToggle', btn.dataset.value);
                setToggleActive('batchResolutionToggle', btn.dataset.value);
                showFormStatus('settingsStatus', '✓ Saved', '#4CAF50');
            } else if (row.id === 'settingModeToggle') {
                chrome.storage.sync.set({ queueDefaultMode: btn.dataset.value });
                setToggleActive('addModeToggle', btn.dataset.value);
                setToggleActive('batchModeToggle', btn.dataset.value);
                updatePromptPlaceholder(btn.dataset.value);
                updateBatchPromptPlaceholder(btn.dataset.value);
                showFormStatus('settingsStatus', '✓ Saved', '#4CAF50');
            }

            // Update prompt placeholder when add form mode changes
            if (row.id === 'addModeToggle') {
                updatePromptPlaceholder(btn.dataset.value);
            }

            // Batch mode toggle: update placeholder and spicy warning
            if (row.id === 'batchModeToggle') {
                updateBatchPromptPlaceholder(btn.dataset.value);
                const spicyWarning = document.getElementById('batchSpicyWarning');
                if (spicyWarning) {
                    spicyWarning.style.display =
                        btn.dataset.value === 'extremely-spicy-or-crazy' ? 'block' : 'none';
                }
            }
        });
    });
}

// ==========================================
// Event Listeners
// ==========================================

let currentQueueStatus = 'idle'; // idle, running, paused, error

function setupEventListeners() {
    // Start / Pause / Resume
    document.getElementById('startQueueBtn').addEventListener('click', async () => {
        if (currentQueueStatus === 'running') {
            // Pause
            await sendToContentScript({ action: 'pauseQueue' });
            setQueueStatus('paused');
        } else {
            // Check usage limit before starting
            const usage = await chrome.runtime.sendMessage({ action: 'getQueueUsage' });
            if (usage.success && !usage.isPro && usage.count >= usage.limit) {
                showFormStatus('addItemStatus', '❌ ' + (chrome.i18n.getMessage('queueUsageLimitReached') || 'Free usage limit reached (50). Upgrade to Pro for unlimited use.'), '#f44336');
                return;
            }

            // Start or Resume
            const resp = await sendToContentScript({ action: 'startQueue' });
            if (resp && resp.success) {
                setQueueStatus('running');
            } else {
                showFormStatus('addItemStatus', '❌ ' + (resp?.error || 'Failed to start'), '#f44336');
            }
        }
    });

    // Stop
    document.getElementById('stopQueueBtn').addEventListener('click', async () => {
        await sendToContentScript({ action: 'stopQueue' });
        setQueueStatus('idle');
        refreshQueueList();
    });

    // Clear Pending
    document.getElementById('clearPendingBtn').addEventListener('click', async () => {
        if (!confirm(chrome.i18n.getMessage('queueConfirmClearPending') || 'Delete all pending items?')) return;
        await chrome.runtime.sendMessage({ action: 'deletePendingItems' });
        refreshQueueList();
    });

    // Clear All
    document.getElementById('clearAllBtn').addEventListener('click', async () => {
        if (!confirm(chrome.i18n.getMessage('queueConfirmClearAll') || 'Delete all items in queue?')) return;
        await chrome.runtime.sendMessage({ action: 'clearQueue' });
        refreshQueueList();
    });

    // Add Item
    document.getElementById('addItemBtn').addEventListener('click', addQueueItem);

    // Batch Add Recent
    document.getElementById('batchAddBtn').addEventListener('click', batchAddRecentPosts);

    // Clear Stats
    document.getElementById('clearStatsBtn').addEventListener('click', async () => {
        if (!confirm(chrome.i18n.getMessage('queueConfirmClearStats') || 'Clear all prompt stats?')) return;
        await chrome.runtime.sendMessage({ action: 'clearPromptStats' });
        refreshPromptStats();
    });

    // Settings auto-save
    setupSettingsAutoSave();
}

function setQueueStatus(status) {
    currentQueueStatus = status;
    const statusText = document.getElementById('queueStatusText');
    const startBtn = document.getElementById('startQueueBtn');
    const stopBtn = document.getElementById('stopQueueBtn');
    const startIcon = document.getElementById('startQueueIcon');
    const startLabel = document.getElementById('startQueueLabel');

    statusText.className = '';

    switch (status) {
        case 'idle':
            statusText.textContent = chrome.i18n.getMessage('queueStatusIdle') || 'Idle';
            statusText.classList.add('status-idle');
            startIcon.textContent = '▶️';
            startLabel.textContent = chrome.i18n.getMessage('queueBtnStart') || 'Start';
            startBtn.className = 'btn btn-success';
            startBtn.disabled = false;
            stopBtn.disabled = true;
            break;
        case 'running':
            statusText.textContent = chrome.i18n.getMessage('queueStatusRunning') || 'Running';
            statusText.classList.add('status-running');
            startIcon.textContent = '⏸';
            startLabel.textContent = chrome.i18n.getMessage('queueBtnPause') || 'Pause';
            startBtn.className = 'btn btn-primary';
            startBtn.disabled = false;
            stopBtn.disabled = false;
            break;
        case 'paused':
            statusText.textContent = chrome.i18n.getMessage('queueStatusPaused') || 'Paused';
            statusText.classList.add('status-paused');
            startIcon.textContent = '▶️';
            startLabel.textContent = chrome.i18n.getMessage('queueBtnResume') || 'Resume';
            startBtn.className = 'btn btn-success';
            startBtn.disabled = false;
            stopBtn.disabled = false;
            break;
        case 'error':
            statusText.textContent = chrome.i18n.getMessage('queueStatusError') || 'Error';
            statusText.classList.add('status-error');
            startIcon.textContent = '▶️';
            startLabel.textContent = chrome.i18n.getMessage('queueBtnResume') || 'Resume';
            startBtn.className = 'btn btn-success';
            startBtn.disabled = false;
            stopBtn.disabled = false;
            break;
    }
}

// ==========================================
// Queue Items
// ==========================================

async function refreshQueueList() {
    const resp = await chrome.runtime.sendMessage({ action: 'getAllQueueItems' });
    if (!resp.success) return;

    const items = resp.items || [];
    const listEl = document.getElementById('queueItemsList');
    const countEl = document.getElementById('queueItemCount');
    const emptyEl = document.getElementById('queueEmptyState');

    countEl.textContent = items.length;

    if (items.length === 0) {
        listEl.innerHTML = '';
        listEl.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }

    // Update progress text
    const active = items.filter(i => i.status === 'active').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const completed = items.filter(i => i.status === 'completed').length;
    const failed = items.filter(i => i.status === 'failed').length;

    const progressText = document.getElementById('queueProgressText');
    if (active > 0 || pending > 0) {
        const done = completed + failed;
        progressText.textContent = `${done}/${items.length}`;
    } else {
        progressText.textContent = '';
    }

    // Check if any item is active to detect running state
    if (active > 0 && currentQueueStatus !== 'error') {
        setQueueStatus('running');
    }

    listEl.innerHTML = '';

    for (const item of items) {
        listEl.appendChild(createQueueItemElement(item));
    }
}

function createQueueItemElement(item) {
    const el = document.createElement('div');
    el.className = `queue-item status-${item.status}`;
    el.dataset.id = item.id;

    const shortPostId = item.postId.length > 12 ? item.postId.substring(0, 12) + '...' : item.postId;
    const shortPrompt = item.prompt.length > 60 ? item.prompt.substring(0, 60) + '...' : item.prompt;
    const isClickable = currentQueueStatus !== 'running';

    let badgeClass = `badge-${item.status}`;
    let statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);

    let actionsHtml = '';

    // Delete button for all non-active items
    const deleteBtn = item.status !== 'active'
        ? `<button class="delete-item-btn" data-id="${item.id}" title="Delete">✕</button>`
        : '';

    if (item.status === 'pending') {
        actionsHtml = deleteBtn;
    } else if (item.status === 'error') {
        actionsHtml = `
            <button class="retry-item-btn" data-id="${item.id}">🔄 Retry</button>
            <button class="skip-item-btn" data-id="${item.id}">⏭ Skip</button>
            ${deleteBtn}
        `;
    } else if (item.status === 'completed' || item.status === 'failed') {
        const upActive = item.rating === 'up' ? ' active up' : '';
        const downActive = item.rating === 'down' ? ' active down' : '';
        actionsHtml = `
            <div class="rating-btns">
                <button class="rating-btn${upActive}" data-prompt="${encodeURIComponent(item.prompt)}" data-rating="up">👍</button>
                <button class="rating-btn${downActive}" data-prompt="${encodeURIComponent(item.prompt)}" data-rating="down">👎</button>
            </div>
            ${deleteBtn}
        `;
    }

    const videoInfo = item.videoLength || item.resolutionName
        ? `<span style="color: #667eea;">${item.videoLength || '?'}s ${item.resolutionName || '?'}</span>`
        : '';

    const modeLabels = { 'custom': '', 'normal': 'Normal', 'extremely-crazy': 'Fun', 'extremely-spicy-or-crazy': 'Spicy' };
    const modeLabel = modeLabels[item.mode] || '';
    const modeBadge = modeLabel ? `<span style="color: #e091ff; font-size: 11px;">${modeLabel}</span>` : '';

    el.innerHTML = `
        <div class="queue-item-header">
            <a class="queue-item-postid ${isClickable ? '' : 'disabled'}" href="https://grok.com/imagine/post/${item.postId}" target="_blank">${shortPostId}</a>
            ${videoInfo}
            ${modeBadge}
            <span class="queue-item-badge ${badgeClass}">${statusLabel}</span>
        </div>
        <div class="queue-item-prompt" title="${item.prompt}">${shortPrompt}</div>
        <div class="queue-item-progress">
            <span class="progress-success">✓ ${item.currentSuccess}/${item.targetSuccess}</span>
            <span class="progress-failure">✗ ${item.currentFailure}/${item.maxRetries}</span>
            <span style="color: #888;">Attempts: ${item.totalAttempts}</span>
            ${actionsHtml}
        </div>
        ${item.status === 'error' && item.errorMessage ? `<div class="queue-item-error-msg">${item.errorMessage}</div>` : ''}
    `;

    // Event delegation for actions
    el.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('delete-item-btn')) {
            const id = target.dataset.id;
            await chrome.runtime.sendMessage({ action: 'deleteQueueItem', id });
            refreshQueueList();
        }

        if (target.classList.contains('retry-item-btn')) {
            const id = target.dataset.id;
            await chrome.runtime.sendMessage({ action: 'queueRetryErrorItem', id });
            refreshQueueList();
        }

        if (target.classList.contains('skip-item-btn')) {
            const id = target.dataset.id;
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.runtime.sendMessage({ action: 'queueSkipErrorItem', id, tabId: tab?.id });
            refreshQueueList();
        }

        if (target.classList.contains('rating-btn')) {
            const prompt = decodeURIComponent(target.dataset.prompt);
            const rating = target.dataset.rating;
            const currentlyActive = target.classList.contains('active');
            const newRating = currentlyActive ? null : rating;
            await chrome.runtime.sendMessage({ action: 'updatePromptRating', prompt, rating: newRating });
            refreshQueueList();
            refreshPromptStats();
        }
    });

    return el;
}

// ==========================================
// Add Item
// ==========================================

async function addQueueItem() {
    const postIdRaw = document.getElementById('addPostIdInput').value.trim();
    const prompt = document.getElementById('addPromptInput').value.trim();
    const target = parseInt(document.getElementById('addTargetInput').value) || 1;
    const retries = parseInt(document.getElementById('addRetriesInput').value) || 5;
    const videoLength = parseInt(getToggleValue('addDurationToggle')) || 6;
    const resolutionName = getToggleValue('addResolutionToggle') || '480p';
    const mode = getToggleValue('addModeToggle') || 'custom';

    if (!postIdRaw) {
        showFormStatus('addItemStatus', '❌ Post ID required', '#f44336');
        return;
    }
    if (!prompt && mode === 'custom') {
        showFormStatus('addItemStatus', '❌ Prompt required', '#f44336');
        return;
    }

    // Extract postId from URL if needed
    let postId = postIdRaw;
    const urlMatch = postIdRaw.match(/\/imagine\/post\/([^/?#]+)/);
    if (urlMatch) {
        postId = urlMatch[1];
    }

    const resp = await chrome.runtime.sendMessage({
        action: 'addQueueItem',
        item: { postId, prompt, targetSuccess: target, maxRetries: retries, videoLength, resolutionName, mode }
    });

    if (resp.success) {
        showFormStatus('addItemStatus', '✅ Added!', '#4CAF50');
        document.getElementById('addPostIdInput').value = '';
        document.getElementById('addPromptInput').value = '';
        refreshQueueList();
    } else {
        showFormStatus('addItemStatus', '❌ ' + (resp.error || 'Failed'), '#f44336');
    }
}

// ==========================================
// Batch Add Recent Posts
// ==========================================

async function batchAddRecentPosts() {
    const hoursLimit = parseInt(getToggleValue('batchHoursToggle')) || 6;
    const prompt = document.getElementById('batchPromptInput').value.trim();
    const targetSuccess = parseInt(document.getElementById('batchTargetInput').value) || 1;
    const maxRetries = parseInt(document.getElementById('batchRetriesInput').value) || 5;
    const videoLength = parseInt(getToggleValue('batchDurationToggle')) || 6;
    const resolutionName = getToggleValue('batchResolutionToggle') || '480p';
    const mode = getToggleValue('batchModeToggle') || 'custom';

    // Validate: custom mode requires prompt
    if (!prompt && mode === 'custom') {
        showFormStatus('batchAddStatus', '❌ Prompt required for Custom mode', '#f44336');
        return;
    }

    const addBtn = document.getElementById('batchAddBtn');
    const progressDiv = document.getElementById('batchAddProgress');
    const progressText = document.getElementById('batchProgressText');
    const progressFill = document.getElementById('batchProgressFill');

    addBtn.disabled = true;
    progressDiv.style.display = 'block';
    progressText.textContent = 'Scanning favorites...';
    progressFill.style.width = '0%';

    try {
        // Step 1: Fetch recent IMAGE posts from content script
        const resp = await sendToContentScript({
            action: 'fetchRecentImagePosts',
            hoursLimit
        });

        if (!resp || !resp.success) {
            throw new Error(resp?.error || 'Failed to fetch posts. Is a Grok tab open?');
        }

        const posts = resp.posts || [];
        if (posts.length === 0) {
            showFormStatus('batchAddStatus', `⊘ No image posts found in last ${hoursLimit}h`, '#FF9800');
            return;
        }

        progressText.textContent = `Found ${posts.length} image posts. Adding to queue...`;

        // Step 2: Get existing queue items to check for duplicates
        const existingResp = await chrome.runtime.sendMessage({ action: 'getAllQueueItems' });
        const existingPostIds = new Set(
            (existingResp.items || []).map(item => item.postId)
        );

        // Step 3: Add each post to queue, skipping duplicates
        let added = 0;
        let skipped = 0;
        const total = posts.length;

        for (let i = 0; i < total; i++) {
            const post = posts[i];

            if (existingPostIds.has(post.postId)) {
                skipped++;
            } else {
                await chrome.runtime.sendMessage({
                    action: 'addQueueItem',
                    item: {
                        postId: post.postId,
                        prompt,
                        targetSuccess,
                        maxRetries,
                        videoLength,
                        resolutionName,
                        mode
                    }
                });
                added++;
                existingPostIds.add(post.postId);
            }

            // Update progress
            const pct = Math.round(((i + 1) / total) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = `Adding ${i + 1}/${total}... (${added} added, ${skipped} skipped)`;
        }

        // Step 4: Show result
        let msg = `✅ Added ${added} posts to queue`;
        if (skipped > 0) {
            msg += ` (${skipped} duplicates skipped)`;
        }
        showFormStatus('batchAddStatus', msg, '#4CAF50');
        refreshQueueList();

    } catch (error) {
        showFormStatus('batchAddStatus', '❌ ' + error.message, '#f44336');
    } finally {
        addBtn.disabled = false;
        progressDiv.style.display = 'none';
    }
}

// ==========================================
// Prompt Stats
// ==========================================

async function refreshPromptStats() {
    const resp = await chrome.runtime.sendMessage({ action: 'getAllPromptStats' });
    if (!resp.success) return;

    const stats = resp.stats || [];
    const listEl = document.getElementById('promptStatsList');

    if (stats.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><p>${chrome.i18n.getMessage('queueNoStats') || 'No prompt stats yet'}</p></div>`;
        return;
    }

    listEl.innerHTML = '';

    for (const stat of stats) {
        const el = document.createElement('div');
        el.className = 'prompt-stat-item';

        const shortPrompt = stat.prompt.length > 40 ? stat.prompt.substring(0, 40) + '...' : stat.prompt;
        const ratingIcon = stat.rating === 'up' ? '👍' : stat.rating === 'down' ? '👎' : '';

        el.innerHTML = `
            <span class="prompt-stat-text" title="${stat.prompt}">${shortPrompt}</span>
            <div class="prompt-stat-counts">
                <span class="progress-success">✓${stat.totalSuccess}</span>
                <span class="progress-failure">✗${stat.totalFailure}</span>
                ${ratingIcon ? `<span>${ratingIcon}</span>` : ''}
            </div>
        `;

        listEl.appendChild(el);
    }
}

// ==========================================
// Usage Display
// ==========================================

async function updateUsageDisplay() {
    try {
        const resp = await chrome.runtime.sendMessage({ action: 'getQueueUsage' });
        if (!resp.success) return;

        const usageEl = document.getElementById('queueUsageText');
        if (!usageEl) return;

        const upgradeHint = document.getElementById('queueUpgradeHint');
        if (resp.isPro) {
            usageEl.textContent = '🎬 ∞';
            usageEl.classList.remove('usage-warning');
            if (upgradeHint) upgradeHint.classList.add('hidden');
        } else {
            usageEl.textContent = `🎬 ${resp.count} / ${resp.limit}`;
            const limitReached = resp.count >= resp.limit;
            usageEl.classList.toggle('usage-warning', limitReached);
            if (upgradeHint) upgradeHint.classList.toggle('hidden', !limitReached);
        }

        // Disable start button if limit reached and not Pro
        const startBtn = document.getElementById('startQueueBtn');
        if (!resp.isPro && resp.count >= resp.limit && currentQueueStatus !== 'running') {
            startBtn.disabled = true;
            startBtn.title = chrome.i18n.getMessage('queueUsageLimitReached') || 'Free usage limit reached (50). Upgrade to Pro for unlimited use.';
        }
    } catch (e) {
        console.error('[QueuePanel] Failed to update usage:', e);
    }
}

// ==========================================
// Helpers
// ==========================================

async function sendToContentScript(message) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;
        return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
        console.error('Failed to send to content script:', error);
        return null;
    }
}

function showFormStatus(elementId, text, color) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    setTimeout(() => { el.textContent = ''; }, 2000);
}
