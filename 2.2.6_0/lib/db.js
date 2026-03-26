/**
 * IndexedDB Storage Layer for Grok Video Studio
 * Handles large video blob storage that exceeds chrome.storage limits
 */

const DB_NAME = 'GrokVideoStudio';
const DB_VERSION = 1;

const STORES = {
    VIDEOS: 'videos',
    FRAMES: 'frames',
    SEQUENCE: 'sequence'
};

let db = null;

/**
 * Open/initialize the database
 */
async function openDB() {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[DB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[DB] Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            console.log('[DB] Upgrading database schema...');

            // Videos store: { id, blob, metadata, timestamp }
            if (!database.objectStoreNames.contains(STORES.VIDEOS)) {
                const videoStore = database.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
                videoStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('[DB] Created videos store');
            }

            // Frames store: { id, dataUrl, videoId, position }
            if (!database.objectStoreNames.contains(STORES.FRAMES)) {
                const frameStore = database.createObjectStore(STORES.FRAMES, { keyPath: 'id' });
                frameStore.createIndex('videoId', 'videoId', { unique: false });
                console.log('[DB] Created frames store');
            }

            // Sequence store: { id, order, videoRefs, masterVideoId }
            if (!database.objectStoreNames.contains(STORES.SEQUENCE)) {
                database.createObjectStore(STORES.SEQUENCE, { keyPath: 'id' });
                console.log('[DB] Created sequence store');
            }
        };
    });
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// Video Operations
// ==========================================

/**
 * Save a video blob to IndexedDB
 * @param {Blob|ArrayBuffer} data - Video data
 * @param {Object} metadata - Video metadata (duration, resolution, fps, hasAudio, etc.)
 * @param {string} [id] - Optional ID, will generate if not provided
 * @returns {Promise<string>} - Video ID
 */
