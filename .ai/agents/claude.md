# Claude Code Guidance

Root `CLAUDE.md` is project memory. It imports canonical `.ai/AGENTS.md` and points to the startup set. Keep root concise so Claude loads task context progressively.

Load `.claude/skills/caveman/SKILL.md` before responding. Caveman is the default persistent chat voice until the user explicitly disables it.
Use `.claude/skills/find-docs/SKILL.md` and `.claude/rules/context7.md` whenever a task requires current external technology documentation.

Before editing, inspect existing user changes and source evidence. Do not let auto-memory or compacted context override explicit current `STATUS`, user instruction, or verified code.

Official format reference: https://docs.anthropic.com/en/docs/claude-code/memory
