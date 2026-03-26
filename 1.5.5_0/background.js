// Grok Rate Limit Background Service Worker
// Version 1.5.2

const DEFAULTS = {
    totalQueries: 40,
    windowSizeSeconds: 7200,
    usage: []
};

let state = {};

function cleanupOldUsages() {
    let changed = false;
    const now = Date.now();

    for (const model in state) {
        const windowMs = (state[model].windowSizeSeconds || 7200) * 1000;
        const initialCount = state[model].usage.length;
        state[model].usage = state[model].usage.filter(ts => (now - ts) < windowMs);

        if (state[model].usage.length !== initialCount) {
            changed = true;
        }
    }

    if (changed) {
        saveState();
    }
}

function saveState() {
    chrome.storage.local.set({ grok_state: state });
}

function broadcastRefresh(model) {
    chrome.tabs.query({ url: "*://grok.com/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_UI', model: model }).catch(() => { });
        });
    });
}

function setupUsageTimers() {
    const now = Date.now();
    for (const model in state) {
        const windowMs = (state[model].windowSizeSeconds || 7200) * 1000;
        state[model].usage.forEach(ts => {
            const timeUntilExpiry = (ts + windowMs) - now;
            if (timeUntilExpiry > 0) {
                setTimeout(() => {
                    cleanupOldUsages();
                    broadcastRefresh(model);
                }, timeUntilExpiry + 100);
            }
        });
    }
}

// Initialize and load state
const initializationPromise = new Promise((resolve) => {
    chrome.storage.local.get(['grok_state'], (result) => {
        if (result.grok_state) {
            state = result.grok_state;
            cleanupOldUsages();
            setupUsageTimers();
        }
        resolve();
    });
});

setInterval(cleanupOldUsages, 60000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    initializationPromise.then(() => {
        handleMessage(message, sender, sendResponse);
    });
    return true; // Keep channel open
});

function handleMessage(message, sender, sendResponse) {
    const { type, model } = message;

    if (!model) {
        sendResponse({ error: 'No model specified' });
        return;
    }

    // Initialize model state if missing
    if (!state[model]) {
        state[model] = JSON.parse(JSON.stringify(DEFAULTS));
        if (model !== 'grok-420') state[model].totalQueries = 100; // Default for others
    }

    if (type === 'GROK_USAGE_DETECTED') {
        const now = Date.now();
        // De-dupe identical timestamps (within 2s to be safe)
        const isDuplicate = state[model].usage.some(ts => Math.abs(now - ts) < 2000);

        if (!isDuplicate) {
            console.log('Background: Usage detected for', model);
            state[model].usage.push(now);
            saveState();

            const windowMs = (state[model].windowSizeSeconds || 7200) * 1000;
            setTimeout(() => {
                cleanupOldUsages();
                broadcastRefresh(model);
            }, windowMs + 100);

            broadcastRefresh(model);
        }
        sendResponse({ success: true });
        return;
    }

    if (type === 'SYNC_AND_GET_REMAINING') {
        const { totalQueries, remainingQueries, windowSizeSeconds } = message;

        // Sync API data
        if (totalQueries != null && totalQueries > 0) {
            state[model].totalQueries = totalQueries;
        }
        
        if (windowSizeSeconds != null && windowSizeSeconds > 0) {
            state[model].windowSizeSeconds = windowSizeSeconds;
        }

        saveState();
        cleanupOldUsages();
        // Fall through to return remaining
    }

    if (type === 'SYNC_AND_GET_REMAINING' || type === 'GET_REMAINING') {
        const modelState = state[model];
        const total = modelState.totalQueries || (model === 'grok-420' ? 40 : 100);
        const remaining = Math.max(0, total - modelState.usage.length);
        const windowMs = (modelState.windowSizeSeconds || 7200) * 1000;

        let nextResetSeconds = 0;
        if (modelState.usage.length > 0) {
            const oldest = Math.min(...modelState.usage);
            nextResetSeconds = Math.max(0, Math.ceil((oldest + windowMs - Date.now()) / 1000));
        }

        sendResponse({
            remaining,
            total,
            nextResetSeconds,
            windowSizeSeconds: modelState.windowSizeSeconds || 7200
        });
        return;
    }

    if (type === 'RATE_LIMIT_HIT') {
        const modelState = state[model];
        const total = modelState.totalQueries || (model === 'grok-420' ? 40 : 100);
        const currentUsage = modelState.usage.length;

        if (currentUsage < total) {
            console.log('Background: Rate limit hit detected. Adjusting usage for', model);
            const now = Date.now();
            // Add "fake" usages to match the total limit immediately
            for (let i = 0; i < (total - currentUsage); i++) {
                // Stagger them slightly so they don't look like duplicates to de-dupe logic later
                state[model].usage.push(now - (i * 10));
            }
            saveState();
            broadcastRefresh(model);
        }
        sendResponse({ success: true });
        return;
    }

    if (type === 'RESET_COUNTERS') {
        const action = message.action || 'all';

        if (action === 'all') {
            for (const key in state) {
                state[key].usage = [];
            }
            console.log('Background: Reset all counters requested by user.');
        } else {
            if (model === 'grok-4-auto') {
                if (state['grok-4']) state['grok-4'].usage = [];
                if (state['grok-3']) state['grok-3'].usage = [];
            } else {
                if (state[model]) state[model].usage = [];
            }
            console.log(`Background: Reset current model (${model}) requested by user.`);
        }

        saveState();
        broadcastRefresh(model);
        sendResponse({ success: true });
        return;
    }

    sendResponse({ error: 'Unknown message type' });
}
