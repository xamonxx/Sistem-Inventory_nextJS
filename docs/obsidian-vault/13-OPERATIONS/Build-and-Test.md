---
type: operations
status: verified
last_verified: 2026-10-13
source_files: [package.json, package-lock.json, scripts/security-test.ts, scripts/webapp-smoke-test.py]
related: ["[[Testing-Strategy]]", "[[Local-Development]]", "[[Pre-Production-Bug-Audit-and-Plan]]"]
tags: [operations, build, testing]
---
# Build and Test

## Static/build gates
```bash
npm run type-check
npm run lint
npm test
npm run test:idempotency   # DB-backed; local DATABASE_URL only
npm run test:concurrency   # creates/drops a disposable local DB; refuses non-local hosts
npm audit --omit=dev
npm run build
```

`build` menjalankan Prisma generate lalu Next build. Build membutuhkan env/schema yang valid; jangan mengarahkannya ke production DB jika step lain ditambahkan.

Audit 2026-10-13: Prisma validation, type-check, lint, security 58/58, and build 22 routes passed. Dependency gate failed with 1 critical, 8 high, and 3 moderate findings; release remains blocked until the critical/high production advisories are patched or explicitly accepted. See [[Pre-Production-Bug-Audit-and-Plan]].

## Browser smoke
```bash
python scripts/webapp-smoke-test.py \
  --base-url http://127.0.0.1:3000 \
  --server-command "npm run dev -- -H 127.0.0.1 -p 3000"
```

Credential smoke harus diberikan melalui environment/argumen aman; jangan menaruhnya di knowledge base. Default script masih 3000 dan perlu override.

## Knowledge gates
```bash
node --check scripts/knowledge-sync.mjs
node scripts/knowledge-sync.mjs validate
node scripts/knowledge-sync.mjs check
```

`validate` memeriksa wikilink, source reference, dan fence Mermaid. `check` membandingkan source snapshot; drift berarti dokumentasi perlu ditinjau, bukan otomatis salah.
