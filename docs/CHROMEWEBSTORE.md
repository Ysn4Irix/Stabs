# Chrome Web Store Listing: Stabs

> Last Updated: 2026-10-18

## Store Listing

**Extension Name** [REQUIRED]
Stabs: Tab Preservation & Telegram Backup

**Short Description** [REQUIRED]
Periodically preserve open tabs and synchronize session backups directly with Telegram.

**Detailed Description** [REQUIRED]
Stabs is a lightweight session preservation tool that automatically archives your open tabs, tab groups, and window layouts to your private Telegram chat.

Key Features:
- Scheduled backups: Automatically snapshot tabs on a custom minute interval or predefined schedule (15m, 30m, 1h, 4h).
- Smart diff detection: Compares tab state with SHA-256 digests so unchanged sessions never spam your Telegram chat.
- Consolidated backup payload: Delivers your portable session JSON file with an overview caption in a single Telegram message.
- Full session restoration: Reconstruct windows, tabs, pinned states, and named tab groups with one click from local history or imported backup files.
- Light and dark mode: Fully accessible themes with quick header toggle and system preference synchronization.
- Browser and device identifier: Auto-detects device type and allows custom labels to easily distinguish backups from multiple computers.
- Privacy-first direct sync: All communications travel directly between your browser and api.telegram.org using your own bot token. No intermediary servers, accounts, or trackers.
- Domain filtering: Exclude local networks, intranets, or sensitive websites from being captured.
- Mobile browser ready: Verified with Android extension browsers including Quetta Browser, Kiwi Browser, and Lemur Browser.

How to Use:
1. Open the Stabs extension popup.
2. In Settings, enter your Telegram Bot Token (from @BotFather) and your personal or channel Chat ID.
3. Click "Test Connection" to verify bot reachability, then save.
4. Click "Sync Now" to send an instant snapshot, or let the periodic timer run quietly in the background.
5. In the Restore tab, browse previous snapshots or import saved JSON files to restore your session.

Privacy and Data Use:
Stabs operates entirely on-device and connects only to Telegram's official API to deliver your backups. No browsing history, telemetry, or personal data is collected or transmitted to any third party.

Support:
Submit issues or feature requests via the project repository.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Periodically snapshot open tabs and tab groups to a user's Telegram chat with full session restore capability.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128x128 PNG | Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280x800 | Not created | |
| Screenshot 2 [RECOMMENDED] | 1280x800 | Not created | |
| Small Promo Tile [RECOMMENDED] | 440x280 | Not created | |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| tabs | permissions | Needed to inspect open tab titles and URLs to generate session snapshots and recreate tabs during restoration. |
| tabGroups | permissions | Needed to preserve and restore user-organized tab group colors, titles, and grouping structures. |
| storage | permissions | Needed to persist local snapshot history, sync timestamps, bot credentials, and user preferences locally on the device. |
| alarms | permissions | Needed to schedule periodic background sync checks according to the user's selected interval. |
| https://api.telegram.org/* | host_permissions | Required to transmit backup messages and JSON files directly to the official Telegram Bot API without an intermediary server. |

## Privacy & Data Use

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Web history (open tab URLs) | Yes | Yes (Directly to user's Telegram) | Core functionality: backing up user tabs to their private Telegram chat. | No (Sent only to Telegram as directed by user). |
| Authentication info (Bot token) | Yes (stored locally) | No | Authenticating requests to Telegram Bot API. | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-10-18 | Initial release with periodic diff-checked sync, Telegram hybrid delivery, and session restore. | Draft |
