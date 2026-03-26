/**
 * IndexedDB Storage Layer for Grok Queue
 * Separate database from GrokVideoStudio (GrokDB)
 * Handles batch video generation queue and prompt stats
 */

const QUEUE_DB_NAME = 'GrokQueue';
const QUEUE_DB_VERSION = 1;

const QUEUE_STORES = {
    QUEUE: 'queue',
    PROMPT_STATS: 'promptStats'
};

let queueDb = null;

/**
 * Open/initialize the queue database
 */
async function openQueueDB() {
    if (queueDb) return queueDb;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);

        request.onerror = () => {
            console.error('[QueueDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            queueDb = request.result;
            console.log('[QueueDB] Database opened successfully');
            resolve(queueDb);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            console.log('[QueueDB] Upgrading database schema...');

            // Queue store
            if (!database.objectStoreNames.contains(QUEUE_STORES.QUEUE)) {
                const queueStore = database.createObjectStore(QUEUE_STORES.QUEUE, { keyPath: 'id' });
                queueStore.createIndex('status', 'status', { unique: false });
                queueStore.createIndex('postId', 'postId', { unique: false });
                queueStore.createIndex('createdAt', 'createdAt', { unique: false });
                console.log('[QueueDB] Created queue store');
            }

            // PromptStats store
            if (!database.objectStoreNames.contains(QUEUE_STORES.PROMPT_STATS)) {
                database.createObjectStore(QUEUE_STORES.PROMPT_STATS, { keyPath: 'prompt' });
                console.log('[QueueDB] Created promptStats store');
            }
        };
    });
}

/**
 * Generate unique ID
 */
function generateQueueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// Queue Operations
// ==========================================

/**
 * Add a new queue item
 * @param {Object} item - { postId, prompt, targetSuccess, maxRetries }
 * @returns {Promise<Object>} - The created queue item
 */
