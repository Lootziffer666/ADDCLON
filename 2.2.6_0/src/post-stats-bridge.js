/**
 * ISOLATED World Relay Bridge
 * Listens for MAIN world postMessage events and forwards to chrome.runtime
 * Runs at document_start in ISOLATED world on grok.com/*
 */

if (!window.__grokBridgeLoaded) {
    window.__grokBridgeLoaded = true;

    window.addEventListener('message', (event) => {
        // Only accept messages from the same window (MAIN world)
        if (event.source !== window) return;
        if (!event.data || event.data.type !== 'GROK_VIDEO_GEN_RESULT') return;

        const payload = event.data.payload;
        if (!payload) return;

        // Forward to background.js via chrome.runtime
        chrome.runtime.sendMessage({
            action: 'videoGenResult',
            parentPostId: payload.parentPostId,
            videoPostId: payload.videoPostId,
            moderated: payload.moderated,
            videoPrompt: payload.videoPrompt
        }).catch(err => {
            console.warn('[GrokBridge] Failed to forward videoGenResult:', err);
        });
    });

    console.log('[GrokBridge] Post stats bridge loaded');
}
