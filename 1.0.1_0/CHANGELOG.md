# Changelog

All notable changes to Grok Toolbox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2024-11-13 - Production Release

### Added
- **Production mode flag** in config.js to disable console logging
- **Privacy Policy** (PRIVACY.md) for Chrome Web Store compliance
- **Comprehensive README** with all features documented
- **CHANGELOG** for version tracking
- Full light/dark mode support with Grok native colors
- Settings modal with feature toggles and feedback form
- Context menu "Send to Grok" for external text selection

### Changed
- Synced version numbers across manifest.json and config.js
- Updated README with accurate feature descriptions
- Wrapped console statements with CONFIG.PRODUCTION checks
- Improved analytics privacy with conditional logging

### Fixed
- Light mode text readability across all modals
- Theme detection and automatic switching
- Console log pollution in production build

## [2.1.0] - 2024-11-10

### Added
- **Pinned Messages** feature with full CRUD operations
- Pin any message within conversations
- Pinned messages modal for quick access
- Navigate back to original conversation from pins
- Import/Export pinned messages
- Free tier limit: 2 pins, Premium: unlimited

### Changed
- Enhanced chat export with 6 formats (PDF, HTML, Markdown, JSON, TXT, Word)
- Improved export quality and formatting
- Better metadata preservation in exports

## [2.0.0] - 2024-11-05 - Major Feature Release

### Added
- **Prompt Library** with 20+ professional default prompts
- Categories: Writing, Coding, Research, Analysis, Creative, Learning
- Custom prompts with variable support (e.g., {topic}, {language})
- Quick insertion into chat
- Import/Export prompt collections
- **Prompt Chains** for multi-step automation
- Create sequences of prompts that execute automatically
- Variable flow between chain steps
- Pause, resume, stop execution controls
- **AI Prompt Enhancement** powered by backend API
- Free tier: 3 enhancements/day, Premium: unlimited
- **Theme Service** for light/dark mode detection
- **API Client** with SWR (stale-while-revalidate) caching
- Premium/Free tier enforcement across all features

### Changed
- Improved analytics system to V2 with deduplication
- SHA-256 fingerprinting for event deduplication
- 7-day TTL for dedup cache
- PII filtering (emails, tokens)
- Enhanced error handling across all modules

### Fixed
- Theme switching edge cases
- Storage synchronization issues
- API client retry logic

## [1.5.0] - 2024-10-25

### Added
- **Bulk Delete** feature for cleaning up conversation history
- Select multiple conversations for deletion
- Batch processing with progress tracking
- Confirmation dialogs to prevent accidents
- Premium-only feature

## [1.1.0] - 2024-10-15

### Added
- Complete **Folder Management System**
- Three-panel interface (folders, chats, preview)
- Drag and drop support for organizing chats
- Nested folders (up to 5 levels deep)
- Custom folder names, icons, and colors
- Import/Export folder structure
- Real-time sync across tabs
- Free tier: 2 folders, Premium: unlimited

### Changed
- Improved UI/UX for folder tree navigation
- Better performance for large folder structures

## [1.0.0] - 2024-10-01 - Initial Release

### Added
- Basic extension structure with Manifest V3
- Button injection into Grok.com sidebar
- Dropdown menu for feature access
- Responsive design adapting to sidebar states
- Chrome storage integration
- Background service worker
- Content script for DOM manipulation
- Extension popup with statistics

### Infrastructure
- Analytics V1 system
- Backend API integration (Railway)
- Chrome permissions setup
- Icon set (16px to 512px)

---

## Release Notes Format

### Added
New features and capabilities

### Changed
Changes to existing functionality

### Deprecated
Features that will be removed in upcoming releases

### Removed
Features that have been removed

### Fixed
Bug fixes and corrections

### Security
Security improvements and vulnerability fixes
