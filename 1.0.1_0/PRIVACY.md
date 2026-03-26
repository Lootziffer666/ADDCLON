# Privacy Policy for Grok Toolbox

**Last Updated: November 13, 2024**

## Overview

Grok Toolbox is committed to protecting your privacy. This privacy policy explains how we collect, use, and protect your information when you use our Chrome extension.

## Information We Collect

### 1. Anonymized Usage Analytics

We collect minimal, anonymized usage data to improve the extension:

- **Install ID**: A randomly generated UUID stored locally to track unique installations (not linked to your identity)
- **Feature Usage**: Which features you use (e.g., folder created, prompt used, export performed)
- **Event Timestamps**: When features are used
- **Session Data**: Session duration and activity patterns
- **Error Events**: Technical errors to help us fix bugs

### 2. Local Storage Data

The following data is stored **only on your device**:

- **Folders**: Your conversation organization structure
- **Prompts**: Custom prompts you create
- **Prompt Chains**: Your automated prompt sequences
- **Pinned Messages**: Messages you pin within conversations
- **Settings**: Your extension preferences
- **Usage Statistics**: Feature usage counts for limit enforcement

### 3. What We DON'T Collect

- ❌ **No Personal Information**: We never collect your name, email, or identity
- ❌ **No Conversation Content**: We never access, store, or transmit your Grok conversations
- ❌ **No Browsing History**: We only work on grok.com and x.com
- ❌ **No Passwords or Credentials**: Never collected or stored
- ❌ **No Location Data**: Not tracked
- ❌ **No Third-Party Sharing**: Your data is never sold or shared

## How We Use Information

### Analytics Usage

- **Improve Features**: Understand which features are most valuable
- **Fix Bugs**: Identify and resolve technical issues
- **Product Development**: Decide what to build next
- **Performance Optimization**: Make the extension faster and more reliable

### Privacy-First Approach

Our analytics system is designed with privacy as the top priority:

1. **Deduplication**: Events are fingerprinted (SHA-256) to prevent duplicate counting
2. **PII Filtering**: Emails and tokens are automatically removed from any data
3. **Batching**: Events are sent in batches every 10 seconds to minimize network usage
4. **No Tracking**: We cannot identify individual users or link actions to real people
5. **Local-First**: All your actual data (folders, prompts, messages) never leaves your device

## Data Storage and Security

### Local Storage

- Your folders, prompts, chains, and pinned messages are stored using Chrome's local storage API
- This data **never leaves your device** unless you manually export it
- Chrome sync storage may be used to backup your Install ID across devices (optional)

### Analytics Backend

- Anonymized usage events are sent to our secure backend (Railway.app)
- Data is transmitted over HTTPS
- No personal identifiers are included in analytics data
- Events are stored for analysis and service improvement

## Chrome Permissions

The extension requests the following permissions:

- **storage**: To save your folders, prompts, and settings locally
- **activeTab**: To interact with Grok.com pages when you use features
- **contextMenus**: To add "Send to Grok" in right-click menu
- **host_permissions (grok.com, x.com)**: To inject features on these sites only

We do NOT request permissions for:
- ❌ Browsing history
- ❌ All websites
- ❌ Cookies
- ❌ User location
- ❌ Identity information

## Premium Features

If you purchase premium features:

- **Email (Optional)**: You may optionally provide an email for account linking
- **Payment Processing**: Handled by Stripe (we never see your payment details)
- **Account Recovery**: Email used only for purchase verification and recovery

## Your Rights

You have the right to:

1. **Access Your Data**: Export all your local data using built-in export features
2. **Delete Your Data**: Uninstall the extension to remove all local data
3. **Opt-Out of Analytics**: Disable analytics in extension settings (coming soon)
4. **Request Deletion**: Contact us to delete any backend analytics data

## Data Retention

- **Local Data**: Retained until you uninstall or manually delete
- **Analytics Data**: Retained for 90 days, then automatically deleted
- **Account Data**: Retained while your account is active, deleted on request

## Third-Party Services

We use the following third-party services:

- **Railway.app**: Backend hosting for analytics and API services
- **Stripe** (Premium only): Payment processing (separate privacy policy applies)

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted in the extension update notes.

## Children's Privacy

Grok Toolbox is not intended for children under 13. We do not knowingly collect information from children.

## Contact Us

For privacy questions or concerns:

- **Email**: [support@groktoolbox.com]
- **GitHub**: [repository link]

## Compliance

This privacy policy complies with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

---

**Summary**: We collect minimal, anonymized usage data to improve the extension. Your actual content (folders, prompts, conversations) never leaves your device. We don't track you, sell your data, or collect personal information.
