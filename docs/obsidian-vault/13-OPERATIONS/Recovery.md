---
type: operations
status: verified
last_verified: 2026-10-13
source_files: [.github/workflows/deploy.yml, package.json, prisma/schema.prisma]
related: ["[[Deployment]]", "[[Risks]]", "[[Data-Integrity]]", "[[Pre-Production-Bug-Audit-and-Plan]]"]
tags: [operations, recovery]
---
# Recovery

## Current verified state
Tidak ditemukan script backup, restore, point-in-time recovery, migration rollback, atau runbook Hostinger pada repository. Recovery produksi belum dapat dianggap teruji.

## Safe incident order
1. Hentikan write traffic bila integritas data terancam.
2. Catat waktu, endpoint/action, actor, dan identifier dokumen tanpa menyalin secret.
3. Ambil backup konsisten dari MySQL melalui fasilitas host/operator.
4. Verifikasi schema terhadap `prisma/schema.prisma`; jangan langsung menjalankan `db push` pada production.
5. Restore ke database terisolasi dan rekonsiliasi `Item.stokAwal + StockLedger.qty`, invoice/payment, return, serta nomor `Counter`.
6. Smoke login/read/report pada environment terisolasi.
7. Cutover hanya setelah owner menyetujui RPO/RTO dan hasil rekonsiliasi.

## Application rollback
Workflow deploy menarik branch `master` lalu mengunggah `.next`. Rollback kode memerlukan checkout revision yang disetujui, install/generate/build ulang, dan restart. Karena migration history tidak tersedia, kode rollback dapat tidak kompatibel dengan schema; verifikasi sebelum deploy.

## Gap

Audit 2026-10-13 keeps recovery as a production release blocker. No restore evidence, migration history, rollback rehearsal, or documented RPO/RTO was found.
Tetapkan backup frequency, retention, encryption, restore owner, RPO/RTO, dan uji restore berkala.
