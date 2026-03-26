# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Usage Tracker is a browser extension (Chrome, Firefox, Electron) that monitors and displays token usage statistics for claude.ai conversations. It tracks usage across session (5-hour), weekly, and model-specific limits using data from Claude's `/usage` API endpoint.

## Build & Test

Building and testing is done manually by the developer. After editing `shared/dataclasses.js`, the generated file `content-components/ui_dataclasses.js` must be regenerated via `node scripts/build-dataclasses.js`. Never edit `ui_dataclasses.js` directly.

Linting: `npx eslint .`

## Architecture

### Execution Contexts

The extension runs across three isolated contexts that communicate via message passing:

1. **Background script** (`background.js` + `bg-components/`) - Service worker (Chrome) or background script (Firefox/Electron). Intercepts WebRequests to Claude API, counts tokens, fetches usage data, manages storage.

2. **Content scripts** (`content-components/`) - Injected into claude.ai pages. Each UI component is a self-managing "actor" that listens for messages from background and manages its own DOM lifecycle. Load order matters (defined in manifest).

3. **Injected page-context scripts** (`injections/`) - Run in the page's JS context (not extension context) to intercept fetch() calls. Communicate with content scripts via CustomEvents.

### Background Components

- `bg-components/claude-api.js` - `ClaudeAPI` and `ConversationAPI` classes for HTTP calls to claude.ai endpoints
- `bg-components/tokenManagement.js` - Token counting using o200k_base tokenizer, `TokenStorageManager` for org tracking
- `bg-components/utils.js` - `CONFIG` object (thresholds, model weights, estimated caps), `StoredMap` (async storage wrapper with TTL), logging utilities
- `bg-components/electron-compat.js` - Electron notification compatibility

### Content Script Components (load order)

1. `content_utils.js` - Foundation: logging, `sendBackgroundMessage()`, DOM helpers, color constants, `CONFIG` reference
2. `electron_reciever.js` - Electron bridge: forwards intercepted request events to background
3. `ui_dataclasses.js` - **Generated file** from `shared/dataclasses.js`. `UsageData` and `ConversationData` classes
4. `notification_card.js` - `FloatingCard`, `VersionNotificationCard`, `SettingsCard` - draggable floating UI panels
5. `usage_ui.js` - `UsageUI` actor: sidebar progress bars + chat area quota display
6. `length_ui.js` - `LengthUI` actor: conversation length, message cost, estimated messages remaining

### Data Flow

When a user sends a message: WebRequest intercepts the POST → background captures a usage snapshot → response arrives → background fetches fresh `/usage` data + conversation metrics → pushes `updateUsage` and `updateConversationData` messages to content scripts → UI actors update their displays.

### Key Data Classes (`shared/dataclasses.js`)

- **`UsageData`** - Usage percentages per limit type (session, weekly, sonnetWeekly, opusWeekly) with reset timestamps. Key methods: `getActiveLimits()`, `getMaxedLimits()`, `getLimitingFactor()`, `getEstimatedTokensRemaining()`.
- **`ConversationData`** - Conversation metrics: length, cost, futureCost, cache info, model.

### Platform Differences

- **Chrome**: Service worker with `type: "module"` for background script
- **Firefox**: Background uses `scripts` array (no module support), incognito `not_allowed`
- **Electron**: No native WebRequest API — uses `injections/webrequest-polyfill.js` to intercept fetch() calls

## Code Conventions

- Background scripts and `shared/` use ES6 modules (`import`/`export`). Content scripts use plain script mode with globals.
- ESLint is configured with `sourceType: 'script'` for content scripts and `sourceType: 'module'` for background/shared.
- Message handlers in background use `messageRegistry.register()` pattern.
- Storage uses `StoredMap` wrapper (supports TTL) rather than raw `browser.storage.local`.
- `browser` API (from browser-polyfill) is used everywhere, not `chrome`.
