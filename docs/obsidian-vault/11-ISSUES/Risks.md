---
type: risk-register
status: verified
last_verified: 2026-10-13
related: ["[[Security-Notes]]", "[[Data-Integrity]]", "[[Recovery]]"]
tags: [issues, risks]
---
# Risks

| ID | Risiko terverifikasi | Dampak | Mitigasi saat ini |
|---|---|---|---|
| R-01 | (Teratasi 2026-10-12) Guard role read page diselaraskan | Belum diuji per-role di browser | Page guard + mutasi role-guarded |
| R-02 | Ledger polymorphic tanpa FK | Orphan/mismatch referensi | Transactional writes dan audit log |
| R-03 | Tidak ada migration history | Reproduksibilitas schema/deploy rendah | `schema.prisma` + `db push` |
| R-04 | Delete invoice menghapus graph luas | Kehilangan histori jika salah operasi | Role Gudang + transaksi DB |
| R-05 | ActivityLog dapat dihapus | Audit trail tidak immutable | Role guard saja |
| R-06 | Non-gudang `userId` tanpa FK | Actor record dapat orphan | ID dicatat aplikasi |
| R-07 | Env production dibuat di CI lalu disalin via SSH | Secret handling bergantung runner/host cleanup | GitHub Secrets; file tidak dikomit |
| R-08 | Main financial/inventory flows minim integration tests | Regression lolos type-check | Validation helpers + manual smoke |
| R-09 | Receipt totals ignore non-cash persisted payments | Customer-facing paid/remaining values can be false | Block release until KB-003 and KB-004 are fixed or accepted |
| R-10 | Losing concurrent checkout returns a generic internal error | Cashier cannot identify the stock conflict | Integrity is preserved; map conflict to actionable stock feedback |

Prioritas: receipt correctness, backup/recovery, migration history, concurrent-checkout feedback, lalu integration test transaksi.
