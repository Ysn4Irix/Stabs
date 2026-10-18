---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- Stabs Architecture: Chrome MV3 direct client to Telegram Bot API with hybrid delivery (Markdown summary + JSON attachment), diff-checking via SHA-256 to avoid redundant backups, and local session restoration.
