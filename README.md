<div align="center">
  <img src="icons/icon-128.png" alt="Stabs Logo" width="96" height="96">
  <h1>Stabs: Tab Preservation & Telegram Backup</h1>
  <p>A Manifest V3 Chrome extension designed to periodically preserve open tabs, tab groups, and windows, syncing them directly to Telegram with full session restore capability.</p>
</div>

## Features

- **Direct Telegram Sync:** Connects directly to the Telegram Bot API (`api.telegram.org`) using your personal bot token and chat ID. Zero external servers or tracking.
- **Single-Message Consolidated Delivery:** Sends the portable `.json` session backup with an informative summary caption in a single unified Telegram message (zero chat clutter).
- **Smart Diff Detection:** Employs SHA-256 hash comparison across open URLs to skip redundant periodic backups when tab state hasn't changed.
- **Complete Session Restoration:** Recreates windows, pinned tabs, and Chrome tab groups (titles and colors) from local snapshot history or imported JSON files.
- **Browser & Device Identifier:** Distinguish backups across multiple machines in your Telegram chat with auto-detected platform labels and customizable device names.
- **Light & Dark Mode Support:** Seamless support for light and dark themes with a one-click header toggle or automatic system matching.
- **Configurable Scheduling & Filtering:** Set custom backup intervals in minutes (or choose standard 15m, 30m, 1h, 4h, or manual only) and define domain exclusion filters (e.g. `localhost`, `127.0.0.1`, `*.internal`).
- **Cross-Platform & Android Support:** Verified for desktop (Chrome, Edge, Brave, Opera, Vivaldi) and Android extension browsers (**Quetta Browser**, **Kiwi Browser**, **Lemur Browser**, and **Firefox for Android**).

## Directory Structure

```
├── manifest.json              # Manifest V3 extension configuration
├── docs/
│   ├── CHROMEWEBSTORE.md      # Store listing, permissions justification & privacy details
│   └── stabs-mvp.md           # MVP architecture, tasks & specification
├── background/
│   └── service-worker.js      # Background worker handling alarms, diff check & sync
├── lib/
│   ├── device.js              # Browser environment & device identifier utility
│   ├── snapshot.js            # Tab, group, and window capture engine
│   ├── telegram.js            # Telegram Bot API client (sendMessage & sendDocument)
│   └── restorer.js            # Multi-window & tab group session reconstructor
├── popup/
│   ├── popup.html             # Clean popup interface (Overview, Restore, Settings)
│   ├── popup.css              # Accessible, high-contrast stylesheet
│   └── popup.js               # Popup event controller & file importer
├── icons/                     # 16px, 48px, 128px PNG extension icons
└── tests/
    └── unit_tests.mjs         # Test suite for extraction, hashing & formatting
```

## Setup & Installation

### Option A: Install via Signed CRX Package
1. Download the latest `stabs-v1.0.0.crx` from [GitHub Releases](https://github.com/Ysn4Irix/Stabs/releases).
2. On desktop, drag and drop the `.crx` file into `chrome://extensions/` with Developer mode enabled.
3. On Android (Quetta Browser, Kiwi, Lemur), open the browser Extensions menu and choose **(from .zip/.crx/.user.js)** to install directly.

### Option B: Load Unpacked Source
1. Open Google Chrome (or Chromium-based browser) and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select this directory (`stabs`).
4. Pin the **Stabs** extension to your toolbar.

## Telegram Bot Configuration

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts to create your bot and obtain your **Bot Token**.
3. Start a conversation with your new bot by clicking **Start** (`/start`).
4. Obtain your numeric **Chat ID** (send a message to `@userinfobot` or check your chat updates).
5. Open Stabs popup -> go to **Settings** -> paste your **Bot Token** and **Chat ID**.
6. Click **Test Connection** to confirm connectivity, then click **Save Settings**.
7. Click **Sync Now** in the Overview tab to send your first backup!

## Development & Testing

```bash
# Run syntax and lint checks
npm run lint

# Run unit tests
npm test

# Build production ZIP package in dist/
npm run build
```

## CI/CD & Release Workflows

This repository follows production-ready GitHub Actions automation and versioning best practices:

- **CI Pipeline (`.github/workflows/ci.yml`):** Automatically executes on pushes and pull requests to `main`. It runs syntax checks, unit tests, AG Kit fast checklist validation, builds the production bundle, and uploads the extension artifact.
- **Release Pipeline (`.github/workflows/release.yml`):** Automatically triggers when pushing a semantic version tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) or via manual dispatch. Validates integrity, builds the distribution `.zip`, creates a GitHub Release, and publishes release notes and downloadable assets.
- **Versioning:** Adheres to Semantic Versioning (`MAJOR.MINOR.PATCH`).
- **Commit Standards:** Follows Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).

## Documentation

- [Chrome Web Store Listing & Privacy Policy](docs/CHROMEWEBSTORE.md): Full store description, review justifications, and privacy disclosures.
- [MVP Architecture & Specification](docs/stabs-mvp.md): Detailed specifications, architectural decisions, and development roadmap.
- [Changelog](docs/CHANGELOG.md): Historical version releases, enhancements, and bug fixes.

