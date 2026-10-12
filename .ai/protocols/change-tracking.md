# Change Tracking Protocol

## Before modification
- Complete startup protocol.
- Identify API, database, permission, business-flow, cache, audit, and deploy impact.
- Record planned work in `.ai/TASKS.md` for non-trivial/multi-session changes.

## During modification
- Preserve behavior not requested.
- Record significant architecture decisions in Vault ADR + `.ai/DECISIONS.md`; routine choices stay in daily/session notes.
- Never revert unrelated user changes.
- Never run destructive DB operation without explicit approval.

## After modification
- Run behavior-specific smoke and relevant static/build checks.
- Review diff.
- Update affected Vault notes/graphs and operational memory.
- Add daily change entry with time, goal, modules, files, before/after, reason, validation, risk, rollback, final status.
- Update handoff and unresolved work.
- Run validator, then refresh source baseline.

## Manual/external edits
`node scripts/knowledge-sync.mjs check` compares source hashes to `.ai/source-manifest.json`. Drift is a review trigger. It cannot infer intent or auto-document semantic changes.
