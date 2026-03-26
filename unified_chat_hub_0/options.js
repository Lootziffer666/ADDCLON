const DEFAULT_SETTINGS = {
  syncEnabled: false,
  inputPrice: 0.003,
  outputPrice: 0.006
};

async function getLocalSettings() {
  const data = await chrome.storage.local.get('chatHubSettings');
  return { ...DEFAULT_SETTINGS, ...(data.chatHubSettings || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ chatHubSettings: settings });
}

async function init() {
  const settings = await getLocalSettings();
  document.getElementById('syncEnabled').checked = Boolean(settings.syncEnabled);
  document.getElementById('inputPrice').value = settings.inputPrice;
  document.getElementById('outputPrice').value = settings.outputPrice;
}

async function onSave() {
  const settings = {
    syncEnabled: document.getElementById('syncEnabled').checked,
    inputPrice: Number(document.getElementById('inputPrice').value || DEFAULT_SETTINGS.inputPrice),
    outputPrice: Number(document.getElementById('outputPrice').value || DEFAULT_SETTINGS.outputPrice)
  };
  await saveSettings(settings);
  const status = document.getElementById('status');
  status.textContent = 'Gespeichert.';
  setTimeout(() => (status.textContent = ''), 1500);
}

document.getElementById('save').addEventListener('click', onSave);
init();
