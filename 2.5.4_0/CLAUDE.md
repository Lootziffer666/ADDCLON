# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A browser extension ("Claude Toolbox" / "Claude QoL") that adds features to claude.ai: global search, chat search, forking/compacting, export/import, TTS, STT, navigation/bookmarks, per-chat style selector, and preferences switching. It ships for Chrome, Firefox, and the Electron desktop client.

## Build & Development

No bundler, no transpiler. Raw JS files loaded directly by the manifest.

### Building
```bash
# Produces three zips in web-ext-artifacts/ (Chrome, Firefox, Electron)
build.bat
```

The build script copies each platform manifest (`manifest_chrome.json`, `manifest_firefox.json`, `manifest_electron.json`) to `manifest.json`, runs `web-ext build`, then deletes `manifest.json`. The working `manifest.json` is gitignored.

### Hot-Reload Development (Chrome)
```bash
web-ext run --target=chromium --chromium-profile="C:\Users\lugia19\AppData\Local\Google\Chrome\User Data\Default"
```
Content scripts reload on page refresh. You must log in to claude.ai manually each session.

## Architecture

### Two Content Script Worlds

The extension runs two sets of content scripts, each in a different world:

**ISOLATED world** (`document_idle`) - Cannot access page JS but has `chrome.storage` API access. Owns all UI: top-right buttons, modals, settings. Feature modules here are IIFEs that register buttons via `ButtonBar` / `MessageButtonBar` and build all user-facing UI.

**MAIN world** (`document_start`) - Can access page JS, used exclusively for `fetch()` interception. Each script monkeypatches `window.fetch` to intercept, modify, or fake API responses. Cannot access `chrome.*` APIs.

Communication between worlds happens via `window.postMessage` with typed `{ type: '...' }` messages and request/response patterns using `messageId` or `requestId` for correlation.

### Helpers (`content/helpers/`) - Shared by both worlds

- **`claude-styles.js`** - The core UI framework. Provides:
  - `CLAUDE_CLASSES` - Tailwind class strings matching Claude's native UI
  - `ClaudeModal` - Modal dialog class with `addCancel()`, `addConfirm()`, `show()`, `destroy()`
  - `createClaudeButton(content, variant, onClick)` - variants: `'primary'`, `'secondary'`, `'icon'`, `'icon-message'`
  - `createClaudeInput()`, `createClaudeSelect()`, `createClaudeToggle()`, `createClaudeTooltip()`
  - `showClaudeAlert()`, `showClaudeConfirm()`, `showClaudePrompt()`, `createLoadingModal()`
  - `ButtonBar` singleton - Manages top-right button injection. Features register via `ButtonBar.register({ buttonClass, createFn, tooltip, pages, ... })` where `pages` is an array of page groups: `'chat'`, `'home'`, `'coworkHome'`, `'codeHome'`, `'coworkChat'`, `'codeChat'`, `'project'`
  - `MessageButtonBar` singleton - Manages per-message buttons (fork, bookmark, TTS speak, advanced edit). Features register via `MessageButtonBar.register({ buttonClass, target, createFn, pages, ... })` where `target` is `'assistant'` or `'user'`
  - `pageLayouts` - Layout registry that detects the current page type and finds DOM anchor points for button injection. Handles multiple layouts: `chatActions`, `chatWiggle`, `homeWeb`, `homeDesktop`, `coworkHome`, `coworkChat`, `codeHome`, `codeChat`, `project`
  - `getUIMessages()` - Returns `{ assistantMessages, userMessages, allMessages }` from the DOM

- **`claude-api.js`** - API abstraction layer. Key classes:
  - `ClaudeConversation` - Wraps a conversation. Methods: `getMessages(tree)`, `setCurrentLeaf()`, `findLongestLeaf()`, `create()`, `delete()`, `sendMessageAndWaitForResponse()`, static `extractMessageText(msg)`, static `fromChatlog()`
  - `ClaudeMessage` - Wraps a message. Properties: `uuid`, `sender`, `text`, `content`, `parent_message_uuid`, `files`. Methods: `attachFile()`, `removeFile()`, `addFile()`, `toHistoryJSON()`, `toCompletionJSON()`
  - `ClaudeFile`, `ClaudeAttachment`, `ClaudeCodeExecutionFile` - File type wrappers
  - `ClaudeProject` - Project API wrapper. Methods: `getData()`, `getSyncs()`, `getDocs()`, `getFiles()`, `downloadFile()`, `downloadAttachment()`
  - `getOrgId()` - Extracts org ID from page state
  - `getConversationId()` - Extracts conversation ID from URL
  - API helpers: `listStyles()`, `createStyle()`, `updateStyle()` for managing Claude's style system

