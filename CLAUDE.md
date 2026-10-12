# Claude Code Project Memory

@.ai/AGENTS.md

Always load `.claude/skills/caveman/SKILL.md` for chat responses. Keep it active unless the user explicitly says `stop caveman` or `normal mode`.
Use `.claude/skills/find-docs/SKILL.md` and `.claude/rules/context7.md` for every external library/framework/API documentation question.

Startup: read `.ai/STATUS.md`, `.ai/CONTEXT.md`, `.ai/TASKS.md`, and `.ai/handoffs/latest.md`; inspect repository drift; load only relevant context; verify source before editing.

Canonical rules remain in `.ai/AGENTS.md`. Do not duplicate or override them through auto-memory. Agent-specific notes: `.ai/agents/claude.md`.
