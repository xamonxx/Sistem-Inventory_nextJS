# Gemini CLI Project Context

@./.ai/AGENTS.md

Always load `.agents/skills/caveman/SKILL.md` for chat responses. Keep it active unless the user explicitly says `stop caveman` or `normal mode`.
Use `.agents/skills/find-docs/SKILL.md` for every external library/framework/API documentation question.

Startup: read `.ai/STATUS.md`, `.ai/CONTEXT.md`, `.ai/TASKS.md`, and `.ai/handoffs/latest.md`; inspect repository drift; load only relevant context; verify source before editing.

Canonical rules remain in `.ai/AGENTS.md`. Agent-specific notes: `.ai/agents/gemini.md`.
