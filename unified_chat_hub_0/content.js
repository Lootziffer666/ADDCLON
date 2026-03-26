(() => {
  const ROOT_ID = 'chathub-root';
  const QUICKBAR_ID = 'chathub-quickbar';
  const MODAL_ID = 'chathub-modal';

  const DEFAULT_DATA = {
    prompts: [
      {
        id: crypto.randomUUID(),
        title: 'Professionell umschreiben',
        content: 'Schreibe den folgenden Text professionell und prägnant um:\n\n{{text}}'
      },
      {
        id: crypto.randomUUID(),
        title: 'Zusammenfassung',
        content: 'Fasse den folgenden Inhalt in 5 Stichpunkten zusammen:\n\n{{text}}'
      }
    ],
    history: []
  };

  const DEFAULT_SETTINGS = {
    syncEnabled: false,
    inputPrice: 0.003,
    outputPrice: 0.006
  };

  const PLATFORM_CONFIG = {
    chatgpt: {
      name: 'ChatGPT',
      inputSelectors: [
        'form textarea',
        'textarea[placeholder*="Nachricht"]',
        'textarea[placeholder*="message"]',
        'div[contenteditable="true"][role="textbox"]'
      ],
      sendButtonSelectors: [
        'form button[data-testid="send-button"]',
        'form button[aria-label*="Send"]',
        'form button[aria-label*="Senden"]'
      ]
    },
    gemini: {
      name: 'Gemini',
      inputSelectors: [
        'textarea',
        'div[contenteditable="true"][role="textbox"]'
      ],
      sendButtonSelectors: [
        'button[aria-label*="Send message"]',
        'button[aria-label*="Nachricht senden"]',
        'button.send-button'
      ]
    }
  };

  const platformKey = /chatgpt\.com|chat\.openai\.com/.test(location.hostname)
    ? 'chatgpt'
    : /gemini\.google\.com/.test(location.hostname)
      ? 'gemini'
      : null;

  if (!platformKey) return;

  const platform = PLATFORM_CONFIG[platformKey];

  let state = {
    prompts: [],
    history: [],
    search: '',
    activeTab: 'prompts',
    lastEstimate: null,
    settings: { ...DEFAULT_SETTINGS }
  };
  let lastCaptured = { text: '', at: 0 };

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

    state.prompts = Array.isArray(data.chatHubData.prompts) ? data.chatHubData.prompts : [];
    state.history = Array.isArray(data.chatHubData.history) ? data.chatHubData.history : [];
  }

  async function saveData() {
    const area = await getStorageArea();
    await area.set({ chatHubData: { prompts: state.prompts, history: state.history } });
  }

  function findFirst(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getInputElement() {
    return findFirst(platform.inputSelectors);
  }

  function getSendButton() {
    return findFirst(platform.sendButtonSelectors);
  }

  function setInputValue(el, value) {
    if (!el) return;

    if (el.tagName === 'TEXTAREA') {
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    el.focus();
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
  }

  function appendInputValue(el, value) {
    if (!el) return;
    const existing = el.tagName === 'TEXTAREA' ? el.value : el.textContent || '';
    const merged = existing ? `${existing}\n${value}` : value;
    setInputValue(el, merged);
  }

  function extractVariables(promptText) {
    const matches = [...promptText.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
  }

  async function collectVariableValues(variableNames) {
    const values = {};
    for (const name of variableNames) {
      const value = await openInputModal({
        title: `Variable: ${name}`,
        fields: [{ name, label: name, type: 'text', value: '' }],
        submitLabel: 'Übernehmen'
      });
      if (!value) return null;
      values[name] = value[name] || '';
    }
    return values;
  }

  function applyVariables(promptText, values) {
    return promptText.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
  }

  async function injectPrompt(promptData) {
    const input = getInputElement();
    if (!input) {
      alert('Kein Eingabefeld gefunden. Bitte Seite neu laden.');
      return;
    }

    let resolvedPrompt = promptData.content;
    const variables = extractVariables(promptData.content);
    if (variables.length > 0) {
      const values = await collectVariableValues(variables);
      if (!values) return;
      resolvedPrompt = applyVariables(promptData.content, values);
    }

    appendInputValue(input, resolvedPrompt);
    await logHistory({
      promptTitle: promptData.title,
      promptText: resolvedPrompt,
      platform: platform.name
    });
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      prompts: state.prompts,
      history: state.history
    };

    const topicTitle = inferMainTopicTitle(payload);
    downloadTextFile({
      text: JSON.stringify(payload, null, 2),
      filename: `chathub-${slugify(topicTitle)}-${Date.now()}.json`,
      mimeType: 'application/json'
    });
  }

  function exportMarkdown() {
    const payload = {
      exportedAt: new Date().toISOString(),
      prompts: state.prompts,
      history: state.history
    };

    const topicTitle = inferMainTopicTitle(payload);
    const lines = [];
    lines.push(`# ChatHub Export – ${topicTitle}`);
    lines.push('');
    lines.push(`- Exportiert am: ${new Date(payload.exportedAt).toLocaleString('de-DE')}`);
    lines.push(`- Plattform: ${platform.name}`);
    lines.push(`- Prompts: ${payload.prompts.length}`);
    lines.push(`- Verlaufseinträge: ${payload.history.length}`);
    lines.push('');
    lines.push('## Prompts');
    lines.push('');

    if (payload.prompts.length === 0) {
      lines.push('_Keine Prompts vorhanden._');
      lines.push('');
    } else {
      payload.prompts.forEach((promptData, index) => {
        lines.push(`### ${index + 1}. ${promptData.title || 'Ohne Titel'}`);
        lines.push('');
        lines.push('```');
        lines.push(String(promptData.content || '').trim());
        lines.push('```');
        lines.push('');
      });
    }

    lines.push('## Verlauf (letzte 100)');
    lines.push('');
    const recentHistory = payload.history.slice(0, 100);
    if (recentHistory.length === 0) {
      lines.push('_Kein Verlauf vorhanden._');
      lines.push('');
    } else {
      recentHistory.forEach((item, index) => {
        lines.push(`### ${index + 1}. ${item.promptTitle || 'Ohne Titel'}`);
        lines.push(`- Zeit: ${new Date(item.createdAt).toLocaleString('de-DE')}`);
        lines.push(`- Plattform: ${item.platform || 'Unbekannt'}`);
        lines.push(
          `- Schätzung: ~${item.estimate?.inputTokens || 0} in / ~${item.estimate?.outputTokens || 0} out / $${Number(item.estimate?.cost || 0).toFixed(4)}`
        );
        lines.push('');
        lines.push('```');
        lines.push(String(item.promptText || '').trim());
        lines.push('```');
        lines.push('');
      });
    }

    downloadTextFile({
      text: lines.join('\n'),
      filename: `chathub-${slugify(topicTitle)}-${Date.now()}.md`,
      mimeType: 'text/markdown'
    });
  }

  function inferMainTopicTitle(payload) {
    const sourceTexts = [
      ...payload.history.slice(0, 25).map((h) => String(h.promptText || '')),
      ...payload.prompts.slice(0, 25).map((p) => String(p.title || ''))
    ]
      .join(' ')
      .toLowerCase();

    const words = sourceTexts.match(/[a-zA-ZäöüÄÖÜß0-9-]{4,}/g) || [];
    const stopwords = new Set([
      'dass', 'dies', 'eine', 'einer', 'einem', 'einen', 'oder', 'aber', 'auch', 'noch', 'nicht', 'sowie',
      'the', 'with', 'from', 'this', 'that', 'your', 'chatgpt', 'gemini', 'prompt', 'prompts', 'text', 'bitte',
      'schreibe', 'fasse', 'zusammen', 'und', 'oder', 'eine', 'einen', 'mein', 'dein'
    ]);
    const freq = new Map();

    words.forEach((word) => {
      if (stopwords.has(word)) return;
      freq.set(word, (freq.get(word) || 0) + 1);
    });

    const best = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
    if (best.length === 0) return 'Hauptthema-unbestimmt';
    return best.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
  }

  function slugify(input) {
    return String(input || 'export')
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/_+/g, '-')
      .toLowerCase()
      .slice(0, 70);
  }

  function downloadTextFile({ text, filename, mimeType }) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.prompts)) {
      throw new Error('Ungültiges Dateiformat');
    }

    state.prompts = parsed.prompts
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
        title: String(item.title || '').trim(),
        content: String(item.content || '').trim()
      }))
      .filter((item) => item.title && item.content);

    state.history = Array.isArray(parsed.history)
      ? parsed.history
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
            createdAt: item.createdAt || new Date().toISOString(),
            promptTitle: String(item.promptTitle || 'Ohne Titel'),
            promptText: String(item.promptText || ''),
            platform: String(item.platform || platform.name),
            estimate: {
              inputTokens: Number(item?.estimate?.inputTokens || 0),
              outputTokens: Number(item?.estimate?.outputTokens || 0),
              cost: Number(item?.estimate?.cost || 0)
            }
          }))
      : [];

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

    state.history = state.history.slice(0, 500);
    await saveData();
    updateEstimateBox();

    if (state.activeTab === 'history') {
      renderHistory();
    }
  }

  function escapeHtml(str) {
    return (str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function createRoot() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="chathub-header">
        <strong>ChatHub · ${platform.name}</strong>
        <button id="chathub-close" title="Schließen">×</button>
      </div>
      <div class="chathub-tabs">
        <button data-tab="prompts" class="active">Prompts</button>
        <button data-tab="history">Verlauf</button>
        <button data-tab="tools">Antwort-Tools</button>
        <button data-tab="limits">Free/Pro Limits</button>
      </div>
      <div id="chathub-content"></div>
      <div id="chathub-estimate"></div>
    `;

    document.body.appendChild(root);

    root.querySelector('#chathub-close').addEventListener('click', () => {
      root.classList.add('hidden');
    });

    root.querySelectorAll('.chathub-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        root.querySelectorAll('.chathub-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  function ensureQuickbarPosition() {
    const quickbar = document.getElementById(QUICKBAR_ID);
    if (!quickbar) return;

    const input = getInputElement();
    if (!input) return;

    const parent = input.closest('form') || input.parentElement;
    if (!parent || quickbar.parentElement === parent) return;
    parent.appendChild(quickbar);
  }

  function createQuickbar() {
    if (document.getElementById(QUICKBAR_ID)) return;

    const quickbar = document.createElement('div');
    quickbar.id = QUICKBAR_ID;
    quickbar.innerHTML = `
      <button id="chathub-toggle">ChatHub</button>
      <div id="chathub-quick-prompts"></div>
    `;

    quickbar.querySelector('#chathub-toggle').addEventListener('click', toggleSidebar);
    document.body.appendChild(quickbar);
    ensureQuickbarPosition();

    const observer = new MutationObserver(() => ensureQuickbarPosition());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function openPromptEditor(initial = { title: '', content: '' }) {
    return openInputModal({
      title: initial.id ? 'Prompt bearbeiten' : 'Prompt anlegen',
      submitLabel: initial.id ? 'Speichern' : 'Anlegen',
      fields: [
        { name: 'title', label: 'Titel', type: 'text', value: initial.title || '' },
        { name: 'content', label: 'Inhalt', type: 'textarea', value: initial.content || '' }
      ]
    });
  }

  async function openInputModal({ title, fields, submitLabel }) {
    let modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = MODAL_ID;

    modal.innerHTML = `
      <div class="chathub-modal-backdrop"></div>
      <form class="chathub-modal-card">
        <h3>${escapeHtml(title)}</h3>
        ${fields
          .map((field) => {
            const fieldValue = escapeHtml(field.value || '');
            if (field.type === 'textarea') {
              return `
                <label>
                  ${escapeHtml(field.label)}
                  <textarea name="${escapeHtml(field.name)}" rows="7">${fieldValue}</textarea>
                </label>
              `;
            }
            return `
              <label>
                ${escapeHtml(field.label)}
                <input name="${escapeHtml(field.name)}" type="text" value="${fieldValue}" />
              </label>
            `;
          })
          .join('')}
        <div class="chathub-modal-actions">
          <button type="button" data-cancel>Abbrechen</button>
          <button type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    const backdrop = modal.querySelector('.chathub-modal-backdrop');

    return new Promise((resolve) => {
      const close = (value) => {
        modal.remove();
        resolve(value);
      };

      backdrop.addEventListener('click', () => close(null));
      modal.querySelector('[data-cancel]').addEventListener('click', () => close(null));

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {};
        fields.forEach((field) => {
          data[field.name] = form.elements[field.name].value.trim();
        });
        if (Object.values(data).every((v) => !v)) {
          close(null);
          return;
        }
        close(data);
      });
    });
  }

  function renderPrompts() {
    const content = document.getElementById('chathub-content');
    const q = state.search.toLowerCase();

    const filtered = state.prompts.filter((promptData) => {
      return !q || promptData.title.toLowerCase().includes(q) || promptData.content.toLowerCase().includes(q);
    });

    content.innerHTML = `
      <div class="chathub-row">
        <input id="chathub-search" type="text" placeholder="Prompts durchsuchen..." value="${escapeHtml(state.search)}" />
      </div>
      <div class="chathub-row actions">
        <button id="chathub-add-prompt">+ Prompt</button>
        <button id="chathub-export-md">Export MD</button>
        <button id="chathub-export-json">Export JSON</button>
        <label class="import-label">Import JSON<input type="file" id="chathub-import" accept="application/json" hidden /></label>
      </div>
      <div class="chathub-list">
        ${filtered
          .map(
            (promptData) => `
              <div class="chathub-card" data-id="${promptData.id}">
                <div class="chathub-card-title">${escapeHtml(promptData.title)}</div>
                <div class="chathub-card-text">${escapeHtml(promptData.content)}</div>
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

    content.querySelector('#chathub-search').addEventListener('input', (event) => {
      state.search = event.target.value;
      renderPrompts();
      renderQuickPrompts();
    });

    content.querySelector('#chathub-export-md').addEventListener('click', exportMarkdown);
    content.querySelector('#chathub-export-json').addEventListener('click', exportData);
    content.querySelector('#chathub-import').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importData(file);
      } catch (error) {
        alert(`Import fehlgeschlagen: ${error.message}`);
      }
    });

    content.querySelector('#chathub-add-prompt').addEventListener('click', async () => {
      const data = await openPromptEditor();
      if (!data?.title || !data?.content) return;

      state.prompts.unshift({ id: crypto.randomUUID(), ...data });
      await saveData();
      renderPrompts();
      renderQuickPrompts();
    });

    content.querySelectorAll('.chathub-card').forEach((card) => {
      const id = card.dataset.id;
      const promptData = state.prompts.find((p) => p.id === id);
      if (!promptData) return;

      card.querySelector('[data-action="use"]').addEventListener('click', () => injectPrompt(promptData));

      card.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const data = await openPromptEditor(promptData);
        if (!data?.title || !data?.content) return;

        promptData.title = data.title;
        promptData.content = data.content;
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
    const q = state.search.toLowerCase();

    const filtered = state.history.filter((item) => {
      return !q || (item.promptTitle || '').toLowerCase().includes(q) || (item.promptText || '').toLowerCase().includes(q);
    });

    content.innerHTML = `
      <div class="chathub-row">
        <input id="chathub-search" type="text" placeholder="Im Verlauf suchen..." value="${escapeHtml(state.search)}" />
      </div>
      <div class="chathub-list">
        ${filtered
          .slice(0, 150)
          .map(
            (item) => `
              <div class="chathub-card">
                <div class="chathub-card-title">${escapeHtml(item.promptTitle || 'Ohne Titel')}</div>
                <div class="chathub-meta">${new Date(item.createdAt).toLocaleString('de-DE')} · ${escapeHtml(item.platform || 'Unbekannt')}</div>
                <div class="chathub-card-text">${escapeHtml(item.promptText || '')}</div>
                <div class="chathub-meta">~${item.estimate?.inputTokens || 0} in / ~${item.estimate?.outputTokens || 0} out / $${(item.estimate?.cost || 0).toFixed(4)}</div>
              </div>
            `
          )
          .join('')}
      </div>
    `;

    content.querySelector('#chathub-search').addEventListener('input', (event) => {
      state.search = event.target.value;
      renderHistory();
    });
  }

  function renderTools() {
    const content = document.getElementById('chathub-content');
    content.innerHTML = `
      <div class="chathub-row">
        <textarea id="chathub-tools-input" rows="7" placeholder="Antworttext hier einfügen..."></textarea>
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
      input.value = cleaned;
      result.textContent = cleaned;
    });

    content.querySelector('[data-tool="translate"]').addEventListener('click', () => {
      const value = (input.value || '').trim();
      if (!value) return;
      window.open(`https://translate.google.com/?sl=auto&tl=de&text=${encodeURIComponent(value)}&op=translate`, '_blank');
      result.textContent = 'Google Translate geöffnet.';
    });

    content.querySelector('[data-tool="summarize"]').addEventListener('click', () => {
      const value = (input.value || '').trim();
      if (!value) return;
      const summary = value.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
      result.textContent = summary || value.slice(0, 280);
    });
  }

  function renderLimits() {
    const content = document.getElementById('chathub-content');
    content.innerHTML = `
      <div class="chathub-card">
        <div class="chathub-card-title">ChatGPT (Richtwerte)</div>
        <div class="chathub-card-text">
          Free: stärker limitierte Nutzung, kleinere Message-Kontingente und Prioritätsdrosselung zu Stoßzeiten.<br />
          Pro/Plus: höhere Kontingente, stabilere Verfügbarkeit und meist frühere Features.
        </div>
      </div>
      <div class="chathub-card">
        <div class="chathub-card-title">Gemini (Richtwerte)</div>
        <div class="chathub-card-text">
          Free: begrenzte Tages-/Kontextnutzung je nach Modell und Last.<br />
          Pro/Advanced: größere Nutzungskontingente, priorisierte Antwortzeiten und erweitere Modelloptionen.
        </div>
      </div>
      <div class="chathub-meta">
        Hinweis: Diese Übersicht ist bewusst qualitativ gehalten, da die konkreten Limits je nach Region, Plan und Anbieter-Updates variieren können.
      </div>
    `;
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
      .filter((promptData) => !q || promptData.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((promptData) => `<button data-id="${promptData.id}" class="quick">${escapeHtml(promptData.title)}</button>`)
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
    if (state.activeTab === 'limits') renderLimits();
    updateEstimateBox();
    renderQuickPrompts();
  }

  function toggleSidebar() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.toggle('hidden');
  }

  async function captureCurrentInputAsHistory() {
    const input = getInputElement();
    if (!input) return;
    const text = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const now = Date.now();
    if (lastCaptured.text === trimmed && now - lastCaptured.at < 1200) {
      return;
    }
    lastCaptured = { text: trimmed, at: now };

    await logHistory({
      promptTitle: 'Freitext',
      promptText: trimmed,
      platform: platform.name
    });
  }

  function setupPromptCapture() {
    document.addEventListener(
      'keydown',
      async (event) => {
        const input = getInputElement();
        if (!input) return;

        const eventTarget = event.target;
        const isTarget = eventTarget === input || input.contains(eventTarget);
        if (!isTarget) return;

        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          await captureCurrentInputAsHistory();
        }
      },
      true
    );

    document.addEventListener(
      'click',
      async (event) => {
        const sendButton = getSendButton();
        if (!sendButton) return;
        const eventTarget = event.target;
        const isSendClick = eventTarget === sendButton || sendButton.contains(eventTarget);
        if (isSendClick) {
          await captureCurrentInputAsHistory();
        }
      },
      true
    );
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'TOGGLE_SIDEBAR') {
      toggleSidebar();
    }
  });

  async function init() {
    await loadData();
    createRoot();
    createQuickbar();
    setupPromptCapture();
    render();
  }

  init();
})();
