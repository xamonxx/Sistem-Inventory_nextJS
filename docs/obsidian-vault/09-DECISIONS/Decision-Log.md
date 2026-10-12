---
type: decision-index
status: verified
last_verified: 2026-10-12
related: ["[[ADR-001-Stock-as-Ledger-Derivative]]", "[[ADR-002-Server-Actions-and-Role-Guards]]", "[[ADR-003-Separate-Non-Warehouse-Domain]]"]
tags: [decisions]
---
# Decision Log

Keputusan berikut direkonstruksi dari implementasi aktif; bukan klaim bahwa ADR historis pernah disetujui secara formal.

| ADR | Keputusan | Status implementasi |
|---|---|---|
| [[ADR-001-Stock-as-Ledger-Derivative]] | Stok akhir diturunkan dari stok awal + ledger | Aktif |
| [[ADR-002-Server-Actions-and-Role-Guards]] | Mutasi utama memakai Server Actions dengan guard role | Aktif; read-page guard belum konsisten |
| [[ADR-003-Separate-Non-Warehouse-Domain]] | Perdagangan non-gudang memakai model/lifecycle terpisah | Aktif |

Keputusan baru yang mengubah contract lintas modul harus memiliki ADR tersendiri. Detail edit rutin cukup di changelog.
