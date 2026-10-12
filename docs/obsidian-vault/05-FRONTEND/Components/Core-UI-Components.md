---
type: frontend-components
status: verified
last_verified: 2026-10-12
source_files: [src/components/ui.tsx, src/components/Drawer.tsx, src/components/ModernDialog.tsx, src/components/DatePicker.tsx]
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
- `Tooltip`: portal fixed dan pointer-events none.

## Shell
`Sidebar`, `TopNav`, `ThemeToggle`, `CommandPalette`, `NotificationCenter`, `FloatingActionButton`, `ScrollLockGuard`.

Semua komponen ini adalah Client Components. Perubahan z-index harus diuji bersama Drawer, Dialog, Select, DatePicker, sticky table header, dan mobile viewport.
