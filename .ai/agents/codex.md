# Codex Guidance

Root `AGENTS.md` is the repository instruction entrypoint. It delegates canonical operational rules to `.ai/AGENTS.md`.

Load `.agents/skills/caveman/SKILL.md` before responding. Caveman is the default persistent chat voice until the user explicitly disables it.
Use `.agents/skills/find-docs/SKILL.md` whenever a task requires current external library, framework, SDK, API, CLI, cloud-service, migration, or configuration documentation.

Codex should load the startup set, then only task-relevant Vault notes and source. Nested `AGENTS.md` files are not currently used; if added later, document their scope and ensure they do not conflict with the root policy.

Official format reference: https://developers.openai.com/codex/guides/agents-md
