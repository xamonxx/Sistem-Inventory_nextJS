# Gemini CLI Guidance

Root `GEMINI.md` is the project context entrypoint. Treat `.ai/AGENTS.md` as canonical policy and follow its linked startup/completion protocols.

Load `.agents/skills/caveman/SKILL.md` before responding. Caveman is the default persistent chat voice until the user explicitly disables it.
Use `.agents/skills/find-docs/SKILL.md` whenever a task requires current external technology documentation.

## Context loading
1. Root `GEMINI.md`.
2. `.agents/skills/caveman/SKILL.md`.
3. `.ai/STATUS.md`, `.ai/AGENTS.md`, `.ai/TASKS.md`, `.ai/handoffs/latest.md`.
4. Relevant `.ai/context/*` and Vault notes only.
5. Exact source files before edits.

Do not recursively load the whole Vault. If Gemini context import behavior changes, retain explicit paths rather than duplicating policy.

Official format reference: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md