async function addQueueItem(item) {
    const database = await openQueueDB();
    const now = Date.now();

    const queueItem = {
        id: generateQueueId(),
        postId: item.postId,
        prompt: item.prompt,
        targetSuccess: item.targetSuccess || 1,
        maxRetries: item.maxRetries || 5,
        videoLength: item.videoLength || 6,
        resolutionName: item.resolutionName || '480p',
        mode: item.mode || 'custom',
        currentSuccess: 0,
        currentFailure: 0,
        totalAttempts: 0,
        status: 'pending',
        errorMessage: null,
        createdAt: now,
        updatedAt: now
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.put(queueItem);

        request.onsuccess = () => {
            console.log(`[QueueDB] Queue item added: ${queueItem.id}`);
            resolve(queueItem);
        };

        request.onerror = () => {
            console.error('[QueueDB] Failed to add queue item:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a queue item by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getQueueItem(id) {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update a queue item
 * @param {string} id
 * @param {Object} updates - Partial updates to merge
 * @returns {Promise<Object>} - Updated queue item
 */
async function updateQueueItem(id, updates) {
    const database = await openQueueDB();
    const existing = await getQueueItem(id);
    if (!existing) throw new Error(`Queue item not found: ${id}`);

    const updated = { ...existing, ...updates, updatedAt: Date.now() };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.put(updated);

        request.onsuccess = () => {
            console.log(`[QueueDB] Queue item updated: ${id}`);
            resolve(updated);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Get the next pending queue item (oldest first)
 * @returns {Promise<Object|null>}
 */
async function getNextPendingItem() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const index = store.index('status');
        const request = index.getAll('pending');

        request.onsuccess = () => {
            const items = request.result || [];
            if (items.length === 0) {
                resolve(null);
            } else {
                // Return oldest pending item
                items.sort((a, b) => a.createdAt - b.createdAt);
                resolve(items[0]);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all queue items
 * @returns {Promise<Array>}
 */
async function getAllQueueItems() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.getAll();

        request.onsuccess = () => {
            const items = request.result || [];
            items.sort((a, b) => a.createdAt - b.createdAt);
            resolve(items);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a queue item by ID
 * @param {string} id
 */
async function deleteQueueItem(id) {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[QueueDB] Queue item deleted: ${id}`);
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete all pending items
 */
async function deletePendingItems() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const index = store.index('status');
        const request = index.openCursor('pending');
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                count++;
                cursor.continue();
            } else {
                console.log(`[QueueDB] Deleted ${count} pending items`);
                resolve(count);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete all completed and failed items
 * @returns {Promise<number>} Number of deleted items
 */
async function deleteCompletedItems() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.openCursor();
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const status = cursor.value.status;
                if (status === 'completed' || status === 'failed') {
                    cursor.delete();
                    count++;
                }
                cursor.continue();
            } else {
                console.log(`[QueueDB] Deleted ${count} completed/failed items`);
                resolve(count);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear entire queue
 */
async function clearQueue() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[QueueDB] Queue cleared');
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Get active queue item (should be at most one)
 * @returns {Promise<Object|null>}
 */
async function getActiveQueueItem() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.QUEUE], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.QUEUE);
        const index = store.index('status');
        const request = index.getAll('active');

        request.onsuccess = () => {
            const items = request.result || [];
            resolve(items.length > 0 ? items[0] : null);
        };

        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Prompt Stats Operations
// ==========================================

/**
 * Update or insert prompt stats after a generation result
 * @param {string} prompt - The prompt text
 * @param {boolean} moderated - Whether the result was moderated
 */
async function upsertPromptStats(prompt, moderated) {
    const database = await openQueueDB();
    const existing = await getPromptStats(prompt);

    const stats = existing || {
        prompt: prompt,
        totalSuccess: 0,
        totalFailure: 0,
        rating: null,
        lastUsed: Date.now()
    };

    if (moderated) {
        stats.totalFailure++;
    } else {
        stats.totalSuccess++;
    }
    stats.lastUsed = Date.now();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.PROMPT_STATS], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.PROMPT_STATS);
        const request = store.put(stats);

        request.onsuccess = () => {
            console.log(`[QueueDB] Prompt stats updated: "${prompt.substring(0, 30)}..."`);
            resolve(stats);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Get stats for a specific prompt
 * @param {string} prompt
 * @returns {Promise<Object|null>}
 */
async function getPromptStats(prompt) {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.PROMPT_STATS], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.PROMPT_STATS);
        const request = store.get(prompt);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all prompt stats
 * @returns {Promise<Array>}
 */
async function getAllPromptStats() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.PROMPT_STATS], 'readonly');
        const store = transaction.objectStore(QUEUE_STORES.PROMPT_STATS);
        const request = store.getAll();

        request.onsuccess = () => {
            const stats = request.result || [];
            stats.sort((a, b) => b.lastUsed - a.lastUsed);
            resolve(stats);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Update rating for a prompt
 * @param {string} prompt
 * @param {'up'|'down'|null} rating
 */
async function updatePromptRating(prompt, rating) {
    const database = await openQueueDB();
    const existing = await getPromptStats(prompt);
    if (!existing) throw new Error(`Prompt stats not found: ${prompt}`);

    existing.rating = rating;

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.PROMPT_STATS], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.PROMPT_STATS);
        const request = store.put(existing);

        request.onsuccess = () => resolve(existing);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear all prompt stats
 */
async function clearPromptStats() {
    const database = await openQueueDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([QUEUE_STORES.PROMPT_STATS], 'readwrite');
        const store = transaction.objectStore(QUEUE_STORES.PROMPT_STATS);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[QueueDB] Prompt stats cleared');
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Export API
// ==========================================

const GrokQueueDB = {
    openQueueDB,
    // Queue
    addQueueItem,
    getQueueItem,
    updateQueueItem,
    getNextPendingItem,
    getActiveQueueItem,
    getAllQueueItems,
    deleteQueueItem,
    deletePendingItems,
    deleteCompletedItems,
    clearQueue,
    // Prompt Stats
    upsertPromptStats,
    getPromptStats,
    getAllPromptStats,
    updatePromptRating,
    clearPromptStats,
    // Utilities
    generateQueueId,
    // Constants
    QUEUE_STORES
};

// Export for use in other scripts
if (typeof globalThis !== 'undefined') {
    globalThis.GrokQueueDB = GrokQueueDB;
}
if (typeof window !== 'undefined') {
    window.GrokQueueDB = GrokQueueDB;
}
if (typeof self !== 'undefined') {
    self.GrokQueueDB = GrokQueueDB;
}

console.log('[QueueDB] GrokQueueDB module loaded');
