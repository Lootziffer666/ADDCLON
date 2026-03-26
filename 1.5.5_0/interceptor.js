// Grok 4.20 Request Interceptor
// Injected into the MAIN world to see request bodies

(function () {
    console.log('Grok Rate Limit Extension: Interceptor initializing...');

    function notifyUsage(model, url) {
        console.log('Grok Rate Limit Extension: Usage detected for', model, 'at', url);
        window.dispatchEvent(new CustomEvent('GROK_USAGE_DETECTED_EVENT', {
            detail: {
                model: model,
                url: url,
                timestamp: Date.now()
            }
        }));
    }

    function notifyRateLimited(model) {
        console.warn('Grok Rate Limit Extension: Rate limit hit for', model);
        window.dispatchEvent(new CustomEvent('GROK_RATE_LIMITED_EVENT', {
            detail: {
                model: model,
                timestamp: Date.now()
            }
        }));
    }

    function getModelFromBody(body) {
        if (!body) return null;
        
        // Normalize checking against different possible fields
        const modeId = body.modeId || body.modelName || body.metadata?.request_metadata?.mode || 
                       body.metadata?.requestMetadata?.mode || body.metadata?.modelName || body.metadata?.model_name;
        const modelMode = body.modelMode;

        if (modeId === 'grok-420' || modelMode === 'MODEL_MODE_GROK_420') {
            return 'grok-420';
        }
        if (modeId === 'heavy' || modelMode === 'MODEL_MODE_HEAVY' || modeId === 'grok-4-heavy') {
            return 'grok-4-heavy';
        }
        if (modeId === 'fast' || modelMode === 'MODEL_MODE_FAST' || modeId === 'grok-3') {
            return 'grok-3';
        }
        if (modeId === 'expert' || modelMode === 'MODEL_MODE_EXPERT' || modeId === 'grok-4') {
            return 'grok-4';
        }
        if (modeId === 'auto' || modelMode === 'MODEL_MODE_AUTO' || modeId === 'grok-4-auto') {
            return 'auto';
        }
        return null;
    }

    function wrapFetch() {
        if (window.fetch._isWrapped) return;

        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
            const urlOrRequest = args[0];
            const options = args[1] || {};

            const url = (urlOrRequest instanceof Request) ? urlOrRequest.url : String(urlOrRequest);

            // Execute original fetch
            const result = originalFetch.apply(this, args);

            try {
                if (url.includes('/rest/app-chat/conversations/new') || (url.includes('/responses') && url.includes('/rest/app-chat/conversations/'))) {
                    let body = null;
                    if (options.body) {
                        try {
                            if (typeof options.body === 'string') {
                                body = JSON.parse(options.body);
                            } else if (typeof options.body === 'object' && !(options.body instanceof ReadableStream)) {
                                body = options.body;
                            }
                        } catch (e) { }
                    }

                    if (!body && urlOrRequest instanceof Request) {
                        try {
                            body = await urlOrRequest.clone().json();
                        } catch (e) { }
                    }

                    const model = getModelFromBody(body);
                    if (model) {
                        if (model === 'auto') {
                            result.then(async (response) => {
                                if (response.ok) {
                                    try {
                                        const clone = response.clone();
                                        const reader = clone.body.getReader();
                                        const decoder = new TextDecoder();
                                        let buffer = '';
                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            buffer += decoder.decode(value, { stream: true });
                                            if (buffer.includes('"effort":"high"') || buffer.includes('"effort": "high"') || 
                                                buffer.includes('"effortLevel":"high"') || buffer.includes('"is_high_effort":true')) {
                                                notifyUsage('grok-4', url);
                                                break;
                                            } else if (buffer.includes('"effort":"low"') || buffer.includes('"effort": "low"') || 
                                                       buffer.includes('"effortLevel":"low"') || buffer.includes('"is_high_effort":false')) {
                                                notifyUsage('grok-3', url);
                                                break;
                                            }
                                            if (buffer.length > 50000) buffer = buffer.slice(-10000);
                                        }
                                    } catch(e) {}
                                }
                            }).catch(() => {});
                        } else {
                            notifyUsage(model, url);
                        }

                        // Also monitor the response for "Too many requests" errors
                        result.then(async (response) => {
                            if (response.status === 429 || !response.ok) {
                                try {
                                    const respClone = response.clone();
                                    const respData = await respClone.json();
                                    if (respData?.error?.message === "Too many requests" || respData?.error?.code === 8) {
                                        notifyRateLimited(model === 'auto' ? 'grok-4' : model);
                                    }
                                } catch (e) { }
                            }
                        }).catch(() => { });
                    }
                }
            } catch (e) {
                console.warn('Grok Rate Limit Extension: Interceptor error', e);
            }

            return result;
        };
        window.fetch._isWrapped = true;
        console.log('Grok Rate Limit Extension: Fetch wrapped');
    }

    function wrapXHR() {
        if (XMLHttpRequest.prototype.send._isWrapped) return;

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (body) {
            try {
                if (this._url && (this._url.includes('/conversations/new') || this._url.includes('/responses'))) {
                    let parsedBody = null;
                    if (typeof body === 'string') {
                        try {
                            parsedBody = JSON.parse(body);
                        } catch (e) { }
                    }

                    const model = getModelFromBody(parsedBody);
                    if (model) {
                        if (model !== 'auto') {
                            notifyUsage(model, this._url);
                        }

                        // For XHR, we listen to load/error events
                        this.addEventListener('load', () => {
                            try {
                                if (model === 'auto' && this.status >= 200 && this.status < 300) {
                                    if (this.responseText.includes('"effort":"high"') || this.responseText.includes('"effort": "high"')) {
                                        notifyUsage('grok-4', this._url);
                                    } else if (this.responseText.includes('"effort":"low"') || this.responseText.includes('"effort": "low"')) {
                                        notifyUsage('grok-3', this._url);
                                    }
                                }

                                if (this.status === 429) {
                                    notifyRateLimited(model === 'auto' ? 'grok-4' : model);
                                } else {
                                    const respData = JSON.parse(this.responseText);
                                    if (respData?.error?.message === "Too many requests" || respData?.error?.code === 8) {
                                        notifyRateLimited(model === 'auto' ? 'grok-4' : model);
                                    }
                                }
                            } catch (e) { }
                        });
                    }
                }
            } catch (e) { }
            return originalSend.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send._isWrapped = true;
        console.log('Grok Rate Limit Extension: XHR wrapped');
    }

    // Wrap immediately
    wrapFetch();
    wrapXHR();

    // Re-wrap on delays to catch late overrides from site scripts
    setTimeout(wrapFetch, 1000);
    setTimeout(wrapFetch, 3000);
    setTimeout(wrapFetch, 10000);
})();
