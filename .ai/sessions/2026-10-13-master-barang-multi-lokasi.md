# Session — Master Barang Gudang Multi-Lokasi

**Date:** 2026-10-13
**Status:** implemented, pushed, and deployed to serverone

## Goal
Import the supplied main, Depok, and LK price lists into Gudang while keeping price-location identity internal and removing location suffixes from customer documents.

## Changes
- Expanded `ITEM_CATEGORIES` with HPL and updated dummy seed coverage.
- Rebuilt `scripts/add-items.ts` as a 475-row idempotent, transactional importer with validation, stock preservation, review exclusions, and an audit summary.
- Added `itemNameForCustomer`; `Nota` and `InvoiceDocument` remove terminal `(DEPOK)`/`(LK)` without changing stored snapshots.
- Added a focused six-case formatter regression script.

## Local data result
- Main: 73; Depok: 18; LK: 384; total: 475.
- Categories: 66 BAHAN UTAMA, 190 MATERIAL, 25 AKSESORIS, 35 KELISTRIKAN, 159 HPL.
- Three rows remain excluded pending correction: Block Board Polos 15mm, TACO TH 050 AA, and TACO TH 887 JG, all LK.

## Verification
- Import rerun: 0 create, 0 update, 475 unchanged.
- Formatter: 6/6.
- Database: unique names/codes, all active, valid prices, no negative effective stock, all LK stock zero, one import audit row.
- Type-check, ESLint, and security 68/68 passed.
- Production was inspected read-only. The owner authorized a staged deployment and full replacement with the verified local database, contingent on a downloaded production backup and checksum validation.

## Production result
- Release `7032e5f` is live at `https://gudangmki.com` from `/www/wwwroot/gudangmki`.
- The pre-replacement production backup exists on server and locally with matching SHA-256 `82f59fcc977d62cf87a53a39802f9bc4e0bbb8db1fb58d2a7168eeae39ced14e`.
- Production database verification matched the local source: 3 users, 475 active items, no business transactions, correct category totals, and no item invariant violations.
- Authenticated browser smoke passed for all three roles. Gudang and Kasir expose the 475-item catalog and HPL category; zero-stock items show as unavailable stock and remain protected by server checkout validation.
