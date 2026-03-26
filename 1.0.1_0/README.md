# Grok Toolbox Chrome Extension

A powerful Chrome extension that supercharges your Grok.com experience with professional-grade productivity tools.

## Features

### ✅ **📁 Folder Management** - Complete
Organize your Grok conversations with a powerful folder system:
- Create unlimited folders with custom names, icons, and colors
- Drag and drop chats into folders for easy organization
- Support for nested folders (up to 5 levels deep)
- Bulk operations for managing multiple chats at once
- Search and filter chats by folder
- Import/Export folder structure for backup
- Real-time sync across tabs

### ✅ **📌 Pinned Messages** - Complete
Never lose important information:
- Pin key messages within any conversation
- Quick access to all pinned messages via modal
- Navigate back to original conversation context
- Import/Export pinned messages
- Free tier: 2 pins, Premium: unlimited

### ✅ **📚 Prompt Library** - Complete
Boost productivity with ready-to-use prompts:
- 20+ professional default prompts across categories
- Create custom prompts with variable support
- Quick insertion into chat
- Import/Export prompt collections
- Free tier: 2 custom prompts, Premium: unlimited

### ✅ **⛓️ Prompt Chains** - Complete
Automate multi-step workflows:
- Create sequences of prompts that execute automatically
- Variables flow between steps
- Pause, resume, or stop execution
- Perfect for complex research or analysis tasks
- Free tier: 1 chain, Premium: unlimited

### ✅ **🗑️ Bulk Delete** - Complete
Clean up your conversation history efficiently:
- Select multiple conversations for deletion
- Batch processing with progress tracking
- Confirmation dialogs to prevent accidents
- Premium feature

### ✅ **💾 Chat Export** - Complete
Export conversations in multiple formats:
- PDF, HTML, Markdown, JSON, TXT, Word
- Preserves formatting and structure
- Includes conversation metadata
- Free tier: 5 exports/day, Premium: unlimited

### ✅ **✨ AI Prompt Enhancement** - Complete
Improve your prompts with AI assistance:
- Automatically enhance prompts for better results
- Powered by backend AI service
- Free tier: 3 enhancements/day, Premium: unlimited

## Installation

### Developer Mode Installation (Current)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" button
4. Select the `grok-toolbox-extension` folder
5. The extension icon should appear in your Chrome toolbar

### Usage

1. Navigate to [grok.com](https://grok.com) or [x.com](https://x.com)
2. Look for the "Grok Toolbox" button in the sidebar (between Search and Voice buttons)
3. Click the button to reveal the dropdown menu with available options
4. The extension adapts to both collapsed and expanded sidebar states

## File Structure

```
grok-toolbox-extension/
├── manifest.json       # Extension configuration
├── content.js         # Main content script for DOM manipulation
├── background.js      # Background service worker
├── styles.css         # Styling for the injected elements
├── popup.html         # Extension popup interface
├── popup.js           # Popup functionality
├── icons/             # Extension icons
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md          # This file
```

## Premium Features

- **Free Tier**:
  - 2 folders
  - 5 daily exports
  - 2 custom prompts
  - 1 prompt chain
  - 3 daily prompt enhancements
  - 2 pinned messages
  
- **Premium Tier**:
  - Unlimited folders
  - Unlimited exports
  - Unlimited custom prompts
  - Unlimited prompt chains
  - Unlimited prompt enhancements
  - Unlimited pinned messages
  - Bulk delete feature
  - Priority support

## Tech Stack

- **Manifest V3** - Latest Chrome extension standard
- **Vanilla JavaScript** - No framework dependencies
- **Chrome Storage API** - Local and sync storage
- **Service Worker** - Background task processing
- **Content Scripts** - DOM manipulation and UI injection
- **Privacy-First Analytics** - SHA-256 fingerprinting, PII filtering

## Development

### Testing the Extension

1. After loading the extension, open the Chrome DevTools Console (F12)
2. Navigate to grok.com
3. You should see console logs starting with `[Grok Toolbox]`
4. Click the Grok Toolbox button to test the dropdown
5. Each menu item will show an alert (placeholder functionality)

### Modifying the Extension

1. Edit any of the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Grok Toolbox extension card
4. Reload the grok.com page to see your changes

## Troubleshooting

### Button not appearing
- Ensure you're on grok.com or x.com
- Refresh the page
- Check the console for any error messages
- Try reloading the extension from chrome://extensions/

### Dropdown not working
- Check if JavaScript is enabled
- Look for console errors
- Ensure the extension has proper permissions

## Architecture

The extension follows a modular service-oriented architecture:

- **Services**: Reusable business logic (FolderService, PromptLibraryService, etc.)
- **Modals**: UI components for feature interactions
- **Content Script**: Main orchestrator, theme management, button injection
- **Background Worker**: API calls, analytics batching, message passing
- **Config**: Centralized configuration with frozen objects

## Version History

- **v2.2.0** - Production Release
  - All 7 core features complete and tested
  - Prompt chains with multi-step automation
  - AI-powered prompt enhancement
  - Full light/dark mode support
  - Privacy-first analytics V2
  - Premium/Free tier system
  - Context menu "Send to Grok"
  - Settings modal with feature toggles

- **v2.1.0** - Pinned Messages & Export
  - Pinned messages feature
  - 6 export formats (PDF, HTML, Markdown, JSON, TXT, Word)
  - Bulk delete implementation
  
- **v2.0.0** - Major Feature Release
  - Prompt library with 20+ default prompts
  - Custom prompts with variables
  - Theme detection and switching
  - API client with SWR caching

- **v1.0.0** - Initial Release
  - Folder management system
  - Basic button injection and dropdown menu

## Privacy & Data

- **No personal data collected** - Only anonymized usage analytics
- **Local storage only** - All your data stays on your device
- **Optional sync** - Chrome sync storage for ID recovery across devices
- **SHA-256 fingerprinting** - Deduplicated analytics events
- **PII filtering** - Emails and tokens automatically redacted

## Support

For issues, questions, or feature requests, please contact [support email].

## License

Proprietary. All rights reserved.

---

Made with ❤️ for the Grok community
