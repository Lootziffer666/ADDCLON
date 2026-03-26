// ===========================================================================
// FOLDERS FOR GEMINI - v2.13 (Subfolders Support)
// ===========================================================================

const SELECTORS = {
    sidebar: 'conversations-list', 
    recentTitleContainer: '.title-container',
    chatContainer: '.conversations-container',
    chatItem: '[data-test-id="conversation"]',  // Changed from div to any element (now it's <a>)
    titleText: '.conversation-title',
    menuTrigger: 'button[aria-haspopup="true"][aria-expanded="true"]'
};

const FOLDER_COLORS = [
    '#F28B82', '#F6BF26', '#FDD663', '#34A853', 
    '#81C995', '#4285F4', '#8AB4F8', '#A142F4', 
    '#C58AF9', '#F06292', '#E6C9A8', '#BDC1C6'
];

const FOLDER_ICON_SVG = `<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path>`;
const MORE_VERT_ICON_SVG = `<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>`;
const ADD_TO_FOLDER_ICON = `<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>`;
const COLLAPSE_ALL_ICON_TOP = `<path class="arrow-top" d="M7.41 5.41L8.83 4 12 7.17 15.17 4l1.41 1.41L12 10l-4.59-4.59z"/>`;
const COLLAPSE_ALL_ICON_BOTTOM = `<path class="arrow-bottom" d="M7.41 18.59L8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59z"/>`;
const ADD_SUBFOLDER_ICON = `<path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h-2v-2h-2v-2h2V8h2v2h2v2z"/>`;
const MOVE_TO_ROOT_ICON = `<path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5H9z"/>`;
const SYNC_ICON_SVG = `<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>`;

const DEFAULT_STATE = { folders: [], activeChatId: null, lastModified: 0 };
let state = null;

// Hash function for generating safe ASCII IDs from any Unicode text (CJK, Arabic, etc.)
function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
let autoScrollFrame = null;
let isProgrammaticClick = false;
let lastInteractedChatId = null;
let folderDropIndicator = null; // Global reference for cleanup
let syncDebounceTimer = null;
const SYNC_DEBOUNCE_MS = 5000;
const SYNC_CHUNK_SIZE = 7000; // Under 8192 per-item limit

// --- INIT ---

