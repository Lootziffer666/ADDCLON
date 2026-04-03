# ADDCLON — Chrome Extension Archive

ADDCLON is a versioned archive and development workspace for custom **Chrome/Browser extensions** focused on enhancing AI chat interfaces and browser productivity workflows.

## What this repo contains

The repository is structured as a **version-based directory archive**, where each folder represents a specific extension version snapshot (e.g. `0.0.2_0`, `1.0.0_0`, `5.25.9_0`). Additionally, it contains a `unified_chat_hub_0` module for cross-platform AI chat integration.

### Known extension types in this archive

| Extension | Purpose |
|-----------|---------|
| **OneClickPrompts** | One-click prompt insertion for ChatGPT, Claude, Gemini, Grok, etc. |
| **Grok Toolbox** | Folder management, prompt library, chat export, bulk delete for Grok.com |
| **Unified Chat Hub** | Cross-platform AI chat productivity layer |

## Structure

```
ADDCLON/
├── 0.0.2_0/          # Version snapshot
├── 0.0.6.2_0/        # Version snapshot (OneClickPrompts)
├── 1.0.0_0/          # Version snapshot
├── 1.0.1_0/          # Version snapshot (Grok Toolbox)
├── ...
├── unified_chat_hub_0/
└── README.md
```

Each version folder contains a self-contained extension with its own `manifest.json`, source files, and (if available) a nested README.

## Development

To load any version as a local Chrome extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the desired version folder (e.g. `1.0.1_0/grok-toolbox-extension`)

## Status

> Active development. See version folders for individual changelogs and feature states.

## Related

- [CATALON](https://github.com/Lootziffer666/CATALON) — UI pipeline system
- [VENT](https://github.com/Lootziffer666/VENT) — Steam utility layer (React Native / Expo)