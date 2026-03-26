// System Logger Module
// Provides persistent logging with storage and rotation

const SystemLogger = (function() {
    const STORAGE_KEY = 'system_logs';
    const MAX_LOGS = 1000;

    // Log levels
    const LEVELS = {
        INFO: 'INFO',
        OK: 'OK',
        FAIL: 'FAIL',
        WARN: 'WARN'
    };

    // Format timestamp as YYYY-MM-DD HH:mm:ss
    function formatTimestamp(date = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
               `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    // Get all logs from storage
    async function getLogs() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            return result[STORAGE_KEY] || [];
        } catch (error) {
            console.error('Failed to get logs:', error);
            return [];
        }
    }

    // Save logs to storage
    async function saveLogs(logs) {
        try {
            await chrome.storage.local.set({ [STORAGE_KEY]: logs });
        } catch (error) {
            console.error('Failed to save logs:', error);
        }
    }

    // Add a log entry
    async function log(level, message, details = null) {
        const entry = {
            timestamp: formatTimestamp(),
            level: level,
            message: message,
            details: details
        };

        // Also output to console for debugging
        const consoleMsg = `[${entry.timestamp}] [${level}] ${message}${details ? ' - ' + details : ''}`;
        if (level === LEVELS.FAIL) {
            console.error(consoleMsg);
        } else if (level === LEVELS.WARN) {
            console.warn(consoleMsg);
        } else {
            console.log(consoleMsg);
        }

        try {
            const logs = await getLogs();
            logs.push(entry);

            // Rotate logs if exceeding max
            if (logs.length > MAX_LOGS) {
                logs.splice(0, logs.length - MAX_LOGS);
            }

            await saveLogs(logs);
        } catch (error) {
            console.error('Failed to add log:', error);
        }
    }

    // Convenience methods
    async function info(message, details = null) {
        return log(LEVELS.INFO, message, details);
    }

    async function ok(message, details = null) {
        return log(LEVELS.OK, message, details);
    }

    async function fail(message, details = null) {
        return log(LEVELS.FAIL, message, details);
    }

    async function warn(message, details = null) {
        return log(LEVELS.WARN, message, details);
    }

    // Clear all logs
    async function clear() {
        try {
            await chrome.storage.local.remove(STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Failed to clear logs:', error);
            return false;
        }
    }

    // Export logs as text
    async function exportAsText() {
        const logs = await getLogs();
        const lines = logs.map(entry => {
            const base = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
            return entry.details ? `${base} - ${entry.details}` : base;
        });
        return lines.join('\n');
    }

    // Get log count
    async function getCount() {
        const logs = await getLogs();
        return logs.length;
    }

    // Get recent logs (for popup preview)
    async function getRecent(count = 10) {
        const logs = await getLogs();
        return logs.slice(-count);
    }

    return {
        LEVELS,
        log,
        info,
        ok,
        fail,
        warn,
        getLogs,
        clear,
        exportAsText,
        getCount,
        getRecent,
        STORAGE_KEY
    };
})();

// Export for use in different contexts
if (typeof window !== 'undefined') {
    window.SystemLogger = SystemLogger;
}
