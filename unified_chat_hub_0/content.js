(() => {
  const ROOT_ID = 'chathub-root';
  const QUICKBAR_ID = 'chathub-quickbar';

  const DEFAULT_DATA = {
    prompts: [
      { id: crypto.randomUUID(), title: 'Professionell umschreiben', content: 'Schreibe den folgenden Text professionell und prägnant um:\n\n{{text}}' },
      { id: crypto.randomUUID(), title: 'Zusammenfassung', content: 'Fasse den folgenden Inhalt in 5 Stichpunkten zusammen:\n\n{{text}}' }
    ],
    history: []
  };

  const DEFAULT_SETTINGS = {
    syncEnabled: false,
    inputPrice: 0.003,
    outputPrice: 0.006
  };

  let state = {
    prompts: [],
    history: [],
    search: '',
    activeTab: 'prompts',
    lastEstimate: null,
    settings: { ...DEFAULT_SETTINGS }
  };

  const isChatGPT = /chatgpt\.com|chat\.openai\.com/.test(location.hostname);
  const isGemini = /gemini\.google\.com/.test(location.hostname);

  function estimateTokens(text = '') {
    return Math.ceil((text || '').trim().length / 4);
  }

  function estimateCost(tokenCount, isOutput = false) {
    const per1k = isOutput ? state.settings.outputPrice : state.settings.inputPrice;
    return (tokenCount / 1000) * per1k;
  }

  async function getStorageArea() {
    const local = await chrome.storage.local.get('chatHubSettings');
    const settings = { ...DEFAULT_SETTINGS, ...(local.chatHubSettings || {}) };
    state.settings = settings;
    return settings.syncEnabled ? chrome.storage.sync : chrome.storage.local;
  }

  async function loadData() {
    const area = await getStorageArea();
    const data = await area.get('chatHubData');
    if (!data.chatHubData) {
      state.prompts = DEFAULT_DATA.prompts;
      state.history = [];
      await area.set({ chatHubData: { prompts: state.prompts, history: state.history } });
      return;
    }
    state.prompts = data.chatHubData.prompts || [];
    state.history = data.chatHubData.history || [];
  }

  async function saveData() {
    const area = await getStorageArea();
    await area.set({ chatHubData: { prompts: state.prompts, history: state.history } });
  }

  function getInputElement() {
    const selectors = [
      'textarea[placeholder*="Nachricht"]',
      'textarea[placeholder*="message"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (el.tagName === 'TEXTAREA') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }

  function appendInputValue(el, value) {
    if (!el) return;
    const existing = el.tagName === 'TEXTAREA' ? el.value : el.textContent || '';
    const merged = existing ? `${existing}\n${value}` : value;
    setInputValue(el, merged);
  }

  function injectPrompt(prompt) {
    const input = getInputElement();
    appendInputValue(input, prompt.content);
    logHistory({ promptTitle: prompt.title, promptText: prompt.content, platform: isChatGPT ? 'ChatGPT' : isGemini ? 'Gemini' : 'Unbekannt' });
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      prompts: state.prompts,
      history: state.history
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chathub-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.prompts) || !Array.isArray(parsed.history)) {
      throw new Error('Ungültiges Format');
    }
    state.prompts = parsed.prompts;
    state.history = parsed.history;
    await saveData();
    render();
  }

  async function logHistory(entry) {
    const inputTokens = estimateTokens(entry.promptText || '');
    const outputTokens = Math.ceil(inputTokens * 1.4);
    const cost = estimateCost(inputTokens, false) + estimateCost(outputTokens, true);

    state.lastEstimate = { inputTokens, outputTokens, cost };
    state.history.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
      estimate: { inputTokens, outputTokens, cost }
    });
    state.history = state.history.slice(0, 300);
    await saveData();
    updateEstimateBox();
    if (state.activeTab === 'history') renderHistory();
  }

  function createRoot() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="chathub-header">
        <strong>ChatHub</strong>
        <button id="chathub-close" title="Schließen">×</button>
      </div>
      <div class="chathub-tabs">
        <button data-tab="prompts" class="active">Prompts</button>
        <button data-tab="history">Verlauf</button>
        <button data-tab="tools">Antwort-Tools</button>
      </div>
      <div id="chathub-content"></div>
      <div id="chathub-estimate"></div>
    `;
    document.body.appendChild(root);

    root.querySelector('#chathub-close').addEventListener('click', () => root.classList.add('hidden'));
    root.querySelectorAll('.chathub-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        root.querySelectorAll('.chathub-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  function createQuickbar() {
    if (document.getElementById(QUICKBAR_ID)) return;
    const quickbar = document.createElement('div');
    quickbar.id = QUICKBAR_ID;
    quickbar.innerHTML = `
      <button id="chathub-toggle">ChatHub</button>
      <div id="chathub-quick-prompts"></div>
    `;

    const attach = () => {
      const input = getInputElement();
      if (!input) return false;
      const parent = input.closest('form, div') || input.parentElement;
      if (!parent) return false;
      if (!quickbar.isConnected) {
        parent.appendChild(quickbar);
        quickbar.querySelector('#chathub-toggle').addEventListener('click', toggleSidebar);
      }
      return true;
    };

    if (!attach()) {
      const obs = new MutationObserver(() => {
        if (attach()) obs.disconnect();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  function renderPrompts() {
    const content = document.getElementById('chathub-content');
    const filtered = state.prompts.filter((p) => {
      const q = state.search.toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
    });

    content.innerHTML = `
      <div class="chathub-row">
        <input id="chathub-search" type="text" placeholder="Suchen..." value="${state.search}" />
      </div>
      <div class="chathub-row actions">
        <button id="chathub-add-prompt">+ Prompt</button>
        <button id="chathub-export">Export JSON</button>
        <label class="import-label">Import JSON<input type="file" id="chathub-import" accept="application/json" hidden /></label>
      </div>
      <div class="chathub-list">
        ${filtered
          .map(
            (p) => `
          <div class="chathub-card" data-id="${p.id}">
            <div class="chathub-card-title">${escapeHtml(p.title)}</div>
            <div class="chathub-card-text">${escapeHtml(p.content)}</div>
            <div class="chathub-card-actions">
              <button data-action="use">Einfügen</button>
              <button data-action="edit">Bearbeiten</button>
              <button data-action="delete">Löschen</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    content.querySelector('#chathub-search').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderPrompts();
      renderQuickPrompts();
    });

    content.querySelector('#chathub-add-prompt').addEventListener('click', async () => {
      const title = prompt('Titel des Prompts');
      if (!title) return;
      const text = prompt('Prompt-Inhalt');
      if (!text) return;
      state.prompts.unshift({ id: crypto.randomUUID(), title, content: text });
      await saveData();
      renderPrompts();
      renderQuickPrompts();
    });

    content.querySelector('#chathub-export').addEventListener('click', exportData);
    content.querySelector('#chathub-import').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await importData(file);
      } catch (error) {
        alert(`Import fehlgeschlagen: ${error.message}`);
      }
    });

    content.querySelectorAll('.chathub-card').forEach((card) => {
      const id = card.dataset.id;
      const promptData = state.prompts.find((p) => p.id === id);
      if (!promptData) return;
      card.querySelector('[data-action="use"]').addEventListener('click', () => injectPrompt(promptData));
      card.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const title = prompt('Neuer Titel', promptData.title);
        if (!title) return;
        const text = prompt('Neuer Inhalt', promptData.content);
        if (!text) return;
        promptData.title = title;
        promptData.content = text;
        await saveData();
        renderPrompts();
        renderQuickPrompts();
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        state.prompts = state.prompts.filter((p) => p.id !== id);
        await saveData();
        renderPrompts();
        renderQuickPrompts();
      });
    });
  }

  function renderHistory() {
    const content = document.getElementById('chathub-content');
    const filtered = state.history.filter((h) => {
      const q = state.search.toLowerCase();
      return !q || (h.promptTitle || '').toLowerCase().includes(q) || (h.promptText || '').toLowerCase().includes(q);
    });

    content.innerHTML = `
      <div class="chathub-row">
        <input id="chathub-search" type="text" placeholder="Im Verlauf suchen..." value="${state.search}" />
      </div>
      <div class="chathub-list">
        ${filtered
          .slice(0, 100)
          .map(
            (h) => `
          <div class="chathub-card">
            <div class="chathub-card-title">${escapeHtml(h.promptTitle || 'Ohne Titel')}</div>
            <div class="chathub-meta">${new Date(h.createdAt).toLocaleString('de-DE')} · ${escapeHtml(h.platform || 'Unbekannt')}</div>
            <div class="chathub-card-text">${escapeHtml(h.promptText || '')}</div>
            <div class="chathub-meta">~${h.estimate.inputTokens} in / ~${h.estimate.outputTokens} out / $${h.estimate.cost.toFixed(4)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    content.querySelector('#chathub-search').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderHistory();
    });
  }

  function renderTools() {
    const content = document.getElementById('chathub-content');
    content.innerHTML = `
      <div class="chathub-row">
        <textarea id="chathub-tools-input" rows="7" placeholder="Antworttext hier einfügen oder markieren + kopieren..."></textarea>
      </div>
      <div class="chathub-row actions">
        <button data-tool="copy">Copy</button>
        <button data-tool="clean">Clean</button>
        <button data-tool="translate">Translate</button>
        <button data-tool="summarize">Summarize</button>
      </div>
      <div id="chathub-tools-result" class="chathub-result"></div>
    `;

    const input = content.querySelector('#chathub-tools-input');
    const result = content.querySelector('#chathub-tools-result');

    content.querySelector('[data-tool="copy"]').addEventListener('click', async () => {
      await navigator.clipboard.writeText(input.value || '');
      result.textContent = 'Kopiert.';
    });

    content.querySelector('[data-tool="clean"]').addEventListener('click', () => {
      const cleaned = (input.value || '').replace(/\s+/g, ' ').trim();
      result.textContent = cleaned;
      input.value = cleaned;
    });

    content.querySelector('[data-tool="translate"]').addEventListener('click', () => {
      const text = encodeURIComponent(input.value || '');
      if (!text) return;
      window.open(`https://translate.google.com/?sl=auto&tl=de&text=${text}&op=translate`, '_blank');
      result.textContent = 'Google Translate geöffnet.';
    });

    content.querySelector('[data-tool="summarize"]').addEventListener('click', () => {
      const value = (input.value || '').trim();
      if (!value) return;
      const sentences = value.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
      result.textContent = sentences || value.slice(0, 280);
    });
  }

  function updateEstimateBox() {
    const el = document.getElementById('chathub-estimate');
    if (!el) return;
    if (!state.lastEstimate) {
      el.textContent = 'Noch keine Schätzung vorhanden.';
      return;
    }
    const { inputTokens, outputTokens, cost } = state.lastEstimate;
    el.textContent = `Letzte Schätzung: ~${inputTokens} Input / ~${outputTokens} Output / $${cost.toFixed(4)}`;
  }

  function renderQuickPrompts() {
    const wrap = document.getElementById('chathub-quick-prompts');
    if (!wrap) return;
    const q = state.search.toLowerCase();
    wrap.innerHTML = state.prompts
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => `<button data-id="${p.id}" class="quick">${escapeHtml(p.title)}</button>`)
      .join('');

    wrap.querySelectorAll('button.quick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const promptData = state.prompts.find((p) => p.id === btn.dataset.id);
        if (promptData) injectPrompt(promptData);
      });
    });
  }

  function render() {
    if (state.activeTab === 'prompts') renderPrompts();
    if (state.activeTab === 'history') renderHistory();
    if (state.activeTab === 'tools') renderTools();
    updateEstimateBox();
    renderQuickPrompts();
  }

  function toggleSidebar() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.toggle('hidden');
  }

  function escapeHtml(str) {
    return (str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setupPromptCapture() {
    document.addEventListener('keydown', async (event) => {
      const input = getInputElement();
      const isTarget = input && (event.target === input || input.contains(event.target));
      if (!isTarget) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        const text = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
        if ((text || '').trim()) {
          await logHistory({
            promptTitle: 'Freitext',
            promptText: text.trim(),
            platform: isChatGPT ? 'ChatGPT' : isGemini ? 'Gemini' : 'Unbekannt'
          });
        }
      }
    }, true);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'TOGGLE_SIDEBAR') toggleSidebar();
  });

  async function init() {
    if (!isChatGPT && !isGemini) return;
    await loadData();
    createRoot();
    createQuickbar();
    setupPromptCapture();
    render();
  }

  init();
})();
