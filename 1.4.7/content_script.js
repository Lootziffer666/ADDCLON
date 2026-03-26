/**
 * XXL Prompt Manager - Content Script
 * Wrapped in IIFE to prevent global variable pollution
 */
(function () {
  'use strict';

  let sidebarVisible = false;
  let sidebarInitialized = false;
  let allExpanded = false;
  let currentSortOrder = 'newest';

  // Configuration constants
  const EXTENSION_URLS = {
    RATE: 'https://go.promptxxl.com/rate-extension',
    SUPPORT: 'https://go.promptxxl.com/support',
    SHARE: 'https://go.promptxxl.com/share-extension'
  };

  // Icon observer to detect removal by SPA frameworks
  let iconObserver = null;

  // Updated sanitizeInput for HTML attributes (keep minimal)
  function sanitizeInput(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    const reg = /[&<>"']/g;
    return str.replace(reg, (match) => map[match]);
  }

  // Fallback copy function for browsers without Clipboard API
  function fallbackCopy(text, copyButton) {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.style.position = 'fixed';
    tempTextArea.style.left = '-9999px';
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
      document.execCommand('copy');
      copyButton.textContent = chrome.i18n.getMessage("copiedButton");
      setTimeout(() => {
        copyButton.textContent = chrome.i18n.getMessage("copyButton");
      }, 2000);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(tempTextArea);
  }

  // Input validation constants
  const VALIDATION = {
    MAX_TITLE_LENGTH: 200,
    MAX_CONTENT_LENGTH: 50000,
    MAX_FOLDER_NAME_LENGTH: 100
  };

  // Input validation helper
  function validateInput(value, maxLength, fieldName) {
    if (!value || value.trim() === '') {
      return { valid: false, message: `${fieldName} cannot be empty.` };
    }
    if (value.length > maxLength) {
      return { valid: false, message: `${fieldName} is too long (max ${maxLength} characters).` };
    }
    return { valid: true, value: value.trim() };
  }

  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'openai-chat-prompts-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'Prompt Manager Sidebar');
    sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-header-left">
        <button id="settings-button" aria-label="Settings"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-settings"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
        <h2>${chrome.i18n.getMessage("sidebarHeader")}</h2>
      </div>
      <div class="sidebar-header-right">
        <button id="search-button-icon" class="header-icon" title="${chrome.i18n.getMessage("searchPromptsPlaceholder")}" aria-label="${chrome.i18n.getMessage("searchPromptsPlaceholder")}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
        <button id="add-prompt-button-icon" class="header-icon" title="${chrome.i18n.getMessage("addPromptButton")}" aria-label="${chrome.i18n.getMessage("addPromptButton")}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
        <button id="add-folder-button-icon" class="header-icon" title="${chrome.i18n.getMessage("addFolderButton")}" aria-label="${chrome.i18n.getMessage("addFolderButton")}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M20 14H4"></path></svg></button>
        <button id="close-sidebar" aria-label="Close sidebar">&times;</button>
      </div>
    </div>
    <!-- Start a new sidebar for settings -->
    <div class="settings-sidebar" id="settings-sidebar">
      <button id="close-settings" class="button-flex">${chrome.i18n.getMessage("closeSettings")}</button>
      <div class="settings-container">
        <div class="setting-icon">
          <span>${chrome.i18n.getMessage("showIconSwitch")}</span>
          <label class="switch">
            <input type="checkbox" id="show-icon-switch" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div id="icon-hidden-message" class="info-message" style="display: none;">
          ${chrome.i18n.getMessage("showIconSwitchOff")}
        </div>
        <div id="icon-drag-tip" class="info-message tip-message">
          💡 ${chrome.i18n.getMessage("iconDragTip")}
        </div>
        <div class="keyboard-shortcuts-section">
          <div class="shortcuts-header">${chrome.i18n.getMessage("keyboardShortcuts")}</div>
          <div class="shortcuts-list" id="shortcuts-list">
            <!-- Populated by JavaScript based on platform -->
          </div>
        </div>
       <button id="export-prompts">${chrome.i18n.getMessage("exportPrompts")}</button>
       <button id="import-prompts">${chrome.i18n.getMessage("importPrompts")}</button>
       <button id="rate-extension">${chrome.i18n.getMessage("rateExtension")}</button>
       <button id="support-extension">${chrome.i18n.getMessage("supportExtension")}</button>
       <button id="share-extension">${chrome.i18n.getMessage("shareExtension")}</button>
       <div class="version">${chrome.runtime.getManifest().version}</div>
      </div>
    </div>
    <!-- End a new sidebar for settings -->
    <div class="sidebar" id="sidebar">
      <!-- Tab container hidden until public prompts feature is ready -->
      <div class="tab-container" style="display: none;">
        <div id="private-prompts-tab" class="tab active">${chrome.i18n.getMessage("privatePromptsTab")}</div>
        <div id="public-prompts-tab" class="tab">${chrome.i18n.getMessage("publicPromptsTab")}</div>
      </div>
      <div class="content-container">
        <div id="private-prompts-content" class="tab-content active">
          <div class="search-container" id="search-container" style="display: none;">
            <input type="text" id="search-prompts" placeholder="${chrome.i18n.getMessage("searchPromptsPlaceholder")}" />
            <button id="clear-search" class="clear-search">&times;</button>
          </div>
          <div class="add-prompt" style="display: none;">
            <input type="text" id="new-prompt-title" placeholder="${chrome.i18n.getMessage("promptTitlePlaceholder")}" />
            <textarea id="new-prompt-text" placeholder="${chrome.i18n.getMessage("newPromptPlaceholder")}" rows="4" cols="30"></textarea>
            <select id="new-prompt-folder"></select>
            <button id="save-prompt">${chrome.i18n.getMessage("saveButton")}</button>
            <button id="cancel-add-prompt">${chrome.i18n.getMessage("hideButton")}</button>
          </div>
          <div id="folders-section">
            <div class="add-folder">
              <input type="text" id="new-folder-name" placeholder="${chrome.i18n.getMessage("folderNamePlaceholder")}" />
              <button id="save-folder">${chrome.i18n.getMessage("saveButton")}</button>
              <button id="cancel-add-folder">${chrome.i18n.getMessage("cancelButton")}</button>
            </div>
           <select id="folder-select-list"></select>
            <div id="folder-actions-container" style="display: none;">
              <button id="edit-folder-action">${chrome.i18n.getMessage("editButton")}</button>
              <button id="delete-folder-action">${chrome.i18n.getMessage("deleteButton")}</button>
            </div>
            <div id="prompt-controls-container">
              <button id="expand-all-button">
                <span class="expand-icon">▼</span>
                <span id="expand-all-text">${chrome.i18n.getMessage("expandAll")}</span>
              </button>
              <div id="sort-container">
                <label for="sort-prompts">${chrome.i18n.getMessage("sortBy")}:</label>
                <select id="sort-prompts">
                  <option value="newest">${chrome.i18n.getMessage("sortNewest")}</option>
                  <option value="oldest">${chrome.i18n.getMessage("sortOldest")}</option>
                  <option value="az">${chrome.i18n.getMessage("sortAZ")}</option>
                  <option value="za">${chrome.i18n.getMessage("sortZA")}</option>
                </select>
              </div>
            </div>
          </div>
          <div id="prompts-list"></div>
        </div>
        <div id="public-prompts-content" class="tab-content">
          <div class="public-prompts-content-info">${chrome.i18n.getMessage("publicPromptsComingSoon")}</div>
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(sidebar);
    return sidebar;
  }

  function createIcon() {
    const icon = document.createElement('div');
    icon.id = 'openai-chat-prompts-icon';
    icon.style.position = 'fixed';
    icon.style.right = '25px';
    icon.style.width = '48px';
    icon.style.height = '48px';
    icon.style.zIndex = '999';
    icon.style.cursor = 'pointer';
    icon.style.userSelect = 'none'; // Prevent text selection during drag
    icon.style.transition = 'opacity 0.2s ease'; // Smooth opacity transitions

    // Load saved position and visibility
    chrome.storage.local.get({ showIcon: true, iconPositionY: 80 }, (data) => {
      icon.style.display = data.showIcon ? 'block' : 'none';
      // Ensure position is within viewport bounds
      const maxY = window.innerHeight - 48;
      const savedY = Math.max(0, Math.min(data.iconPositionY, maxY));
      icon.style.top = savedY + 'px';
    });

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('viewBox', '0 0 1024 1024');

    svg.innerHTML = `<g id="svgg"><path fill="#71A89A" opacity="1.000000" stroke="none"
	d="
M701.000000,1025.000000
	C468.833344,1025.000000 237.166672,1024.989502 5.500042,1025.093506
	C1.750803,1025.095215 0.905801,1024.249146 0.906913,1020.500000
	C1.007246,682.166687 1.007246,343.833344 0.906913,5.500028
	C0.905801,1.750903 1.750902,0.905800 5.500028,0.906912
	C343.833344,1.007255 682.166687,1.007255 1020.500000,0.906912
	C1024.249146,0.905800 1025.094360,1.750902 1025.093262,5.500027
	C1024.992920,343.833344 1024.992798,682.166687 1025.093140,1020.500000
	C1025.094238,1024.249146 1024.249634,1025.098877 1020.499878,1025.094727
	C914.166687,1024.977173 807.833313,1025.000000 701.000000,1025.000000
z"/>
<path fill="#FFFFFF" opacity="1.000000" stroke="none"
	d="
M374.330261,717.828247
	C341.854248,714.262878 321.312378,696.548706 310.802734,666.594788
	C308.527344,660.109619 308.020294,653.251099 308.018951,646.414795
	C307.992584,511.582092 308.120087,376.749207 307.921021,241.916794
	C307.866089,204.700912 336.353271,178.878510 364.562469,173.329956
	C369.590881,172.340881 374.828339,172.054459 379.969604,172.051910
	C514.468933,171.985367 648.968262,171.984589 783.467651,172.009262
	C817.529053,172.015518 844.892212,193.435516 852.364868,225.964478
	C853.592224,231.307465 854.006714,236.812637 854.006409,242.325836
	C853.999023,376.991852 854.021301,511.657898 853.986450,646.323914
	C853.977600,680.576172 831.621033,709.185120 799.158630,716.443848
	C794.486694,717.488525 789.585388,717.934509 784.789795,717.937256
	C649.290466,718.014404 513.791138,717.999268 378.291748,717.993164
	C377.126282,717.993164 375.960785,717.911072 374.330261,717.828247
z"/>
<path fill="#FFFFFF" opacity="1.000000" stroke="none"
	d="
M172.069031,787.748291
	C172.028519,643.128662 172.014206,498.982941 172.000336,354.837219
	C171.998993,340.839233 172.097595,326.840088 171.931931,312.844086
	C171.890930,309.381073 172.447479,307.857300 176.478104,307.902618
	C195.972824,308.121918 215.471756,308.062866 234.968185,307.941589
	C238.170868,307.921631 239.611420,308.821716 239.252960,312.145294
	C239.075333,313.792358 239.226700,315.474792 239.226700,317.141205
	C239.226944,471.285675 239.226746,625.430176 239.227676,779.574646
	C239.227722,786.768494 239.232422,786.772400 246.579651,786.772461
	C400.890778,786.773193 555.201904,786.773010 709.513000,786.773621
	C711.179443,786.773621 712.851685,786.871948 714.510925,786.764221
	C717.022461,786.601135 718.045837,787.529602 718.035400,790.186096
	C717.956055,810.349548 717.952087,830.513611 718.040161,850.677002
	C718.052002,853.385864 716.993408,854.259521 714.500854,854.007812
	C713.676270,853.924500 712.835754,853.999695 712.002563,853.999695
	C555.525085,853.999756 399.047607,854.012085 242.570129,853.989990
	C208.483597,853.985168 181.199112,832.643127 173.656128,800.081055
	C172.760559,796.215027 172.597778,792.179321 172.069031,787.748291
z"/>
<path fill="#71A89A" opacity="1.000000" stroke="none"
	d="
M523.000122,410.774658
	C597.155151,410.774719 670.810242,410.773956 744.465271,410.776215
	C751.214050,410.776428 751.222107,410.785309 751.223511,417.495361
	C751.227478,436.325714 751.109070,455.157349 751.313171,473.985474
	C751.358215,478.142090 750.128662,479.310516 745.982910,479.306580
	C636.000305,479.202423 526.017639,479.202789 416.035095,479.305634
	C411.913361,479.309479 410.641632,478.184082 410.685883,474.003510
	C410.890564,454.675385 410.888641,435.342712 410.686859,416.014526
	C410.643463,411.858337 411.869476,410.672272 416.017334,410.689819
	C451.511047,410.839996 487.005707,410.775208 523.000122,410.774658
z"/>
<path fill="#71A89A" opacity="1.000000" stroke="none"
	d="
M536.000000,341.998749
	C495.687256,341.998596 455.874329,341.941925 416.062103,342.084351
	C412.017120,342.098846 410.628693,341.157257 410.679047,336.887848
	C410.902954,317.900330 410.900055,298.907227 410.681732,279.919586
	C410.632477,275.636627 412.087891,274.695160 416.108704,274.698700
	C526.051758,274.795502 635.994873,274.796539 745.937927,274.696045
	C750.019958,274.692322 751.362671,275.747620 751.315796,279.966156
	C751.104736,298.953979 751.092285,317.947052 751.323303,336.934418
	C751.376038,341.269379 749.870911,342.085449 745.891418,342.079102
	C676.094421,341.967438 606.297180,341.998596 536.000000,341.998749
z"/>
<path fill="#71A89A" opacity="1.000000" stroke="none"
	d="
M413.205139,546.835449
	C479.008575,546.793213 544.330688,546.822510 609.652466,546.688721
	C613.917358,546.679993 615.392883,547.639954 615.332642,552.184448
	C615.076599,571.511047 615.135071,590.843689 615.298584,610.172363
	C615.331055,614.002991 614.333374,615.314392 610.296326,615.307007
	C545.474365,615.188416 480.652100,615.195312 415.830048,615.294189
	C412.007599,615.300049 410.646881,614.344788 410.687836,610.298523
	C410.885223,590.803894 410.745789,571.306030 410.829315,551.809753
	C410.836792,550.064819 409.737183,547.594543 413.205139,546.835449
z"/></g>`;

    icon.appendChild(svg);

    // Drag functionality variables
    let isDragging = false;
    let hasDragged = false;
    let startY = 0;
    let startTop = 0;

    // Mouse down - start potential drag
    icon.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      hasDragged = false;
      startY = e.clientY;
      startTop = parseInt(icon.style.top) || 80;
      icon.style.cursor = 'grabbing';
      icon.style.opacity = '0.8';
    });

    // Mouse move - perform drag
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaY = e.clientY - startY;

      // Only consider it a drag if moved more than 5 pixels
      if (Math.abs(deltaY) > 5) {
        hasDragged = true;
      }

      // Calculate new position with bounds checking
      const newTop = startTop + deltaY;
      const maxY = window.innerHeight - 48; // 48 is icon height
      const boundedTop = Math.max(0, Math.min(newTop, maxY));

      icon.style.top = boundedTop + 'px';
    });

    // Mouse up - end drag and save position
    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;

      isDragging = false;
      icon.style.cursor = 'pointer';
      icon.style.opacity = '1';

      if (hasDragged) {
        // Save the new position
        const currentTop = parseInt(icon.style.top) || 80;
        chrome.storage.local.set({ iconPositionY: currentTop });
      }
    });

    // Click handler - only toggle sidebar if not dragging
    icon.addEventListener('click', (e) => {
      if (hasDragged) {
        // Prevent click action if we just finished dragging
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      toggleSidebar();
    });

    // Handle window resize - keep icon in bounds
    window.addEventListener('resize', () => {
      const currentTop = parseInt(icon.style.top) || 80;
      const maxY = window.innerHeight - 48;
      if (currentTop > maxY) {
        icon.style.top = maxY + 'px';
        chrome.storage.local.set({ iconPositionY: maxY });
      }
    });

    document.body.appendChild(icon);
    return icon;
  }

  function sanitizeForCSV(str) {
    if (typeof str !== 'string') {
      str = String(str);
    }
    // Check if the string contains a comma, a newline, or a double quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      // If it does, enclose the string in double quotes and escape any existing double quotes by doubling them
      return `"${str.replace(/"/g, '""')}"`;
    }
    // If it doesn't contain any special characters, return the original string
    return str;
  }


  function toggleSidebar() {
    const sidebar = document.getElementById('openai-chat-prompts-sidebar') || createSidebar();
    const icon = document.getElementById('openai-chat-prompts-icon') || createIcon();
    sidebarVisible = !sidebarVisible;
    sidebar.style.display = sidebarVisible ? 'block' : 'none';

    if (sidebarVisible) {
      chrome.storage.local.get({ lastSelectedFolderId: 'all', showIcon: true, sortOrder: 'newest' }, (data) => {
        currentFolderId = data.lastSelectedFolderId;
        currentSortOrder = data.sortOrder;
        const sortSelect = document.getElementById('sort-prompts');
        if (sortSelect) {
          sortSelect.value = currentSortOrder;
        }
        loadFolders();
        loadPrompts(data.lastSelectedFolderId);
        const showIconSwitch = document.getElementById('show-icon-switch');
        if (showIconSwitch) {
          showIconSwitch.checked = data.showIcon;
        }
      });
    }

    if (!sidebarInitialized) {
      // Populate keyboard shortcuts based on platform
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
        navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? '⌘' : 'Ctrl';
      const altKey = isMac ? '⌥' : 'Alt';

      const shortcutsList = document.getElementById('shortcuts-list');
      if (shortcutsList) {
        shortcutsList.innerHTML = `
          <div class="shortcut-item">
            <span class="shortcut-keys">${altKey}+P</span>
            <span class="shortcut-desc">${chrome.i18n.getMessage("shortcutToggleSidebar")}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-keys">${modKey}+F</span>
            <span class="shortcut-desc">${chrome.i18n.getMessage("shortcutSearch")}</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-keys">Esc</span>
            <span class="shortcut-desc">${chrome.i18n.getMessage("shortcutClose")}</span>
          </div>
        `;
      }

      // Close sidebar button functionality
      document.getElementById('close-sidebar').addEventListener('click', () => {
        sidebarVisible = false;
        sidebar.style.display = 'none';
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Alt+P to toggle sidebar (works globally)
        // Note: Ctrl+Shift+P conflicts with browser's Print dialog
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault();
          toggleSidebar();
          return;
        }

        // Remaining shortcuts only work when sidebar is visible
        if (!sidebarVisible) return;

        // Escape key to close sidebar
        if (e.key === 'Escape') {
          // If settings is visible, close settings first
          if (document.getElementById('settings-sidebar').style.display === 'block') {
            document.getElementById('settings-sidebar').style.display = 'none';
            document.getElementById('sidebar').style.display = 'block';
          } else {
            sidebarVisible = false;
            sidebar.style.display = 'none';
          }
        }

        // Ctrl+F (Windows/Linux) or Cmd+F (macOS) to toggle search (when sidebar is open)
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          const searchContainer = document.getElementById('search-container');
          const searchInput = document.getElementById('search-prompts');
          const searchButton = document.getElementById('search-button-icon');
          if (searchContainer && searchInput && document.getElementById('sidebar').style.display !== 'none') {
            e.preventDefault();
            // Toggle search visibility
            if (searchContainer.style.display === 'none') {
              searchContainer.style.display = 'block';
              searchButton.classList.add('active');
              searchInput.focus();
            } else {
              // If search has content, clear it first; otherwise hide
              if (searchInput.value.trim()) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
              } else {
                searchContainer.style.display = 'none';
                searchButton.classList.remove('active');
              }
            }
          }
        }
      });

      // Event listener Show and Hide the Settings Sidebar
      document.getElementById('settings-button').addEventListener('click', () => {
        // Check if the settings sidebar is currently visible
        if (document.getElementById('settings-sidebar').style.display === 'block') {
          // If it is visible, hide it and show the main sidebar
          document.getElementById('settings-sidebar').style.display = 'none';
          document.getElementById('sidebar').style.display = 'block';
        } else {
          // If it's not visible, hide the main sidebar and show the settings sidebar
          document.getElementById('sidebar').style.display = 'none';
          document.getElementById('settings-sidebar').style.display = 'block';
        }
      });

      document.getElementById('close-settings').addEventListener('click', () => {
        // Hide the settings sidebar and show the main sidebar
        document.getElementById('settings-sidebar').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
      });

      // Search button icon click handler - toggle search container
      document.getElementById('search-button-icon').addEventListener('click', () => {
        const searchContainer = document.getElementById('search-container');
        const searchInput = document.getElementById('search-prompts');
        const searchButton = document.getElementById('search-button-icon');

        if (searchContainer.style.display === 'none') {
          searchContainer.style.display = 'block';
          searchButton.classList.add('active');
          searchInput.focus();
        } else {
          // If search has content, clear it first; otherwise hide
          if (searchInput.value.trim()) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
          } else {
            searchContainer.style.display = 'none';
            searchButton.classList.remove('active');
          }
        }
      });

      // Show/hide icon switch functionality
      const showIconSwitch = document.getElementById('show-icon-switch');
      const iconHiddenMessage = document.getElementById('icon-hidden-message');
      const iconDragTip = document.getElementById('icon-drag-tip');
      showIconSwitch.addEventListener('change', (event) => {
        const showIcon = event.target.checked;
        chrome.storage.local.set({ showIcon: showIcon });
        const icon = document.getElementById('openai-chat-prompts-icon');
        if (icon) {
          icon.style.display = showIcon ? 'block' : 'none';
        }
        if (iconHiddenMessage) {
          iconHiddenMessage.style.display = showIcon ? 'none' : 'block';
        }
        if (iconDragTip) {
          iconDragTip.style.display = showIcon ? 'block' : 'none';
        }
      });

      //  Creating a downloadable CSV file when the 'Export Prompts' button is clicked
      document.getElementById('export-prompts').addEventListener('click', () => {
        chrome.storage.local.get(['prompts', 'folders'], (data) => {
          let prompts = data.prompts || [];
          let folders = data.folders || [];
          const folderMap = folders.reduce((map, folder) => {
            map[folder.id] = folder.name;
            return map;
          }, {});

          let csvContent = 'Title,Prompt,Folder\n' + prompts.map(prompt => {
            const folderName = prompt.folderId ? folderMap[prompt.folderId] || '' : '';
            return `${sanitizeForCSV(prompt.title)},${sanitizeForCSV(prompt.content)},${sanitizeForCSV(folderName)}`;
          }).join('\n');

          const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
          const encoder = new TextEncoder();
          const csvData = encoder.encode(csvContent);
          const blob = new Blob([bom, csvData], { type: 'text/csv;charset=utf-8;' });
          let url = URL.createObjectURL(blob);
          let link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', 'xxl-prompt-manager.csv');
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      });

      //  Rate Extension button click
      document.getElementById('rate-extension').addEventListener('click', function () {
        window.open(EXTENSION_URLS.RATE, '_blank');
      });

      //  Support button click
      document.getElementById('support-extension').addEventListener('click', function () {
        window.open(EXTENSION_URLS.SUPPORT, '_blank');
      });

      //  Share button click
      document.getElementById('share-extension').addEventListener('click', function () {
        window.open(EXTENSION_URLS.SHARE, '_blank');
      });

      // Import prompts from a CSV file
      document.getElementById('import-prompts').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);
          reader.onload = (readerEvent) => {
            const buffer = readerEvent.target.result;
            const decoder = new TextDecoder('utf-8');
            let csvData = decoder.decode(buffer);
            // Remove BOM if present
            if (csvData.startsWith('\uFEFF')) {
              csvData = csvData.substring(1);
            }
            const parsedData = parseCSV(csvData);
            if (parsedData.length > 0) {
              chrome.storage.local.get(['prompts', 'folders'], (data) => {
                let prompts = data.prompts || [];
                let folders = data.folders || [];

                const headers = Object.keys(parsedData[0]);
                const titleHeader = headers.find(h => h.toLowerCase() === 'title');
                const promptHeader = headers.find(h => h.toLowerCase() === 'prompt');
                const folderHeader = headers.find(h => h.toLowerCase() === 'folder');

                if (!titleHeader || !promptHeader) {
                  alert(chrome.i18n.getMessage("importErrorNoTitlePrompt"));
                  return;
                }

                parsedData.forEach((row, i) => {
                  const title = row[titleHeader];
                  const content = row[promptHeader];
                  const folderName = folderHeader ? (row[folderHeader] || '').trim() : '';

                  if (title && content) {
                    const newPrompt = { title: title.trim(), content: content.trim() };
                    if (folderName) {
                      let folder = folders.find(f => f.name === folderName);
                      if (!folder) {
                        folder = { id: Date.now() + i, name: folderName };
                        folders.push(folder);
                      }
                      newPrompt.folderId = folder.id;
                    }
                    prompts.push(newPrompt);
                  }
                });

                chrome.storage.local.set({ prompts, folders }, () => {
                  loadFolders();
                  loadPrompts();
                  alert(chrome.i18n.getMessage("importSuccess"));
                });
              });
            } else {
              alert(chrome.i18n.getMessage("importErrorParse"));
            }
          }
        };
        input.click();
      });

      function parseCSV(strData) {
        const CSVToArray = (data, delimiter) => {
          delimiter = delimiter || ",";
          const pattern = new RegExp(
            "(\\" + delimiter + "|\\r?\\n|\\r|^)" +
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
            "([^\"\\" + delimiter + "\\r\\n]*))",
            "gi"
          );
          let arrData = [[]];
          let arrMatches = null;
          while (arrMatches = pattern.exec(data)) {
            const strMatchedDelimiter = arrMatches[1];
            if (strMatchedDelimiter.length && strMatchedDelimiter !== delimiter) {
              arrData.push([]);
            }
            let strMatchedValue;
            if (arrMatches[2]) {
              strMatchedValue = arrMatches[2].replace(new RegExp("\"\"", "g"), "\"");
            } else {
              strMatchedValue = arrMatches[3];
            }
            arrData[arrData.length - 1].push(strMatchedValue);
          }
          return arrData;
        };

        const arr = CSVToArray(strData);
        const result = [];
        if (!arr || arr.length < 2) {
          return result;
        }

        if (arr[arr.length - 1].length === 1 && arr[arr.length - 1][0] === '') {
          arr.pop();
        }

        const headers = arr[0].map(h => h.trim());

        for (let i = 1; i < arr.length; i++) {
          const row = arr[i];
          if (row.length === 1 && row[0] === '') continue; // Skip empty lines
          if (row.length !== headers.length) continue; // Skip malformed rows
          const obj = {};
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = row[j];
          }
          result.push(obj);
        }
        return result;
      }


      // Implement the search functionality
      document.getElementById('search-prompts').addEventListener('input', (event) => {
        const query = event.target.value.toLowerCase();
        const prompts = document.querySelectorAll('#prompts-list .prompt-item');
        prompts.forEach((prompt) => {
          if (prompt.innerText.toLowerCase().includes(query)) {
            prompt.style.display = 'block';
          } else {
            prompt.style.display = 'none';
          }
        });
      });

      // Show the add prompt form when the button is clicked
      document.getElementById('add-prompt-button-icon').addEventListener('click', () => {
        const folderSelect = document.getElementById('new-prompt-folder');
        folderSelect.innerHTML = `<option value="">${chrome.i18n.getMessage("selectFolder")}</option>`;
        folders.forEach(folder => {
          const option = document.createElement('option');
          option.value = folder.id;
          option.textContent = folder.name;
          folderSelect.appendChild(option);
        });
        document.querySelector('.add-prompt').style.display = 'flex';
      });

      // Hide the add prompt form when the cancel button is clicked
      document.getElementById('cancel-add-prompt').addEventListener('click', () => {
        document.querySelector('.add-prompt').style.display = 'none';
        document.getElementById('new-prompt-title').value = '';
        document.getElementById('new-prompt-text').value = '';
      });

      // Show the add folder form when the button is clicked
      document.getElementById('add-folder-button-icon').addEventListener('click', () => {
        document.querySelector('.add-folder').style.display = 'flex';
      });

      // Hide the add folder form when the cancel button is clicked
      document.getElementById('cancel-add-folder').addEventListener('click', () => {
        document.querySelector('.add-folder').style.display = 'none';
        document.getElementById('new-folder-name').value = '';
      });

      // Save new prompt
      document.getElementById('save-prompt').addEventListener('click', () => {
        const titleInput = document.getElementById('new-prompt-title').value;
        const textInput = document.getElementById('new-prompt-text').value;
        const folderId = document.getElementById('new-prompt-folder').value;

        // Validate inputs
        const titleValidation = validateInput(titleInput, VALIDATION.MAX_TITLE_LENGTH, 'Prompt title');
        const textValidation = validateInput(textInput, VALIDATION.MAX_CONTENT_LENGTH, 'Prompt content');

        if (!titleValidation.valid) {
          alert(titleValidation.message);
          return;
        }
        if (!textValidation.valid) {
          alert(textValidation.message);
          return;
        }

        chrome.storage.local.get('prompts', (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error loading prompts:', chrome.runtime.lastError);
            return;
          }
          let prompts = data.prompts || [];
          prompts.push({
            title: titleValidation.value,
            content: textValidation.value,
            folderId: folderId || null,
            createdAt: Date.now()
          });
          chrome.storage.local.set({ prompts }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving prompt:', chrome.runtime.lastError);
              alert('Failed to save prompt. Please try again.');
              return;
            }
            document.getElementById('new-prompt-title').value = '';
            document.getElementById('new-prompt-text').value = '';
            document.querySelector('.add-prompt').style.display = 'none';
            loadPrompts(currentFolderId);
          });
        });
      });

      // Save new folder
      document.getElementById('save-folder').addEventListener('click', () => {
        const folderNameInput = document.getElementById('new-folder-name').value;

        // Validate input
        const nameValidation = validateInput(folderNameInput, VALIDATION.MAX_FOLDER_NAME_LENGTH, 'Folder name');

        if (!nameValidation.valid) {
          alert(nameValidation.message);
          return;
        }

        chrome.storage.local.get('folders', (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error loading folders:', chrome.runtime.lastError);
            return;
          }
          let folders = data.folders || [];
          folders.push({ id: Date.now(), name: nameValidation.value });
          chrome.storage.local.set({ folders }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving folder:', chrome.runtime.lastError);
              alert('Failed to save folder. Please try again.');
              return;
            }
            document.getElementById('new-folder-name').value = '';
            document.querySelector('.add-folder').style.display = 'none';
            loadFolders();
          });
        });
      });

      // Add the click event listener for the "x" button to clear the search input
      addClearSearchListener();
      toggleClearSearchButtonVisibility();

      // Add event listener for tab selection
      document.getElementById('private-prompts-tab').addEventListener('click', function () {
        switchTab('private-prompts');
      });

      document.getElementById('public-prompts-tab').addEventListener('click', function () {
        switchTab('public-prompts');
      });

      document.getElementById('edit-folder-action').addEventListener('click', () => {
        const folderToUpdate = folders.find(f => String(f.id) === String(currentFolderId));
        if (folderToUpdate) {
          const newName = prompt(chrome.i18n.getMessage("enterNewFolderName"), folderToUpdate.name);
          if (newName && newName.trim() !== '') {
            folderToUpdate.name = newName.trim();
            chrome.storage.local.set({ folders }, () => {
              loadFolders();
              const folderActionsContainer = document.getElementById('folder-actions-container');
              folderActionsContainer.style.display = 'none';
            });
          }
        }
      });

      document.getElementById('delete-folder-action').addEventListener('click', () => {
        if (confirm(chrome.i18n.getMessage("confirmDeleteFolder"))) {
          chrome.storage.local.get(['folders', 'prompts'], (data) => {
            let folders = data.folders || [];
            let prompts = data.prompts || [];

            prompts.forEach(p => {
              if (String(p.folderId) === String(currentFolderId)) {
                p.folderId = null;
              }
            });

            const newFolders = folders.filter(f => String(f.id) !== String(currentFolderId));
            chrome.storage.local.set({ folders: newFolders, prompts }, () => {
              loadFolders();
              loadPrompts('all');
              const folderActionsContainer = document.getElementById('folder-actions-container');
              folderActionsContainer.style.display = 'none';
            });
          });
        }
      });

      function switchTab(tab) {
        const tabIds = ['private-prompts', 'public-prompts'];
        tabIds.forEach((id) => {
          document.getElementById(id + '-tab').classList.toggle('active', id === tab);
          document.getElementById(id + '-content').classList.toggle('active', id === tab);
        });
      }

      // Expand All / Collapse All button functionality
      document.getElementById('expand-all-button').addEventListener('click', () => {
        allExpanded = !allExpanded;
        const expandButton = document.getElementById('expand-all-button');
        const expandText = document.getElementById('expand-all-text');
        const prompts = document.querySelectorAll('#prompts-list .prompt-item');

        if (allExpanded) {
          expandButton.classList.add('expanded');
          expandText.textContent = chrome.i18n.getMessage("collapseAll");
          prompts.forEach((prompt) => {
            if (!prompt.classList.contains('editing')) {
              prompt.classList.add('expanded');
            }
          });
        } else {
          expandButton.classList.remove('expanded');
          expandText.textContent = chrome.i18n.getMessage("expandAll");
          prompts.forEach((prompt) => {
            if (!prompt.classList.contains('editing')) {
              prompt.classList.remove('expanded');
            }
          });
        }
      });

      // Sort dropdown functionality
      chrome.storage.local.get({ sortOrder: 'newest' }, (data) => {
        currentSortOrder = data.sortOrder;
        const sortSelect = document.getElementById('sort-prompts');
        if (sortSelect) {
          sortSelect.value = currentSortOrder;
        }
      });

      document.getElementById('sort-prompts').addEventListener('change', (event) => {
        currentSortOrder = event.target.value;
        chrome.storage.local.set({ sortOrder: currentSortOrder });
        loadPrompts(currentFolderId);
      });

      sidebarInitialized = true;
    }
  }

  // Add click event listener for the "x" button to clear the search input
  function addClearSearchListener() {
    document.getElementById('clear-search').addEventListener('click', () => {
      const searchInput = document.getElementById('search-prompts');
      searchInput.value = '';
      searchInput.focus();
      // Trigger the input event to refresh the list of prompts
      searchInput.dispatchEvent(new Event('input'));
    });
  }

  function toggleClearSearchButtonVisibility() {
    const searchInput = document.getElementById('search-prompts');
    const clearSearchButton = document.getElementById('clear-search');

    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim()) {
        clearSearchButton.style.display = 'inline';
      } else {
        clearSearchButton.style.display = 'none';
      }
    });

    searchInput.addEventListener('change', () => {
      if (searchInput.value.trim()) {
        clearSearchButton.style.display = 'inline';
      } else {
        clearSearchButton.style.display = 'none';
      }
    });
  }

  // Checks if prompt is too long to show "..."
  function updateEllipsis() {
    const promptTextElements = document.querySelectorAll('.prompt-text');
    promptTextElements.forEach((elem) => {
      const overflow = elem.scrollHeight > elem.clientHeight;
      if (overflow) {
        elem.classList.add('has-ellipsis');
      } else {
        elem.classList.remove('has-ellipsis');
      }
    });
  }


  let folders = [];
  let currentFolderId = 'all';

  // Listen for clicks on the browser icon
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleSidebar') {
      toggleSidebar();
    }
  });

  // Load saved folders from the storage
  // Store reference to folder change handler to prevent duplication
  let folderChangeHandler = null;

  function loadFolders() {
    chrome.storage.local.get('folders', (data) => {
      const folderSelectList = document.getElementById('folder-select-list');
      folderSelectList.innerHTML = '';
      folders = data.folders || [];

      // Sort folders alphabetically by name
      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      const allPromptsOption = document.createElement('option');
      allPromptsOption.value = 'all';
      allPromptsOption.textContent = chrome.i18n.getMessage("allPrompts");
      folderSelectList.appendChild(allPromptsOption);

      folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        folderSelectList.appendChild(option);
      });

      folderSelectList.value = currentFolderId;

      // Remove old event listener if it exists to prevent duplication
      if (folderChangeHandler) {
        folderSelectList.removeEventListener('change', folderChangeHandler);
      }

      // Define handler function so we can reference it for removal later
      folderChangeHandler = (event) => {
        const folderId = event.target.value;
        const folderActionsContainer = document.getElementById('folder-actions-container');

        if (folderId === 'all') {
          folderActionsContainer.style.display = 'none';
        } else {
          folderActionsContainer.style.display = 'flex';
        }

        loadPrompts(folderId);
      };

      folderSelectList.addEventListener('change', folderChangeHandler);
    });
  }

  // Load saved prompts from the storage
  function loadPrompts(folderId = 'all', callback) {
    currentFolderId = folderId;
    chrome.storage.local.set({ lastSelectedFolderId: folderId }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving folder selection:', chrome.runtime.lastError);
      }
    });
    chrome.storage.local.get('prompts', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading prompts:', chrome.runtime.lastError);
        return;
      }
      const promptsList = document.getElementById('prompts-list');
      promptsList.innerHTML = '';

      if (data.prompts) {
        const filteredPrompts = data.prompts.map((prompt, index) => ({ ...prompt, originalIndex: index })).filter(prompt => {
          if (folderId === 'all') {
            return true;
          }
          return String(prompt.folderId) === String(folderId);
        });

        // Sort prompts based on currentSortOrder
        switch (currentSortOrder) {
          case 'newest':
            // Newest first (reverse order of originalIndex - higher index = newer)
            filteredPrompts.sort((a, b) => b.originalIndex - a.originalIndex);
            break;
          case 'oldest':
            // Oldest first (original order by index)
            filteredPrompts.sort((a, b) => a.originalIndex - b.originalIndex);
            break;
          case 'az':
            // Alphabetical A-Z by title
            filteredPrompts.sort((a, b) => {
              const titleA = (a.title || '').toLowerCase();
              const titleB = (b.title || '').toLowerCase();
              return titleA.localeCompare(titleB);
            });
            break;
          case 'za':
            // Reverse alphabetical Z-A by title
            filteredPrompts.sort((a, b) => {
              const titleA = (a.title || '').toLowerCase();
              const titleB = (b.title || '').toLowerCase();
              return titleB.localeCompare(titleA);
            });
            break;
        }

        // Reset expand state when reloading prompts
        allExpanded = false;
        const expandButton = document.getElementById('expand-all-button');
        const expandText = document.getElementById('expand-all-text');
        if (expandButton) {
          expandButton.classList.remove('expanded');
        }
        if (expandText) {
          expandText.textContent = chrome.i18n.getMessage("expandAll");
        }

        for (let i = 0; i < filteredPrompts.length; i++) {
          let prompt = filteredPrompts[i];
          const index = prompt.originalIndex;

          // Check if the saved prompt is a string, and convert it to an object with a default title
          if (typeof prompt === 'string') {
            prompt = { title: chrome.i18n.getMessage("untitledPrompt"), content: prompt };
          }

          const promptItem = document.createElement('div');
          promptItem.className = 'prompt-item';

          const promptTitle = document.createElement('span');
          promptTitle.className = 'prompt-title';
          promptTitle.textContent = prompt.title;
          promptTitle.title = sanitizeInput(prompt.title);

          const promptText = document.createElement('span');
          promptText.className = 'prompt-text';
          promptText.textContent = prompt.content;
          promptText.title = sanitizeInput(prompt.content);

          const actions = document.createElement('div');
          actions.className = 'actions';
          actions.innerHTML = `
           <button class="copy-prompt" data-index="${index}">${chrome.i18n.getMessage("copyButton")}</button>
           <button class="edit-prompt" data-index="${index}">${chrome.i18n.getMessage("editButton")}</button>
           <button class="delete-prompt" data-index="${index}">${chrome.i18n.getMessage("deleteButton")}</button>
          `;

          promptItem.appendChild(promptTitle);

          const variables = prompt.content.match(/\[([^\]]+)\]/g);
          if (variables) {
            const variablesContainer = document.createElement('div');
            variablesContainer.className = 'variables-container';
            variablesContainer.style.display = 'none';

            const uniqueVariables = [...new Set(variables)];
            uniqueVariables.forEach(variable => {
              const variableName = variable.substring(1, variable.length - 1);
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'variable-input';
              input.placeholder = variableName;
              input.dataset.variable = variable;
              variablesContainer.appendChild(input);
            });
            promptItem.appendChild(variablesContainer);

            promptItem.addEventListener('mouseenter', () => {
              if (!promptItem.classList.contains('editing')) {
                variablesContainer.style.display = 'flex';
              }
            });
            promptItem.addEventListener('mouseleave', () => {
              variablesContainer.style.display = 'none';
            });
          }

          promptItem.appendChild(promptText);
          if (prompt.folderId) {
            const folder = folders.find(f => String(f.id) === String(prompt.folderId));
            if (folder) {
              const folderInfo = document.createElement('div');
              folderInfo.className = 'prompt-folder-info';
              folderInfo.textContent = `${folder.name}`;
              promptItem.appendChild(folderInfo);
            }
          }
          promptItem.appendChild(actions);
          promptsList.appendChild(promptItem);
        }

        // Edit prompt button functionality
        document.querySelectorAll('.edit-prompt').forEach((editButton) => {
          editButton.addEventListener('click', () => {
            const index = editButton.dataset.index;
            const promptItem = editButton.parentElement.parentElement;
            const promptTitle = promptItem.querySelector('.prompt-title');
            const promptText = promptItem.querySelector('.prompt-text');
            const isEditing = !promptItem.classList.contains('editing');
            const searchField = document.getElementById('search-prompts');
            const searchQuery = searchField.value.trim().toLowerCase();
            const copyButton = promptItem.querySelector('.copy-prompt');
            const deleteButton = promptItem.querySelector('.delete-prompt');
            const variablesContainer = promptItem.querySelector('.variables-container');

            if (isEditing) {
              if (variablesContainer) {
                variablesContainer.style.display = 'none';
              }
              promptItem.classList.add('editing', 'expanded');
              promptTitle.setAttribute('contenteditable', 'true');
              promptText.setAttribute('contenteditable', 'true');
              promptText.style.height = 'auto'; // Expands the prompt text
              promptText.style.overflowY = 'visible'; // Removes the scrollbar
              promptText.classList.remove('has-ellipsis'); // Remove the ellipsis effect

              if (copyButton) copyButton.style.display = 'none';
              if (deleteButton) deleteButton.style.display = 'none';

              const folderSelect = document.createElement('select');
              folderSelect.className = 'edit-prompt-folder';
              folderSelect.innerHTML = `<option value="">${chrome.i18n.getMessage("selectFolder")}</option>`;
              folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.name;
                folderSelect.appendChild(option);
              });

              chrome.storage.local.get('prompts', (data) => {
                let prompts = data.prompts || [];
                const currentPrompt = prompts[index];
                if (currentPrompt && currentPrompt.folderId) {
                  folderSelect.value = currentPrompt.folderId;
                }
              });

              promptItem.insertBefore(folderSelect, promptText);

              promptText.focus();
              editButton.textContent = chrome.i18n.getMessage("saveButton");
              editButton.style.color = '#FFFFFF';
              editButton.style.backgroundColor = '#DD395B';
              editButton.style.width = '100%';
              editButton.style.borderRadius = '0 0 5px 5px';

            } else {
              const folderSelect = promptItem.querySelector('.edit-prompt-folder');
              const newFolderId = folderSelect.value;
              promptItem.classList.remove('editing', 'expanded');
              promptTitle.setAttribute('contenteditable', 'false');
              promptText.setAttribute('contenteditable', 'false');
              promptText.style.height = '100px'; // Set this to your desired height
              promptText.style.overflowY = 'hidden'; // Hides the scrollbar
              editButton.textContent = chrome.i18n.getMessage("editButton");
              editButton.style.color = ''; // Reset the color to the original value
              editButton.style.backgroundColor = ''; // Reset the background color to the original value
              editButton.style.width = '33.3333%';
              editButton.style.borderRadius = '';

              if (copyButton) copyButton.style.display = '';
              if (deleteButton) deleteButton.style.display = '';

              const editedTitle = promptTitle.textContent.trim();
              const editedContent = promptText.textContent.trim();
              if (editedTitle !== '' && editedContent !== '') {
                chrome.storage.local.get('prompts', (data) => {
                  let prompts = data.prompts || [];
                  prompts[index] = { title: editedTitle, content: editedContent, folderId: newFolderId || null };
                  chrome.storage.local.set({ prompts }, () => {
                    loadPrompts(currentFolderId, () => {
                      if (searchQuery !== '') {
                        const searchInput = document.getElementById('search-prompts');
                        searchInput.value = searchQuery;
                        searchInput.dispatchEvent(new Event('input'));
                      }
                    });
                  });
                });
              }
            }
          });
        });


        // Copy prompt button functionality
        document.querySelectorAll('.copy-prompt').forEach((copyButton) => {
          copyButton.addEventListener('click', () => {
            const promptItem = copyButton.closest('.prompt-item');
            const promptTextElement = promptItem.querySelector('.prompt-text');
            let promptText = promptTextElement.textContent;

            const variableInputs = promptItem.querySelectorAll('.variable-input');
            if (variableInputs.length > 0) {
              variableInputs.forEach(input => {
                const variablePlaceholder = input.dataset.variable;
                const variableValue = input.value;
                if (variableValue.trim() !== '') {
                  // Escape special characters for RegExp
                  const escapedPlaceholder = variablePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  promptText = promptText.replace(new RegExp(escapedPlaceholder, 'g'), variableValue);
                }
              });
            }

            // Use modern Clipboard API (with fallback for older browsers)
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(promptText).then(() => {
                copyButton.textContent = chrome.i18n.getMessage("copiedButton");
                setTimeout(() => {
                  copyButton.textContent = chrome.i18n.getMessage("copyButton");
                }, 2000);
              }).catch(() => {
                // Fallback for clipboard API failure
                fallbackCopy(promptText, copyButton);
              });
            } else {
              // Fallback for browsers without Clipboard API
              fallbackCopy(promptText, copyButton);
            }
          });
        });


        // Delete prompt button functionality
        document.querySelectorAll('.delete-prompt').forEach((deleteButton) => {
          deleteButton.addEventListener('click', () => {
            const index = deleteButton.dataset.index;
            if (confirm(chrome.i18n.getMessage("confirmDeletePrompt"))) {
              chrome.storage.local.get('prompts', (data) => {
                let prompts = data.prompts || [];
                prompts.splice(index, 1);
                chrome.storage.local.set({ prompts }, () => {
                  loadPrompts(currentFolderId);
                });
              });
            }
          });
        });

        // Load check for prompt length
        updateEllipsis();

        // Add click listener to prompt titles to expand/collapse
        document.querySelectorAll('.prompt-title').forEach((title) => {
          title.addEventListener('click', (e) => {
            if (e.target.getAttribute('contenteditable') !== 'true') {
              const promptItem = title.parentElement;
              promptItem.classList.toggle('expanded');
            }
          });
        });
      }
      if (callback) {
        callback();
      }
    });
  }

  function migrateData() {
    chrome.storage.sync.get('prompts', (syncData) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving prompts from sync storage:', chrome.runtime.lastError);
        return;
      }

      if (syncData.prompts) {
        chrome.storage.local.set({ prompts: syncData.prompts }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving prompts to local storage:', chrome.runtime.lastError);
            return;
          }

          chrome.storage.sync.remove('prompts', () => {
            if (chrome.runtime.lastError) {
              console.error('Error removing prompts from sync storage:', chrome.runtime.lastError);
            }
          });
        });
      }
    });
  }


  // Call the migrateData function when the extension is loaded
  migrateData();

  function initialize() {
    // Function to ensure icon exists and set up observer
    function ensureIconAndObserver() {
      // Check if icon already exists
      if (!document.getElementById('openai-chat-prompts-icon')) {
        createIcon();
      }

      // Set up MutationObserver to detect icon removal by SPA frameworks
      // This is especially important for sites like ChatGPT that re-render DOM
      if (!iconObserver) {
        iconObserver = new MutationObserver((mutations) => {
          // Check if icon was removed
          if (!document.getElementById('openai-chat-prompts-icon')) {
            // Check settings to see if icon should be shown
            chrome.storage.local.get({ showIcon: true }, (data) => {
              if (data.showIcon && document.body) {
                createIcon();
              }
            });
          }
        });

        // Observe body for child list changes (direct children removal)
        iconObserver.observe(document.body, {
          childList: true,
          subtree: false // Only observe direct children for performance
        });
      }
    }

    // If the body is already present, create the icon immediately.
    if (document.body) {
      ensureIconAndObserver();
    } else {
      // Otherwise, wait for the body to be added to the DOM.
      const bodyObserver = new MutationObserver((mutations, obs) => {
        if (document.body) {
          ensureIconAndObserver();
          obs.disconnect(); // Disconnect body observer once setup is complete
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Additional check: Re-check icon after a delay for SPAs that hydrate later
    // This handles cases where the page re-renders after initial load
    setTimeout(() => {
      if (document.body && !document.getElementById('openai-chat-prompts-icon')) {
        chrome.storage.local.get({ showIcon: true }, (data) => {
          if (data.showIcon) {
            createIcon();
          }
        });
      }
    }, 2000);
  }

  initialize();

})(); // End of IIFE
