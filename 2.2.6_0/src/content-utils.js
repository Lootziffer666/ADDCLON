/**
 * Grok Video Downloader - Content Utilities
 * Pure functions extracted from content.js for testing
 */

(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js/CommonJS
        const GrokUtils = require('./utils');
        module.exports = factory(GrokUtils);
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(['GrokUtils'], factory);
    } else {
        // Browser globals
        root.ContentUtils = factory(root.GrokUtils);
    }
}(typeof self !== 'undefined' ? self : this, function(GrokUtils) {
    'use strict';

    /**
     * Check if a timestamp is within a date range
     * @param {number} itemTimestamp - The timestamp to check (ms)
     * @param {number|null} fromTimestamp - Start of range (ms), null means no lower bound
     * @param {number|null} toTimestamp - End of range (ms), null means no upper bound
     * @returns {boolean}
     */
    function isInDateRange(itemTimestamp, fromTimestamp, toTimestamp) {
        if (fromTimestamp && itemTimestamp < fromTimestamp) return false;
        if (toTimestamp && itemTimestamp > toTimestamp) return false;
        return true;
    }

    /**
     * Filter items by date range based on createTime field
     * @param {Array} items - Array of items with createTime field
     * @param {number|null} fromDate - Start timestamp (ms)
     * @param {number|null} toDate - End timestamp (ms)
     * @returns {{filtered: Array, excluded: Array}}
     */
    function filterByDateRange(items, fromDate, toDate) {
        const filtered = [];
        const excluded = [];

        for (const item of items) {
            if (!item.createTime) {
                excluded.push({ item, reason: 'missing_createTime' });
                continue;
            }
            const itemTimestamp = new Date(item.createTime).getTime();
            if (isInDateRange(itemTimestamp, fromDate, toDate)) {
                filtered.push(item);
            } else {
                excluded.push({ item, reason: 'out_of_range' });
            }
        }

        return { filtered, excluded };
    }

    /**
     * Map raw image post data to download data format
     * @param {Object} img - Raw image post from API
     * @param {Object} options - Options including promptAsFilename
     * @returns {Object} - Formatted image download data
     */
    function mapImageToDownloadData(img, options = {}) {
        const ext = GrokUtils.getExtFromMediaUrl(img.mediaUrl, 'png');

        let filename;
        if (options.promptAsFilename) {
            const dateTimeStr = GrokUtils.formatDateWithTime(img.createTime);
            const effectivePrompt = img.originalPrompt || img.prompt;
            const sanitizedPrompt = GrokUtils.sanitizePromptForFilename(effectivePrompt, 120, img.id);
            filename = `img_${dateTimeStr}_${sanitizedPrompt}.${ext}`;
        } else {
            const dateStr = GrokUtils.formatDateYYYYMMDD(img.createTime);
            filename = `grok_image_${dateStr}_${img.id}.${ext}`;
        }

        return {
            id: img.id,
            type: 'image',
            url: GrokUtils.removeQueryString(img.mediaUrl),
            filename: filename,
            userId: img.userId,
            createTime: img.createTime,
            prompt: img.prompt,
            originalPrompt: img.originalPrompt,
            downloaded: false,
            downloadedAt: null
        };
    }

    /**
     * Map raw video post data to download data format
     * @param {Object} video - Raw video post from API
     * @param {Object} options - Options (reserved for future use)
     * @returns {Object} - Formatted video download data
     */
    function mapVideoToDownloadData(video, options = {}) {
        return {
            id: video.id,
            type: 'video',
            url: GrokUtils.removeQueryString(video.mediaUrl),
            hdUrl: video.hdMediaUrl ? GrokUtils.removeQueryString(video.hdMediaUrl) : null,
            resolutionName: video.resolutionName || null,
            detailUrl: `https://grok.com/imagine/post/${video.id}`,
            userId: video.userId,
            createTime: video.createTime,
            prompt: video.prompt,
            originalPrompt: video.originalPrompt,
            downloaded: false,
            downloadedAt: null
        };
    }

    /**
     * Calculate image download statistics
     * @param {Array} imageData - Array of image download data
     * @param {Array} history - Array of downloaded IDs
     * @returns {Object} - Statistics object
     */
    function calculateImageStats(imageData, history) {
        const historySet = Array.isArray(history) ? new Set(history) : history;
        const alreadyDownloaded = imageData.filter(img => historySet.has(img.id));
        const needDownload = imageData.filter(img => !historySet.has(img.id));

        return {
            total: imageData.length,
            alreadyDownloaded: alreadyDownloaded.length,
            needDownload: needDownload.length,
            alreadyDownloadedItems: alreadyDownloaded,
            needDownloadItems: needDownload
        };
    }

    /**
     * Calculate video download statistics
     * @param {Array} videoData - Array of video download data
     * @param {Array} history - Array of downloaded IDs
     * @param {boolean} hdPriority - Whether HD priority mode is enabled
     * @returns {Object} - Statistics object
     */
    function calculateVideoStats(videoData, history, hdPriority = true) {
        // Convert history to Set for O(1) lookups (accepts both Array and Set)
        const historySet = Array.isArray(history) ? new Set(history) : history;

        // Helper: determine if video is effectively HD (has hdUrl or is native 720p)
        const isEffectivelyHd = (v) => !!v.hdUrl || v.resolutionName === '720p';

        // Calculate file count (depends on HD priority)
        const fileCount = hdPriority
            ? videoData.length  // HD priority: one file per video
            : videoData.reduce((acc, v) => acc + (v.hdUrl ? 2 : 1), 0);  // Both SD and HD (native 720p only has 1 file)

        // Calculate already downloaded file count
        const alreadyDownloadedFiles = videoData.reduce((acc, v) => {
            if (hdPriority) {
                const targetKey = isEffectivelyHd(v) ? `${v.id}_hd` : `${v.id}_sd`;
                return acc + (historySet.has(targetKey) ? 1 : 0);
            } else {
                let count = 0;
                if (historySet.has(v.id) || historySet.has(`${v.id}_sd`)) count++;
                if (v.hdUrl && historySet.has(`${v.id}_hd`)) count++;
                return acc + count;
            }
        }, 0);

        // Videos fully downloaded (both SD and HD if available)
        const fullyDownloadedVideos = videoData.filter(v => {
            if (isEffectivelyHd(v) && !v.hdUrl) {
                // Native 720p: only one file, saved as _hd
                return historySet.has(`${v.id}_hd`);
            }
            const sdDownloaded = historySet.has(v.id) || historySet.has(`${v.id}_sd`);
            const hdDownloaded = v.hdUrl ? historySet.has(`${v.id}_hd`) : true;
            return sdDownloaded && hdDownloaded;
        });

        // Videos needing download (missing SD or HD)
        const needDownloadVideos = videoData.filter(v => {
            if (hdPriority) {
                const targetKey = isEffectivelyHd(v) ? `${v.id}_hd` : `${v.id}_sd`;
                return !historySet.has(targetKey);
            } else {
                if (isEffectivelyHd(v) && !v.hdUrl) {
                    // Native 720p: only one file
                    return !historySet.has(`${v.id}_hd`);
                }
                const sdMissing = !historySet.has(v.id) && !historySet.has(`${v.id}_sd`);
                const hdMissing = v.hdUrl ? !historySet.has(`${v.id}_hd`) : false;
                return sdMissing || hdMissing;
            }
        });

        return {
            totalVideos: videoData.length,
            totalFiles: fileCount,
            alreadyDownloadedFiles: alreadyDownloadedFiles,
            needDownloadFiles: fileCount - alreadyDownloadedFiles,
            fullyDownloadedVideos: fullyDownloadedVideos.length,
            needDownloadVideos: needDownloadVideos.length,
            fullyDownloadedItems: fullyDownloadedVideos,
            needDownloadItems: needDownloadVideos
        };
    }

    /**
     * Extract post ID from a Grok post URL
     * @param {string} url - URL like "https://grok.com/imagine/post/abc-123"
     * @returns {string|null} - Post ID or null if not found
     */
    function extractPostIdFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/\/post\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
    }

    /**
     * Create initial download state object
     * @param {Array} imageData - Array of image download data
     * @param {Array} videoData - Array of video download data
     * @param {Object} options - Generation options
     * @returns {Object} - Initial state object
     */
    function createDownloadState(imageData, videoData, options = {}) {
        return {
            images: imageData,
            videos: videoData,
            currentPhase: 'images',
            currentIndex: 0,
            downloadedImages: [],
            downloadedVideos: [],
            failed: [],
            startTime: Date.now(),
            skipDownloaded: true,
            completed: false,
            filterOptions: {
                includeImages: options.includeImages !== false,
                includeVideos: options.includeVideos !== false,
                fromDate: options.fromDate || null,
                fromDateString: options.fromDate ? new Date(options.fromDate).toLocaleDateString() : null,
                toDate: options.toDate || null,
                toDateString: options.toDate ? new Date(options.toDate).toLocaleDateString() : null,
                hdPriority: options.hdPriority !== false,
                saveMetadata: options.saveMetadata === true,
                promptAsFilename: options.promptAsFilename === true
            }
        };
    }

    /**
     * Separate posts by media type
     * @param {Array} posts - Flattened posts array
     * @returns {Object} - { images: Array, videos: Array }
     */
    function separateByMediaType(posts) {
        const images = posts.filter(p => p.mediaType === 'MEDIA_POST_TYPE_IMAGE');
        const videos = posts.filter(p => p.mediaType === 'MEDIA_POST_TYPE_VIDEO');
        return { images, videos };
    }

    /**
     * Calculate download duration in minutes
     * @param {number} startTime - Start timestamp (ms)
     * @param {number} endTime - End timestamp (ms), defaults to now
     * @returns {string} - Duration in minutes with 1 decimal place
     */
    function calculateDuration(startTime, endTime = Date.now()) {
        return ((endTime - startTime) / 1000 / 60).toFixed(1);
    }

    /**
     * Create download summary statistics
     * @param {Object} state - Download state object
     * @returns {Object} - Summary stats
     */
    function createDownloadSummary(state) {
        const totalItems = (state.images?.length || 0) + (state.videos?.length || 0);
        const totalDownloaded = (state.downloadedImages?.length || 0) + (state.downloadedVideos?.length || 0);
        const duration = calculateDuration(state.startTime, state.completedAt || Date.now());

        return {
            totalItems,
            totalDownloaded,
            failedCount: state.failed?.length || 0,
            imageStats: {
                total: state.images?.length || 0,
                downloaded: state.downloadedImages?.length || 0
            },
            videoStats: {
                total: state.videos?.length || 0,
                downloaded: state.downloadedVideos?.length || 0
            },
            duration,
            completed: state.completed || false
        };
    }

    /**
     * Validate import data structure
     * @param {Object} data - Data to validate
     * @returns {{valid: boolean, errors: Array<string>}}
     */
    function validateImportData(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Data must be an object'] };
        }

        // Check for at least one valid field
        const validFields = ['state', 'history', 'settings'];
        const hasValidField = validFields.some(field => data[field] !== undefined);

        if (!hasValidField) {
            errors.push('Data must contain at least one of: state, history, settings');
        }

        // Validate history if present
        if (data.history !== undefined && !Array.isArray(data.history)) {
            errors.push('history must be an array');
        }

        // Validate settings if present
        if (data.settings !== undefined && typeof data.settings !== 'object') {
            errors.push('settings must be an object');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Public API
    const ContentUtils = {
        // Date filtering
        isInDateRange,
        filterByDateRange,

        // Data mapping
        mapImageToDownloadData,
        mapVideoToDownloadData,
        separateByMediaType,

        // Statistics
        calculateImageStats,
        calculateVideoStats,
        createDownloadSummary,
        calculateDuration,

        // URL parsing
        extractPostIdFromUrl,

        // State management
        createDownloadState,

        // Validation
        validateImportData
    };

    return ContentUtils;
}));
