// Log Viewer Page Script

document.addEventListener('DOMContentLoaded', async () => {
    const logList = document.getElementById('logList');
    const logCount = document.getElementById('logCount');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const levelFilter = document.getElementById('levelFilter');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const autoScrollNotice = document.getElementById('autoScrollNotice');

    let allLogs = [];
    let autoScroll = true;

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Render logs based on current filters
    function renderLogs() {
        const searchTerm = searchInput.value.toLowerCase();
        const levelFilterValue = levelFilter.value;

        // Filter logs
        const filteredLogs = allLogs.filter(log => {
            // Level filter
            if (levelFilterValue && log.level !== levelFilterValue) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const searchText = `${log.timestamp} ${log.level} ${log.message} ${log.details || ''}`.toLowerCase();
                if (!searchText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        // Update count
        logCount.textContent = `(${filteredLogs.length} of ${allLogs.length} entries)`;

        // Clear and render
        logList.innerHTML = '';

        if (filteredLogs.length === 0) {
            logList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>${allLogs.length === 0 ? 'No logs yet' : 'No logs match your filters'}</p>
                </div>
            `;
            return;
        }

        // Render log entries
        const fragment = document.createDocumentFragment();

        filteredLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';

            const messageHtml = escapeHtml(log.message);
            const detailsHtml = log.details ? `<span class="log-details">- ${escapeHtml(log.details)}</span>` : '';

            entry.innerHTML = `
                <span class="log-timestamp">${escapeHtml(log.timestamp)}</span>
                <span class="log-level ${log.level}">${log.level}</span>
                <span class="log-message">${messageHtml}${detailsHtml}</span>
            `;

            fragment.appendChild(entry);
        });

        logList.appendChild(fragment);

        // Auto-scroll to bottom if enabled
        if (autoScroll) {
            logList.scrollTop = logList.scrollHeight;
        }
    }

    // Load logs from storage
    async function loadLogs() {
        try {
            allLogs = await SystemLogger.getLogs();
            renderLogs();
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }

    // Export logs as text file
    async function exportLogs() {
        try {
            const text = await SystemLogger.exportAsText();
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `grok-downloader-logs-${timestamp}.txt`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export logs:', error);
            alert('Failed to export logs');
        }
    }

    // Clear all logs
    async function clearLogs() {
        if (!confirm('Are you sure you want to clear all logs?\n\nThis action cannot be undone.')) {
            return;
        }

        try {
            await SystemLogger.clear();
            allLogs = [];
            renderLogs();
        } catch (error) {
            console.error('Failed to clear logs:', error);
            alert('Failed to clear logs');
        }
    }

    // Track scroll position for auto-scroll
    logList.addEventListener('scroll', () => {
        const isAtBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;
        autoScroll = isAtBottom;

        autoScrollNotice.textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
        autoScrollNotice.classList.toggle('active', autoScroll);
    });

    // Event listeners
    searchInput.addEventListener('input', renderLogs);
    levelFilter.addEventListener('change', renderLogs);
    refreshBtn.addEventListener('click', loadLogs);
    exportBtn.addEventListener('click', exportLogs);
    clearBtn.addEventListener('click', clearLogs);

    // Listen for storage changes (real-time updates)
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[SystemLogger.STORAGE_KEY]) {
            allLogs = changes[SystemLogger.STORAGE_KEY].newValue || [];
            renderLogs();
        }
    });

    // Initial load
    await loadLogs();

    // Update auto-scroll notice initial state
    autoScrollNotice.classList.add('active');
    autoScrollNotice.textContent = 'Auto-scroll: ON';
});
