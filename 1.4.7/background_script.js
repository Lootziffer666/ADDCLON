chrome.runtime.onInstalled.addListener((details) => {
  migrateDataToRawFormat();
  if (details.reason === "install") {
    chrome.storage.local.set({
      version: chrome.runtime.getManifest().version,
      permissions: chrome.runtime.getManifest().permissions
    });
  } else if (details.reason === "update") {
    chrome.storage.local.get(['version', 'permissions'], (data) => {
      const currentVersion = chrome.runtime.getManifest().version;
      const currentPermissions = chrome.runtime.getManifest().permissions;

      if (data.version !== currentVersion || JSON.stringify(data.permissions) !== JSON.stringify(currentPermissions)) {
        chrome.notifications.create('updateNotification', {
          title: 'Extension Updated',
          message: 'Please check the extension settings to re-enable if it was disabled due to permission changes.',
          iconUrl: 'icon48.png',
          type: 'basic',
          buttons: [{ title: 'Open Extension Settings' }]
        });

        // Update the stored version and permissions
        chrome.storage.local.set({
          version: currentVersion,
          permissions: currentPermissions
        });
      }
    });
  }
});

// Listen for notification button clicks (correct API usage)
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'updateNotification' && buttonIndex === 0) {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  }
});



chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
});

function decodeHtmlEntitiesManually(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
}

function migrateDataToRawFormat() {
  chrome.storage.local.get(['prompts', 'data_migration_v1_complete'], (data) => {
    if (data.prompts && !data.data_migration_v1_complete) {
      const migratedPrompts = data.prompts.map(prompt => {
        if (typeof prompt === 'string') {
          return decodeHtmlEntitiesManually(prompt);
        }
        if (prompt && prompt.title && prompt.content) {
          return {
            title: decodeHtmlEntitiesManually(prompt.title),
            content: decodeHtmlEntitiesManually(prompt.content)
          };
        }
        return prompt; // Return unchanged if format is unexpected
      });

      chrome.storage.local.set({ prompts: migratedPrompts, data_migration_v1_complete: true });
    }
  });
}
