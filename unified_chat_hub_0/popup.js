async function withActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await fn(tab.id);
}

document.getElementById('toggle').addEventListener('click', async () => {
  await withActiveTab((tabId) => chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR' }));
  window.close();
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
