<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

INPUT_LANGUAGE is english
OUTPUT_LANGUAGE is english

## UI Rule: Prohibit Decorative Badges and Pills

**Default: DO NOT create decorative badges, pills, chips, or tag-shaped labels.**

- Never wrap ordinary metadata, technology names, database types, framework names, feature descriptions, or informational labels in a colored or rounded container.
- Render this information as plain text, subtle secondary text, or within an existing content row.
- Use badges only for meaningful dynamic statuses, alerts, counts, or other cases where visual emphasis provides clear user value.
- Use interactive chips only for genuine user interactions, such as selectable filters.
- Do not introduce new badge variants or badge components merely to decorate a screen.
- Apply this rule consistently across all screens, components, dialogs, cards, and future features.
- When uncertain, choose plain text over a badge.
- During UI reviews, actively identify and remove unnecessary badges from both new and existing interfaces.

## GitHub CI/CD & Releases
Configure production-ready GitHub workflows and version control. Follow Git best practices, use Conventional Commits and Semantic Versioning (`MAJOR.MINOR.PATCH`), automate linting, tests, builds, and security checks on PRs and pushes, and publish tagged releases with changelogs and artifacts. Use GitHub Actions, least-privilege permissions, secure secrets, caching, and fail-fast checks. Never commit secrets, bypass checks, or release broken builds. Document the workflow in `README.md`.
**Git & Release Policy:** Use Conventional Commits and Semantic Versioning (`MAJOR.MINOR.PATCH`). Bump **MINOR** for new features and **PATCH** for bug fixes, refactoring, documentation, and other edits; bump **MAJOR** only for breaking changes. Update the version and changelog accordingly. Commit changes locally; **never push, publish, or sync to any remote** without explicit user authorization.
**Documentation:** Move all Markdown documentation into docs/, except essential root-level files required by tools or platforms (e.g., README.md, AGENTS.md). Preserve required file locations.
**Gitignore:** add .agents/ to .gitignore; keep it untrackable by Git unless explicitly instructed otherwise.