- **`databases.js`** - IndexedDB layer using Dexie. Three databases:
  - `ClaudeSearchDB` - Search index (metadata + encrypted message text)
  - `ClaudeExportDB` - Conversation cache for export
  - `ClaudePhantomMessagesDB` - Phantom message storage
  - All data is AES-GCM encrypted at rest. The encryption key is stored as a Claude "style" (via `createStyle()` API) so it persists across devices. Includes encrypt-on-read migration for legacy plaintext data.
  - Exposes a `postMessage` bridge so MAIN world scripts can access IndexedDB through the ISOLATED world.

- **`shortcuts.js`** - `ShortcutManager` singleton for configurable keyboard shortcuts. Stores in `chrome.storage.local`.

- **`tts-providers.js`** / **`stt-providers.js`** - Provider abstractions (ElevenLabs, OpenAI, Groq, Browser native) with base classes `TTSProvider` / `STTProvider`.

### ISOLATED World Feature Modules (`content/isolated/`)

Each is an IIFE that registers its buttons on load:

- **`global-search.js`** - Global text search across all chats. Syncs conversation text to IndexedDB, intercepts Claude's search API to return local results.
- **`chat-search.js`** - In-chat text search across all branches of the conversation tree.
- **`navigation.js`** - Bookmark system for conversation tree positions + user-message navigation arrows. Bookmarks stored in `localStorage`.
- **`tts.js`** - Text-to-speech with per-message speak buttons, auto-speak, and "actor mode" (character-to-voice mapping).
- **`stt.js`** - Speech-to-text microphone button injected next to the send button.
- **`exporter.js`** - Export (ZIP/HTML/JSON/TXT/JSONL) and import (ZIP) of chats and projects. Handles GDPR export import too.
- **`pref-switcher.js`** - Sidebar dropdown for switching between saved preference presets. Uses `BroadcastChannel` for cross-tab sync.
- **`perchat-styles.js`** - Per-chat style override selector. Stores style per conversation in `chrome.storage.local`.
- **`notifications.js`** - Version update notification cards.

### MAIN World Interceptors (`content/main/`)

All monkeypatch `window.fetch`:

- **`phantom-messages.js`** - Intercepts conversation fetch to inject "phantom messages" (forked conversation history). Also intercepts `navigator.clipboard.write` to strip phantom/UUID markers from copied text. Injects UUID markers into assistant messages so the DOM can be tagged with `data-message-uuid`.
- **`search-interceptor.js`** - Intercepts search API calls, asks ISOLATED world whether to return custom results.
- **`forking.js`** - Fork/compact modal UI. Creates new conversations with previous chat content as phantom messages or summarized.
- **`edit-files.js`** - Advanced edit modal that intercepts the edit completion request to let users modify files/attachments and style before submitting.
- **`file-download.js`** - Adds download buttons to project file thumbnails and file previews.
- **`pref-switcher-fetch-watcher.js`** - Watches for `PUT /api/account_profile` to notify other tabs via `BroadcastChannel`.
- **`styles-fetch-interceptor.js`** - Filters internal styles (temp edit style, encryption key) from `list_styles` responses. Injects per-chat style overrides into completion requests.
- **`tts-interceptor.js`** - Intercepts `navigator.clipboard.write` for TTS copy-to-speak. Monitors completion streams for auto-speak. Handles dialogue analysis requests via throwaway conversations.

### Fetch Interception Chain

Multiple MAIN world scripts patch `window.fetch` in sequence. Each stores a reference to the previous `window.fetch` before patching. The chain order is determined by script load order in the manifest. Scripts must be careful to call the previous fetch (not `window.fetch`) to avoid infinite loops.

### Background Script (`background.js`)

Minimal - handles GDPR export download/unzip and the extension icon click (opens Ko-fi page).

### Third-Party Libraries (`lib/`)

Vendored minified libs: Dexie (IndexedDB), JSZip, mime, marked (Markdown), highlight.js.

## Desktop Client Button Injection

**Never inject inside native containers** (`chat-actions`, `wiggle-controls-actions`) - this rearranges native buttons on the desktop Electron client. The `ButtonBar` creates a sibling `.toolbox-buttons` container instead.

Chat page has two layouts:
1. `chat-actions` present: parent is horizontal flex, normal sibling works.
2. `wiggle-controls-actions` only: parent is `flex-col relative`. Container uses `absolute top-0 z-20` with dynamic `right` = `wiggleControls.offsetWidth + 4px`.

Homepage has two environments:
1. Web UI: ghost button inside `#main-content` -> insert next to its `z-header` wrapper.
2. Desktop client: ghost button in Electron title bar -> own absolute container inside `#main-content`.

## Testing Features in Browser

Key UI elements added to claude.ai (top-right of page):
- Search icon (Q) - Global/chat search
- Navigation arrow - Chat navigation/bookmarks
- Pen icon - Style selector (per-chat style override)
- Download icon - Export/Import modal
- Microphone - Speech to text settings
- Speaker - Text to speech settings
