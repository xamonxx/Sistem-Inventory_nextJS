---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - .github/workflows/deploy.yml
  - package.json
  - next.config.ts
related: ["[[Local-Development]]", "[[Build-and-Test]]", "[[Recovery]]"]
tags: [deployment, operations]
---
# Deployment

## Pipeline aktif
GitHub Actions `.github/workflows/deploy.yml` berjalan saat push ke `master`:
1. Checkout.
2. Node.js 22 + npm cache.
3. `npm ci`.
4. Membuat `.env` build dari GitHub Secrets.
5. `npx prisma generate`.
6. `npm run build`.
7. SSH ke Hostinger, pull, install, generate Prisma, dan menyentuh `tmp/restart.txt`.
8. Upload folder `.next` melalui SCP.

## Runtime scripts
- Development: `next dev --turbo` (port 3000).
- Production: `next start -p 3010` setelah build.
- Build: `prisma generate && next build`.

## Environment names
Hanya nama variabel disimpan di knowledge base: `DATABASE_URL`, `AUTH_SECRET`, `INVOICE_VERIFY_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY_HEADERS`, `SEED_DEFAULT_PASSWORD`, `NEXT_PUBLIC_APP_URL`, identitas perusahaan, dan path/nama tanda tangan.

## Risiko operasional
Pipeline menjalankan build sebelum remote pull, lalu mengunggah `.next`; sinkronisasi artifact dan source bergantung pada kedua langkah berhasil. Tidak ditemukan migration deploy (`prisma migrate deploy`) dalam workflow.
