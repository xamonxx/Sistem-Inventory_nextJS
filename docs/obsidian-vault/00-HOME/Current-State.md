---
type: status
status: verified
last_verified: 2026-10-12
related: ["[[Known-Bugs]]", "[[Technical-Debt]]", "[[Change-Index]]"]
tags: [status, operations]
---
# Current State

## Implementasi aktif
- App Router dengan server components untuk pengambilan data dan client components untuk interaksi.
- Server Actions menangani mutasi utama; tiga Route Handlers menangani pencarian, notifikasi, dan logout.
- MySQL + Prisma; stok dihitung sebagai `Item.stokAwal + SUM(StockLedger.qty)`.
- Tiga role: `ADMIN_KASIR`, `ADMIN_GUDANG`, `ADMIN_NONGUDANG`.
- Domain non-gudang terpisah dari stok gudang.

## Kondisi working tree saat discovery
Repository sudah memiliki banyak perubahan source code yang belum di-commit sebelum knowledge system dibuat. Knowledge system tidak mengubah business logic dan tidak menghapus perubahan tersebut. Lihat `.ai/STATUS.md` untuk ringkasan operasional.

## Drift/inkonsistensi terverifikasi
- `README.md` masih menyebut development port 3000 dan artefak importer/export route yang tidak ditemukan pada tree aktif.
- `package.json` dev, README, `.claude/launch.json`, dan smoke script seragam di port 3000.
- `scripts/webapp-smoke-test.py` default ke port 3000.
- Manifest dependency Next.js dan `eslint-config-next` tidak berada pada versi minor yang sama.
- Beberapa dependency tercantum tetapi tidak ditemukan penggunaannya di `src`: React Query, TanStack Table, React Hook Form.

## Observasi runtime terbaru
Dev server Turbopack di Windows pernah gagal menulis `.next/static/development/_buildManifest.js.tmp.*` dengan `ENOENT`. Ini observasi runtime, bukan kesimpulan akar masalah. Lihat [[Known-Bugs]].

## Build gates terbaru
- `npm run lint`: lulus pada 2026-10-12.
- `npm test`: lulus 58, gagal 0 pada security validation.
- `npm run type-check`: gagal pada `KasirClient.tsx:385` karena `res.grandTotal` dapat `undefined`; lihat [[Known-Bugs]] KB-002.
- Production build dan browser smoke tidak dijalankan setelah kegagalan type-check.

Saat validasi berlangsung, drift eksternal terdeteksi pada UI POS/navigation/stock/user dan label export. Perubahan bermakna yang ditemukan: filter kategori item pada `KasirClient`; dokumentasi komponen telah disinkronkan. Perubahan source tersebut bukan dibuat oleh fase knowledge system.

## Kebijakan AI Agent
Skill suite `JuliusBrussee/caveman` terpasang project-scoped. Semua Agent wajib membaca `.agents/skills/caveman/SKILL.md` dan memakai Caveman untuk respons chat sampai pengguna menulis `stop caveman` atau `normal mode`. Source skill dan hash instalasi tercatat di `skills-lock.json`; artefak repository tetap menggunakan bahasa profesional.

Context7 terpasang melalui `npx ctx7 setup --cli --project -y`. Skill universal berada di `.agents/skills/find-docs`, sedangkan Claude memakai `.claude/skills/find-docs` dan `.claude/rules/context7.md`. Agent wajib menggunakannya untuk detail library/API terbaru, tidak untuk business logic lokal, dan tidak boleh mengirim secret atau proprietary source.
