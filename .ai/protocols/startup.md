# Startup Protocol

## Level 1 — mandatory
1. Read `.agents/skills/caveman/SKILL.md`; activate it for chat unless the user explicitly disabled it.
2. Read `.ai/STATUS.md`, `.ai/CONTEXT.md`, and `.ai/AGENTS.md`.
3. Read `.ai/TASKS.md` and `.ai/handoffs/latest.md`.
4. Run `git status --short`; classify pre-existing user changes.
5. Run `node scripts/knowledge-sync.mjs check`; inspect drift list.
6. If the task concerns a library, framework, SDK, API, CLI, cloud service, migration, configuration, or library-specific bug, read `.agents/skills/find-docs/SKILL.md` and use Context7.

## Level 2 — task context
Read `.ai/context/<relevant>.md` and only the affected Vault module/API/database/business-flow notes.

## Level 3 — deep investigation
Read exact source, callers, schema/relations, decisions, and relevant history. Source wins when docs conflict; update stale docs in the same change.

## Before implementation
State a short plan with affected contracts, dependencies, behavior proof, and safety constraints. Never request information already available in repository/config/docs.
