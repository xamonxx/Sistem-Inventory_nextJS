---
type: operations-runbook
status: pending-production
last_verified: 2026-10-13
source_files: [prisma/schema.prisma, src/lib/idempotency.ts, src/lib/postCommit.ts, src/lib/requestKey.ts, .github/workflows/deploy.yml]
related: ["[[Pre-Production-Bug-Audit-and-Plan]]", "[[Recovery]]", "[[Identity-and-Audit-Tables]]", "[[Build-and-Test]]"]
tags: [operations, runbook, database, deployment]
---
# Idempotency Schema Rollout

## Why this runbook exists
AUD-003 remediation adds the `idempotency_keys` table. Checkout, invoice payment, return/exchange, Non-Gudang invoice creation, and Non-Gudang payment read and write this table **inside their database transaction**. The deploy workflow (`.github/workflows/deploy.yml`) only runs `git pull`, `npm ci`, and `prisma generate`; it never changes the production schema.

**If the application code reaches production before the table exists, every checkout and payment fails.** The table must be created first.

## Schema change
Additive only: one new table, no change to existing tables or data.

```sql
CREATE TABLE `idempotency_keys` (
    `key` VARCHAR(64) NOT NULL,
    `scope` VARCHAR(40) NOT NULL,
    `userId` INTEGER NOT NULL,
    `response` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idempotency_keys_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Generated with `prisma migrate diff` from the previous `prisma/schema.prisma` to the current one. [[Recovery]] forbids running `prisma db push` directly against production; apply this reviewed DDL instead.

## Production order (owner-run)
1. Take and verify a database backup (see [[Recovery]]).
2. Confirm the target database name and host without printing credentials.
3. Run the `CREATE TABLE` statement above.
4. Verify: `SHOW CREATE TABLE idempotency_keys;` matches the DDL, and `SELECT COUNT(*) FROM idempotency_keys;` returns `0`.
5. Only then deploy the application commit that contains AUD-003 part B.
6. Smoke: one checkout and one invoice payment; confirm one row per action in `idempotency_keys` and no duplicate transaction/payment.

Rollback: deploy the previous application commit first, then the table may stay (unused) or be dropped by the owner after review.

## Behavior
- The client sends a random key per attempt (`useRequestKey`) and reuses it only after a network failure. It resets after any definitive server response.
- The server checks the key first inside the transaction. A key that was already committed returns the stored result with `replayed: true`; no new sale, payment, return, or invoice is written.
- If two requests with the same key run at once, the primary key lets only one commit. The other request reads the stored result.
- A key reused for another action or another user is rejected.

## Follow-up
- Retention: rows are small but accumulate. Define an owner-approved cleanup policy (for example, rows older than 30 days) before high volume. No automatic deletion exists.
