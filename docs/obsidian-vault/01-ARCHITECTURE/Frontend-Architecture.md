---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/app/(app)/layout.tsx
  - src/components/ui.tsx
  - src/lib/kasirStore.ts
  - src/lib/ngCartStore.ts
related: ["[[Routes]]", "[[State-Management]]", "[[Core-UI-Components]]"]
tags: [frontend, architecture]
---
# Frontend Architecture

## Pola rendering
- Page files mayoritas Server Components yang membaca session dan Prisma lalu mengirim plain data ke komponen client.
- Komponen interaktif menandai `"use client"` dan menggunakan `useState`, `useTransition`, `useActionState`, router, serta Server Actions.
- Shell terautentikasi menempatkan `Sidebar`, `TopNav`, `CommandPalette`, dan `FloatingActionButton` di `src/app/(app)/layout.tsx`.

## State
- `src/lib/kasirStore.ts`: Zustand untuk keranjang dan metadata checkout gudang.
- `src/lib/ngCartStore.ts`: Zustand untuk keranjang CO non-gudang dan metadata pembayaran.
- Filter, drawer, dialog, pagination, dan form lokal memakai React state.
- React Query dan TanStack Table tercantum sebagai dependency tetapi tidak ditemukan digunakan dalam `src`.

## UI bersama
`src/components/ui.tsx` menyediakan Button, Input, CurrencyInput, Textarea, Select, Card, Badge, Table, Th, Td, dan TableActionButton. Popover penting memakai portal untuk keluar dari stacking context. Print memakai iframe terisolasi melalui `src/lib/print.ts`.

## Data flow umum
[[Data-Flow]] mendokumentasikan jalur Server Component dan mutasi Client Component → Server Action.
