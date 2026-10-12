---
type: engineering
status: verified
last_verified: 2026-10-12
source_files: [tsconfig.json, eslint.config.mjs, src/lib/validation.ts]
related: ["[[Testing-Strategy]]", "[[Data-Integrity]]"]
tags: [engineering, conventions]
---
# Coding Standards

## Terverifikasi dari codebase
- TypeScript strict, ES2022, alias `@/* -> src/*`.
- App Router: page/layout server by default; `"use client"` hanya untuk interaksi; `"use server"` untuk actions.
- Input tidak dipercaya: parse dengan Zod/helper `validation.ts` pada boundary server.
- Uang DB memakai Prisma Decimal; props client dikonversi ke number/string serializable.
- Mutasi lintas tabel memakai Prisma transaction; stok/keuangan sensitif memakai Serializable bila race relevan.
- Auth mutation memakai `requireRole`, bukan hanya hidden UI.
- Mutasi penting menulis `ActivityLog` dan revalidate path/tag.
- Snapshot nama/harga dipertahankan untuk histori transaksi.

## Konvensi perubahan
Pertahankan pola file lokal. Jangan membuat service/abstraction baru jika action + lib domain yang ada cukup. Ubah source contract, caller, tests, dan note terkait sebagai satu cutover.

## Konvensi AI Agent
Setiap Agent wajib membaca `.agents/skills/caveman/SKILL.md` saat startup dan memakai Caveman untuk respons chat. Mode tetap aktif sampai pengguna menulis `stop caveman` atau `normal mode`. Aturan ini tidak mengubah gaya source code atau dokumentasi: artefak repository tetap memakai bahasa profesional yang jelas. Instalasi dan hash upstream tercatat pada `skills-lock.json`.

Context7 wajib digunakan untuk detail library, framework, SDK, API, CLI, cloud service, konfigurasi, migrasi versi, atau debugging yang bergantung pada behavior library. Agent membaca `.agents/skills/find-docs/SKILL.md`, melakukan resolusi library lebih dulu, membatasi maksimal tiga command per pertanyaan, dan tidak mengirim secret atau proprietary source. Context7 tidak menggantikan investigasi business logic lokal.
