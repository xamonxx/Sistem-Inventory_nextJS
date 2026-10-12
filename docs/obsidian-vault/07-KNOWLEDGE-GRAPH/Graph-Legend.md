---
type: graph-legend
status: verified
last_verified: 2026-10-12
related: ["[[System-Graph]]", "[[Module-Graph]]", "[[Database-Graph]]", "[[Dependency-Graph]]"]
tags: [graph]
---
# Graph Legend

## Makna relasi
- `A --> B`: A memanggil, menulis, menyuplai, atau menjadi prerequisite B sesuai label/konteks diagram.
- Node silinder: datastore.
- Wikilink: hubungan navigasi knowledge, bukan otomatis dependency runtime.

## Status bukti
- `status: verified`: diperiksa terhadap source/config pada `last_verified`.
- Ketidakpastian ditulis eksplisit sebagai observasi atau risiko.
- Hubungan historis/stale ditempatkan di [[Technical-Debt]] atau [[Known-Bugs]], bukan di graph aktif.

## Aturan pemeliharaan
Pisahkan graph sistem, modul, database, dan dependency. Jangan menambahkan edge tanpa lokasi source/config. Setelah relasi berubah, update note modul, graph terkait, dan changelog.
