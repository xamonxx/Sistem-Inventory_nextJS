# Dependencies Context

## Runtime
Next.js 15.5.x, React 19, TypeScript 5.7, Prisma/MySQL, Zod, jose, bcryptjs, Zustand, Tailwind CSS 4, Recharts, ExcelJS, jsPDF/autotable, QRCode, Framer Motion, Lucide.

## Tooling
ESLint 9 + eslint-config-next 15.1.x, tsx, Prisma CLI, Playwright Python smoke script. Deployment pins Node 22.

## External surfaces
- MySQL through `DATABASE_URL`.
- Browser navigation to `wa.me`; no server-side WhatsApp API found.
- GitHub Actions to Hostinger through SSH/SCP.
- Public invoice verify URL uses signed token.

## Audit notes
React Query, TanStack Table, and React Hook Form are declared but import usage was not found. Do not remove based on this note alone; run package/reference/build verification.

See [`Dependency Graph`](../../docs/obsidian-vault/07-KNOWLEDGE-GRAPH/Dependency-Graph.md) and `package.json`.
