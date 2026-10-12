# Active Decisions

Only current operational decisions are duplicated here; rationale/details remain in the Vault.

1. **Source code is implementation truth.** Knowledge notes are verified representations, never authority over conflicting code.
2. **Progressive context loading.** Read startup files, then task notes, then source detail/history only as needed.
3. **Stock is ledger-derived.** See [`ADR-001`](../docs/obsidian-vault/09-DECISIONS/ADR/ADR-001-Stock-as-Ledger-Derivative.md).
4. **Main mutations use Server Actions + role guards.** See [`ADR-002`](../docs/obsidian-vault/09-DECISIONS/ADR/ADR-002-Server-Actions-and-Role-Guards.md).
5. **Non-gudang is a separate business domain.** See [`ADR-003`](../docs/obsidian-vault/09-DECISIONS/ADR/ADR-003-Separate-Non-Warehouse-Domain.md).
6. **No silent conflict overwrite.** Record conflict, verify current code and active user instruction, then obtain approval for unresolved architectural choice.
7. **No destructive DB operation without explicit approval and verified target/recovery.**
8. **Caveman is the default persistent chat-response skill.** Every Agent reads `.agents/skills/caveman/SKILL.md` at startup. Only explicit `stop caveman` or `normal mode` disables it. Persisted repository prose remains professional.
9. **Context7 is mandatory for external technology documentation.** Use `.agents/skills/find-docs/SKILL.md` for current library/API details. Keep queries free of secrets and proprietary code.