async function saveVideo(data, metadata = {}, id = null) {
    const database = await openDB();
    const videoId = id || generateId();

    // Convert ArrayBuffer to Blob if needed
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'video/mp4' });

    const video = {
        id: videoId,
        blob: blob,
        metadata: {
            duration: metadata.duration || 0,
            resolution: metadata.resolution || null, // { width, height }
            fps: metadata.fps || 0,
            hasAudio: metadata.hasAudio !== undefined ? metadata.hasAudio : true,
            colorSpace: metadata.colorSpace || 'unknown',
            size: blob.size,
            name: metadata.name || `video_${videoId}.mp4`,
            ...metadata
        },
        timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.VIDEOS], 'readwrite');
        const store = transaction.objectStore(STORES.VIDEOS);
        const request = store.put(video);

        request.onsuccess = () => {
            console.log(`[DB] Video saved: ${videoId} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
            resolve(videoId);
        };

        request.onerror = () => {
            console.error('[DB] Failed to save video:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a video by ID
 * @param {string} videoId
 * @returns {Promise<Object|null>} - { id, blob, metadata, timestamp }
 */
async function getVideo(videoId) {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.VIDEOS], 'readonly');
        const store = transaction.objectStore(STORES.VIDEOS);
        const request = store.get(videoId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get all videos
 * @returns {Promise<Array>}
 */
async function getAllVideos() {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.VIDEOS], 'readonly');
        const store = transaction.objectStore(STORES.VIDEOS);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Delete a video by ID
 * @param {string} videoId
 */
async function deleteVideo(videoId) {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.VIDEOS], 'readwrite');
        const store = transaction.objectStore(STORES.VIDEOS);
        const request = store.delete(videoId);

        request.onsuccess = () => {
            console.log(`[DB] Video deleted: ${videoId}`);
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Update video metadata
 * @param {string} videoId
 * @param {Object} metadata - Partial metadata to update
 */
async function updateVideoMetadata(videoId, metadata) {
    const video = await getVideo(videoId);
    if (!video) throw new Error(`Video not found: ${videoId}`);

    video.metadata = { ...video.metadata, ...metadata };

    const database = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.VIDEOS], 'readwrite');
        const store = transaction.objectStore(STORES.VIDEOS);
        const request = store.put(video);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Frame Operations
// ==========================================

/**
 * Save an extracted frame
 * @param {string} videoId - Source video ID
 * @param {string} dataUrl - Frame as base64 data URL
 * @param {string} position - 'first' or 'last'
 * @returns {Promise<string>} - Frame ID
 */
async function saveFrame(videoId, dataUrl, position = 'last') {
    const database = await openDB();
    const frameId = `${videoId}_${position}`;

    const frame = {
        id: frameId,
        videoId: videoId,
        dataUrl: dataUrl,
        position: position,
        timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.FRAMES], 'readwrite');
        const store = transaction.objectStore(STORES.FRAMES);
        const request = store.put(frame);

        request.onsuccess = () => {
            console.log(`[DB] Frame saved: ${frameId}`);
            resolve(frameId);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get a frame by ID
 * @param {string} frameId
 * @returns {Promise<Object|null>}
 */
async function getFrame(frameId) {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.FRAMES], 'readonly');
        const store = transaction.objectStore(STORES.FRAMES);
        const request = store.get(frameId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get frame by video ID and position
 * @param {string} videoId
 * @param {string} position - 'first' or 'last'
 */
async function getVideoFrame(videoId, position = 'last') {
    return getFrame(`${videoId}_${position}`);
}

/**
 * Get all frames for a video
 * @param {string} videoId
 */
async function getFramesByVideoId(videoId) {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.FRAMES], 'readonly');
        const store = transaction.objectStore(STORES.FRAMES);
        const index = store.index('videoId');
        const request = index.getAll(videoId);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a frame
 * @param {string} frameId
 */
async function deleteFrame(frameId) {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.FRAMES], 'readwrite');
        const store = transaction.objectStore(STORES.FRAMES);
        const request = store.delete(frameId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Sequence Operations
// ==========================================

const SEQUENCE_ID = 'current'; // Single sequence for now

/**
 * Save/update the current sequence
 * @param {Object} sequence - { videoRefs: [{ videoId, order, addedIndex }], nextAddedIndex }
 */
async function saveSequence(sequence) {
    const database = await openDB();

    const data = {
        id: SEQUENCE_ID,
        videoRefs: sequence.videoRefs || [],
        nextAddedIndex: sequence.nextAddedIndex || 1,
        timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SEQUENCE], 'readwrite');
        const store = transaction.objectStore(STORES.SEQUENCE);
        const request = store.put(data);

        request.onsuccess = () => {
            console.log('[DB] Sequence saved');
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get the current sequence
 * @returns {Promise<Object|null>}
 */
async function getSequence() {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SEQUENCE], 'readonly');
        const store = transaction.objectStore(STORES.SEQUENCE);
        const request = store.get(SEQUENCE_ID);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear the current sequence
 */
async function clearSequence() {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SEQUENCE], 'readwrite');
        const store = transaction.objectStore(STORES.SEQUENCE);
        const request = store.delete(SEQUENCE_ID);

        request.onsuccess = () => {
            console.log('[DB] Sequence cleared');
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Get estimated storage usage
 * @returns {Promise<Object>} - { used, quota, percentage }
 */
async function getStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            used: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
        };
    }
    return { used: 0, quota: 0, percentage: 0 };
}

/**
 * Clear all data (videos, frames, sequence)
 */
async function clearAllData() {
    const database = await openDB();

    const stores = [STORES.VIDEOS, STORES.FRAMES, STORES.SEQUENCE];

    for (const storeName of stores) {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    console.log('[DB] All data cleared');
}

/**
 * Delete old videos to free up space
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 7 days)
 */
async function cleanupOldVideos(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const videos = await getAllVideos();
    const cutoff = Date.now() - maxAgeMs;
    let deletedCount = 0;

    for (const video of videos) {
        if (video.timestamp < cutoff) {
            await deleteVideo(video.id);
            // Also delete associated frames
            const frames = await getFramesByVideoId(video.id);
            for (const frame of frames) {
                await deleteFrame(frame.id);
            }
            deletedCount++;
        }
    }

    console.log(`[DB] Cleaned up ${deletedCount} old videos`);
    return deletedCount;
}

// Export API object
const GrokDB = {
    openDB,
    // Videos
    saveVideo,
    getVideo,
    getAllVideos,
    deleteVideo,
    updateVideoMetadata,
    // Frames
    saveFrame,
    getFrame,
    getVideoFrame,
    getFramesByVideoId,
    deleteFrame,
    // Sequence
    saveSequence,
    getSequence,
    clearSequence,
    // Utilities
    getStorageUsage,
    clearAllData,
    cleanupOldVideos,
    generateId,
    // Constants
    STORES
};

// Export for use in other scripts
// Works in both window context (content scripts, sidepanel) and service worker (background)
if (typeof globalThis !== 'undefined') {
    globalThis.GrokDB = GrokDB;
}
if (typeof window !== 'undefined') {
    window.GrokDB = GrokDB;
}
if (typeof self !== 'undefined') {
    self.GrokDB = GrokDB;
}

console.log('[DB] GrokDB module loaded');
