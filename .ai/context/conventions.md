# Conventions Context

- TypeScript strict; alias `@/*`.
- Server Components by default; add `"use client"` only for browser state/events.
- Server Actions begin `"use server"`; input parsed with Zod/helpers.
- Prisma Decimal is converted before crossing server/client serialization.
- Prefer existing `src/lib` helpers; avoid parallel abstraction conventions.
- Financial/stock multi-write operations use Prisma transaction; Serializable when read-check-write races exist.
- Write `ActivityLog` and revalidate relevant path/tag after successful mutation.
- Preserve snapshots in transaction/invoice rows.
- UI uses shared `src/components/ui.tsx`, Tailwind tokens/CSS variables, and Lucide icons.
- New permanent tests must assert consumer-visible behavior, not implementation text/wiring.
- AI chat responses use the installed `caveman` skill by default. Persisted repository prose does not use stylized caveman grammar.
- Use Context7 `find-docs` before relying on memory for named library/framework/API syntax, configuration, migrations, or version behavior.

Detailed standard: [`Coding Standards`](../../docs/obsidian-vault/08-ENGINEERING/Coding-Standards.md).
