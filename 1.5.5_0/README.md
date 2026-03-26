# Grok Rate Limit Display Chrome Extension

A Chrome extension that displays remaining query limits on grok.com, originally ported from CursedAtom's extension by Blankspeaker.

## Features

- **Real-time Rate Limit Display**: Shows remaining queries for different Grok models
- **Model Detection**: Automatically detects which Grok model you're using (Grok 3, Grok 4, etc.)
- **Smart Polling**: Updates rate limits when needed without excessive API calls
- **Countdown Timer**: Shows time until rate limit reset when limits are reached
- **Click to Refresh**: Click the rate limit display to manually refresh
- **Think/Search Mode Detection**: For Grok 3, detects when Think or Deep Search modes are enabled
- **Extension Popup**: Click the extension icon for author info and support options
- **Smart Text Overlap**: Hides display when typing (immediately on small screens <900px, >28 characters on larger screens)

## Installation

1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will automatically activate on grok.com

## Usage

The extension automatically runs when you visit grok.com and displays the rate limit information next to the model selector in the query bar. The display shows:

- **Single number**: Remaining queries for the current model
- **Two numbers with divider**: High effort | Low effort queries (for Auto mode)
- **Red countdown timer**: Time until rate limit reset when limits are reached
- **Click to refresh**: Click the display to manually update rate limits

## Model Support

- Grok 3 (Fast)
- Grok 4 (Expert) 
- Grok 4 Heavy
- Grok 4 Auto (shows both high and low effort limits)
- Grok 4 Fast
- Grok 4.1 (uses low effort rate limits)
- Grok 4.1 Thinking (uses high effort rate limits)

## Smart Features

- **Overlap Detection**: Automatically hides rate limit display when long text input would overlap it
- **Real-time Updates**: Responds immediately to text input changes and model selections
- **Intelligent Positioning**: Finds the best position in the UI without interfering with functionality

## Attribution

- **Original Author**: Blankspeaker (@blankspeaker)
- **Based on**: CursedAtom's original Chrome extension
- **License**: MIT

## Version History

### v1.0
- Initial Chrome extension release
- Support for all Grok models: Grok 3, Grok 4, Grok 4 Heavy, Grok 4 Auto, Grok 4 Fast, Grok 4.1, and Grok 4.1 Thinking
- Real-time rate limit display with countdown timers
- Smart overlap detection with space-aware responsiveness (immediate hiding on small screens, 28 chars on large screens)
- Model-aware effort level detection (high/low effort rate limits)
- **Cost-aware calculations**: Correctly handles when users don't have enough tokens for high-cost models
- Extension popup with author attribution and support links
- Efficient API caching and rate limiting

## License

MIT License - see original script for full details.
