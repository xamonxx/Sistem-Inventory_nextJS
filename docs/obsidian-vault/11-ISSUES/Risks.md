---
type: risk-register
status: verified
last_verified: 2026-10-13
related: ["[[Security-Notes]]", "[[Data-Integrity]]", "[[Recovery]]", "[[Pre-Production-Bug-Audit-and-Plan]]"]
tags: [issues, risks]
---
# Risks

| ID | Risiko terverifikasi | Dampak | Mitigasi saat ini |
|---|---|---|---|
| R-01 | (Teratasi 2026-10-12) Guard role read page diselaraskan | Belum diuji per-role di browser | Page guard + mutasi role-guarded |
| R-02 | Ledger polymorphic tanpa FK | Orphan/mismatch referensi | Transactional writes dan audit log |
| R-03 | Tidak ada migration history | Reproduksibilitas schema/deploy rendah | `schema.prisma` + `db push` |
| R-04 | Delete invoice menghapus graph transaksi/retur/payment/ledger luas | Kehilangan histori jika salah operasi | Role Kasir + transaksi DB; recovery belum teruji |
| R-05 | ActivityLog dapat dihapus | Audit trail tidak immutable | Role guard saja |
| R-06 | Non-gudang `userId` tanpa FK | Actor record dapat orphan | ID dicatat aplikasi |
| R-07 | Env production dibuat di CI lalu disalin via SSH | Secret handling bergantung runner/host cleanup | GitHub Secrets; file tidak dikomit |
| R-08 | Main financial/inventory flows minim integration tests | Regression lolos type-check | Validation helpers + manual smoke |
| R-09 | Receipt totals ignore non-cash persisted payments | Customer-facing paid/remaining values can be false | Block release until KB-003 and KB-004 are fixed or accepted |
| R-10 | Losing concurrent checkout returns a generic internal error | Cashier cannot identify the stock conflict | Integrity is preserved; map conflict to actionable stock feedback |
| R-11 | `next@15.5.19` berada dalam advisory critical | RCE/cache poisoning/DoS sesuai jalur yang terjangkau | Block release; upgrade minimal ke lini patched 15.5.27 |
| R-12 | Post-commit helper dapat mengubah hasil sukses menjadi error | Retry dapat membuat transaksi/pembayaran ganda | Warning cek riwayat hanya ada pada network failure Kasir |
| R-13 | Edit item invoice Gudang tidak memakai Serializable | Race dengan checkout/edit lain dapat oversell | Belum ada concurrent edit test |
| R-14 | Edit invoice Non-Gudang membaca payment sebelum transaksi | Race edit-vs-payment dapat merusak total/status | Belum ada concurrent edit/payment test |
| R-15 | Deploy restart sebelum upload artifact selesai dan env runtime tidak dipreflight | Partial/old artifact atau runtime secret hilang | Host state perlu verifikasi tanpa mencetak secret |
| R-16 | Stock cache tidak diinvalidate setelah invoice edit/delete | Stok UI stale hingga cache kedaluwarsa | Cache 60 detik |
| R-17 | Password reset tidak mencabut JWT aktif | Sesi curian bertahan sampai 7 hari | Deaktivasi user dibaca per request |
| R-18 | Public verification count+insert tidak atomik dan percaya proxy header | Klaim first-view/trusted-network dapat salah | Signature token tetap tervalidasi |

Prioritas: patch dependency critical, receipt correctness, outcome atomik/idempotent, race transaksi, backup/recovery, deployment cutover, lalu security hardening dan integration tests. Detail: [[Pre-Production-Bug-Audit-and-Plan]].
