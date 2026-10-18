# Changelog

All notable changes to the Stabs extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-10-18

### Fixed
- Restored desktop extension popup dimensions to a dedicated 380px layout, eliminating mobile viewport emulation squeezing.
- Removed mobile viewport meta tag that caused desktop Chromium to collapse popup width to ~185px.
- Fixed text wrapping on status rows with flex constraints and nowrap labels.
- Removed rigid min-height to eliminate dead whitespace on the overview view.
- Added topic ID indicator to Telegram Target in overview status when configured.

## [1.1.0] - 2026-10-18

### Added
- Multi-browser Telegram Supergroup Forum Topic support (`message_thread_id`) via optional Settings input.
- Automatic fallback to general chat if a configured topic is deleted or not found.
- Searchable alphanumeric device hashtags (`#device_[slug]`) and platform tags in Telegram captions.
- Quetta Browser integration and user-agent detection on Android.
- Automated CRX3 package builder with RSA-SHA256 signing (`npm run build`).

### Fixed
- Cross-version `navigator.userAgent` mocking compatibility across Node.js 20 and Node.js 22+.
- Mobile viewport responsive reflow for Android browsers with widths under 380px.
- Platform fallbacks for browsers without multi-window management APIs.

## [1.0.0] - 2026-10-18

### Added
- Manifest V3 extension core for tab and window preservation.
- Direct Telegram Bot API client for consolidated single-message backups (attached JSON document with HTML caption).
- SHA-256 diff detection engine to avoid redundant backups.
- Multi-window and colored tab group restoration engine.
- Light and dark mode popup interface.
- Device identifier generator and custom device naming.
- Custom periodic intervals via `chrome.alarms`.
- GitHub Actions CI/CD workflows and automated release packaging.