// Añadir esta función para inyectar CSS crítico
function injectStyles() {
    const styleId = 'gemini-folders-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* === THEME-ADAPTIVE TEXT COLORS === */
        /* Uses Gemini's own CSS variables with appropriate fallbacks */
        
        /* Default (Dark Mode) */
        .folder-name, .folder-section-title span, .cloned-chat-title, .no-folders-msg, .add-folder-btn, .collapse-all-btn {
            color: var(--gem-sys-color-on-surface, #e3e3e3) !important;
            opacity: 1 !important;
        }
        .folder-header {
            color: var(--gem-sys-color-on-surface, #e3e3e3) !important;
        }
        .cloned-chat-item {
            color: var(--gem-sys-color-on-surface-variant, #9aa0a6) !important;
        }
        .cloned-chat-item:hover {
            color: var(--gem-sys-color-on-surface, #e3e3e3) !important;
            background-color: var(--gem-sys-color-surface-container, rgba(255, 255, 255, 0.08)) !important;
        }
        .cloned-chat-item.active {
            background-color: var(--gem-sys-color-primary-container, #004A77) !important;
            color: var(--gem-sys-color-on-primary-container, #d3e3fd) !important;
        }
        .cloned-chat-item.active:hover {
            background-color: var(--gem-sys-color-primary-container, #005082) !important;
            filter: brightness(1.05);
        }
        .folder-header:hover {
            background-color: var(--gem-sys-color-surface-container, rgba(255, 255, 255, 0.08)) !important;
        }
        .arrow-icon {
            color: var(--gem-sys-color-on-surface-variant, #afb2b0) !important;
        }
        .folder-menu-btn {
            color: var(--gem-sys-color-on-surface-variant, #afb2b0) !important;
        }
        .count-badge {
            color: var(--gem-sys-color-on-surface-variant, #afb2b0) !important;
        }
        .remove-chat-btn {
            color: var(--gem-sys-color-on-surface-variant, #afb2b0) !important;
        }
        
        /* Light Mode Override */
        @media (prefers-color-scheme: light) {
            .folder-name, .folder-section-title span, .cloned-chat-title, .no-folders-msg, .add-folder-btn, .collapse-all-btn {
                color: var(--gem-sys-color-on-surface, #1f1f1f) !important;
            }
            .folder-header {
                color: var(--gem-sys-color-on-surface, #1f1f1f) !important;
            }
            .cloned-chat-item {
                color: var(--gem-sys-color-on-surface-variant, #5f6368) !important;
            }
            .cloned-chat-item:hover {
                color: var(--gem-sys-color-on-surface, #1f1f1f) !important;
                background-color: var(--gem-sys-color-surface-container, rgba(0, 0, 0, 0.06)) !important;
            }
            .cloned-chat-item.active {
                background-color: var(--gem-sys-color-primary-container, #d3e3fd) !important;
                color: var(--gem-sys-color-on-primary-container, #1f1f1f) !important;
            }
            .cloned-chat-item.active:hover {
                background-color: var(--gem-sys-color-primary-container, #c2d9f9) !important;
            }
            .folder-header:hover {
                background-color: var(--gem-sys-color-surface-container, rgba(0, 0, 0, 0.06)) !important;
            }
            .arrow-icon {
                color: var(--gem-sys-color-on-surface-variant, #5f6368) !important;
            }
            .folder-menu-btn {
                color: var(--gem-sys-color-on-surface-variant, #5f6368) !important;
            }
            .count-badge {
                color: var(--gem-sys-color-on-surface-variant, #5f6368) !important;
            }
            .remove-chat-btn {
                color: var(--gem-sys-color-on-surface-variant, #5f6368) !important;
            }
        }
        
        /* Ensure icons have proper contrast */
        .folder-icon {
            opacity: 1 !important;
        }

        /* Custom color picker button (Rainbow) */
        .modal-color-circle.custom-picker-btn, 
        .color-option-circle.custom-picker-btn {
            background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
            border: 2px solid var(--gem-sys-color-outline, #ccc);
            cursor: pointer;
        }
        
        /* Hidden color input - accessible but offscreen */
        #hidden-color-input, .hidden-menu-color-input {
            position: fixed;
            top: -100px;
            left: -100px;
            width: 50px;
            height: 50px;
            opacity: 0.01;
            z-index: 99999;
        }
        
        /* Chat search state */
        .cloned-chat-item.searching {
            opacity: 0.6;
            pointer-events: none;
            position: relative;
        }
        .cloned-chat-item.searching::after {
            content: '⏳';
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
    `;
    document.head.appendChild(style);
}

function init() {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(['geminiOrganizerState'], (result) => {
        if (chrome.runtime.lastError || !chrome.runtime?.id) return;
        state = result.geminiOrganizerState || JSON.parse(JSON.stringify(DEFAULT_STATE));
        if (!state.activeChatId) state.activeChatId = null;
        
        // Migrate folders to have subfolders array
        state.folders = migrateSubfolders(state.folders);
        
        // Migrate chat IDs to new format (with chat_ prefix)
        migrateChatIds(state.folders);
        
        // Migrate old percent-encoded CJK IDs to hash-based IDs
        migrateEncodedChatIds(state.folders);

        startPersistentObserver();
        
        injectStyles();
        
        // Migrar URLs de chats existentes que no las tengan
        migrateExistingChatUrls();
        
        setupInteractionTracker(); 
        observeNativeMenu();
        
        // Debug: Log what we can find in the DOM
        setTimeout(() => {
            const chatItems = document.querySelectorAll(SELECTORS.chatItem);
            console.log('[Folders] Found chat items with selector:', SELECTORS.chatItem, chatItems.length);
            const altItems = document.querySelectorAll('[data-test-id="conversation"]');
            console.log('[Folders] Found chat items with alt selector:', altItems.length);
            if (altItems.length > 0) {
                console.log('[Folders] Sample chat item:', altItems[0]);
            }
        }, 2000);
        
        // Ensure UI exists before syncing
        ensureUIExists();
        scanUrlAndSync();
        // Render active state again after a delay to catch late-loading UI
        setTimeout(() => {
            renderActiveState();
        }, 100);
        setTimeout(() => {
            renderActiveState();
        }, 500);
        
        setupAutoScroll();
        setupNavigationListener();
        
        // Check if sync has newer data (runs in background)
        setTimeout(() => checkSyncState(), 2000);
    });
}

// Migrate chat IDs to always have chat_ prefix
function migrateChatIds(folders) {
    if (!folders) return;
    let changed = false;
    folders.forEach(folder => {
        if (folder.chats) {
            folder.chats.forEach(chat => {
                // If originalId doesn't start with chat_, add the prefix
                if (chat.originalId && !chat.originalId.startsWith('chat_')) {
                    chat.originalId = 'chat_' + chat.originalId;
                    changed = true;
                }
            });
        }
        if (folder.subfolders) {
            migrateChatIds(folder.subfolders);
        }
    });
    if (changed) {
        // Also migrate activeChatId
        if (state.activeChatId && !state.activeChatId.startsWith('chat_')) {
            state.activeChatId = 'chat_' + state.activeChatId;
        }
        saveState();
    }
}

// Migrate old percent-encoded chat IDs (CJK, etc.) to hash-based IDs
function migrateEncodedChatIds(folders) {
    if (!folders) return false;
    let changed = false;
    folders.forEach(folder => {
        if (folder.chats) {
            folder.chats.forEach(chat => {
                // Check if this looks like an old percent-encoded title ID
                if (chat.originalId && chat.originalId.startsWith('chat_') && 
                    chat.originalId.includes('%') && !chat.originalId.startsWith('chat_t_')) {
                    const encodedPart = chat.originalId.substring(5); // Remove 'chat_' prefix
                    try {
                        const decoded = decodeURIComponent(encodedPart);
                        // Only migrate non-ASCII titles (CJK, Arabic, etc.)
                        if (/[^\x00-\x7F]/.test(decoded)) {
                            const newId = 'chat_t_' + hashString(decoded);
                            console.log('[Folders] Migrating CJK ID:', chat.originalId, '->', newId);
                            chat.originalId = newId;
                            changed = true;
                        }
                    } catch (e) {
                        // Decode failed, leave as is
                    }
                }
            });
        }
        if (folder.subfolders) {
            if (migrateEncodedChatIds(folder.subfolders)) changed = true;
        }
    });
    if (changed) saveState();
    return changed;
}

// --- SUBFOLDER MIGRATION & HELPERS ---

// Migrate existing folders to have subfolders array
function migrateSubfolders(folders) {
    if (!folders) return [];
    folders.forEach(folder => {
        if (!folder.subfolders) folder.subfolders = [];
        migrateSubfolders(folder.subfolders);
    });
    return folders;
}

// Find folder by ID recursively in nested structure
function findFolderById(folderId, folders = state.folders) {
    for (const folder of folders) {
        if (folder.id === folderId) return folder;
        if (folder.subfolders && folder.subfolders.length > 0) {
            const found = findFolderById(folderId, folder.subfolders);
            if (found) return found;
        }
    }
    return null;
}

// Find parent folder of a given folder ID
function findParentFolder(folderId, folders = state.folders, parent = null) {
    for (const folder of folders) {
        if (folder.id === folderId) return parent;
        if (folder.subfolders && folder.subfolders.length > 0) {
            const found = findParentFolder(folderId, folder.subfolders, folder);
            if (found !== undefined) return found;
        }
    }
    return undefined; // Not found
}

// Get all folder IDs (to prevent circular nesting)
function getAllDescendantIds(folder) {
    let ids = [folder.id];
    if (folder.subfolders) {
        folder.subfolders.forEach(sub => {
            ids = ids.concat(getAllDescendantIds(sub));
        });
    }
    return ids;
}

// Remove folder from its current location
function removeFolderFromParent(folderId) {
    // Check root level
    const rootIndex = state.folders.findIndex(f => f.id === folderId);
    if (rootIndex !== -1) {
        return state.folders.splice(rootIndex, 1)[0];
    }
    // Check nested
    function removeFromNested(folders) {
        for (const folder of folders) {
            if (folder.subfolders) {
                const idx = folder.subfolders.findIndex(f => f.id === folderId);
                if (idx !== -1) {
                    return folder.subfolders.splice(idx, 1)[0];
                }
                const found = removeFromNested(folder.subfolders);
                if (found) return found;
            }
        }
        return null;
    }
    return removeFromNested(state.folders);
}

// --- INTERACTION TRACKING ---
function setupInteractionTracker() {
    console.log('[Folders] Setting up interaction tracker');
    
    // Use capturing phase (true) to catch events before they're handled
    document.addEventListener('mousedown', handleInteraction, true);
    document.addEventListener('mouseover', handleInteraction, true);
    document.addEventListener('click', handleInteraction, true);
    document.addEventListener('pointerdown', handleInteraction, true);
    document.addEventListener('touchstart', handleInteraction, true);
    
    function handleInteraction(e) {
        // Try to find a chat item from the event target
        const chatItem = e.target.closest(SELECTORS.chatItem) || 
                        e.target.closest('[data-test-id="conversation"]') ||
                        e.target.closest('a[href*="/app/"]')?.closest('[data-test-id="conversation"]');
        
        if (chatItem) {
            assignChatId(chatItem);
            lastInteractedChatId = chatItem.id;
            // console.log('[Folders] Interaction tracked:', e.type, chatItem.id);
        }
    }
    
    // Also observe when menu buttons are clicked - use MutationObserver to find them
    const menuObserver = new MutationObserver(() => {
        // Find all menu trigger buttons and add listeners
        const menuButtons = document.querySelectorAll('button[aria-haspopup="true"], button[aria-haspopup="menu"], [aria-haspopup="true"]');
        menuButtons.forEach(btn => {
            if (btn.dataset.folderTracked) return;
            btn.dataset.folderTracked = 'true';
            
            btn.addEventListener('click', (e) => {
                const chatItem = btn.closest(SELECTORS.chatItem) || 
                                btn.closest('[data-test-id="conversation"]');
                if (chatItem) {
                    assignChatId(chatItem);
                    lastInteractedChatId = chatItem.id;
                    console.log('[Folders] Menu button click tracked:', chatItem.id);
                }
            }, true);
        });
    });
    
    menuObserver.observe(document.body, { childList: true, subtree: true });
}

function assignChatId(chatItem) {
    // Skip if already has a valid ID
    if (chatItem.id && chatItem.id.startsWith('chat_')) return;
    
    // 1. Intentar obtener ID estable de la URL (MEJORA ANTI-DUPLICADOS)
    const anchor = chatItem.querySelector('a');
    if (anchor) {
        const urlId = getChatIdFromUrl(anchor.getAttribute('href'));
        if (urlId) {
            chatItem.id = 'chat_' + urlId;
            return;
        }
    }

    // 2. Fallback: title-based ID
    const titleEl = chatItem.querySelector(SELECTORS.titleText);
    if (titleEl) {
        const title = titleEl.innerText.trim();
        // For ASCII-only titles, use encodeURIComponent (backward compatible)
        // For non-ASCII (CJK, Arabic, Cyrillic, etc.), use hash for safe, short IDs
        if (/^[\x20-\x7E]*$/.test(title)) {
            chatItem.id = 'chat_' + encodeURIComponent(title);
        } else {
            chatItem.id = 'chat_t_' + hashString(title);
        }
    } else {
        chatItem.id = 'chat_unknown_' + Math.random().toString(36).substr(2, 5);
    }
}

// --- NATIVE MENU INJECTION (CON METADATA FIX) ---

function observeNativeMenu() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    // Strategy 1: Direct mat-mdc-menu-content
                    let menuContent = node.classList && node.classList.contains('mat-mdc-menu-content') 
                        ? node 
                        : (node.querySelector ? node.querySelector('.mat-mdc-menu-content') : null);
                    
                    // Strategy 2: Check for cdk-overlay-pane containing menu
                    if (!menuContent && node.classList && node.classList.contains('cdk-overlay-pane')) {
                        menuContent = node.querySelector('.mat-mdc-menu-content');
                    }
                    
                    // Strategy 3: Check for mat-mdc-menu-panel
                    if (!menuContent && node.querySelector) {
                        const menuPanel = node.querySelector('.mat-mdc-menu-panel');
                        if (menuPanel) {
                            menuContent = menuPanel.querySelector('.mat-mdc-menu-content');
                        }
                    }
                    
                    if (menuContent && !menuContent.classList.contains('gemini-menu-injected')) {
                        const hasDeleteOrPin = menuContent.querySelector('button[data-test-id="delete-button"]') || 
                                               menuContent.querySelector('button[data-test-id="pin-button"]') ||
                                               menuContent.querySelector('[data-test-id="delete-button"]') ||
                                               menuContent.querySelector('[data-test-id="pin-button"]');
                        
                        if (hasDeleteOrPin) {
                            menuContent.classList.add('gemini-menu-injected');
                            const targetId = findContextChatId(menuContent);
                            // Always inject, even if targetId is null - we'll use fallbacks
                            injectMenuItem(menuContent, targetId);
                        }
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also check periodically for menus that might have been missed or need re-injection
    setInterval(() => {
        // Check menus without the injected class
        const menus = document.querySelectorAll('.mat-mdc-menu-content');
        menus.forEach(menuContent => {
            const hasDeleteOrPin = menuContent.querySelector('button[data-test-id="delete-button"]') || 
                                   menuContent.querySelector('button[data-test-id="pin-button"]') ||
                                   menuContent.querySelector('[data-test-id="delete-button"]') ||
                                   menuContent.querySelector('[data-test-id="pin-button"]');
            
            // Check if our button is missing even if class was added
            const hasOurButton = menuContent.querySelector('.gemini-folder-menu-item');
            
            if (hasDeleteOrPin && !hasOurButton) {
                menuContent.classList.add('gemini-menu-injected');
                const targetId = findContextChatId(menuContent);
                injectMenuItem(menuContent, targetId);
            }
        });
    }, 100);
}

function findContextChatId(menuContainer) {
    console.log('[Folders] findContextChatId called, lastInteractedChatId:', lastInteractedChatId);
    
    // ESTRATEGIA 0: If we already have lastInteractedChatId, use it first (most reliable)
    if (lastInteractedChatId) {
        console.log('[Folders] Using lastInteractedChatId:', lastInteractedChatId);
        return lastInteractedChatId;
    }
    
    // ESTRATEGIA 1: Buscar el botón disparador (el de los 3 puntos) que está activo
    const openMenuBtn = document.querySelector('button[aria-expanded="true"][aria-haspopup="true"]') || 
                        document.querySelector('button[aria-expanded="true"][aria-haspopup="menu"]') ||
                        document.querySelector('[aria-expanded="true"][aria-haspopup]');
    
    if (openMenuBtn) {
        const chatItem = openMenuBtn.closest(SELECTORS.chatItem) || 
                        openMenuBtn.closest('[data-test-id="conversation"]');
        if (chatItem) {
             assignChatId(chatItem);
             console.log('[Folders] Found via open menu button:', chatItem.id);
             return chatItem.id;
        }
    }
    
    // ESTRATEGIA 2: Buscar chat que tiene hover/focus activo
    const hoveredChat = document.querySelector(`${SELECTORS.chatItem}:hover`) ||
                       document.querySelector('[data-test-id="conversation"]:hover');
    if (hoveredChat) {
        assignChatId(hoveredChat);
        console.log('[Folders] Found via hover:', hoveredChat.id);
        return hoveredChat.id;
    }

    // ESTRATEGIA 3: METADATOS desde jslog del menú
    if (menuContainer) {
        const dataButton = menuContainer.querySelector('button[data-test-id="delete-button"]') || 
                           menuContainer.querySelector('button[data-test-id="pin-button"]') ||
                           menuContainer.querySelector('[data-test-id="delete-button"]') ||
                           menuContainer.querySelector('[data-test-id="pin-button"]');
        
        if (dataButton) {
            const jslog = dataButton.getAttribute('jslog') || "";
            const match = jslog.match(/(c_[a-f0-9]{8,})/);
            
            if (match && match[1]) {
                const googleId = match[1];
                console.log('[Folders] Found Google ID in jslog:', googleId);
                
                // Search for chat element with this Google ID
                const chatElement = document.querySelector(`${SELECTORS.chatItem}[jslog*="${googleId}"]`) ||
                                   document.querySelector(`[data-test-id="conversation"][jslog*="${googleId}"]`);
                
                if (chatElement) {
                    assignChatId(chatElement);
                    console.log('[Folders] Found via jslog:', chatElement.id);
                    return chatElement.id;
                }
                
                // If not found directly, search all conversations
                const allChats = document.querySelectorAll(SELECTORS.chatItem);
                for (const chat of allChats) {
                    const chatJslog = chat.getAttribute('jslog') || '';
                    if (chatJslog.includes(googleId)) {
                        assignChatId(chat);
                        console.log('[Folders] Found via jslog search:', chat.id);
                        return chat.id;
                    }
                }
            }
        }
    }

    // ESTRATEGIA 4: Chat activo (Último recurso)
    console.log('[Folders] Using activeChatId as fallback:', state.activeChatId);
    return state.activeChatId; 
}

function injectMenuItem(menuContainer, chatId) {
    if (menuContainer.querySelector('.gemini-folder-menu-item')) return;

    // Try to find chatId NOW, before anything else happens
    let finalChatId = chatId;
    if (!finalChatId) {
        finalChatId = findContextChatId(menuContainer);
    }
    if (!finalChatId) {
        finalChatId = lastInteractedChatId;
    }
    if (!finalChatId) {
        finalChatId = state.activeChatId;
    }

    const button = document.createElement('button');
    button.className = 'mat-mdc-menu-item mat-focus-indicator gemini-folder-menu-item';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('tabindex', '0');
    // Store the chatId on the button itself so we have it at click time
    button.dataset.targetChatId = finalChatId || '';
    
    // Create the folder icon SVG
    const iconSvg = createSVGElement(ADD_TO_FOLDER_ICON);
    iconSvg.style.width = '20px';
    iconSvg.style.height = '20px';
    iconSvg.style.fill = 'currentColor';
    iconSvg.style.marginRight = '12px';
    iconSvg.style.flexShrink = '0';
    
    button.innerHTML = `
        <span class="mat-mdc-menu-item-text" style="display: flex; align-items: center; width: 100%;">
            <span class="gemini-folder-icon-wrapper" style="display: flex; align-items: center; margin-right: 12px;"></span>
            <span class="gds-body-m">Move to folder</span>
        </span>
        <div matripple="" class="mat-ripple mat-mdc-menu-ripple"></div>
    `;
    
    // Insert the SVG into the wrapper
    button.querySelector('.gemini-folder-icon-wrapper').appendChild(iconSvg);

    button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get chatId from the button's data attribute
        let targetChatId = button.dataset.targetChatId;
        
        // Fallback if still empty
        if (!targetChatId) {
            targetChatId = lastInteractedChatId || state.activeChatId;
        }
        
        if (!targetChatId) {
            alert("Could not identify the chat. Please try again.");
            return;
        }
        
        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop) backdrop.click();
        else document.body.click(); 

        showFolderSelector(targetChatId);
    };

    // Find where to insert - before delete button or at the end
    const deleteBtn = menuContainer.querySelector('button[data-test-id="delete-button"]') || 
                      menuContainer.querySelector('[data-test-id="delete-button"]');
    if (deleteBtn) {
        menuContainer.insertBefore(button, deleteBtn);
    } else {
        menuContainer.appendChild(button);
    }
}

function showFolderSelector(chatId) {
    if (state.folders.length === 0) {
        alert("Create a folder first!");
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Build folder list recursively
    function buildFolderHtml(folders, depth = 0) {
        let html = '';
        folders.forEach(folder => {
            const indent = depth * 16;
            html += `
                <div class="folder-selector-item" data-folder-id="${folder.id}" style="padding-left: ${16 + indent}px;">
                    <div class="folder-icon-preview" style="color: ${folder.color || '#afb2b0'}">
                        ${createSVGElement(FOLDER_ICON_SVG).outerHTML}
                    </div>
                    <span>${folder.name}</span>
                </div>
            `;
            if (folder.subfolders && folder.subfolders.length > 0) {
                html += buildFolderHtml(folder.subfolders, depth + 1);
            }
        });
        return html;
    }
    
    let html = `
        <div class="modal-container">
            <h3 class="modal-title">Move to Folder</h3>
            <div class="folder-selector-list">
                ${buildFolderHtml(state.folders)}
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel">Cancel</button>
            </div>
        </div>
    `;
    
    overlay.innerHTML = html;

    const close = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 150);
    };

    overlay.querySelector('.modal-btn.cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // FIX CLIC DOBLE: Cerrar antes de ejecutar la acción
    overlay.querySelectorAll('.folder-selector-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation(); // Evitar que el clic atraviese
            
            const folderId = item.dataset.folderId;
            const folderDOM = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
            
            // 1. Cerrar UI INMEDIATAMENTE (Lo primero)
            close();

            // 2. Ejecutar la acción en segundo plano
            if (folderDOM) {
                // Pequeño timeout para separar la renderización del cierre de la acción de mover
                setTimeout(() => {
                    moveChatToFolder(chatId, folderId, folderDOM);
                }, 0);
            }
        };
    });

    document.body.appendChild(overlay);
}

// --- STATE MANAGEMENT ---

function saveState() {
    if (!state) return;
    state.lastModified = Date.now();
    chrome.storage.local.set({ geminiOrganizerState: state });
    debouncedSyncSave();
    checkEmptyState();
}

// --- CHROME SYNC STORAGE ---

function saveToSync() {
    if (!state || !chrome.runtime?.id) return;
    const syncData = {
        folders: state.folders,
        lastModified: state.lastModified || Date.now(),
        version: '2.14'
    };
    const json = JSON.stringify(syncData);
    if (json.length > 95000) {
        console.log('[Folders] State too large for sync storage:', json.length, 'bytes');
        return;
    }
    const chunks = [];
    for (let i = 0; i < json.length; i += SYNC_CHUNK_SIZE) {
        chunks.push(json.substring(i, i + SYNC_CHUNK_SIZE));
    }
    chrome.storage.sync.get(null, (existing) => {
        if (chrome.runtime.lastError || !chrome.runtime?.id) return;
        const oldKeys = Object.keys(existing).filter(k => k.startsWith('geminiState_'));
        const newData = {
            geminiState_meta: { chunks: chunks.length, lastModified: syncData.lastModified, version: syncData.version }
        };
        chunks.forEach((chunk, i) => { newData['geminiState_' + i] = chunk; });
        const keysToClean = oldKeys.filter(k => !(k in newData));
        const doSet = () => {
            chrome.storage.sync.set(newData, () => {
                if (chrome.runtime.lastError) {
                    console.log('[Folders] Sync save error:', chrome.runtime.lastError.message);
                } else {
                    console.log('[Folders] Synced (' + chunks.length + ' chunks, ' + json.length + ' bytes)');
                }
            });
        };
        if (keysToClean.length > 0) {
            chrome.storage.sync.remove(keysToClean, doSet);
        } else {
            doSet();
        }
    });
}

function debouncedSyncSave() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => saveToSync(), SYNC_DEBOUNCE_MS);
}

function loadFromSync(callback) {
    if (!chrome.runtime?.id) { callback(null); return; }
    chrome.storage.sync.get(null, (data) => {
        if (chrome.runtime.lastError || !data || !data.geminiState_meta) {
            callback(null);
            return;
        }
        const meta = data.geminiState_meta;
        const chunks = [];
        for (let i = 0; i < meta.chunks; i++) {
            const chunk = data['geminiState_' + i];
            if (!chunk) { callback(null); return; }
            chunks.push(chunk);
        }
        try {
            const syncState = JSON.parse(chunks.join(''));
            syncState.lastModified = meta.lastModified;
            callback(syncState);
        } catch (e) {
            console.log('[Folders] Error parsing sync state:', e);
            callback(null);
        }
    });
}

function checkSyncState() {
    loadFromSync((syncState) => {
        if (!syncState || !syncState.folders) return;
        const localModified = state.lastModified || 0;
        const syncModified = syncState.lastModified || 0;
        if (syncModified > localModified && syncState.folders.length > 0) {
            console.log('[Folders] Sync state is newer, updating local');
            state.folders = migrateSubfolders(syncState.folders);
            state.lastModified = syncModified;
            chrome.storage.local.set({ geminiOrganizerState: state });
            refreshFolderUI();
        }
    });
}

// --- EXPORT / IMPORT ---

function exportStateToCode() {
    const exportData = {
        folders: state.folders,
        version: '2.14',
        exportedAt: Date.now()
    };
    const json = JSON.stringify(exportData);
    return btoa(unescape(encodeURIComponent(json)));
}

function importStateFromCode(code) {
    try {
        const json = decodeURIComponent(escape(atob(code.trim())));
        const importData = JSON.parse(json);
        if (!importData.folders || !Array.isArray(importData.folders)) {
            throw new Error('Invalid data format');
        }
        return importData;
    } catch (e) {
        console.log('[Folders] Import error:', e);
        return null;
    }
}

function showSyncModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const code = exportStateToCode();
    const folderCount = state.folders.length;
    let chatCount = 0;
    function countChats(folders) {
        folders.forEach(f => {
            chatCount += (f.chats ? f.chats.length : 0);
            if (f.subfolders) countChats(f.subfolders);
        });
    }
    countChats(state.folders);

    overlay.innerHTML = `
        <div class="modal-container" style="width: 420px;">
            <h3 class="modal-title">Sync & Backup</h3>
            <p class="modal-text" style="margin-bottom:12px;">Transfer your folder structure between devices, or create a backup.</p>
            
            <div class="sync-section">
                <div class="sync-section-header">Export</div>
                <p class="sync-section-desc">Copy this code and paste it on your other device.</p>
                <div class="sync-stats">${folderCount} folder${folderCount !== 1 ? 's' : ''}, ${chatCount} chat${chatCount !== 1 ? 's' : ''}</div>
                <textarea class="sync-textarea" id="export-code" readonly>${code}</textarea>
                <button class="modal-btn confirm sync-copy-btn" id="copy-export-btn">Copy to clipboard</button>
            </div>

            <div class="sync-divider"></div>

            <div class="sync-section">
                <div class="sync-section-header">Import</div>
                <p class="sync-section-desc">Paste a code from another device to restore folders.</p>
                <textarea class="sync-textarea" id="import-code" placeholder="Paste your code here..."></textarea>
                <div class="sync-import-actions">
                    <button class="modal-btn confirm sync-import-btn" id="import-replace-btn">Replace all</button>
                    <button class="modal-btn cancel sync-import-btn" id="import-merge-btn" style="color:#81C995;border:1px solid #81C995;">Merge</button>
                </div>
            </div>

            <div class="sync-divider"></div>
            <div class="sync-section">
                <div class="sync-section-header" style="display:flex;align-items:center;gap:8px;">Chrome Sync
                    <span class="sync-auto-badge">automatic</span>
                </div>
                <p class="sync-section-desc">Your folders are automatically synced across devices where you're signed into Chrome with the same account. This happens in the background — no action needed.</p>
            </div>

            <div class="modal-actions" style="margin-top:16px;">
                <button class="modal-btn cancel" id="sync-close-btn">Close</button>
            </div>
        </div>
    `;

    const close = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 150);
    };

    document.body.appendChild(overlay);

    overlay.querySelector('#sync-close-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Copy button
    overlay.querySelector('#copy-export-btn').onclick = () => {
        const textarea = overlay.querySelector('#export-code');
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            const btn = overlay.querySelector('#copy-export-btn');
            btn.textContent = 'Copied!';
            btn.style.backgroundColor = '#81C995';
            setTimeout(() => { btn.textContent = 'Copy to clipboard'; btn.style.backgroundColor = ''; }, 2000);
        }).catch(() => {
            document.execCommand('copy');
            const btn = overlay.querySelector('#copy-export-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
        });
    };

    // Replace button
    overlay.querySelector('#import-replace-btn').onclick = () => {
        const importCode = overlay.querySelector('#import-code').value;
        if (!importCode.trim()) { alert('Please paste a code first.'); return; }
        const importData = importStateFromCode(importCode);
        if (!importData) { alert('Invalid code. Please check and try again.'); return; }
        if (!confirm(`This will replace all your current folders with ${importData.folders.length} imported folder(s). Continue?`)) return;
        state.folders = migrateSubfolders(importData.folders);
        migrateChatIds(state.folders);
        saveState();
        refreshFolderUI();
        close();
    };

    // Merge button
    overlay.querySelector('#import-merge-btn').onclick = () => {
        const importCode = overlay.querySelector('#import-code').value;
        if (!importCode.trim()) { alert('Please paste a code first.'); return; }
        const importData = importStateFromCode(importCode);
        if (!importData) { alert('Invalid code. Please check and try again.'); return; }
        const existingNames = new Set(state.folders.map(f => f.name.toLowerCase()));
        let added = 0;
        importData.folders.forEach(f => {
            f = migrateSubfolders([f])[0];
            if (existingNames.has(f.name.toLowerCase())) {
                // Rename to avoid confusion
                f.name = f.name + ' (imported)';
            }
            // Give it a new ID to avoid conflicts
            f.id = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            state.folders.push(f);
            added++;
        });
        migrateChatIds(state.folders);
        saveState();
        refreshFolderUI();
        alert(`Merged ${added} folder(s) into your existing structure.`);
        close();
    };
}

function renderActiveState() {
    // Remove active from all that don't match
    document.querySelectorAll('.cloned-chat-item.active').forEach(el => {
        if (el.dataset.cloneId !== state.activeChatId) el.classList.remove('active');
    });

    if (state.activeChatId) {
        // Try to find by exact ID match
        let target = document.querySelector(`.cloned-chat-item[data-clone-id="${state.activeChatId}"]`);
        
        // If not found and activeChatId looks like a chat ID, try CSS escape for special chars
        if (!target) {
            // Try finding by iterating (handles special characters in IDs)
            document.querySelectorAll('.cloned-chat-item').forEach(el => {
                if (el.dataset.cloneId === state.activeChatId) {
                    target = el;
                }
            });
        }
        
        if (target && !target.classList.contains('active')) {
            target.classList.add('active');
        }
    }
}

// --- CORE SYNC LOGIC ---

function scanUrlAndSync() {
    const currentUrlId = getChatIdFromUrl(window.location.href);
    
    if (!currentUrlId) {
        if (state.activeChatId !== null) {
            state.activeChatId = null;
            saveState();
            renderActiveState();
        }
        return;
    }

    // Helper to find chat in nested folders by URL
    function findChatInFoldersByUrl(folders, urlId) {
        for (const folder of folders) {
            for (const chat of folder.chats) {
                // Check by stored URL
                const chatUrlId = chat.url ? getChatIdFromUrl(chat.url) : null;
                if (chatUrlId === urlId) {
                    return chat.originalId;
                }
                // Also check if originalId contains the urlId (with or without chat_ prefix)
                if (chat.originalId === urlId || 
                    chat.originalId === 'chat_' + urlId ||
                    chat.originalId.endsWith('_' + urlId)) {
                    return chat.originalId;
                }
            }
            if (folder.subfolders && folder.subfolders.length > 0) {
                const found = findChatInFoldersByUrl(folder.subfolders, urlId);
                if (found) return found;
            }
        }
        return null;
    }

    // Helper to find chat object by originalId and update its URL
    function updateChatUrlInFolders(folders, originalId, newUrl) {
        for (const folder of folders) {
            for (const chat of folder.chats) {
                if (chat.originalId === originalId) {
                    if (!chat.url || chat.url !== newUrl) {
                        chat.url = newUrl;
                        return true; // Updated
                    }
                    return false; // Already has this URL
                }
            }
            if (folder.subfolders && folder.subfolders.length > 0) {
                if (updateChatUrlInFolders(folder.subfolders, originalId, newUrl)) return true;
            }
        }
        return false;
    }

    // First, check if current URL matches a chat in our folders (including subfolders)
    const folderChatId = findChatInFoldersByUrl(state.folders, currentUrlId);
    
    if (folderChatId) {
        if (state.activeChatId !== folderChatId) {
            state.activeChatId = folderChatId;
            saveState();
        }
        renderActiveState();
        return;
    }
    
    // URL not found by direct match - check if we have a saved activeChatId
    // This handles legacy chats that don't have URLs stored yet
    if (state.activeChatId) {
        // Check if this activeChatId exists as a clone in DOM
        const existingClone = document.querySelector(`.cloned-chat-item[data-clone-id="${state.activeChatId}"]`);
        if (existingClone) {
            // Clone exists - update the stored URL for future lookups
            const fullUrl = window.location.pathname + window.location.search;
            if (updateChatUrlInFolders(state.folders, state.activeChatId, fullUrl)) {
                // Also update the clone's dataset
                existingClone.dataset.chatUrl = fullUrl;
                saveState();
            }
            renderActiveState();
            return;
        }
    }

    // If not in folders, check DOM for matching chat
    const allOriginals = document.querySelectorAll(SELECTORS.chatItem);
    let foundOriginalId = null;

    for (const chat of allOriginals) {
        const anchor = chat.querySelector('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (getChatIdFromUrl(href) === currentUrlId) {
                if (!chat.id) assignChatId(chat);
                foundOriginalId = chat.id;
                break;
            }
        }
    }

    if (foundOriginalId) {
        const hasClone = document.querySelector(`.cloned-chat-item[data-clone-id="${foundOriginalId}"]`);
        if (hasClone) {
            if (state.activeChatId !== foundOriginalId) {
                state.activeChatId = foundOriginalId;
                saveState();
            }
            // Always render to ensure UI is in sync
            renderActiveState();
        } else {
            // Chat exists but not in any folder - clear active state
            if (state.activeChatId !== null) {
                state.activeChatId = null;
                saveState();
                renderActiveState();
            }
        }
    } else {
        // No matching chat found anywhere - clear active state
        if (state.activeChatId !== null) {
            state.activeChatId = null;
            saveState();
            renderActiveState();
        }
    }
}

// --- OBSERVERS ---

function startPersistentObserver() {
    const bodyObserver = new MutationObserver(() => {
        ensureUIExists();
        forceHideOriginals();
        renderActiveState();
        setTimeout(forceHideOriginals, 50); 
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        ensureUIExists();
        forceHideOriginals();
        scanUrlAndSync();
    }, 500);
}

function setupNavigationListener() {
    let lastUrl = window.location.href;
    const navObserver = new MutationObserver(() => {
        const url = window.location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            scanUrlAndSync();
        }
    });
    navObserver.observe(document, { subtree: true, childList: true });
}

// --- HELPERS ---

function getChatIdFromUrl(url) {
    try {
        if (!url) return null;
        const match = url.match(/\/app\/([a-zA-Z0-9\-_]+)/);
        return match ? match[1] : null;
    } catch (e) { return null; }
}

function forceHideOriginals() {
    if (!state) return;
    const hiddenIds = new Set();
    const hiddenUrls = new Set(); // FIX DUPLICADOS: Rastrear URLs
    const chatsNeedingUrls = new Map(); // originalId -> chatData
    
    // Collect all chats recursively from nested folders
    function collectChats(folders) {
        folders.forEach(f => {
            f.chats.forEach(c => {
                hiddenIds.add(c.originalId);
                // FIX DUPLICADOS: Si tiene URL, la añadimos al set de ocultación
                if (c.url) {
                   const urlId = getChatIdFromUrl(c.url);
                   if (urlId) hiddenUrls.add(urlId);
                } else {
                    chatsNeedingUrls.set(c.originalId, c);
                }
            });
            if (f.subfolders) collectChats(f.subfolders);
        });
    }
    collectChats(state.folders);
    
    if (hiddenIds.size === 0 && hiddenUrls.size === 0) return;

    let urlsUpdated = false;
    const allChats = document.querySelectorAll(SELECTORS.chatItem);
    allChats.forEach(chat => {
        if (!chat.id) assignChatId(chat);
        
        let shouldHide = hiddenIds.has(chat.id);
        
        // FIX DUPLICADOS: Comprobación por URL
        if (!shouldHide) {
            const anchor = chat.querySelector('a');
            if (anchor) {
                const urlId = getChatIdFromUrl(anchor.getAttribute('href'));
                if (urlId && hiddenUrls.has(urlId)) {
                    shouldHide = true;
                }
            }
        }

        if (shouldHide) {
            // MIGRACIÓN: Si este chat necesita URL, capturarla ahora
            if (chatsNeedingUrls.has(chat.id)) {
                const anchor = chat.querySelector('a');
                if (anchor) {
                    const url = anchor.getAttribute('href');
                    if (url) {
                        const chatData = chatsNeedingUrls.get(chat.id);
                        chatData.url = url;
                        urlsUpdated = true;
                        
                        // También actualizar el clone en el DOM
                        const clone = document.querySelector(`.cloned-chat-item[data-clone-id="${chat.id}"]`);
                        if (clone) clone.dataset.chatUrl = url;
                    }
                }
            }
            chat.style.setProperty('display', 'none', 'important');
        }
    });
    
    // Guardar si hubo actualizaciones
    if (urlsUpdated) {
        saveState();
    }
}

// Función para migrar URLs de chats existentes
function migrateExistingChatUrls() {
    if (!state || !state.folders) return;
    
    let urlsUpdated = false;
    const allChats = document.querySelectorAll(SELECTORS.chatItem);
    
    // Crear un mapa de título -> elemento para búsqueda rápida
    const chatsByTitle = new Map();
    const chatsById = new Map();
    
    allChats.forEach(chat => {
        if (!chat.id) assignChatId(chat);
        chatsById.set(chat.id, chat);
        
        const titleEl = chat.querySelector(SELECTORS.titleText);
        if (titleEl) {
            const title = titleEl.innerText.trim();
            chatsByTitle.set(title, chat);
        }
    });
    
    // Buscar chats sin URL y actualizar - recursively
    function migrateFolderChats(folders) {
        folders.forEach(folder => {
            folder.chats.forEach(chatData => {
                if (!chatData.url) {
                    // Intentar encontrar por ID primero
                    let chatElement = chatsById.get(chatData.originalId);
                    
                    // Si no, intentar por título
                    if (!chatElement && chatData.title) {
                        chatElement = chatsByTitle.get(chatData.title);
                    }
                    
                    if (chatElement) {
                        const anchor = chatElement.querySelector('a');
                        if (anchor) {
                            const url = anchor.getAttribute('href');
                            if (url) {
                                chatData.url = url;
                                urlsUpdated = true;
                                
                                // Actualizar clone en DOM
                                const clone = document.querySelector(`.cloned-chat-item[data-clone-id="${chatData.originalId}"]`);
                                if (clone) clone.dataset.chatUrl = url;
                            }
                        }
                    }
                }
            });
            if (folder.subfolders) migrateFolderChats(folder.subfolders);
        });
    }
    migrateFolderChats(state.folders);
    
    if (urlsUpdated) {
        saveState();
    }
}

function ensureUIExists() {
    const sidebar = document.querySelector(SELECTORS.sidebar);
    const recentTitle = sidebar?.querySelector(SELECTORS.recentTitleContainer);
    const existingContainer = document.getElementById('gemini-folder-container');

    if (sidebar && recentTitle && !existingContainer) {
        createFolderUI(recentTitle.parentNode, recentTitle);
        setupDraggableChats(sidebar);
        setupNativeClickDelegation(sidebar);
    } else if (sidebar) {
        setupDraggableChats(sidebar);
        setupNativeClickDelegation(sidebar);
    }
}

function setupNativeClickDelegation(sidebar) {
    if (sidebar.dataset.nativeListenerAttached === "true") return;
    sidebar.addEventListener('click', (e) => {
        if (isProgrammaticClick) return;
        const isInsideFolders = e.target.closest('#gemini-folder-container');
        if (!isInsideFolders) {
            const clickedChat = e.target.closest(SELECTORS.chatItem);
            if (clickedChat) {
                if (state.activeChatId !== null) {
                    state.activeChatId = null;
                    saveState();
                    renderActiveState();
                }
            }
        }
    });
    sidebar.dataset.nativeListenerAttached = "true";
}

function createSVGElement(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.innerHTML = pathData; 
    return svg;
}

function checkEmptyState() {
    const msg = document.getElementById('empty-folders-msg');
    if (msg) {
        if (state.folders.length === 0) msg.classList.add('visible');
        else msg.classList.remove('visible');
    }
}

// --- UI COMPONENTS ---

function createFolderUI(parent, sibling) {
    const container = document.createElement('div');
    container.id = 'gemini-folder-container';
    const header = document.createElement('div');
    header.className = 'folder-section-title';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Folders';
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'folder-header-buttons';
    
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-all-btn';
    const collapseSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    collapseSvg.setAttribute("viewBox", "0 0 24 24");
    collapseSvg.innerHTML = COLLAPSE_ALL_ICON_TOP + COLLAPSE_ALL_ICON_BOTTOM;
    collapseBtn.appendChild(collapseSvg);
    collapseBtn.onclick = () => toggleAllFolders();
    
    // Set initial state
    const anyOpen = state.folders.some(f => f.isOpen);
    collapseBtn.title = anyOpen ? 'Collapse all folders' : 'Expand all folders';
    if (!anyOpen) collapseBtn.classList.add('expand-mode');
    
    const addBtn = document.createElement('button');
    addBtn.className = 'add-folder-btn';
    addBtn.title = 'New Folder';
    addBtn.textContent = '+';
    addBtn.onclick = () => addNewFolder();
    
    const syncBtn = document.createElement('button');
    syncBtn.className = 'collapse-all-btn';
    syncBtn.title = 'Sync & Backup';
    const syncSvg = createSVGElement(SYNC_ICON_SVG);
    syncSvg.style.width = '16px';
    syncSvg.style.height = '16px';
    syncSvg.style.fill = 'currentColor';
    syncBtn.appendChild(syncSvg);
    syncBtn.onclick = () => showSyncModal();
    
    buttonsContainer.appendChild(syncBtn);
    buttonsContainer.appendChild(collapseBtn);
    buttonsContainer.appendChild(addBtn);
    
    header.appendChild(titleSpan);
    header.appendChild(buttonsContainer);
    container.appendChild(header);
    const folderList = document.createElement('div');
    folderList.id = 'folder-list-root';
    container.appendChild(folderList);
    const emptyMsg = document.createElement('div');
    emptyMsg.id = 'empty-folders-msg';
    emptyMsg.className = 'no-folders-msg';
    emptyMsg.textContent = "No folders created yet.";
    if (state.folders.length === 0) emptyMsg.classList.add('visible');
    container.appendChild(emptyMsg);
    if (state.folders.length > 0) {
        state.folders.forEach(folder => folderList.appendChild(renderSingleFolder(folder)));
    }
    parent.insertBefore(container, sibling);
    
    // Setup folder reordering after UI is created
    setupFolderReordering();
}

// --- FOLDER RENDERING ---

function renderSingleFolder(folder, depth = 0) {
    const el = document.createElement('div');
    el.className = 'folder-item' + (folder.isOpen ? ' open' : '');
    el.dataset.folderId = folder.id;
    el.dataset.folderDepth = depth;
    
    const folderColor = folder.color || '#afb2b0';
    const initialCount = folder.chats ? folder.chats.length : 0;
    const subfolderCount = folder.subfolders ? folder.subfolders.length : 0;
    
    const header = document.createElement('div');
    header.className = 'folder-header';
    // Add indentation based on depth
    header.style.paddingLeft = (12 + depth * 16) + 'px';
    
    const arrow = document.createElement('span');
    arrow.className = 'arrow-icon';
    arrow.textContent = '▶';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'folder-icon';
    iconSpan.style.color = folderColor;
    iconSpan.appendChild(createSVGElement(FOLDER_ICON_SVG));
    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.style.flexGrow = '1';
    nameSpan.style.marginLeft = '8px';
    nameSpan.textContent = folder.name; 
    const countSpan = document.createElement('span');
    countSpan.className = 'count-badge';
    countSpan.style.fontSize = '10px';
    countSpan.style.opacity = '0.5';
    countSpan.style.marginRight = '8px';
    // Show chat count and subfolder count if any
    countSpan.textContent = subfolderCount > 0 ? `${initialCount}+${subfolderCount}` : initialCount;
    const menuBtn = document.createElement('span');
    menuBtn.className = 'folder-menu-btn';
    menuBtn.appendChild(createSVGElement(MORE_VERT_ICON_SVG));
    header.append(arrow, iconSpan, nameSpan, countSpan, menuBtn);
    el.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'folder-content';
    el.appendChild(content);
    
    // Render subfolders first
    if (folder.subfolders && folder.subfolders.length > 0) {
        folder.subfolders.forEach(subfolder => {
            content.appendChild(renderSingleFolder(subfolder, depth + 1));
        });
    }
    
    // Then render chats
    if (folder.chats && folder.chats.length > 0) {
        folder.chats.forEach(savedChat => {
            createVisualClone(savedChat.originalId, savedChat.title, savedChat.url || null, content, folder.id, false, depth);
        });
    }
    
    header.onclick = (e) => {
        e.stopPropagation(); // Prevent parent folder from toggling
        if (e.target.closest('.folder-menu-btn')) return;
        folder.isOpen = !folder.isOpen;
        el.classList.toggle('open');
        updateCollapseButtonState();
        saveState();
    };
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        showFolderMenu(folder, el, menuBtn, depth);
    };
    
    // Folder drag start - only from header
    header.setAttribute('draggable', 'true');
    header.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        state.draggedFolderId = folder.id;
        el.classList.add('dragging-folder');
        e.dataTransfer.effectAllowed = "move";
    });
    header.addEventListener('dragend', () => {
        el.classList.remove('dragging-folder');
        state.draggedFolderId = null;
    });
    
    // Drop zone - for chats always, for folders only in center zone (edges = reorder)
    header.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        // Don't stopPropagation - let it bubble for folder reordering
        
        // For folder drags, only show nest indicator when in center zone
        if (state.draggedFolderId) {
            const draggedFolder = findFolderById(state.draggedFolderId);
            if (draggedFolder) {
                const descendantIds = getAllDescendantIds(draggedFolder);
                if (descendantIds.includes(folder.id)) return;
            }
            
            // Check if in center zone (middle 40% of header height)
            const rect = header.getBoundingClientRect();
            const mouseY = e.clientY;
            const relativeY = mouseY - rect.top;
            const heightPercent = relativeY / rect.height;
            
            // Only show nest indicator if in center 40% (0.3 to 0.7)
            if (heightPercent >= 0.3 && heightPercent <= 0.7) {
                el.classList.add('drag-over');
            } else {
                el.classList.remove('drag-over');
            }
            return;
        }
        
        // For chat drags, always show indicator
        el.classList.add('drag-over'); 
    });
    header.addEventListener('dragleave', (e) => { 
        // Only remove if leaving to outside the header
        if (header.contains(e.relatedTarget)) return;
        el.classList.remove('drag-over'); 
    });
    header.addEventListener('drop', (e) => {
        const wasInNestZone = el.classList.contains('drag-over');
        el.classList.remove('drag-over');
        
        // Handle folder drop - only nest if was in center zone
        if (state.draggedFolderId && state.draggedFolderId !== folder.id) {
            if (!wasInNestZone) {
                // Not in nest zone - let the event bubble up for reordering
                return;
            }
            
            // In nest zone - stop propagation and handle nesting
            e.preventDefault();
            e.stopPropagation();
            
            const draggedFolder = findFolderById(state.draggedFolderId);
            if (draggedFolder) {
                const descendantIds = getAllDescendantIds(draggedFolder);
                if (!descendantIds.includes(folder.id)) {
                    moveFolderToFolder(state.draggedFolderId, folder.id);
                }
            }
            return;
        }
        
        // Handle chat drop
        e.preventDefault();
        e.stopPropagation();
        const chatId = state.draggedChatId;
        if (chatId) moveChatToFolder(chatId, folder.id, el, false);
    });
    
    return el;
}

// Move a folder into another folder as subfolder
function moveFolderToFolder(sourceFolderId, targetFolderId) {
    const sourceFolder = removeFolderFromParent(sourceFolderId);
    if (!sourceFolder) return;
    
    const targetFolder = findFolderById(targetFolderId);
    if (!targetFolder) {
        // Put it back at root if target not found
        state.folders.push(sourceFolder);
        saveState();
        refreshFolderUI();
        return;
    }
    
    if (!targetFolder.subfolders) targetFolder.subfolders = [];
    targetFolder.subfolders.unshift(sourceFolder);
    
    // Open target folder to show the moved subfolder
    targetFolder.isOpen = true;
    
    saveState();
    refreshFolderUI();
}

// Refresh the entire folder UI
function refreshFolderUI() {
    const folderList = document.getElementById('folder-list-root');
    if (!folderList) return;
    folderList.innerHTML = '';
    state.folders.forEach(folder => {
        folderList.appendChild(renderSingleFolder(folder, 0));
    });
    setupFolderReordering(); // Setup drag reordering after refresh
    updateCollapseButtonState();
    forceHideOriginals();
    renderActiveState();
}

// Reorder a folder to a new position in root folders
function reorderFolder(folderId, newIndex) {
    const currentIndex = state.folders.findIndex(f => f.id === folderId);
    if (currentIndex === -1 || currentIndex === newIndex) return;
    
    const [folder] = state.folders.splice(currentIndex, 1);
    // Adjust index if moving down (since we removed an item)
    const adjustedIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
    state.folders.splice(adjustedIndex, 0, folder);
    
    saveState();
    refreshFolderUI();
}

// Setup drag and drop reordering for root folders
function setupFolderReordering() {
    const folderList = document.getElementById('folder-list-root');
    if (!folderList || folderList.dataset.reorderReady === 'true') return;
    
    let targetIndex = -1;
    
    // Create drop indicator element
    function getDropIndicator() {
        if (!folderDropIndicator) {
            folderDropIndicator = document.createElement('div');
            folderDropIndicator.className = 'folder-drop-indicator';
        }
        return folderDropIndicator;
    }
    
    // Remove drop indicator - global function
    function removeDropIndicator() {
        if (folderDropIndicator && folderDropIndicator.parentNode) {
            folderDropIndicator.remove();
        }
        targetIndex = -1;
    }
    
    // Global dragend cleanup
    document.addEventListener('dragend', () => {
        removeDropIndicator();
    });
    
    folderList.addEventListener('dragover', (e) => {
        // Only handle folder drags for root-level reordering
        if (!state.draggedFolderId) return;
        
        // Check if dragged folder is a root folder
        const draggedFolderIndex = state.folders.findIndex(f => f.id === state.draggedFolderId);
        if (draggedFolderIndex === -1) return; // Not a root folder, skip reordering
        
        e.preventDefault();
        
        const indicator = getDropIndicator();
        const folderItems = Array.from(folderList.querySelectorAll(':scope > .folder-item'));
        const mouseY = e.clientY;
        
        if (folderItems.length === 0) {
            removeDropIndicator();
            return;
        }
        
        // Find insertion point based on which gap/edge the mouse is closest to
        let insertBefore = null;
        targetIndex = folderItems.length; // Default to end
        
        for (let i = 0; i < folderItems.length; i++) {
            const item = folderItems[i];
            const rect = item.getBoundingClientRect();
            
            // For the first item, check if we're in the upper half
            if (i === 0 && mouseY < rect.top + rect.height * 0.5) {
                insertBefore = item;
                targetIndex = 0;
                break;
            }
            
            // For other items, check if mouse is above the midpoint
            if (mouseY < rect.top + rect.height * 0.5) {
                insertBefore = item;
                targetIndex = i;
                break;
            }
        }
        
        // Don't show indicator if dropping at same position
        if (targetIndex === draggedFolderIndex || targetIndex === draggedFolderIndex + 1) {
            removeDropIndicator();
            return;
        }
        
        // Insert indicator
        if (insertBefore) {
            folderList.insertBefore(indicator, insertBefore);
        } else {
            folderList.appendChild(indicator);
        }
    });
    
    folderList.addEventListener('dragleave', (e) => {
        // Only remove if leaving the folder list entirely
        if (!folderList.contains(e.relatedTarget)) {
            removeDropIndicator();
        }
    });
    
    folderList.addEventListener('drop', (e) => {
        if (!state.draggedFolderId) {
            removeDropIndicator();
            return;
        }
        
        const draggedFolderIndex = state.folders.findIndex(f => f.id === state.draggedFolderId);
        if (draggedFolderIndex === -1) {
            removeDropIndicator();
            return;
        }
        
        e.preventDefault();
        
        if (targetIndex !== -1 && targetIndex !== draggedFolderIndex && targetIndex !== draggedFolderIndex + 1) {
            reorderFolder(state.draggedFolderId, targetIndex);
        }
        
        removeDropIndicator();
    });
    
    folderList.dataset.reorderReady = 'true';
}

function createVisualClone(originalId, title, url, container, folderId, prepend = false, depth = 0) {
    if (container.querySelector(`[data-clone-id="${originalId}"]`)) return;
    const clone = document.createElement('div');
    clone.className = 'cloned-chat-item';
    clone.dataset.cloneId = originalId;
    if (url) clone.dataset.chatUrl = url; // Guardar URL para navegación directa
    clone.setAttribute('draggable', 'true'); 
    // Add indentation based on folder depth
    clone.style.marginLeft = (25 + depth * 16) + 'px';
    if (state.activeChatId === originalId) {
        clone.classList.add('active');
    }
    const titleSpan = document.createElement('span');
    titleSpan.className = 'cloned-chat-title';
    titleSpan.title = title;
    titleSpan.textContent = title; 
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-chat-btn';
    removeBtn.title = 'Remove from folder';
    removeBtn.textContent = '×';
    clone.append(titleSpan, removeBtn);
    
    // Click en el título o en el clone para navegar
    const navigateToChat = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveChat(clone, originalId, url, true);
    };
    
    titleSpan.onclick = navigateToChat;
    clone.onclick = (e) => {
        // Solo navegar si no se clickeó en el botón de eliminar
        if (!e.target.closest('.remove-chat-btn')) {
            navigateToChat(e);
        }
    };
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeChatFromFolder(originalId, folderId, clone);
    };
    clone.addEventListener('dragstart', (e) => {
        state.draggedChatId = originalId; 
        e.dataTransfer.effectAllowed = "move";
        clone.style.opacity = "0.5";
    });
    clone.addEventListener('dragend', () => {
        clone.style.opacity = "1";
        state.draggedChatId = null;
    });
    if (prepend && container.firstChild) {
        container.insertBefore(clone, container.firstChild);
    } else {
        container.appendChild(clone);
    }
}

// --- ACTIONS ---

// Función para buscar un chat scrolleando el sidebar
async function findChatByScrolling(originalId, chatTitle) {
    console.log('[Folders for Gemini] Starting scroll search for:', chatTitle || originalId);
    
    // Crear overlay para ocultar el scrolling
    const overlay = document.createElement('div');
    overlay.className = 'gemini-search-overlay';
    overlay.innerHTML = `
        <div class="search-spinner"></div>
        <div class="search-text">Loading chat...</div>
    `;
    document.body.appendChild(overlay);
    
    // Función para encontrar el elemento scrollable real probando el scroll
    function findScrollableContainer() {
        // Empezar desde un chat item y subir buscando el contenedor scrollable
        const anyChat = document.querySelector('[data-test-id="conversation"]');
        if (!anyChat) {
            console.log('[Folders for Gemini] No chat items found to detect scroll container');
            return null;
        }
        
        let current = anyChat.parentElement;
        while (current && current !== document.body && current !== document.documentElement) {
            // Probar si el scroll funciona en la práctica
            const scrollHeight = current.scrollHeight;
            const clientHeight = current.clientHeight;
            
            if (scrollHeight > clientHeight + 10) { // Al menos 10px de diferencia
                const oldScroll = current.scrollTop;
                current.scrollTop = oldScroll + 10;
                const scrolled = current.scrollTop !== oldScroll;
                current.scrollTop = oldScroll; // Restaurar
                
                if (scrolled) {
                    console.log('[Folders for Gemini] Found scrollable container:', 
                        current.tagName, current.className.slice(0, 50), 'scrollHeight:', scrollHeight);
                    return current;
                }
            }
            
            current = current.parentElement;
        }
        
        console.log('[Folders for Gemini] No scrollable container found by traversal');
        return null;
    }
    
    const scrollContainer = findScrollableContainer();
    
    if (!scrollContainer) {
        console.log('[Folders for Gemini] No scroll container found');
        overlay.remove();
        return null;
    }
    
    // Guardar posición original
    const originalScrollTop = scrollContainer.scrollTop;
    console.log('[Folders for Gemini] Original scroll position:', originalScrollTop);
    
    // Scrollear al TOP para empezar desde el principio
    scrollContainer.scrollTop = 0;
    await new Promise(r => setTimeout(r, 200));
    
    let attempts = 0;
    const maxAttempts = 300;
    let lastChatCount = 0;
    let noNewChatsCount = 0;
    let lastScrollTop = -1;
    
    while (attempts < maxAttempts) {
        // Buscar el chat en el DOM actual
        let chat = document.getElementById(originalId);
        
        // También intentar por título
        if (!chat && chatTitle) {
            const allChats = document.querySelectorAll(SELECTORS.chatItem);
            for (const c of allChats) {
                const titleEl = c.querySelector(SELECTORS.titleText);
                if (titleEl && titleEl.innerText.trim() === chatTitle) {
                    chat = c;
                    break;
                }
            }
        }
        
        if (chat) {
            console.log('[Folders for Gemini] Chat found after', attempts, 'scroll attempts');
            const anchor = chat.querySelector('a');
            if (anchor) {
                const url = anchor.getAttribute('href');
                if (url) {
                    if (!chat.id) assignChatId(chat);
                    scrollContainer.scrollTop = originalScrollTop;
                    overlay.remove();
                    return { url, chatId: chat.id };
                }
            }
            scrollContainer.scrollTop = originalScrollTop;
            overlay.remove();
            return { element: chat, chatId: chat.id };
        }
        
        // Contar chats actuales
        const currentChatCount = document.querySelectorAll(SELECTORS.chatItem).length;
        
        // Scrollear
        const prevScrollTop = scrollContainer.scrollTop;
        const scrollAmount = 500;
        scrollContainer.scrollTop += scrollAmount;
        
        // Esperar para lazy loading
        await new Promise(r => setTimeout(r, 100));
        
        const currentScrollTop = scrollContainer.scrollTop;
        
        // Log cada 20 intentos para debugging
        if (attempts % 20 === 0) {
            console.log('[Folders for Gemini] Scroll attempt', attempts, 
                'scrollTop:', currentScrollTop, 'chats:', currentChatCount);
        }
        
        // Detectar si llegamos al final
        if (currentChatCount === lastChatCount && currentScrollTop === prevScrollTop) {
            noNewChatsCount++;
            if (noNewChatsCount > 10) {
                console.log('[Folders for Gemini] Reached end of list');
                break;
            }
        } else {
            noNewChatsCount = 0;
        }
        
        lastChatCount = currentChatCount;
        lastScrollTop = currentScrollTop;
        attempts++;
    }
    
    console.log('[Folders for Gemini] Chat not found after', attempts, 'attempts');
    scrollContainer.scrollTop = originalScrollTop;
    overlay.remove();
    return null;
}

function setActiveChat(cloneElement, originalId, chatUrl, shouldNavigate = true) {
    state.activeChatId = originalId;
    saveState();
    renderActiveState();
    
    if (shouldNavigate) {
        // ESTRATEGIA 1: Navegar directamente por URL pasada
        if (chatUrl) {
            window.location.href = chatUrl;
            return;
        }
        
        // ESTRATEGIA 2: Intentar obtener URL del dataset del clone
        if (cloneElement && cloneElement.dataset.chatUrl) {
            window.location.href = cloneElement.dataset.chatUrl;
            return;
        }
        
        // ESTRATEGIA 3: Buscar en el state (incluyendo subfolders)
        let foundUrl = null;
        let chatTitle = null;
        
        function searchInFolders(folders) {
            for (const folder of folders) {
                const chat = folder.chats.find(c => c.originalId === originalId);
                if (chat) {
                    if (chat.url) {
                        foundUrl = chat.url;
                        return true;
                    }
                    chatTitle = chat.title;
                }
                if (folder.subfolders && folder.subfolders.length > 0) {
                    if (searchInFolders(folder.subfolders)) return true;
                }
            }
            return false;
        }
        searchInFolders(state.folders);
        
        if (foundUrl) {
            window.location.href = foundUrl;
            return;
        }
        
        // ESTRATEGIA 4: Buscar el original en el DOM por ID
        let original = document.getElementById(originalId);
        
        // ESTRATEGIA 5: Si no está por ID, buscar por título en DOM actual
        if (!original && chatTitle) {
            const allChats = document.querySelectorAll(SELECTORS.chatItem);
            for (const chat of allChats) {
                const titleEl = chat.querySelector(SELECTORS.titleText);
                if (titleEl && titleEl.innerText.trim() === chatTitle) {
                    original = chat;
                    break;
                }
            }
        }
        
        if (original) {
            // Temporalmente hacerlo visible para obtener URL
            const wasHidden = original.style.display === 'none';
            if (wasHidden) original.style.display = '';
            
            const anchor = original.querySelector('a');
            if (anchor) {
                const href = anchor.getAttribute('href');
                if (href) {
                    // Guardar la URL para futuras navegaciones
                    for (const folder of state.folders) {
                        const chat = folder.chats.find(c => c.originalId === originalId);
                        if (chat && !chat.url) {
                            chat.url = href;
                            saveState();
                            break;
                        }
                    }
                    if (cloneElement) cloneElement.dataset.chatUrl = href;
                    
                    window.location.href = href;
                    return;
                }
            }
            
            // Fallback: click directo
            isProgrammaticClick = true;
            if (anchor) anchor.click();
            else original.click();
            setTimeout(() => { isProgrammaticClick = false; }, 50);
            return;
        }
        
        // ESTRATEGIA 6: Chat no está en DOM - scrollear para buscarlo
        if (chatTitle || originalId) {
            // Mostrar indicador de búsqueda
            if (cloneElement) {
                cloneElement.classList.add('searching');
                cloneElement.title = 'Searching for chat...';
            }
            
            findChatByScrolling(originalId, chatTitle).then(result => {
                if (cloneElement) {
                    cloneElement.classList.remove('searching');
                    cloneElement.title = chatTitle || '';
                }
                
                if (result && result.url) {
                    // Guardar la URL para futuras navegaciones (incluyendo subfolders)
                    function updateChatInFolders(folders) {
                        for (const folder of folders) {
                            const chat = folder.chats.find(c => c.originalId === originalId || c.title === chatTitle);
                            if (chat) {
                                chat.url = result.url;
                                if (result.chatId && chat.originalId !== result.chatId) {
                                    const oldClone = document.querySelector(`.cloned-chat-item[data-clone-id="${chat.originalId}"]`);
                                    if (oldClone) {
                                        oldClone.dataset.cloneId = result.chatId;
                                        oldClone.dataset.chatUrl = result.url;
                                    }
                                    chat.originalId = result.chatId;
                                }
                                saveState();
                                return true;
                            }
                            if (folder.subfolders && updateChatInFolders(folder.subfolders)) return true;
                        }
                        return false;
                    }
                    updateChatInFolders(state.folders);
                    
                    if (cloneElement) cloneElement.dataset.chatUrl = result.url;
                    
                    window.location.href = result.url;
                } else if (result && result.element) {
                    // Encontramos el elemento pero sin URL directa, hacer click
                    isProgrammaticClick = true;
                    const anchor = result.element.querySelector('a');
                    if (anchor) {
                        const href = anchor.getAttribute('href');
                        if (href) {
                            window.location.href = href;
                        } else {
                            anchor.click();
                        }
                    } else {
                        result.element.click();
                    }
                    setTimeout(() => { isProgrammaticClick = false; }, 50);
                } else {
                    // No encontrado - mostrar mensaje
                    console.warn('Chat not found:', chatTitle || originalId);
                    alert('Could not find this chat. It may have been deleted or renamed.');
                }
            });
        }
    }
}

function moveChatToFolder(chatId, targetFolderId, targetFolderDOM, isRestoring = false) {
    if (!chatId) return;
    
    // Find source folder recursively (chat might be in any nested folder)
    let existingChatData = null;
    function findSourceFolder(folders) {
        for (const f of folders) {
            const chatData = f.chats.find(c => c.originalId === chatId);
            if (f.id !== targetFolderId && chatData) {
                existingChatData = chatData; // Save the chat data before removing
                return f;
            }
            if (f.subfolders && f.subfolders.length > 0) {
                const found = findSourceFolder(f.subfolders);
                if (found) return found;
            }
        }
        return null;
    }
    
    const sourceFolder = findSourceFolder(state.folders);
    if (sourceFolder && !isRestoring) {
        const oldClone = document.querySelector(`.folder-item[data-folder-id="${sourceFolder.id}"] .cloned-chat-item[data-clone-id="${chatId}"]`);
        if (oldClone) oldClone.remove();
        sourceFolder.chats = sourceFolder.chats.filter(c => c.originalId !== chatId);
        const oldFolderDOM = document.querySelector(`.folder-item[data-folder-id="${sourceFolder.id}"]`);
        if(oldFolderDOM) {
            const countBadge = oldFolderDOM.querySelector('.count-badge');
            if (countBadge) {
                const subCount = sourceFolder.subfolders?.length || 0;
                countBadge.textContent = subCount > 0 ? `${sourceFolder.chats.length}+${subCount}` : sourceFolder.chats.length;
            }
        }
    }
    const originalChat = document.getElementById(chatId);
    if (originalChat) originalChat.style.display = 'none';
    if (isRestoring) return;
    
    // Find target folder recursively
    const targetFolderState = findFolderById(targetFolderId);
    if (!targetFolderState) return;
    if (targetFolderState.chats.find(c => c.originalId === chatId)) return;
    
    // Use existing chat data if moving between folders, otherwise get from DOM
    let chatTitle = existingChatData?.title || "Chat";
    let chatUrl = existingChatData?.url || null;
    
    if (originalChat) {
        const titleEl = originalChat.querySelector(SELECTORS.titleText);
        if (titleEl) chatTitle = titleEl.innerText;
        
        // CRÍTICO: Guardar la URL del chat para navegación directa
        const anchor = originalChat.querySelector('a');
        if (anchor) {
            chatUrl = anchor.getAttribute('href') || chatUrl;
        }
    }
    
    const contentZone = targetFolderDOM.querySelector('.folder-content');
    const depth = parseInt(targetFolderDOM.dataset.folderDepth || '0');
    createVisualClone(chatId, chatTitle, chatUrl, contentZone, targetFolderId, true, depth);
    targetFolderState.chats.unshift({ originalId: chatId, title: chatTitle, url: chatUrl });
    
    const currentUrlId = getChatIdFromUrl(window.location.href);
    let originalIdFromUrl = null;
    if (originalChat) {
        const anchor = originalChat.querySelector('a');
        if (anchor) originalIdFromUrl = getChatIdFromUrl(anchor.getAttribute('href') || '');
    }
    if (currentUrlId && originalIdFromUrl === currentUrlId) {
        state.activeChatId = chatId;
        renderActiveState();
    }

    saveState();
    const countBadge = targetFolderDOM.querySelector('.count-badge');
    if (countBadge) {
        const subCount = targetFolderState.subfolders?.length || 0;
        countBadge.textContent = subCount > 0 ? `${targetFolderState.chats.length}+${subCount}` : targetFolderState.chats.length;
    }
    if (!targetFolderDOM.classList.contains('open')) {
        targetFolderDOM.classList.add('open');
        targetFolderState.isOpen = true;
        saveState();
    }
}

function removeChatFromFolder(originalId, folderId, cloneDOMElement) {
    const folderItem = cloneDOMElement.closest('.folder-item');
    cloneDOMElement.remove();
    const original = document.getElementById(originalId);
    if (original) {
        original.style.display = ''; 
        original.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Use recursive finder for nested folders
    const folderState = findFolderById(folderId);
    if (folderState) {
        folderState.chats = folderState.chats.filter(c => c.originalId !== originalId);
        if (state.activeChatId === originalId) {
            state.activeChatId = null;
            saveState();
        } else {
            saveState();
        }
        const countBadge = folderItem.querySelector('.count-badge');
        if (countBadge) {
            const subCount = folderState.subfolders?.length || 0;
            countBadge.textContent = subCount > 0 ? `${folderState.chats.length}+${subCount}` : folderState.chats.length;
        }
    }
}

function deleteFolder(folderId, folderDOMElement) {
    // Find folder recursively
    const folderData = findFolderById(folderId);
    
    // Collect all chat IDs that need to be restored
    const chatsToRestore = [];
    function collectChatsRecursive(folder) {
        if (folder.chats) {
            folder.chats.forEach(chat => {
                chatsToRestore.push(chat.originalId);
                if (state.activeChatId === chat.originalId) state.activeChatId = null;
            });
        }
        if (folder.subfolders) {
            folder.subfolders.forEach(sub => collectChatsRecursive(sub));
        }
    }
    
    if (folderData) {
        collectChatsRecursive(folderData);
    }
    
    const currentHeight = folderDOMElement.getBoundingClientRect().height;
    folderDOMElement.style.height = currentHeight + 'px';
    folderDOMElement.offsetHeight; 
    folderDOMElement.classList.add('deleting');
    setTimeout(() => {
        // Remove from state using helper
        removeFolderFromParent(folderId);
        saveState();
        folderDOMElement.remove();
        checkEmptyState();
        
        // Now restore visibility of original chats
        // This needs to happen AFTER state is saved so forceHideOriginals won't hide them again
        chatsToRestore.forEach(chatId => {
            const original = document.getElementById(chatId);
            if (original) {
                original.style.removeProperty('display');
                original.style.display = '';
            }
        });
        
        // Force a re-check of hidden originals
        forceHideOriginals();
    }, 300);
}

// --- MODALS (STANDARD) ---

function toggleAllFolders() {
    if (state.folders.length === 0) return;
    
    // Check if any folder is open (including subfolders)
    function checkAnyOpen(folders) {
        for (const f of folders) {
            if (f.isOpen) return true;
            if (f.subfolders && checkAnyOpen(f.subfolders)) return true;
        }
        return false;
    }
    
    const anyOpen = checkAnyOpen(state.folders);
    const newState = !anyOpen;
    
    // Set all folders recursively
    function setAllFolders(folders, isOpen) {
        folders.forEach(folder => {
            folder.isOpen = isOpen;
            const folderDOM = document.querySelector(`.folder-item[data-folder-id="${folder.id}"]`);
            if (folderDOM) {
                if (isOpen) {
                    folderDOM.classList.add('open');
                } else {
                    folderDOM.classList.remove('open');
                }
            }
            if (folder.subfolders) {
                setAllFolders(folder.subfolders, isOpen);
            }
        });
    }
    
    setAllFolders(state.folders, newState);
    
    // Update button state
    updateCollapseButtonState();
    
    saveState();
}

function updateCollapseButtonState() {
    const collapseBtn = document.querySelector('.collapse-all-btn');
    if (!collapseBtn) return;
    
    // Check recursively if any folder is open
    function checkAnyOpen(folders) {
        for (const f of folders) {
            if (f.isOpen) return true;
            if (f.subfolders && checkAnyOpen(f.subfolders)) return true;
        }
        return false;
    }
    
    const anyOpen = checkAnyOpen(state.folders);
    
    if (anyOpen) {
        collapseBtn.title = 'Collapse all folders';
        collapseBtn.classList.remove('expand-mode');
    } else {
        collapseBtn.title = 'Expand all folders';
        collapseBtn.classList.add('expand-mode');
    }
}

function addNewFolder() {
    showDialog({
        title: 'New Folder',
        inputValue: 'New Project',
        showColors: true,
        confirmText: 'Create',
        onConfirm: (name, color) => {
            const folder = { id: 'f_' + Date.now(), name, color, isOpen: true, chats: [], subfolders: [] };
            state.folders.push(folder);
            saveState();
            document.getElementById('folder-list-root')?.appendChild(renderSingleFolder(folder, 0));
        }
    });
}

function showDialog({ title, inputValue = '', showColors = false, confirmText = 'Save', dangerMode = false, message = '', onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let selectedColor = FOLDER_COLORS[6]; // Color por defecto
    
    // El input de color ahora está inline en el HTML del botón custom
    
    // HTML para el selector de colores (Standard + Custom)
    let colorGridHtml = '';
    if (showColors) {
        // 1. Colores predefinidos
        const standardColors = FOLDER_COLORS.map(c => 
            `<div class="modal-color-circle${c === selectedColor ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>`
        ).join('');
        
        // 2. Botón de color personalizado (Arcoíris) - CON INPUT ENCIMA
        // El input está posicionado encima del botón, es transparente pero clickeable
        const customBtn = `
            <div class="modal-color-circle custom-picker-btn" title="Custom Color" style="position:relative;overflow:visible;">
                <input type="color" class="custom-color-input-overlay" value="${selectedColor}" 
                    style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;border:none;padding:0;">
            </div>`;
        
        colorGridHtml = `
            <div class="modal-colors-title">Color</div>
            <div class="modal-color-grid">
                ${standardColors}
                ${customBtn}
            </div>
        `;
    }

    overlay.innerHTML = `
        <div class="modal-container">
            <h3 class="modal-title">${title}</h3>
            ${message ? `<p class="modal-text">${message}</p>` : ''}
            ${inputValue !== null && !message ? `
                <div class="modal-input-group">
                    <input class="modal-input" type="text" value="${inputValue}" placeholder="Folder Name">
                </div>
            ` : ''}
            ${showColors ? colorGridHtml : ''}
            <div class="modal-actions">
                <button class="modal-btn cancel">Cancel</button>
                <button class="modal-btn ${dangerMode ? 'danger' : 'confirm'}">${confirmText}</button>
            </div>
        </div>
    `;

    const input = overlay.querySelector('.modal-input');
    const confirmBtn = overlay.querySelector('.modal-btn.confirm, .modal-btn.danger');
    const cancelBtn = overlay.querySelector('.modal-btn.cancel');

    // Lógica de selección de color
    if (showColors) {
        const circles = overlay.querySelectorAll('.modal-color-circle:not(.custom-picker-btn)');
        const customBtnElement = overlay.querySelector('.custom-picker-btn');
        const colorInput = overlay.querySelector('.custom-color-input-overlay');

        // A. Click en colores estándar
        circles.forEach(c => {
            c.onclick = () => {
                overlay.querySelectorAll('.modal-color-circle').forEach(x => x.classList.remove('selected'));
                c.classList.add('selected');
                selectedColor = c.dataset.color;
                // Reseteamos el borde del botón custom
                customBtnElement.style.background = 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)';
                customBtnElement.classList.remove('selected');
                // Sincronizar input nativo
                if (colorInput) colorInput.value = selectedColor;
            };
        });

        // B. El input está directamente encima del botón, el usuario hace clic en él
        // Cuando el usuario elige un color en el selector nativo
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                const newColor = e.target.value;
                selectedColor = newColor;
                
                // UI Update: Quitar selección de otros
                overlay.querySelectorAll('.modal-color-circle').forEach(x => x.classList.remove('selected'));
                
                // El botón custom ahora muestra el color seleccionado sólido
                customBtnElement.style.background = newColor;
                customBtnElement.classList.add('selected');
            });
            
            colorInput.addEventListener('change', (e) => {
                selectedColor = e.target.value;
            });
        }
    }

    const close = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 150);
    };

    cancelBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    
    confirmBtn.onclick = () => {
        const val = input?.value.trim();
        // Permitimos guardar sin nombre si es solo edición de color, pero si hay input debe tener texto
        if (input && !val) { input.focus(); return; }
        onConfirm(val, selectedColor);
        close();
    };

    if (input) {
        input.onkeyup = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') close();
        };
    }

    document.body.appendChild(overlay);
    requestAnimationFrame(() => input?.select());
}

function showFolderMenu(folder, folderEl, triggerBtn, depth = 0) {
    // Limpiar menús previos
    document.querySelector('.folder-options-dropdown')?.remove();

    const dropdown = document.createElement('div');
    dropdown.className = 'folder-options-dropdown';

    // --- SECCIÓN DE COLORES ---
    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';

    // El input de color ahora está inline dentro del botón custom

    // 2. Colores Predefinidos
    FOLDER_COLORS.forEach(c => {
        const circle = document.createElement('div');
        circle.className = 'color-option-circle';
        circle.style.backgroundColor = c;
        if (folder.color === c) circle.style.border = '2px solid white';
        
        circle.onclick = (e) => {
            e.stopPropagation();
            folder.color = c;
            saveState();
            folderEl.querySelector('.folder-icon').style.color = c;
            dropdown.remove();
        };
        colorGrid.appendChild(circle);
    });

    // 3. Botón Custom (Arcoíris) - Con input transparente encima
    const customBtn = document.createElement('div');
    customBtn.className = 'color-option-circle custom-picker-btn';
    customBtn.title = 'Custom Color';
    customBtn.style.position = 'relative';
    customBtn.style.overflow = 'visible';
    
    if (folder.color && !FOLDER_COLORS.includes(folder.color)) {
        customBtn.style.border = '2px solid white';
        customBtn.style.background = folder.color; 
    }

    // Input transparente posicionado encima del botón - clickeable directamente
    const colorInputOverlay = document.createElement('input');
    colorInputOverlay.type = 'color';
    colorInputOverlay.value = folder.color || '#afb2b0';
    colorInputOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;border:none;padding:0;';
    
    colorInputOverlay.addEventListener('input', (e) => {
        const newColor = e.target.value;
        folder.color = newColor;
        saveState();
        folderEl.querySelector('.folder-icon').style.color = newColor;
        customBtn.style.background = newColor;
        customBtn.style.border = '2px solid white';
    });
    
    colorInputOverlay.addEventListener('change', (e) => {
        dropdown.remove();
    });
    
    customBtn.appendChild(colorInputOverlay);
    colorGrid.appendChild(customBtn);

    dropdown.appendChild(colorGrid);

    // --- ADD SUBFOLDER OPTION ---
    const addSubfolder = document.createElement('div');
    addSubfolder.className = 'folder-option';
    addSubfolder.textContent = 'Add Subfolder';
    addSubfolder.onclick = () => {
        dropdown.remove();
        showDialog({
            title: 'New Subfolder',
            inputValue: 'New Subfolder',
            showColors: true,
            confirmText: 'Create',
            onConfirm: (name, color) => {
                const subfolder = { 
                    id: 'f_' + Date.now(), 
                    name, 
                    color, 
                    isOpen: true, 
                    chats: [],
                    subfolders: []
                };
                if (!folder.subfolders) folder.subfolders = [];
                folder.subfolders.push(subfolder);
                folder.isOpen = true; // Open parent to show new subfolder
                saveState();
                refreshFolderUI();
            }
        });
    };
    dropdown.appendChild(addSubfolder);

    // --- MOVE TO ROOT OPTION (only for nested folders) ---
    if (depth > 0) {
        const moveToRoot = document.createElement('div');
        moveToRoot.className = 'folder-option';
        moveToRoot.textContent = 'Move folder to root';
        moveToRoot.onclick = () => {
            dropdown.remove();
            const movedFolder = removeFolderFromParent(folder.id);
            if (movedFolder) {
                state.folders.push(movedFolder);
                saveState();
                refreshFolderUI();
            }
        };
        dropdown.appendChild(moveToRoot);
    }

    // --- SECCIÓN RENAME ---
    const rename = document.createElement('div');
    rename.className = 'folder-option';
    rename.textContent = 'Rename';
    rename.onclick = () => {
        dropdown.remove();
        showDialog({
            title: 'Rename Folder',
            inputValue: folder.name,
            onConfirm: (name) => {
                folder.name = name;
                saveState();
                folderEl.querySelector('.folder-name').textContent = name;
            }
        });
    };
    dropdown.appendChild(rename);

    // --- SECCIÓN DELETE ---
    const del = document.createElement('div');
    del.className = 'folder-option delete';
    del.textContent = 'Delete Folder';
    del.onclick = () => {
        dropdown.remove();
        showDialog({
            title: 'Delete Folder?',
            message: `Are you sure you want to delete "${folder.name}"?${folder.subfolders?.length > 0 ? ' This will also delete all subfolders.' : ''}`,
            confirmText: 'Delete',
            dangerMode: true,
            inputValue: null,
            onConfirm: () => deleteFolder(folder.id, folderEl)
        });
    };
    dropdown.appendChild(del);

    document.body.appendChild(dropdown);

    // Posicionamiento
    const rect = triggerBtn.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    
    let top = rect.bottom + 5;
    let left = rect.left;

    if (left + dropdownRect.width > window.innerWidth) left = rect.right - dropdownRect.width;
    if (top + dropdownRect.height > window.innerHeight) top = rect.top - dropdownRect.height - 5;

    dropdown.style.top = top + 'px';
    dropdown.style.left = left + 'px';

    // Listener para cerrar al hacer clic fuera
    requestAnimationFrame(() => {
        const closeMenu = (e) => {
            if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
                dropdown.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    });
}

// --- UTILS (SCROLL, DRAG) ---

function getScrollParent(node) {
    if (!node) return null;
    if (node.scrollHeight > node.clientHeight && node.clientHeight > 0) {
        const style = window.getComputedStyle(node);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node;
    }
    return getScrollParent(node.parentNode) || document.body;
}

function setupAutoScroll() {
    if (window._geminiScrollHandler) {
        document.removeEventListener('dragover', window._geminiScrollHandler);
        document.removeEventListener('dragend', window._geminiScrollEndHandler);
    }

    window._geminiScrollHandler = (e) => {
        if (!state.draggedChatId) return;
        
        // FIX SCROLL: En lugar de buscar 'sidebar', buscamos un ancla segura dentro de la lista.
        // Usamos nuestro contenedor de carpetas o el título de recientes.
        const anchor = document.getElementById('gemini-folder-container') || 
                       document.querySelector(SELECTORS.recentTitleContainer);
        
        // Buscamos hacia arriba quién tiene el scroll
        const scrollContainer = getScrollParent(anchor);
        
        if (!scrollContainer) return;

        const rect = scrollContainer.getBoundingClientRect();
        const mouseY = e.clientY;
        
        // Zonas de activación (60px desde arriba o abajo)
        const SCROLL_ZONE = 60; 
        const MAX_SPEED = 15; // Un poco más rápido para que se sienta fluido

        if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
        
        let speed = 0;

        // Calcular velocidad según la posición del ratón
        if (mouseY < rect.top + SCROLL_ZONE) {
            // Scroll hacia ARRIBA
            const distance = (rect.top + SCROLL_ZONE) - mouseY;
            const intensity = Math.pow(Math.min(distance / SCROLL_ZONE, 1), 2);
            speed = - (MAX_SPEED * intensity); 
        } else if (mouseY > rect.bottom - SCROLL_ZONE) {
            // Scroll hacia ABAJO
            const distance = mouseY - (rect.bottom - SCROLL_ZONE);
            const intensity = Math.pow(Math.min(distance / SCROLL_ZONE, 1), 2);
            speed = (MAX_SPEED * intensity); 
        }

        if (speed !== 0) {
            const scrollStep = () => {
                scrollContainer.scrollTop += speed;
                // Continuar mientras se arrastre y haya velocidad
                if (Math.abs(speed) > 0.1 && state.draggedChatId) { 
                   autoScrollFrame = requestAnimationFrame(scrollStep);
                }
            };
            autoScrollFrame = requestAnimationFrame(scrollStep);
        }
    };

    window._geminiScrollEndHandler = () => {
        if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
    };

    document.addEventListener('dragover', window._geminiScrollHandler);
    document.addEventListener('dragend', window._geminiScrollEndHandler);
}

function setupDraggableChats(container) {
    const chats = container.querySelectorAll(SELECTORS.chatItem);
    chats.forEach(chatEl => {
        if (!chatEl.dataset.clickListenerAdded) {
            chatEl.dataset.clickListenerAdded = "true";
        }
        if (chatEl.dataset.organizerReady) return;
        // Use assignChatId for consistent ID generation (handles CJK, etc.)
        assignChatId(chatEl);
        chatEl.setAttribute('draggable', 'true');
        chatEl.addEventListener('dragstart', (e) => {
            state.draggedChatId = chatEl.id;
            chatEl.classList.add('dragging-chat');
            e.dataTransfer.effectAllowed = "move";
        });
        chatEl.addEventListener('dragend', (e) => {
            chatEl.classList.remove('dragging-chat');
            state.draggedChatId = null;
        });
        chatEl.dataset.organizerReady = "true";
    });
    forceHideOriginals();
}

// --- START ---
init();