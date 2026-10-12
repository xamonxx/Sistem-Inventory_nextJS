---
type: operations
status: verified
last_verified: 2026-10-12
source_files: [package.json, scripts/security-test.ts, scripts/webapp-smoke-test.py]
related: ["[[Testing-Strategy]]", "[[Local-Development]]"]
tags: [operations, build, testing]
---
# Build and Test

## Static/build gates
```bash
npm run type-check
npm run lint
npm test
npm run build
```

`build` menjalankan Prisma generate lalu Next build. Build membutuhkan env/schema yang valid; jangan mengarahkannya ke production DB jika step lain ditambahkan.

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
