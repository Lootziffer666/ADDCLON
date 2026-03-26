chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle_sidebar') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
});
