---
type: frontend-components
status: verified
last_verified: 2026-10-13
source_files: [src/components/ui.tsx, src/components/Drawer.tsx, src/components/ModernDialog.tsx, src/components/DatePicker.tsx, src/components/GlobalTooltip.tsx, src/components/Tooltip.tsx, src/components/WhatsAppDialog.tsx, src/lib/useMediaQuery.ts, src/app/globals.css, src/components/page/index.tsx]
related: ["[[Frontend-Architecture]]", "[[Business-Components]]"]
tags: [frontend, components]
---
# Core UI Components

## Primitives
`ui.tsx`: Button, Input, CurrencyInput, Textarea, CharCounter, LabelWithCounter, Select, Label, Card, Badge, Table, Th, Td, TableActionButton.

## Overlay
- `Drawer`: portal ke body, backdrop, focus/scroll handling.
- `ModernDialog`: portal dengan z-index di atas Drawer.
- `DatePicker`: portal fixed dengan reposition scroll/resize.
- `Select`: custom hidden native select + portal menu, positioning viewport-aware.
- `Tooltip`: portal fixed dan pointer-events none; memakai gaya bersama `.app-tooltip`.
- `GlobalTooltip` (di-mount sekali di `src/app/layout.tsx`): merender atribut `data-tooltip` dan `title` lewat portal bergaya `.app-tooltip` (balik ke bawah bila mepet, dibatasi viewport, hanya perangkat hover). `title` dipindah ke `data-tip` saat hover pertama agar tooltip OS tidak ganda; `aria-label` ditambahkan bila elemen tak punya nama aksesibel.
- `WhatsAppDialog` + `normalizeWhatsAppNumber`: pengganti `window.prompt` untuk nomor WhatsApp (validasi, normalisasi ke `62…`, Escape fase capture agar tidak menutup Drawer di belakang).

## Primitif halaman (`src/components/page/index.tsx`, 2026-10-13)
`PageHeader` (eyebrow, judul, deskripsi, slot aksi), `StatCard` + `StatGrid` (2 kolom di HP; 4 atau 5 kolom di desktop, kartu ke-5 melebar di bawah `lg`), `Panel` (kartu bento dengan header ikon; `flush` untuk tabel), `IconChip`, `StatusDot`, `TonePill` (margin ≥20 hijau, ≥15 biru, selain itu kuning), `IconAction` (tombol ikon tanpa border, tooltip via `title`), `FilterBar`. Dipakai seluruh halaman Non-Gudang.
- `globals.css` punya aturan `h1`/`h2`/`h3` tanpa layer yang menimpa utilitas ukuran teks; `Panel` memakai `!text-sm` untuk judul `h2`.

## Konvensi gaya bersama (2026-10-13)
- `.field-surface` + token `--field-*` (layer components): permukaan yang sama untuk `Input`, tombol `Select`, dan `DatePicker` (latar, garis, hover, fokus). `DatePicker` mewarisi ukuran/ketebalan teks dari wrapper (bawaan `text-xs font-semibold`) dan mengikuti `rounded-*` pemanggil.
- `Select` hanya meneruskan kelas `w-*`, `col-*`, `m*-*` tanpa prefix ke wrapper; span responsif (`lg:col-span-*`) perlu elemen pembungkus. Pencarian menu memecah kata dengan `/\s+/` (sebelumnya salah `/s+/`).
- Checkbox global: ukuran/bentuk di `@layer base`, warna status di luar layer (centang, indeterminate, fokus, mode gelap). Checkbox `sr-only` tidak terpengaruh.
- `Th`/`Td`: header `font-bold`, baris 56px, teks mode gelap `slate-300`, garis `white/5`. Jangan memakai `opacity` pada `<td>` (ikut memudarkan latar baris); redupkan lewat warna teks.
- Kartu bento (`.bento-card`, `.bento-tone` + `--tone`, `.bento-icon`, `.bento-segment`) dipakai dashboard, Laporan, dan toolbar segmented.

## Shell
`Sidebar`, `TopNav`, `ThemeToggle`, `CommandPalette`, `NotificationCenter`, `FloatingActionButton`, `ScrollLockGuard`.

- Navbar desktop 64px; header logo sidebar `lg:h-16` agar sejajar.
- `NotificationCenter` (polling 60 detik) hanya di-mount satu kali: `TopNav` di `lg` ke atas, header mobile/tablet di bawahnya, via `useMediaQuery(DESKTOP_QUERY)`.
- Gaya "collapsed" sidebar hanya berlaku di `lg:`; `railCollapsed = isCollapsed && isDesktop !== false` mengatur `chrome-soft-panel` (CSS di luar layer) pada panel profil. Item nav tidak aktif memakai border halus 9%.

Semua komponen ini adalah Client Components. Perubahan z-index harus diuji bersama Drawer, Dialog, Select, DatePicker, sticky table header, dan mobile viewport.
