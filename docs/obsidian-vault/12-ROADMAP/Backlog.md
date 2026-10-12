---
type: roadmap
status: verified
last_verified: 2026-10-12
related: ["[[Improvements]]", "[[Technical-Debt]]", "[[Risks]]"]
tags: [roadmap, backlog]
---
# Backlog

Daftar pekerjaan teridentifikasi, bukan komitmen jadwal.

| Priority | Item | Evidence |
|---|---|---|
| Selesai | Samakan role guard pada seluruh read page domain | [[Authorization]], R-01 |
| P0 | Tetapkan backup/restore dan uji recovery | [[Recovery]], R-04 |
| P1 | Tambahkan integration test checkout, retur, payment, invoice edit/delete | [[Testing-Strategy]], R-08 |
| P1 | Introduce migration history dan `prisma migrate deploy` pada CI/CD | [[Deployment]], R-03 |
| Selesai | Samakan port launcher/smoke/README dengan dev 3000 | [[Technical-Debt]] |
| P2 | Audit dependency/caller tidak terpakai | [[Dependency-Graph]] |
| P2 | Evaluasi immutable/external audit retention | [[Risks]] |
