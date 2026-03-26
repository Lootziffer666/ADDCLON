// Grok Rate Limit Display Chrome Extension
// Default model updated to Grok 4
// Version 1.5.2

(function () {
    'use strict';

    console.log('Grok Rate Limit Extension loaded');

    // Inject interceptor.js into MAIN world to catch request bodies
    try {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('interceptor.js');
        s.onload = function () { this.remove(); };
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {
        console.error('Grok Rate Limit Extension: Failed to inject interceptor:', e);
    }

    // Listen for usage detected by interceptor
    window.addEventListener('GROK_USAGE_DETECTED_EVENT', (event) => {
        const { model } = event.detail;
        console.log('Grok Rate Limit Extension: Usage detected for', model);
        try {
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'GROK_USAGE_DETECTED', model: model });
            }
        } catch (e) {
            console.warn('Grok Rate Limit Extension: Extension context invalidated. Please refresh the page.');
        }
    });

    // Listen for rate limit errors detected by interceptor
    window.addEventListener('GROK_RATE_LIMITED_EVENT', (event) => {
        const { model } = event.detail;
        console.warn('Grok Rate Limit Extension: UI detected rate limit hit for', model);
        try {
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'RATE_LIMIT_HIT', model: model });
            }
        } catch (e) { }
    });

    // Listen for refresh messages from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'REFRESH_UI') {
            if (lastQueryBar) {
                // Poll up to 3 times if count hasn't changed yet
                fetchAndUpdateRateLimit(lastQueryBar, true, 3);
            }
        }
    });

    let lastHigh = { remaining: null, wait: null };
    let lastLow = { remaining: null, wait: null };
    let lastBoth = { high: null, low: null, wait: null };
    let grok420Fetches = 0;
    let grok420HasDropped = false;

    const MODEL_MAP = {
        "Grok 4.20 (Beta)": "grok-420",
        "Grok 420": "grok-420",
        "Grok 4": "grok-4",
        "Grok 3": "grok-3",
        "Grok 4 Heavy": "grok-4-heavy",
        "Grok 4 With Effort Decider": "grok-4-auto",
        "Auto": "grok-4-auto",
        "Fast": "grok-3",
        "Expert": "grok-4",
        "Heavy": "grok-4-heavy",
        "Grok 4 Fast": "grok-4-mini-thinking-tahoe",
        "Grok 4.1": "grok-4-1-non-thinking-w-tool",
        "Grok 4.1 Thinking": "grok-4-1-thinking-1129",
        "Grok 2": "grok-2",
        "Grok 2 Mini": "grok-2-mini",
    };

    const DEFAULT_KIND = "DEFAULT";
    const MODEL_SELECTOR = "button[aria-label='Model select']";
    const QUERY_BAR_SELECTOR = ".query-bar";
    const ELEMENT_WAIT_TIMEOUT_MS = 5000;

    const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit";

    const cachedRateLimits = {};

    let countdownTimer = null;
    let isCountingDown = false;
    let lastQueryBar = null;
    let lastModelObserver = null;
    let lastThinkObserver = null;
    let lastSearchObserver = null;
    let lastInputElement = null;
    let lastSubmitButton = null;
    let lastModelName = null;

    // State for overlap checking
    let overlapCheckInterval = null;
    let isHiddenDueToOverlap = false;

    const commonFinderConfigs = {
        thinkButton: {
            selector: "button",
            ariaLabel: "Think",
            svgPartialD: "M19 9C19 12.866",
        },
        deepSearchButton: {
            selector: "button",
            ariaLabelRegex: /Deep(er)?Search/i,
        },
        attachButton: {
            selector: "button",
            classContains: ["group/attach-button"],
        },
        submitButton: {
            selector: "button",
            svgPartialD: "M6 11L12 5M12 5L18 11M12 5V19",
        }
    };

    // Function to check if current page is under /imagine
    function isImaginePage() {
        return window.location.pathname.startsWith('/imagine');
    }

    // Debounce function
    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }

    // Function to find element based on config (OR logic for conditions)
    function findElement(config, root = document) {
        const elements = root.querySelectorAll(config.selector);
        for (const el of elements) {
            let satisfied = 0;

            if (config.ariaLabel) {
                if (el.getAttribute('aria-label') === config.ariaLabel) satisfied++;
            }

            if (config.ariaLabelRegex) {
                const aria = el.getAttribute('aria-label');
                if (aria && config.ariaLabelRegex.test(aria)) satisfied++;
            }

            if (config.svgPartialD) {
                const path = el.querySelector('path');
                if (path && path.getAttribute('d')?.includes(config.svgPartialD)) satisfied++;
            }

            if (config.classContains) {
                if (config.classContains.some(cls => el.classList.contains(cls))) satisfied++;
            }

            if (satisfied > 0) {
                return el;
            }
        }
        return null;
    }

    // Function to format timer for display (H:MM:SS or MM:SS)
    function formatTimer(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Function to check if text content overlaps with rate limit display
    function checkTextOverlap(queryBar) {
        const rateLimitContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (!rateLimitContainer) return;

        // Look for both mobile textarea and desktop contenteditable
        const contentEditable = queryBar.querySelector('div[contenteditable="true"]');
        const textArea = queryBar.querySelector('textarea[aria-label*="Ask Grok"]');
        const inputElement = contentEditable || textArea;

        if (!inputElement) return;

        // Get the text content from either element
        const textContent = inputElement.value || inputElement.textContent || '';
        const textLength = textContent.trim().length;

        // Calculate available space more accurately
        const queryBarWidth = queryBar.offsetWidth;
        const rateLimitWidth = rateLimitContainer.offsetWidth;
        const availableSpace = queryBarWidth - rateLimitWidth - 100; // 100px buffer

        // More aggressive detection for small screens
        const isSmallScreen = window.innerWidth < 900 ||
            availableSpace < 200 ||
            window.screen?.width < 500 ||
            document.documentElement.clientWidth < 500;

        // Very conservative approach: on small screens hide immediately when typing
        // On larger screens, give more room
        const characterLimit = isSmallScreen ? 0 : 28;

        const shouldHide = textLength > characterLimit;

        if (shouldHide && !isHiddenDueToOverlap) {
            // Add slide-right animation to match model picker
            rateLimitContainer.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
            rateLimitContainer.style.transform = 'translateX(100%)';
            rateLimitContainer.style.opacity = '0';

            // After animation, hide completely
            setTimeout(() => {
                if (isHiddenDueToOverlap) {
                    rateLimitContainer.style.display = 'none';
                }
            }, 200);

            isHiddenDueToOverlap = true;
        } else if (!shouldHide && isHiddenDueToOverlap) {
            // Show and slide back in
            rateLimitContainer.style.display = '';
            rateLimitContainer.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';

            // Force a reflow to ensure display change takes effect
            rateLimitContainer.offsetHeight;

            rateLimitContainer.style.transform = 'translateX(0)';
            rateLimitContainer.style.opacity = '0.8';

            isHiddenDueToOverlap = false;
        }
    }

    // Function to start overlap checking for a query bar
    function startOverlapChecking(queryBar) {
        // Clear any existing interval
        if (overlapCheckInterval) {
            clearInterval(overlapCheckInterval);
        }

        // Check for overlap less frequently to prevent flashing
        overlapCheckInterval = setInterval(() => {
            if (document.body.contains(queryBar)) {
                checkTextOverlap(queryBar);
            } else {
                clearInterval(overlapCheckInterval);
                overlapCheckInterval = null;
            }
        }, 500);
    }

    // Function to stop overlap checking
    function stopOverlapChecking() {
        if (overlapCheckInterval) {
            clearInterval(overlapCheckInterval);
            overlapCheckInterval = null;
        }
        isHiddenDueToOverlap = false;
    }

    // Function to remove any existing rate limit display
    function removeExistingRateLimit() {
        const existing = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (existing) {
            existing.remove();
        }
    }

    // Function to determine model key from SVG or text
    function getCurrentModelKey(queryBar) {
        const modelButton = queryBar.querySelector(MODEL_SELECTOR);
        if (!modelButton) return DEFAULT_MODEL;

        // Check for text span first (updated selector for new UI)
        const textElement = modelButton.querySelector('span.font-semibold');
        if (textElement) {
            const modelText = textElement.textContent.trim();
            return MODEL_MAP[modelText] || DEFAULT_MODEL;
        }

        // Fallback to old chooser text span
        const oldTextElement = modelButton.querySelector('span.inline-block');
        if (oldTextElement) {
            const modelText = oldTextElement.textContent.trim();
            return MODEL_MAP[modelText] || DEFAULT_MODEL;
        }

        // New chooser: check SVG icon
        const svg = modelButton.querySelector('svg');
        if (svg) {
            const pathsD = Array.from(svg.querySelectorAll('path'))
                .map(p => p.getAttribute('d') || '')
                .filter(d => d.length > 0)
                .join(' ');

            const hasBrainFill = svg.querySelector('path[class*="fill-yellow-100"]') !== null;

            if (pathsD.includes('M6.5 12.5L11.5 17.5')) {
                return 'grok-4-auto'; // Auto
            } else if (pathsD.includes('M5 14.25L14 4')) {
                return 'grok-3'; // Fast
            } else if (hasBrainFill || pathsD.includes('M19 9C19 12.866')) {
                return 'grok-4'; // Expert
            } else if (pathsD.includes('M12 3a6 6 0 0 0 9 9')) {
                return 'grok-4-mini-thinking-tahoe'; // Grok 4 Fast
            } else if (pathsD.includes('M11 18H10C7.79086 18 6 16.2091 6 14V13')) {
                return 'grok-4-heavy'; // Heavy
            }
        }

        return DEFAULT_MODEL;
    }

    // Function to determine effort level based on model
    function getEffortLevel(modelName) {
        if (modelName === 'grok-4-auto') {
            return 'both';
        } else if (modelName === 'grok-3') {
            return 'low';
        } else if (modelName === 'grok-4-1-non-thinking-w-tool') {
            return 'low';
        } else if (modelName === 'grok-4-1-thinking-1129') {
            return 'high';
        } else if (modelName === 'grok-420') {
            return 'high';
        } else {
            // Grok 4, Heavy, and Grok 4.1 Thinking fall here
            return 'high';
        }
    }

    // Function to update or inject the rate limit display
    function updateRateLimitDisplay(queryBar, response, effort, modelName) {
        if (isImaginePage()) {
            removeExistingRateLimit();
            return;
        }

        let rateLimitContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);

        if (!rateLimitContainer) {
            rateLimitContainer = document.createElement('div');
            rateLimitContainer.id = RATE_LIMIT_CONTAINER_ID;
            rateLimitContainer.className = 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed [&_svg]:duration-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:-mx-0.5 select-none text-fg-primary hover:bg-button-ghost-hover hover:border-border-l2 disabled:hover:bg-transparent h-10 px-3.5 py-2 text-sm rounded-full group/rate-limit transition-colors duration-100 relative overflow-hidden border border-transparent cursor-pointer';
            rateLimitContainer.style.opacity = '0.8';
            rateLimitContainer.style.transition = 'opacity 0.1s ease-in-out';
            rateLimitContainer.style.zIndex = '20';

            rateLimitContainer.addEventListener('mouseenter', () => { rateLimitContainer._isHovered = true; });
            let pressTimer;
            rateLimitContainer.addEventListener('mousedown', () => {
                pressTimer = setTimeout(() => {
                    showResetMenu(rateLimitContainer, modelName, queryBar);
                }, 2000);
            });
            rateLimitContainer.addEventListener('mouseup', () => clearTimeout(pressTimer));
            rateLimitContainer.addEventListener('mouseleave', () => {
                rateLimitContainer._isHovered = false;
                clearTimeout(pressTimer);
            });

            rateLimitContainer.addEventListener('click', () => {
                if (pressTimer) clearTimeout(pressTimer);
                if (!document.getElementById('grok-rate-limit-reset-menu')) {
                    fetchAndUpdateRateLimit(queryBar, true);
                }
            });

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '18');
            svg.setAttribute('height', '18');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('class', 'lucide lucide-gauge stroke-[2] text-fg-secondary transition-colors duration-100');
            svg.setAttribute('aria-hidden', 'true');

            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex items-center';

            rateLimitContainer.appendChild(svg);
            rateLimitContainer.appendChild(contentDiv);

            // Targeted Insertion Logic: Place it to the left of the model selector
            const modelSelector = queryBar.querySelector('#model-select-trigger')?.closest('.z-20') || 
                                 queryBar.querySelector('button[aria-label="Model select"]')?.closest('.z-20') ||
                                 queryBar.querySelector('button[aria-label="Model select"]');
            
            const toolsContainer = queryBar.querySelector('div.ms-auto.flex.flex-row.items-end');

            if (modelSelector && modelSelector.parentNode) {
                modelSelector.parentNode.insertBefore(rateLimitContainer, modelSelector);
            } else if (toolsContainer) {
                // Prepend to put it to the left of other buttons if model selector not found
                toolsContainer.prepend(rateLimitContainer);
            } else {
                // Fallback: bottom bar
                const bottomBar = queryBar.querySelector('div.absolute.inset-x-0.bottom-0');
                if (bottomBar) {
                    bottomBar.appendChild(rateLimitContainer);
                } else {
                    rateLimitContainer.remove();
                    rateLimitContainer = null;
                    return;
                }
            }
        }

        const contentDiv = rateLimitContainer.lastChild;
        const svg = rateLimitContainer.querySelector('svg');

        contentDiv.innerHTML = '';

        const isBoth = effort === 'both';

        if (response.error) {
            if (isBoth) {
                if (lastBoth.high !== null) {
                    appendNumberSpan(contentDiv, lastBoth.high, '');
                    rateLimitContainer.title = `High: ${lastBoth.high} | Low: ${lastBoth.low ?? 'Unknown'} queries remaining`;
                    setGaugeSVG(svg);
                } else {
                    appendNumberSpan(contentDiv, 'Unavailable', '');
                    rateLimitContainer.title = 'Unavailable';
                    setGaugeSVG(svg);
                }
            } else {
                const lastForEffort = (effort === 'high') ? lastHigh : lastLow;
                if (lastForEffort.remaining !== null) {
                    appendNumberSpan(contentDiv, lastForEffort.remaining, '');
                    rateLimitContainer.title = `${lastForEffort.remaining} queries remaining`;
                    setGaugeSVG(svg);
                } else {
                    appendNumberSpan(contentDiv, 'Unavailable', '');
                    rateLimitContainer.title = 'Unavailable';
                    setGaugeSVG(svg);
                }
            }
        } else {
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }

            if (isBoth) {
                lastBoth.high = response.highRemaining;
                lastBoth.low = response.lowRemaining;
                lastBoth.wait = response.waitTimeSeconds;

                const high = lastBoth.high;
                const low = lastBoth.low;
                const waitTimeSeconds = lastBoth.wait;

                let currentCountdown = waitTimeSeconds;
                let timerSpan = null;

                if (high > 0) {
                    appendNumberSpan(contentDiv, high, '');
                    setGaugeSVG(svg);
                } else if (waitTimeSeconds > 0) {
                    timerSpan = appendNumberSpan(contentDiv, formatTimer(currentCountdown), '#ff6347');
                    setClockSVG(svg);
                } else {
                    appendNumberSpan(contentDiv, '0', '#ff6347');
                    setGaugeSVG(svg);
                }

                const updateTooltip = () => {
                    let title = "";
                    if (currentCountdown > 0) {
                        title = `Wait Time ${formatTimer(currentCountdown)}`;
                    }
                    if (!rateLimitContainer._isHovered && rateLimitContainer.title !== title) {
                        rateLimitContainer.title = title;
                        if (contentDiv) contentDiv.title = title;
                    }
                };

                updateTooltip();

                if (waitTimeSeconds > 0) {
                    const isOutOfQueries = (high <= 0);
                    if (isOutOfQueries) {
                        isCountingDown = true;
                    }

                    countdownTimer = setInterval(() => {
                        currentCountdown--;
                        if (currentCountdown <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            if (isOutOfQueries) isCountingDown = false;
                            fetchAndUpdateRateLimit(queryBar, true);
                        } else {
                            if (timerSpan) timerSpan.textContent = formatTimer(currentCountdown);
                            updateTooltip();
                        }
                    }, 1000);
                }
            } else {
                const lastForEffort = (effort === 'high') ? lastHigh : lastLow;
                lastForEffort.remaining = response.remainingQueries;
                lastForEffort.wait = response.waitTimeSeconds;

                const remaining = lastForEffort.remaining;
                const waitTimeSeconds = lastForEffort.wait;

                let currentCountdown = waitTimeSeconds;
                let timerSpan = null;

                if (remaining > 0) {
                    let displayText = remaining;
                    appendNumberSpan(contentDiv, displayText, '');
                    setGaugeSVG(svg);
                } else if (waitTimeSeconds > 0) {
                    timerSpan = appendNumberSpan(contentDiv, formatTimer(currentCountdown), '#ff6347');
                    setClockSVG(svg);
                } else {
                    appendNumberSpan(contentDiv, '0', '#ff6347');
                    setGaugeSVG(svg);
                }

                const updateTooltip = () => {
                    let title = "";
                    if (currentCountdown > 0) {
                        title = `Wait Time ${formatTimer(currentCountdown)}`;
                    }
                    if (!rateLimitContainer._isHovered && rateLimitContainer.title !== title) {
                        rateLimitContainer.title = title;
                        if (contentDiv) contentDiv.title = title;
                    }
                };

                updateTooltip();

                if (waitTimeSeconds > 0) {
                    const isOutOfQueries = (remaining <= 0);
                    if (isOutOfQueries) {
                        isCountingDown = true;
                    }

                    countdownTimer = setInterval(() => {
                        currentCountdown--;
                        if (currentCountdown <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            if (isOutOfQueries) isCountingDown = false;
                            fetchAndUpdateRateLimit(queryBar, true);
                        } else {
                            if (timerSpan) timerSpan.textContent = formatTimer(currentCountdown);
                            updateTooltip();
                        }
                    }, 1000);
                }
            }
        }
    }

    function appendNumberSpan(parent, text, color) {
        const span = document.createElement('span');
        span.textContent = text;
        if (color) span.style.color = color;
        parent.appendChild(span);
        return span;
    }

    function appendDivider(parent) {
        const span = document.createElement('span');
        span.textContent = '|';
        span.style.margin = '0 8px';
        span.style.color = '#9a9a9a';
        parent.appendChild(span);
    }

    function setGaugeSVG(svg) {
        if (svg) {
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'm12 14 4-4');
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M3.34 19a10 10 0 1 1 17.32 0');
            svg.appendChild(path1);
            svg.appendChild(path2);
            svg.setAttribute('class', 'lucide lucide-gauge stroke-[2] text-fg-secondary transition-colors duration-100');
        }
    }

    function setClockSVG(svg) {
        if (svg) {
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '8');
            circle.setAttribute('stroke', 'currentColor');
            circle.setAttribute('stroke-width', '2');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 12L12 6');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(circle);
            svg.appendChild(path);
            svg.setAttribute('class', 'stroke-[2] text-fg-secondary group-hover/rate-limit:text-fg-primary transition-colors duration-100');
        }
    }

    function showResetMenu(anchorElement, modelName, queryBar) {
        let existingMenu = document.getElementById('grok-rate-limit-reset-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'grok-rate-limit-reset-menu';
        
        menu.className = 'flex flex-col gap-1 p-2 rounded-xl border z-[9999] shadow-lg';
        menu.style.position = 'fixed';
        menu.style.backgroundColor = '#1a1a1a';
        menu.style.borderColor = '#333333';
        menu.style.color = '#e5e5e5';
        menu.style.minWidth = '140px';
        menu.style.fontSize = '14px';

        const createButton = (text, onClick, isCancel = false) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = 'w-full text-left px-3 py-2 rounded-lg hover:bg-[#333333] transition-colors focus:outline-none';
            if (isCancel) {
                btn.style.color = '#9a9a9a';
                btn.style.textAlign = 'center';
                btn.style.marginTop = '4px';
            }
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
                menu.remove();
            });
            return btn;
        };

        const resetCurrentBtn = createButton('Reset Current', () => {
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'RESET_COUNTERS', model: modelName, action: 'current' }, () => {
                    fetchAndUpdateRateLimit(queryBar, true);
                });
            }
        });

        const resetAllBtn = createButton('Reset All', () => {
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'RESET_COUNTERS', model: modelName, action: 'all' }, () => {
                    fetchAndUpdateRateLimit(queryBar, true);
                });
            }
        });

        const cancelBtn = createButton('Cancel', () => {}, true);

        menu.appendChild(resetCurrentBtn);
        menu.appendChild(resetAllBtn);
        menu.appendChild(cancelBtn);

        document.body.appendChild(menu);

        const rect = anchorElement.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        let targetLeft = rect.left + (rect.width / 2) - (menuRect.width / 2);
        if (targetLeft < 10) targetLeft = 10; // Prevent falling off left edge constraint
        
        menu.style.left = `${targetLeft}px`;
        menu.style.top = `${rect.top - menuRect.height - 8}px`;

        const closeMenuOnOutsideClick = (e) => {
            if (!menu.contains(e.target) && !anchorElement.contains(e.target)) {
                menu.remove();
                document.removeEventListener('mousedown', closeMenuOnOutsideClick);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeMenuOnOutsideClick), 0);
    }

    // Function to fetch rate limit
    async function fetchRateLimit(modelName, requestKind, force = false) {
        if (!force) {
            const cached = cachedRateLimits[modelName]?.[requestKind];
            if (cached !== undefined) {
                return cached;
            }
        }

        try {
            const response = await fetch(window.location.origin + '/rest/rate-limits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requestKind,
                    modelName,
                }),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error: Status ${response.status}`);
            }

            const data = await response.json();
            if (!cachedRateLimits[modelName]) {
                cachedRateLimits[modelName] = {};
            }
            cachedRateLimits[modelName][requestKind] = data;
            return data;
        } catch (error) {
            console.error(`Failed to fetch rate limit:`, error);
            if (!cachedRateLimits[modelName]) {
                cachedRateLimits[modelName] = {};
            }
            cachedRateLimits[modelName][requestKind] = undefined;
            return { error: true };
        }
    }

    // Function to process the rate limit data based on effort level
    function processRateLimitData(data, effortLevel) {
        if (data.error) {
            return data;
        }

        const getWaitTime = (obj) => {
            if (!obj) return 0;
            // Check prioritize waitTimeSeconds, then resetsAt (timestamp), then resetTime
            if (obj.waitTimeSeconds) return obj.waitTimeSeconds;
            if (obj.resetsAt) {
                const wait = Math.round((obj.resetsAt - Date.now()) / 1000);
                return wait > 0 ? wait : 0;
            }
            if (obj.resetTime) return obj.resetTime;
            return 0;
        };

        if (effortLevel === 'both') {
            const high = data.highEffortRateLimits?.remainingQueries;
            const low = data.lowEffortRateLimits?.remainingQueries;
            const waitTimeSeconds = Math.max(
                getWaitTime(data.highEffortRateLimits),
                getWaitTime(data.lowEffortRateLimits),
                getWaitTime(data)
            );

            if (high !== undefined && low !== undefined && high !== null && low !== null) {
                return {
                    highRemaining: high,
                    lowRemaining: low,
                    waitTimeSeconds: waitTimeSeconds
                };
            } else if (data.remainingQueries !== undefined) {
                // If breakdown is missing (e.g. unauthenticated), fallback to top-level
                return {
                    highRemaining: data.remainingQueries,
                    lowRemaining: data.remainingQueries, // Or maybe null? Let's show the same for both if we don't know
                    waitTimeSeconds: waitTimeSeconds
                };
            } else {
                return { error: true };
            }
        } else {
            let rateLimitsKey = effortLevel === 'high' ? 'highEffortRateLimits' : 'lowEffortRateLimits';
            let remaining = data[rateLimitsKey]?.remainingQueries ?? data.remainingQueries;

            if (remaining !== undefined) {
                return {
                    remainingQueries: remaining,
                    waitTimeSeconds: getWaitTime(data[rateLimitsKey]) || getWaitTime(data)
                };
            } else {
                return { error: true };
            }
        }
    }

    // Function to fetch and update rate limit
    async function fetchAndUpdateRateLimit(queryBar, force = false, pollUntilChange = false) {
        if (isImaginePage() || !queryBar || !document.body.contains(queryBar)) {
            return;
        }
        const modelName = getCurrentModelKey(queryBar);

        if (modelName !== lastModelName) {
            force = true;
        }

        if (isCountingDown && !force) {
            return;
        }

        const effortLevel = getEffortLevel(modelName);

        let requestKind = DEFAULT_KIND;
        if (modelName === 'grok-3') {
            const thinkButton = findElement(commonFinderConfigs.thinkButton, queryBar);
            const searchButton = findElement(commonFinderConfigs.deepSearchButton, queryBar);

            if (thinkButton && thinkButton.getAttribute('aria-pressed') === 'true') {
                requestKind = 'REASONING';
            } else if (searchButton && searchButton.getAttribute('aria-pressed') === 'true') {
                const searchAria = searchButton.getAttribute('aria-label') || '';
                if (/deeper/i.test(searchAria)) {
                    requestKind = 'DEEPERSEARCH';
                } else if (/deep/i.test(searchAria)) {
                    requestKind = 'DEEPSEARCH';
                }
            }
        }

        let data = await fetchRateLimit(modelName, requestKind, force);

        if (chrome.runtime?.id) {
            const syncWithBackground = (bucket, remaining, total, windowSize) => {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        type: 'SYNC_AND_GET_REMAINING',
                        model: bucket,
                        remainingQueries: remaining,
                        totalQueries: total,
                        windowSizeSeconds: windowSize
                    }, (response) => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                        else resolve(response);
                    });
                });
            };

            const getFromBackground = (bucket) => {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        type: 'GET_REMAINING',
                        model: bucket
                    }, (response) => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                        else resolve(response);
                    });
                });
            };

            if (!data.error) {
                // API SUCCESS: Use API data but sync to background for redundancy
                try {
                    if (effortLevel === 'both') {
                        let highRemaining = data.highEffortRateLimits?.remainingQueries ?? null;
                        let highTotal = data.highEffortRateLimits?.totalQueries ?? null;
                        let lowRemaining = data.lowEffortRateLimits?.remainingQueries ?? null;
                        let lowTotal = data.lowEffortRateLimits?.totalQueries ?? null;
                        
                        // Check if we should poll for change (max 3 times, 2s apart)
                        if (pollUntilChange && typeof pollUntilChange === 'number' && pollUntilChange > 0) {
                            if (highRemaining === lastBoth.high && highRemaining !== null) {
                                console.log(`Grok Rate Limit Extension: Count unchanged (${highRemaining}), polling... (${pollUntilChange} retries left)`);
                                setTimeout(() => fetchAndUpdateRateLimit(queryBar, true, pollUntilChange - 1), 2000);
                            }
                        }

                        await syncWithBackground('grok-4', highRemaining, highTotal, data.windowSizeSeconds);
                        await syncWithBackground('grok-3', lowRemaining, lowTotal, data.windowSizeSeconds);
                    } else {
                        let rateLimitsKey = effortLevel === 'high' ? 'highEffortRateLimits' : 'lowEffortRateLimits';
                        let apiRemaining = data[rateLimitsKey]?.remainingQueries ?? data.remainingQueries;
                        let apiTotal = data[rateLimitsKey]?.totalQueries ?? data.totalQueries;

                        // Check if we should poll for change (max 3 times, 2s apart)
                        if (pollUntilChange && typeof pollUntilChange === 'number' && pollUntilChange > 0) {
                            const lastRemaining = effortLevel === 'high' ? lastHigh.remaining : lastLow.remaining;
                            if (apiRemaining === lastRemaining && apiRemaining !== null) {
                                console.log(`Grok Rate Limit Extension: Count unchanged (${apiRemaining}), polling... (${pollUntilChange} retries left)`);
                                setTimeout(() => fetchAndUpdateRateLimit(queryBar, true, pollUntilChange - 1), 2000);
                            }
                        }

                        await syncWithBackground(modelName, apiRemaining, apiTotal, data.windowSizeSeconds);
                    }
                } catch (e) {
                    console.warn('Grok Rate Limit Extension: Failed to sync API data to background tracker.');
                }
            } else {
                // API FAILURE: Fallback to local background tracking
                console.log('Grok Rate Limit Extension: API failed, falling back to local tracking.');
                try {
                    if (effortLevel === 'both') {
                        const bgDataHigh = await getFromBackground('grok-4');
                        const bgDataLow = await getFromBackground('grok-3');

                        data = {
                            ...data,
                            error: false, // Clear error since we have fallback
                            highEffortRateLimits: {
                                remainingQueries: bgDataHigh.remaining,
                                waitTimeSeconds: bgDataHigh.nextResetSeconds
                            },
                            lowEffortRateLimits: {
                                remainingQueries: bgDataLow.remaining,
                                waitTimeSeconds: bgDataLow.nextResetSeconds
                            },
                            windowSizeSeconds: bgDataHigh.windowSizeSeconds
                        };
                    } else {
                        const bgData = await getFromBackground(modelName);
                        let rateLimitsKey = effortLevel === 'high' ? 'highEffortRateLimits' : 'lowEffortRateLimits';

                        data = {
                            ...data,
                            error: false,
                            remainingQueries: bgData.remaining,
                            waitTimeSeconds: bgData.nextResetSeconds,
                            windowSizeSeconds: bgData.windowSizeSeconds
                        };

                        // Ensure the specific effort level object is also populated
                        data[rateLimitsKey] = {
                            remainingQueries: bgData.remaining,
                            waitTimeSeconds: bgData.nextResetSeconds
                        };
                    }
                } catch (e) {
                    console.error('Grok Rate Limit Extension: Both API and level fallback failed.', e);
                }
            }
        }

        const processedData = processRateLimitData(data, effortLevel);
        updateRateLimitDisplay(queryBar, processedData, effortLevel, modelName);

        lastModelName = modelName;
    }

    // Function to observe the DOM for the query bar
    function observeDOM() {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && lastQueryBar && !isImaginePage()) {
                fetchAndUpdateRateLimit(lastQueryBar, true);
            }
        };

        // Add resize listener to handle mobile/desktop mode switches
        const handleResize = debounce(() => {
            if (lastQueryBar) {
                checkTextOverlap(lastQueryBar);
            }
        }, 300);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('resize', handleResize);

        if (!isImaginePage()) {
            const initialQueryBar = document.querySelector(QUERY_BAR_SELECTOR);
            if (initialQueryBar) {
                removeExistingRateLimit();
                fetchAndUpdateRateLimit(initialQueryBar);
                lastQueryBar = initialQueryBar;

                setupQueryBarObserver(initialQueryBar);
                setupGrok3Observers(initialQueryBar);
                setupSubmissionListeners(initialQueryBar);

                // Start overlap checking
                startOverlapChecking(initialQueryBar);
                setTimeout(() => checkTextOverlap(initialQueryBar), 100);

                // Removed redundant polling
                // Refresh is triggered by background script on expiry/usage

            }
        }

        const observer = new MutationObserver(() => {
            if (isImaginePage()) {
                removeExistingRateLimit();
                stopOverlapChecking();
                if (lastModelObserver) {
                    lastModelObserver.disconnect();
                    lastModelObserver = null;
                }
                if (lastThinkObserver) {
                    lastThinkObserver.disconnect();
                    lastThinkObserver = null;
                }
                if (lastSearchObserver) {
                    lastSearchObserver.disconnect();
                    lastSearchObserver = null;
                }
                lastInputElement = null;
                lastSubmitButton = null;
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                lastQueryBar = null;
                return;
            }

            const queryBar = document.querySelector(QUERY_BAR_SELECTOR);
            if (queryBar && queryBar !== lastQueryBar) {
                removeExistingRateLimit();
                fetchAndUpdateRateLimit(queryBar);
                if (lastModelObserver) {
                    lastModelObserver.disconnect();
                }
                if (lastThinkObserver) {
                    lastThinkObserver.disconnect();
                }
                if (lastSearchObserver) {
                    lastSearchObserver.disconnect();
                }

                setupQueryBarObserver(queryBar);
                setupGrok3Observers(queryBar);
                setupSubmissionListeners(queryBar);

                // Start overlap checking
                startOverlapChecking(queryBar);
                setTimeout(() => checkTextOverlap(queryBar), 100);

                // Removed redundant polling
                lastQueryBar = queryBar;
            } else if (!queryBar && lastQueryBar) {
                removeExistingRateLimit();
                stopOverlapChecking();
                if (lastModelObserver) {
                    lastModelObserver.disconnect();
                }
                if (lastThinkObserver) {
                    lastThinkObserver.disconnect();
                }
                if (lastSearchObserver) {
                    lastSearchObserver.disconnect();
                }
                lastQueryBar = null;
                lastModelObserver = null;
                lastThinkObserver = null;
                lastSearchObserver = null;
                lastInputElement = null;
                lastSubmitButton = null;
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        function setupQueryBarObserver(queryBar) {
            const debouncedUpdate = debounce(() => {
                fetchAndUpdateRateLimit(queryBar);
                setupGrok3Observers(queryBar);
            }, 300);

            lastModelObserver = new MutationObserver(debouncedUpdate);
            lastModelObserver.observe(queryBar, { childList: true, subtree: true, attributes: true, characterData: true });
        }

        function setupGrok3Observers(queryBar) {
            const currentModel = getCurrentModelKey(queryBar);
            if (currentModel === 'grok-3') {
                const thinkButton = findElement(commonFinderConfigs.thinkButton, queryBar);
                if (thinkButton) {
                    if (lastThinkObserver) lastThinkObserver.disconnect();
                    lastThinkObserver = new MutationObserver(() => {
                        fetchAndUpdateRateLimit(queryBar);
                    });
                    lastThinkObserver.observe(thinkButton, { attributes: true, attributeFilter: ['aria-pressed', 'class'] });
                }
                const searchButton = findElement(commonFinderConfigs.deepSearchButton, queryBar);
                if (searchButton) {
                    if (lastSearchObserver) lastSearchObserver.disconnect();
                    lastSearchObserver = new MutationObserver(() => {
                        fetchAndUpdateRateLimit(queryBar);
                    });
                    lastSearchObserver.observe(searchButton, { attributes: true, attributeFilter: ['aria-pressed', 'class'], childList: true, subtree: true, characterData: true });
                }
            } else {
                if (lastThinkObserver) {
                    lastThinkObserver.disconnect();
                    lastThinkObserver = null;
                }
                if (lastSearchObserver) {
                    lastSearchObserver.disconnect();
                    lastSearchObserver = null;
                }
            }
        }

        function setupSubmissionListeners(queryBar) {
            const inputElement = queryBar.querySelector('div[contenteditable="true"]');
            if (inputElement && inputElement !== lastInputElement) {
                lastInputElement = inputElement;

                const debouncedOverlapCheck = debounce(() => {
                    checkTextOverlap(queryBar);
                }, 300);

                inputElement.addEventListener('keydown', (e) => {
                    const modelName = getCurrentModelKey(queryBar);
                    if (e.key === 'Enter' && !e.shiftKey) {
                        // For locally tracked models, we rely on the interceptor, but we still want to refresh the UI
                        const locallyTrackedModels = ['grok-420', 'grok-4-heavy', 'grok-3', 'grok-4', 'grok-4-auto'];
                        const delay = locallyTrackedModels.includes(modelName) ? 1000 : 3000;
                        setTimeout(() => fetchAndUpdateRateLimit(queryBar, true, 3), delay);
                    }
                });

                inputElement.addEventListener('input', debouncedOverlapCheck);
                inputElement.addEventListener('focus', debouncedOverlapCheck);
                inputElement.addEventListener('blur', () => {
                    setTimeout(() => {
                        checkTextOverlap(queryBar);
                    }, 200);
                });
            }

            const bottomBar = queryBar.querySelector('div.absolute.inset-x-0.bottom-0');
            const submitButton = bottomBar ? findElement(commonFinderConfigs.submitButton, bottomBar) : findElement(commonFinderConfigs.submitButton, queryBar);
            if (submitButton && submitButton !== lastSubmitButton) {
                lastSubmitButton = submitButton;
                submitButton.addEventListener('click', () => {
                    const modelName = getCurrentModelKey(queryBar);
                    const locallyTrackedModels = ['grok-420', 'grok-4-heavy', 'grok-3', 'grok-4', 'grok-4-auto'];
                    const delay = locallyTrackedModels.includes(modelName) ? 1000 : 3000;
                    setTimeout(() => fetchAndUpdateRateLimit(queryBar, true, 3), delay);
                });
            }
        }
    }

    // Start observing the DOM for changes
    observeDOM();

})();