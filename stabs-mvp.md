# Stabs MVP Plan

## Goal
Build a Manifest V3 Chrome extension named Stabs that periodically snapshots open tabs and tab groups, sends diff-checked consolidated backups (JSON document with formatted summary caption in a single message) directly to Telegram, and provides local session restoration with dark/light mode support.

## Architecture & Specifications
- **Manifest:** Manifest V3 (`service_worker`, `action`, permissions: `tabs`, `tabGroups`, `storage`, `alarms`, host permissions: `https://api.telegram.org/*`).
- **Telegram Connection:** Direct client-side calls to Telegram Bot API (`sendDocument` with HTML caption), zero external servers.
- **Diff Detection:** SHA-256 hash comparison of current session URLs against the previous snapshot to prevent redundant Telegram messages.
- **Payload:** Consolidated single-message format containing an attached `stabs-backup-[timestamp].json` file with an informative HTML summary caption (browser/device identifier, window count, tab count, pinned count, highlights).
- **Session Restorer:** Recreates windows, tabs, pinned states, and Chrome tab groups (title, color) from local history or imported JSON files.
- **UI & Controls:** Accessible popup with instant light/dark theme toggle, connection test, manual "Sync Now" button, custom interval configuration, domain exclusion list, and snapshot restore history.

## Tasks
- [x] Task 1: Create `manifest.json` and generate valid pixel-perfect icons (`icons/icon-16.png`, `48.png`, `128.png`). -> Verify: Extension loads unpacked in `chrome://extensions` without errors.
- [x] Task 2: Implement snapshot extraction module (`lib/snapshot.js`) that captures windows, tabs, tab groups, pinned states, and filters excluded domains/incognito. -> Verify: Test extraction outputs clean structured JSON.
- [x] Task 3: Implement Telegram client (`lib/telegram.js`) for `sendMessage` and `sendDocument` with connection validation. -> Verify: Test script validates token and chat ID via `getMe` and delivers a test payload.
- [x] Task 4: Implement background service worker (`background/service-worker.js`) with `chrome.alarms` scheduler and SHA-256 diff detection. -> Verify: Alarm triggers snapshot; duplicate sessions are skipped; new tab additions trigger sync.
- [x] Task 5: Implement session restoration module (`lib/restorer.js`) to reconstruct windows, tabs, and tab groups from snapshot data. -> Verify: Restoring a snapshot opens matching windows and reconstructs named/colored tab groups.
- [x] Task 6: Build popup interface (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`) with connection setup, "Sync Now", settings, and snapshot history with one-click restore. -> Verify: Popup displays live stats, triggers manual sync, and allows configuration without UI console errors.
- [x] Task 7: Build JSON backup import handler in popup to restore sessions from any saved Stabs backup file. -> Verify: Uploading a previous backup file accurately reconstructs all tabs and groups.
- [x] Task 8: Create `CHROMEWEBSTORE.md` with permissions justification, privacy policy declaration, and store metadata. -> Verify: Document conforms to store review checklist.

## Done When
- [x] Extension loads unpacked in Chrome with zero manifest warnings.
- [x] Manual "Sync Now" pushes summary + JSON backup to Telegram chat.
- [x] Periodic alarm runs diff check and only pushes when tabs change.
- [x] Sessions can be restored from local snapshot history or uploaded JSON backup.
- [x] Excluded domains and incognito tabs are properly omitted.
- [x] All UI complies with anti-slop rules (clean typography, no decorative badges/pills, full keyboard navigation).

## Notes
- `chrome.windows` has no `.query()` method; use `chrome.windows.getAll({ populate: true })`.
- Service workers are ephemeral; all state must reside in `chrome.storage.local`.
- Exclude `chrome://*`, `chrome-extension://*`, and user-defined domains from backup payloads.
