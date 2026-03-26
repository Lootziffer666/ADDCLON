// ==UserScript==
// @name Grok Rate Limit Display
// @namespace http://tampermonkey.net/
// @version 5.2.26
// @description Displays remaining queries on grok.com
// @author Blankspeaker, Originally ported from CursedAtom's chrome extension
// @match https://grok.com/*
// @icon https://img.icons8.com/color/1200/grok--v2.jpg
// @license MIT
// ==/UserScript==

(function () {
    'use strict';

    console.log('Grok Rate Limit Script loaded');

    let lastHigh = { remaining: null, wait: null };
    let lastLow = { remaining: null, wait: null };
    let lastBoth = { high: null, low: null, wait: null };

    const MODEL_MAP = {
        "Grok 4": "grok-4",
        "Grok 3": "grok-3",
        "Grok 4 Heavy": "grok-4-heavy",
        "Grok 4 With Effort Decider": "grok-4-auto",
        "Auto": "grok-4-auto",
        "Fast": "grok-3",
        "Expert": "grok-4",
        "Heavy": "grok-4-heavy",
        "Grok 4 Fast": "grok-4-mini-thinking-tahoe",
    };

    const DEFAULT_MODEL = "grok-3";
    const DEFAULT_KIND = "DEFAULT";
    const POLL_INTERVAL_MS = 30000;
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
    let pollInterval = null;
    let lastModelName = null;

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
            // svgPartialD можно оставить или удалить — classContains достаточно
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

    // Function to wait for element based on config
    function waitForElementByConfig(config, timeout = ELEMENT_WAIT_TIMEOUT_MS, root = document) {
        return new Promise((resolve) => {
            let element = findElement(config, root);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                element = findElement(config, root);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(root, { childList: true, subtree: true, attributes: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
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

    // Function to wait for element appearance
    function waitForElement(selector, timeout = ELEMENT_WAIT_TIMEOUT_MS, root = document) {
        return new Promise((resolve) => {
            let element = root.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                element = root.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(root, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
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
        } else {
            return 'high';
        }
    }

    // Function to update or inject the rate limit display
    function updateRateLimitDisplay(queryBar, response, effort) {
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

            rateLimitContainer.addEventListener('click', () => {
                console.log('Rate limit display clicked - refreshing');
                fetchAndUpdateRateLimit(queryBar, true);
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

            // Теперь вставляем уже созданный контейнер справа от кнопки "Отправить"
            // Ищем правый контейнер с кнопками (модель, голосовая, вставка кода, отправить)
            const toolsContainer = queryBar.querySelector('div.ms-auto.flex.flex-row.items-end.gap-1');

            if (toolsContainer) {
                // Вставляем счётчик самым первым (слева от кнопки выбора модели)
                toolsContainer.prepend(rateLimitContainer);
            } else {
                // Fallback: если контейнер не найден, вставляем в конец bottomBar
                const bottomBar = queryBar.querySelector('div.absolute.inset-x-0.bottom-0');
                if (bottomBar) {
                    bottomBar.appendChild(rateLimitContainer);
                } else {
                    rateLimitContainer.remove();
                    rateLimitContainer = null;
                    return;
                }
            }

            // Отступ снизу для поля ввода (чтобы счётчик не перекрывал текст)
            const contentEditable = queryBar.querySelector('div[contenteditable="true"]');
            if (contentEditable) {
                contentEditable.style.paddingBottom = '3rem';
            }
        }

        const contentDiv = rateLimitContainer.lastChild;
        const svg = rateLimitContainer.querySelector('svg');

        contentDiv.innerHTML = '';

        const isBoth = effort === 'both';

        if (response.error) {
            if (isBoth) {
                if (lastBoth.high !== null && lastBoth.low !== null) {
                    appendNumberSpan(contentDiv, lastBoth.high, '');
                    appendDivider(contentDiv);
                    appendNumberSpan(contentDiv, lastBoth.low, '');
                    rateLimitContainer.title = `High: ${lastBoth.high} | Low: ${lastBoth.low} queries remaining`;
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

                if (high > 0) {
                    appendNumberSpan(contentDiv, high, '');
                    appendDivider(contentDiv);
                    appendNumberSpan(contentDiv, low, '');
                    rateLimitContainer.title = `High: ${high} | Low: ${low} queries remaining`;
                    setGaugeSVG(svg);
                } else if (waitTimeSeconds > 0) {
                    const timerSpan = appendNumberSpan(contentDiv, formatTimer(currentCountdown), '#ff6347');
                    appendDivider(contentDiv);
                    appendNumberSpan(contentDiv, low, '');
                    rateLimitContainer.title = `High: Time until reset | Low: ${low} queries remaining`;
                    setClockSVG(svg);

                    isCountingDown = true;
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                    }

                    countdownTimer = setInterval(() => {
                        currentCountdown--;
                        if (currentCountdown <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            fetchAndUpdateRateLimit(queryBar, true);
                            isCountingDown = false;
                            if (document.visibilityState === 'visible' && lastQueryBar) {
                                pollInterval = setInterval(() => fetchAndUpdateRateLimit(lastQueryBar, true), POLL_INTERVAL_MS);
                            }
                        } else {
                            timerSpan.textContent = formatTimer(currentCountdown);
                        }
                    }, 1000);
                } else {
                    appendNumberSpan(contentDiv, '0', '#ff6347');
                    appendDivider(contentDiv);
                    appendNumberSpan(contentDiv, low, '');
                    rateLimitContainer.title = `High: Limit reached | Low: ${low} queries remaining`;
                    setGaugeSVG(svg);
                }
            } else {
                const lastForEffort = (effort === 'high') ? lastHigh : lastLow;
                lastForEffort.remaining = response.remainingQueries;
                lastForEffort.wait = response.waitTimeSeconds;

                const remaining = lastForEffort.remaining;
                const waitTimeSeconds = lastForEffort.wait;

                let currentCountdown = waitTimeSeconds;

                if (remaining > 0) {
                    appendNumberSpan(contentDiv, remaining, '');
                    rateLimitContainer.title = `${remaining} queries remaining`;
                    setGaugeSVG(svg);
                } else if (waitTimeSeconds > 0) {
                    const timerSpan = appendNumberSpan(contentDiv, formatTimer(currentCountdown), '#ff6347');
                    rateLimitContainer.title = `Time until reset`;
                    setClockSVG(svg);

                    isCountingDown = true;
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                    }

                    countdownTimer = setInterval(() => {
                        currentCountdown--;
                        if (currentCountdown <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            fetchAndUpdateRateLimit(queryBar, true);
                            isCountingDown = false;
                            if (document.visibilityState === 'visible' && lastQueryBar) {
                                pollInterval = setInterval(() => fetchAndUpdateRateLimit(lastQueryBar, true), POLL_INTERVAL_MS);
                            }
                        } else {
                            timerSpan.textContent = formatTimer(currentCountdown);
                        }
                    }, 1000);
                } else {
                    appendNumberSpan(contentDiv, '0', ' #ff6347');
                    rateLimitContainer.title = 'Limit reached. Awaiting reset.';
                    setGaugeSVG(svg);
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
        const divider = document.createElement('div');
        divider.className = 'h-6 w-[2px] bg-border-l2 mx-1';
        parent.appendChild(divider);
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

    // Function to fetch rate limit
    async function fetchRateLimit(modelName, requestKind, force = false) {
        // Removed force to grok-3; use actual modelName for specific models like grok-4-heavy

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

        if (effortLevel === 'both') {
            const high = data.highEffortRateLimits?.remainingQueries;
            const low = data.lowEffortRateLimits?.remainingQueries;
            const waitTimeSeconds = Math.max(
                data.highEffortRateLimits?.waitTimeSeconds || 0,
                data.lowEffortRateLimits?.waitTimeSeconds || 0,
                data.waitTimeSeconds || 0
            );
            if (high !== undefined && low !== undefined) {
                return {
                    highRemaining: high,
                    lowRemaining: low,
                    waitTimeSeconds: waitTimeSeconds
                };
            } else {
                return { error: true };
            }
        } else {
            let rateLimitsKey = effortLevel === 'high' ? 'highEffortRateLimits' : 'lowEffortRateLimits';
            let remaining = data[rateLimitsKey]?.remainingQueries;
            if (remaining === undefined) {
                remaining = data.remainingQueries;
            }
            if (remaining !== undefined) {
                return {
                    remainingQueries: remaining,
                    waitTimeSeconds: data[rateLimitsKey]?.waitTimeSeconds || data.waitTimeSeconds || 0
                };
            } else {
                return { error: true };
            }
        }
    }

    // Function to fetch and update rate limit
    async function fetchAndUpdateRateLimit(queryBar, force = false) {
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

        const processedData = processRateLimitData(data, effortLevel);
        updateRateLimitDisplay(queryBar, processedData, effortLevel);

        lastModelName = modelName;
    }

    // Function to observe the DOM for the query bar
    function observeDOM() {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && lastQueryBar && !isImaginePage()) {
                fetchAndUpdateRateLimit(lastQueryBar, true);
                if (!isCountingDown) {
                    if (pollInterval) {
                        clearInterval(pollInterval);
                    }
                    pollInterval = setInterval(() => fetchAndUpdateRateLimit(lastQueryBar, true), POLL_INTERVAL_MS);
                }
            } else {
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (!isImaginePage()) {
            const initialQueryBar = document.querySelector(QUERY_BAR_SELECTOR);
            if (initialQueryBar) {
                removeExistingRateLimit();
                fetchAndUpdateRateLimit(initialQueryBar);
                lastQueryBar = initialQueryBar;

                setupQueryBarObserver(initialQueryBar);
                setupGrok3Observers(initialQueryBar);
                setupSubmissionListeners(initialQueryBar);

                if (document.visibilityState === 'visible' && !isCountingDown) {
                    pollInterval = setInterval(() => fetchAndUpdateRateLimit(lastQueryBar, true), POLL_INTERVAL_MS);
                }
            }
        }

        const observer = new MutationObserver(() => {
            if (isImaginePage()) {
                removeExistingRateLimit();
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

                if (document.visibilityState === 'visible' && !isCountingDown) {
                    if (pollInterval) clearInterval(pollInterval);
                    pollInterval = setInterval(() => fetchAndUpdateRateLimit(lastQueryBar, true), POLL_INTERVAL_MS);
                }
                lastQueryBar = queryBar;
            } else if (!queryBar && lastQueryBar) {
                removeExistingRateLimit();
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
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
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
                inputElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        console.log('Enter pressed for submit');
                        setTimeout(() => fetchAndUpdateRateLimit(queryBar, true), 3000);
                    }
                });
            }

            const bottomBar = queryBar.querySelector('div.absolute.inset-x-0.bottom-0');
            const submitButton = bottomBar ? findElement(commonFinderConfigs.submitButton, bottomBar) : findElement(commonFinderConfigs.submitButton, queryBar);
            if (submitButton && submitButton !== lastSubmitButton) {
                lastSubmitButton = submitButton;
                submitButton.addEventListener('click', () => {
                    console.log('Submit button clicked');
                    setTimeout(() => fetchAndUpdateRateLimit(queryBar, true), 3000);
                });
            }
        }
    }

    // Start observing the DOM for changes
    observeDOM();

})();
