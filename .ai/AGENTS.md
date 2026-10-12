# Canonical Agent Policy

Applies to every coding agent in this repository.

## Mandatory Caveman skill
- At the start of every session, read `.agents/skills/caveman/SKILL.md` before the first substantive response.
- Keep `caveman` active for all chat responses by default. Only an explicit user instruction `stop caveman` or `normal mode` disables it.
- Follow the installed skill exactly, including persistence, payload accuracy, and safety exceptions.
- Caveman controls chat voice, not repository prose. Code, comments, documentation, issues, changelogs, and memory files remain clear professional language as required by the skill.
- `skills-lock.json` is the installation record. Do not replace the skill with a paraphrased local rule.

## Mandatory Context7 documentation lookup
- For questions or changes involving a named library, framework, SDK, API, CLI, cloud service, configuration option, migration, or library-specific debugging, read `.agents/skills/find-docs/SKILL.md` and use Context7 before answering or editing.
- Resolve the library with `npx ctx7@latest library` before `docs`, unless the user provides a `/org/project` ID.
- Prefer Context7 over generic web search for library/API documentation. Do not use it for project business logic, generic refactoring, code review, or scripts with no external-library question.
- Never send secrets, credentials, personal data, or proprietary source to Context7. Use at most three Context7 commands per question.
- If Context7 fails or reaches quota, report that fact before using a fallback.

## Startup
1. Read `.agents/skills/caveman/SKILL.md`, `.ai/STATUS.md`, `.ai/CONTEXT.md`, this file, `.ai/TASKS.md`, and `.ai/handoffs/latest.md`.
2. Run `git status --short`; preserve user changes.
3. Read only relevant Vault notes, then verify planned edits against source.
4. Run `node scripts/knowledge-sync.mjs check`; source drift requires documentation impact review.
5. Write a short implementation plan before non-trivial edits.
6. When the task matches Context7 scope, read `.agents/skills/find-docs/SKILL.md` before researching implementation details.

## During changes
- Preserve existing behavior unless the user asks to change it.
- Validate untrusted input server-side; enforce authorization at the server mutation/read boundary.
- Identify API, DB, permission, business-flow, cache, audit, and deployment impact.
- Do not read, print, or document `.env`, credentials, keys, tokens, or customer data.
- Do not run destructive migrations, seeds, clears, stock fixes, or production commands without explicit approval.
- Do not overwrite architecture decisions silently; record and resolve conflicts.
- Do not edit generated/dependency output (`.next`, `node_modules`, build artifacts).

## Completion
1. Run behavior-specific smoke/test plus type/lint/build gates relevant to the change.
2. Review `git diff` without reverting unrelated edits.
3. Update affected Vault notes/graphs and `.ai/STATUS.md`, `PROGRESS.md`, `TASKS.md`.
4. Add the daily changelog and session record; update `handoffs/latest.md`.
5. Run `node scripts/knowledge-sync.mjs validate`, then `baseline` after docs reflect source.
6. Report only checks actually observed.

Detailed protocols: [`protocols/startup.md`](protocols/startup.md), [`protocols/change-tracking.md`](protocols/change-tracking.md), [`protocols/documentation-sync.md`](protocols/documentation-sync.md), [`protocols/completion.md`](protocols/completion.md).
