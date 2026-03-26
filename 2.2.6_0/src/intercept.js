/**
 * MAIN World Fetch Interceptor
 * Intercepts Grok streaming conversation API to detect video generation results.
 * Runs at document_start in MAIN world on grok.com/*
 */

if (!window.__grokInterceptLoaded) {
    window.__grokInterceptLoaded = true;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const [resource, init] = args;
        const url = typeof resource === 'string' ? resource : resource?.url || '';

        // Only intercept conversation API calls
        if (!url.includes('/rest/app-chat/conversations/')) {
            return originalFetch.apply(this, args);
        }

        // Only intercept POST requests (conversation submissions)
        const method = (init?.method || 'GET').toUpperCase();
        if (method !== 'POST') {
            return originalFetch.apply(this, args);
        }

        // Check for queue overrides (set by content.js via DOM data attributes)
        // and patch videoGenModelConfig in the request body
        let patchedInit = init;
        try {
            if (init?.body) {
                const bodyStr = typeof init.body === 'string' ? init.body : null;
                if (bodyStr) {
                    const bodyData = JSON.parse(bodyStr);
                    const el = document.documentElement;
                    const overrideLength = el.dataset.grokQueueVideoLength;
                    const overrideRes = el.dataset.grokQueueResolution;
                    const overrideMode = el.dataset.grokQueueMode;

                    const overridePrompt = el.dataset.grokQueuePrompt;

                    if (overrideLength || overrideRes || overrideMode || overridePrompt) {
                        let patched = false;
                        const config = bodyData?.responseMetadata?.modelConfigOverride?.modelMap?.videoGenModelConfig;
                        if (config) {
                            const origLength = config.videoLength;
                            const origRes = config.resolutionName;
                            if (overrideLength) {
                                config.videoLength = parseInt(overrideLength);
                            }
                            if (overrideRes) {
                                config.resolutionName = overrideRes;
                            }
                            console.log(`[GrokIntercept] ✅ Patched videoGenModelConfig: videoLength ${origLength} → ${config.videoLength}, resolution ${origRes} → ${config.resolutionName}`);
                            patched = true;
                        } else if (overrideLength || overrideRes) {
                            console.warn('[GrokIntercept] ⚠️ Queue overrides found but no videoGenModelConfig in request body');
                        }

                        // Ensure prompt is in the message (ProseMirror may not see content script's fill)
                        if (overridePrompt && bodyData.message !== undefined) {
                            const currentMsg = (bodyData.message || '').trim();
                            if (!currentMsg || !currentMsg.includes(overridePrompt.substring(0, 20))) {
                                // Preserve any existing image URL prefix in the message
                                const imageUrlMatch = currentMsg.match(/^(https:\/\/imagine-public\.x\.ai\/\S+)\s*/);
                                bodyData.message = imageUrlMatch
                                    ? `${imageUrlMatch[1]} ${overridePrompt}`
                                    : overridePrompt;
                                console.log(`[GrokIntercept] ✅ Patched message with queue prompt: "${bodyData.message.substring(0, 60)}..."`);
                                patched = true;
                            }
                        }

                        // Patch --mode= in message if override exists
                        if (overrideMode && bodyData.message) {
                            const origMessage = bodyData.message;
                            if (/--mode=\S+/.test(bodyData.message)) {
                                bodyData.message = bodyData.message.replace(/--mode=\S+/, `--mode=${overrideMode}`);
                            } else {
                                bodyData.message = bodyData.message.trimEnd() + ` --mode=${overrideMode}`;
                            }
                            console.log(`[GrokIntercept] ✅ Patched mode in message: "${origMessage.substring(0, 40)}..." → "--mode=${overrideMode}"`);
                            patched = true;
                        }

                        if (patched) {
                            const newBody = JSON.stringify(bodyData);
                            patchedInit = { ...init, body: newBody };
                        }

                        // Clear overrides after use
                        delete el.dataset.grokQueueVideoLength;
                        delete el.dataset.grokQueueResolution;
                        delete el.dataset.grokQueueMode;
                        delete el.dataset.grokQueuePrompt;
                    }
                }
            }
        } catch (e) {
            console.warn('[GrokIntercept] Failed to patch request body:', e);
        }

        const response = await originalFetch.call(this, resource, patchedInit);

        // Detect 429 Too Many Requests — notify content script to stop queue
        if (response.status === 429) {
            console.warn('[GrokIntercept] ⚠️ 429 Too Many Requests — rate limited');
            window.postMessage({
                type: 'GROK_RATE_LIMITED',
                payload: { status: 429, url }
            }, '*');
            return response;
        }

        try {
            // Tee the response body — one for the page, one for inspection
            const [pageStream, inspectStream] = response.body.tee();

            // Read the inspection stream in background (don't block)
            readStreamForVideoResult(inspectStream, url);

            // Return the page stream as a new Response
            return new Response(pageStream, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        } catch (e) {
            console.warn('[GrokIntercept] Failed to tee stream:', e);
            return response;
        }
    };

    async function readStreamForVideoResult(stream, requestUrl) {
        try {
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    processSSELine(line);
                }
            }

            // Process remaining buffer
            if (buffer.trim()) {
                processSSELine(buffer);
            }
        } catch (e) {
            // Stream may be cancelled by the page — that's OK
        }
    }

    function processSSELine(line) {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Handle SSE data: prefix
        let jsonStr = trimmed;
        if (trimmed.startsWith('data: ')) {
            jsonStr = trimmed.slice(6);
        }

        try {
            const data = JSON.parse(jsonStr);
            checkForVideoGenResult(data);
        } catch (e) {
            // Not valid JSON — skip
        }
    }

    function checkForVideoGenResult(data) {
        // Look for streamingVideoGenerationResponse
        const videoGenResp = data?.result?.response?.streamingVideoGenerationResponse
            || data?.streamingVideoGenerationResponse;

        if (!videoGenResp) return;

        // Log first progress event to verify resolution/dimensions
        if (videoGenResp.progress === 1) {
            console.log(`[GrokIntercept] 📹 Video gen started — resolution: ${videoGenResp.resolutionName}, ${videoGenResp.width}x${videoGenResp.height}`);
        }

        if (videoGenResp.progress !== 100) return;

        const moderated = videoGenResp.moderated === true;
        const videoPostId = videoGenResp.postId || null;
        const parentPostId = videoGenResp.parentPostId || null;
        const videoPrompt = videoGenResp.prompt || '';

        console.log(`[GrokIntercept] Video generation complete — moderated: ${moderated}, parentPostId: ${parentPostId}, videoPostId: ${videoPostId}`);

        // Post to ISOLATED world via window.postMessage
        window.postMessage({
            type: 'GROK_VIDEO_GEN_RESULT',
            payload: {
                parentPostId,
                videoPostId,
                moderated,
                videoPrompt
            }
        }, '*');
    }

    // Listen for GROK_FILL_EDITOR messages from content script (ISOLATED world)
    // Content scripts cannot access TipTap's editor instance on DOM elements,
    // so we handle it here in MAIN world where el.editor is accessible.
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data?.type !== 'GROK_FILL_EDITOR') return;

        const { text } = event.data.payload || {};
        if (!text) return;

        try {
            const el = document.querySelector('[contenteditable="true"]');
            if (!el) {
                console.warn('[GrokIntercept] FILL_EDITOR: no contenteditable found');
                window.postMessage({ type: 'GROK_FILL_EDITOR_RESULT', payload: { success: false, error: 'no contenteditable' } }, '*');
                return;
            }

            const editor = el.editor;
            if (!editor || !editor.commands?.insertContent) {
                console.warn('[GrokIntercept] FILL_EDITOR: no TipTap editor instance found');
                window.postMessage({ type: 'GROK_FILL_EDITOR_RESULT', payload: { success: false, error: 'no editor instance' } }, '*');
                return;
            }

            // Clear existing content and insert new text
            editor.commands.setContent('');
            editor.commands.insertContent(text);
            const filled = editor.getText?.() || '';
            console.log(`[GrokIntercept] ✅ FILL_EDITOR: inserted ${filled.length} chars via TipTap API`);
            window.postMessage({ type: 'GROK_FILL_EDITOR_RESULT', payload: { success: true, length: filled.length } }, '*');
        } catch (e) {
            console.warn('[GrokIntercept] FILL_EDITOR error:', e);
            window.postMessage({ type: 'GROK_FILL_EDITOR_RESULT', payload: { success: false, error: e.message } }, '*');
        }
    });

    // Listen for GROK_SUBMIT_EDITOR — press Enter in TipTap to submit the form
    // This is more reliable than clicking the submit button from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data?.type !== 'GROK_SUBMIT_EDITOR') return;

        try {
            const el = document.querySelector('[contenteditable="true"]');
            if (!el) {
                window.postMessage({ type: 'GROK_SUBMIT_EDITOR_RESULT', payload: { success: false, error: 'no contenteditable' } }, '*');
                return;
            }

            el.focus();
            // Dispatch Enter key — Grok's TipTap setup treats Enter as submit (not new line)
            const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
            el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
            el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
            el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
            console.log('[GrokIntercept] ✅ SUBMIT_EDITOR: dispatched Enter key');
            window.postMessage({ type: 'GROK_SUBMIT_EDITOR_RESULT', payload: { success: true } }, '*');
        } catch (e) {
            console.warn('[GrokIntercept] SUBMIT_EDITOR error:', e);
            window.postMessage({ type: 'GROK_SUBMIT_EDITOR_RESULT', payload: { success: false, error: e.message } }, '*');
        }
    });

    console.log('[GrokIntercept] Fetch interceptor loaded');
}
