---
type: operations-audit
status: release-blocked
last_verified: 2026-10-13
source_files: [package.json, package-lock.json, next.config.ts, prisma/schema.prisma, .github/workflows/deploy.yml, src/app, src/components, src/lib]
related: ["[[Comprehensive-Role-Verification-Checkpoint]]", "[[Known-Bugs]]", "[[Risks]]", "[[Build-and-Test]]", "[[Recovery]]", "[[ADR-004-Credit-Is-Unpaid-Receivable]]"]
tags: [operations, audit, production, security, bugs, plan]
---
# Pre-Production Bug Audit and Remediation Plan

## Executive decision

**NO-GO untuk production release saat ini.**

Audit menemukan blocker aktif pada integritas struk, hasil mutasi setelah commit, concurrency, recovery, dan deployment.

Temuan dependency critical awal sudah ditangani oleh perubahan dependency terpisah setelah audit: runtime sekarang memakai `next@15.5.27`, dan recheck `npm audit --omit=dev` melaporkan **0 critical, 0 high, 2 moderate** (`exceljs`/`uuid`). Status release tetap **NO-GO** karena blocker aplikasi dan operasional lain belum diperbaiki.

AUD-002 dan AUD-016 sudah diperbaiki di source pada 2026-10-13: owner memutuskan CREDIT adalah piutang tempo belum dibayar ([[ADR-004-Credit-Is-Unpaid-Receivable]]), dan semua jalur struk kini memakai nilai pembayaran tersimpan. Baris Payment CREDIT historis di production belum diperiksa.

Tidak ditemukan pelanggaran pada sweep invariant database lokal saat audit. Build production, type-check, lint, Prisma validation, security regression 58/58, production-like browser smoke, dan production read-only smoke lulus. Hasil hijau tersebut tidak meniadakan blocker di atas karena test suite belum mencakup mekanisme yang ditemukan.

## Scope and method

Audit mencakup:

- 22 route hasil production build;
- seluruh Server Action dan Route Handler;
- autentikasi, role authorization, cookie/session, origin checks, dan public invoice verification;
- transaksi POS, pembayaran, invoice edit/delete, retur/tukar, stok, dan Non-Gudang;
- invariants keuangan/stok dan transaction isolation;
- cache/revalidation, receipt/print, Excel export, error handling, dan audit log;
- Prisma schema, dependency tree, CI/deployment, recovery, dan production headers;
- read-only local database sweep dan read-only HTTP smoke pada production.

Tidak ada production mutation. Audit ini tidak memakai atau mencatat kredensial. Authenticated browser flow tidak diulang karena kredensial disposable tidak tersedia pada sesi audit; bukti role/browser terbaru tetap tersedia di [[Comprehensive-Role-Verification-Checkpoint]].

## Verification evidence

| Check | Result | Evidence |
|---|---:|---|
| `node scripts/knowledge-sync.mjs check` | Pass | 241 source files; no drift before audit |
| `npx prisma validate` | Pass | Schema valid; Prisma config deprecation warning |
| `npm run type-check` | Pass | No TypeScript error |
| `npm run lint` | Pass | No ESLint error |
| `npm run test:security` | Pass | 58 passed, 0 failed |
| `npm run build` | Pass after dependency update | Next.js 15.5.27; clean build after removing stale `.next` artifacts |
| Production-like server | Pass | `next start -p 3010`; ready in 1.119s |
| Production-like HTTP | Pass | `/` 307 to `/login`; `/login` 200; APIs unauthenticated 401 |
| Production-like browser smoke | Pass | `webapp-smoke-test.py --no-server` |
| Local DB financial sweep | Pass | 0 transaction total, overpayment, payment sum, status, and NG total violations |
| Local DB stock sweep | Pass | 0 missing item ledger groups; 0 non-integer balances |
| Production read-only HTTP | Pass | `/` 307; `/login` 200; `/api/search` 401 |
| Production headers | Pass with weakness | CSP, HSTS, nosniff, DENY, referrer, permissions present; CSP permits unsafe script execution modes |
| `npm audit --omit=dev` | Pass critical/high gate after dependency update | 0 critical, 0 high, 2 moderate; `exceljs`/`uuid` remain |

The first build attempt failed with Windows `EPERM` because a stale `next dev` child still held Prisma's engine DLL. After stopping that process, the unchanged build passed. Following the separate Next.js dependency update, the first build found a stale `.next/server/pages-manifest.json` state; removing generated `.next` artifacts and rebuilding passed on Next.js 15.5.27. Both failures were local generated-artifact/process contention, not application-source failures.

## Finding summary

| ID | Severity | Confidence | Finding | Release gate |
|---|---|---|---|---|
| AUD-001 | Critical at discovery | Observed, remediated | Vulnerable Next.js runtime and dependency tree | Cleared for critical/high dependency gate |
| AUD-002 | High at discovery | Observed, remediated | Receipt paid/remaining values are incorrect | Cleared in source; production data review pending |
| AUD-003 | High | Code-proven | Post-commit failures can be reported as mutation failures | Block |
| AUD-004 | High | Code-proven | Gudang invoice edit can race stock writes | Block |
| AUD-005 | High | Code-proven | Non-Gudang edit can race a payment and violate totals | Block |
| AUD-006 | High | Observed | No tested backup/restore or migration history before destructive operations | Block |
| AUD-007 | High | Code/config-proven | Deployment does not enforce runtime env completeness or safe restart order | Block until verified/fixed |
| AUD-008 | Medium | Code-proven | Invoice mutations leave stock caches stale | Fix before release |
| AUD-009 | Medium | Code-proven | Inactive items can receive stock through a replayed action | Fix before release |
| AUD-010 | Medium | Observed | Losing concurrent checkout shows a generic internal error | Fix before release |
| AUD-011 | Medium | Code-proven | Password reset does not revoke existing sessions | Fix or accept explicitly |
| AUD-012 | Medium | Code-proven | Logout mutates state through GET and uses a weak POST origin comparison | Fix before release |
| AUD-013 | Medium | Code-proven | Public verification is not atomic and trusts spoofable proxy headers | Fix or rename semantics |
| AUD-014 | Medium | Code-proven | User management cannot create/manage `ADMIN_NONGUDANG` | Product decision required |
| AUD-015 | Medium | Observed/config-proven | CSP allows `'unsafe-inline'` and `'unsafe-eval'` | Harden after compatibility test |
| AUD-016 | Medium | Decided, remediated | `CREDIT` is labeled tempo but counted as paid | Cleared by ADR-004 |
| AUD-017 | Medium | Code-proven | Mutation audit logging is not atomic and logs are clearable | Fix governance before release |
| AUD-018 | Low | Code-proven | Several primary pages perform unbounded reads | Capacity gate |
| AUD-019 | Low | Observed | Unauthorized Server Action replay surfaces HTTP 500 | Fix response contract |
| AUD-020 | Low | Observed | Automated “security” suite tests schemas, not live auth/business boundaries | Expand gate |

## Detailed findings

### AUD-001 — Vulnerable framework dependency remediated

- **Rule ID:** NEXT-SUPPLY-001
- **Severity:** Critical at discovery; resolved for the critical/high release gate
- **Location:** `package.json:52`, current `next@15.5.27`; `package-lock.json`
- **Evidence:** Initial audit on `next@15.5.19` returned 1 critical, 8 high, and 3 moderate vulnerabilities. A later dependency change pinned `next@15.5.27` and aligned Next tooling. Recheck `npm audit --omit=dev --json` returned 0 critical, 0 high, and 2 moderate vulnerabilities; only the `exceljs`/transitive `uuid` path remains.
- **Impact:** The known critical/high Next.js advisory gate is cleared. Moderate Excel export dependency risk remains and still requires explicit triage.
- **Fix:** Completed for Next.js. Preserve the pin, verify production build/runtime after every lockfile update, and resolve or formally accept the remaining ExcelJS/UUID advisory based on actual buffer-API reachability.
- **Mitigation:** Keep public traffic controls at Cloudflare/reverse proxy and avoid passing caller-controlled output buffers to UUID generation through export code.
- **False-positive notes:** The current moderate advisory concerns UUID buffer-bound handling; package presence alone does not prove that the vulnerable API form is reachable.

### AUD-002 — Receipt payment totals are false

- **Rule ID:** FIN-RECEIPT-001
- **Severity:** High
- **Location:** `src/app/(app)/kasir/KasirClient.tsx:319-320,378-401`; `src/components/Nota.tsx:91-103`; `src/app/(app)/invoice/InvoiceClient.tsx:1149-1170`; `src/app/(app)/invoice/[id]/page.tsx:74-86`
- **Evidence:** Immediate POS receipt passes only cash as `bayar`. `Nota` derives remaining amount as `total - bayar`. Existing invoice thermal paths omit `bayar` and `sisaTagihan` entirely, so a paid invoice can render as unpaid. `PC00003` and `PC00004` already reproduced the split/transfer defects.
- **Impact:** Customers receive incorrect paid and receivable values. Collections, disputes, and accounting decisions may use false documents.
- **Fix:** Return authoritative persisted payment totals from checkout; pass `totalDibayar` and computed remaining amount through every `Nota` entry point. Add regression cases for cash, transfer, credit, split, partial, LUNAS, reprint, and image/PDF paths.
- **Mitigation:** Block affected receipt issuance and use the A4 invoice only after confirming its persisted totals.
- **False-positive notes:** None for the reproduced cases. Credit semantics still require the decision in AUD-016.
- **Remediation (2026-10-13):** `createTransaction` returns persisted `totalDibayar`/`sisaTagihan`; Kasir receipt, invoice thermal preview, and `/invoice/[id]` pass both values to `Nota`; `Nota` status is derived from amounts instead of catatan text; the hidden A4 row that showed `-total` was removed. Image and PDF reuse the same rendered `Nota`. Local browser checkouts `PC00102` (split with tempo) and `PC00103` (transfer-only) matched the database on every path.

### AUD-003 — Committed mutation can be reported as failed

- **Rule ID:** TX-OUTCOME-001
- **Severity:** High
- **Location:** `src/app/(app)/kasir/actions.ts:283-316`; `src/app/(app)/invoice/actions.ts:59-84`; `src/app/(app)/non-gudang/buat-invoice/actions.ts:246-295`; `src/lib/activity.ts:3-18`; `src/lib/invoiceVerify.ts:6-34`
- **Evidence:** Domain transactions commit first. `logActivity`, cache invalidation, and invoice verification URL creation run afterward inside the same outer `try`. A failure after commit is converted to a generic action error. Checkout clients may retry after receiving that error.
- **Impact:** Duplicate sales/payments can be created after a false failure response. Audit-log outages can also make healthy domain writes appear unsuccessful.
- **Fix:** Put required audit rows inside the same database transaction. Treat cache invalidation as best-effort after a successful result. Generate token prerequisites before commit or return the committed result even if optional URL generation fails. Add an idempotency key for checkout/payment retries.
- **Mitigation:** Cashiers must check transaction history before retrying any ambiguous response; this warning already exists only for network exceptions.
- **False-positive notes:** The mechanism is code-proven; triggering requires a post-commit dependency failure.

### AUD-004 — Invoice item edits can oversell under concurrency

- **Rule ID:** STOCK-RACE-002
- **Severity:** High
- **Location:** `src/app/(app)/invoice/actions.ts:425-509,511-631`
- **Evidence:** `updateInvoiceAndItems` reads aggregate stock and then writes transaction items/ledgers in a default-isolation transaction. Checkout and return use `Serializable`; this path does not.
- **Impact:** Two concurrent stock-consuming operations can validate against the same availability and both commit, producing negative stock or oversell.
- **Fix:** Run the complete invoice read/check/write operation in a `Serializable` transaction with bounded retry for serialization conflicts. Keep the existing returned-quantity and payment guards inside that transaction.
- **Mitigation:** Temporarily restrict invoice item edits during active checkout and monitor negative-stock alerts.
- **False-positive notes:** No concurrent invoice-edit reproduction was run; mechanism follows the same read-check-write race already guarded elsewhere.

### AUD-005 — Non-Gudang edit/payment race

- **Rule ID:** NG-FIN-RACE-001
- **Severity:** High
- **Location:** `src/app/(app)/non-gudang/invoice/actions.ts:194-229,230-266`; payment path `:47-92`
- **Evidence:** Edit reads `totalDibayar`, validates the new total, and computes status before entering its transaction. A concurrent serializable payment can commit between that read and the edit write.
- **Impact:** The edit can lower `totalPenjualan` below the newly committed payment or overwrite status using stale payment data.
- **Fix:** Move invoice read, total guard, item replacement, and status calculation into one `Serializable` transaction. Add an edit-vs-payment concurrency regression.
- **Mitigation:** Operationally prevent simultaneous edit and payment for the same invoice until fixed.
- **False-positive notes:** Payment-vs-payment concurrency passed; edit-vs-payment was not previously tested.

### AUD-006 — Recovery is not production-ready

- **Rule ID:** OPS-RECOVERY-001
- **Severity:** High
- **Location:** `docs/obsidian-vault/13-OPERATIONS/Recovery.md:11-27`; `package.json:16-17`; no Prisma migrations directory
- **Evidence:** No tested backup, restore, point-in-time recovery, migration rollback, or schema migration history exists. Invoice deletion can remove a full transaction, return, payment, invoice, and stock-ledger graph.
- **Impact:** Operator error, deployment mismatch, or corruption may be irreversible or require manual reconstruction.
- **Fix:** Establish automated backups, retention/encryption, named owners, RPO/RTO, isolated restore rehearsal, reconciliation queries, and versioned Prisma migrations before release.
- **Mitigation:** Disable or tightly restrict destructive invoice/log actions until recovery is proven.
- **False-positive notes:** Host-level backup may exist outside the repo; it must be demonstrated by a successful restore test.

### AUD-007 — Deployment workflow has environment and cutover gaps

- **Rule ID:** NEXT-DEPLOY-001 / OPS-DEPLOY-002
- **Severity:** High
- **Location:** `.github/workflows/deploy.yml:24-34,42-65`
- **Evidence:** Runner `.env` omits `INVOICE_VERIFY_SECRET` and `TRUST_PROXY_HEADERS`. The generated `.env` is not uploaded, so runtime depends on undocumented host state. The remote restart marker is touched before the new `.next` directory is uploaded. CI does not run lint, security tests, dependency audit, backup gate, or migration gate before deployment.
- **Impact:** Missing runtime secrets can break token generation after a committed sale. Restart-before-upload can expose old or partial artifacts. A push to `master` can deploy despite known critical advisories or business regressions.
- **Fix:** Validate required runtime variables on the host without printing values; stage artifacts in a release directory, switch atomically, then restart. Add dependency, test, backup, schema, and smoke gates. Pin action versions by commit SHA.
- **Mitigation:** Manual release checklist and maintenance window until atomic deployment exists.
- **False-positive notes:** Required variables may already exist on Hostinger. That state was not inspected because secrets must not be exposed; verify presence and length only.

### AUD-008 — Stock cache invalidation is incomplete

- **Rule ID:** CACHE-STOCK-001
- **Severity:** Medium
- **Location:** `src/app/(app)/invoice/actions.ts:259,379,641`; `src/lib/stock.ts:35-57`
- **Evidence:** Invoice delete, bulk delete, and item edit mutate or remove transaction stock ledgers but only revalidate `/invoice`. They do not invalidate tag `stock` or stock/dashboard/kasir paths.
- **Impact:** Users can see stale availability for up to 60 seconds and make decisions from stale stock after edits/deletes.
- **Fix:** Invalidate the `stock` tag and affected paths after every successful ledger mutation. Add a runtime smoke that primes cache, mutates, and verifies immediate balance.
- **Mitigation:** Manual refresh does not guarantee tag eviction; wait for cache expiry.
- **False-positive notes:** Integrity remains in the database; this is stale presentation/availability data.

### AUD-009 — Inactive item accepts direct stock increase

- **Rule ID:** STOCK-ACTIVE-001
- **Severity:** Medium
- **Location:** `src/app/(app)/stok/actions.ts:28-42`; documented invariant `.ai/context/domain-rules.md:5`
- **Evidence:** `barangMasuk` validates item existence but not `aktif`. Batch stock-in correctly filters `aktif: true`. A replayed Server Action can therefore increase an inactive item.
- **Impact:** Archived inventory can silently re-enter stock and reports.
- **Fix:** Require `aktif: true` server-side for positive stock receipt, or document a specific reactivation workflow. Apply the same rule consistently to correction when it increases stock.
- **Mitigation:** UI filtering is not an authorization or invariant boundary.
- **False-positive notes:** If inactive items intentionally accept receipts, update the domain rule and UI wording explicitly.

### AUD-010 — Concurrency conflict is hidden

- **Rule ID:** UX-CONFLICT-001
- **Severity:** Medium
- **Location:** `src/app/(app)/kasir/actions.ts:315-317`; `src/lib/validation.ts:92-149`
- **Evidence:** Final-unit concurrent checkout preserved stock but the losing action returned `Terjadi kesalahan internal saat memproses checkout.`
- **Impact:** Cashier cannot distinguish a stock conflict from infrastructure failure and may retry unnecessarily.
- **Fix:** Map serialization/write conflicts to the existing actionable stock-conflict message and refresh availability.
- **Mitigation:** Check stock and transaction history before retry.
- **False-positive notes:** Integrity passed; only outcome classification is defective.

### AUD-011 — Password reset leaves old sessions active

- **Rule ID:** NEXT-SESS-002
- **Severity:** Medium
- **Location:** `src/app/(app)/pengguna/actions.ts:139-159`; `src/lib/auth.ts:43-99`; `prisma/schema.prisma:21-35`
- **Evidence:** Session JWT remains valid for seven days. `getSession` checks current user/role/active state but no session version or password-change timestamp. Password reset updates only the hash.
- **Impact:** A stolen session remains usable after an administrator resets the password.
- **Fix:** Add `sessionVersion` or `passwordChangedAt`, include it in the JWT, and reject older sessions. Increment it on reset and relevant privilege changes.
- **Mitigation:** Deactivate/reactivate the account to invalidate access operationally, but this is not a complete token-revocation design.
- **False-positive notes:** Role and active-state changes are read from DB per request, so those changes take effect immediately.

### AUD-012 — Logout uses state-changing GET and weak origin matching

- **Rule ID:** NEXT-CSRF-001
- **Severity:** Medium
- **Location:** `src/app/(app)/logout/route.ts:14-25`; `src/components/Sidebar.tsx:109-110`; `src/components/TopNav.tsx:116-119`
- **Evidence:** GET destroys the session. POST checks `origin.includes(host)`, which is not exact origin validation. Current UI intentionally navigates to GET `/logout`.
- **Impact:** Cross-site resources can force logout; crafted origins can pass the substring check.
- **Fix:** Remove GET mutation. Submit POST and reuse `isSameOriginRequest` or exact parsed-origin comparison.
- **Mitigation:** SameSite cookies reduce other CSRF classes but do not make state-changing GET acceptable.
- **False-positive notes:** Impact is logout CSRF, not account takeover.

### AUD-013 — Public “one-time” verification is non-atomic and proxy-spoofable

- **Rule ID:** VERIFY-TRUST-001
- **Severity:** Medium
- **Location:** `src/app/verify/[noInvoice]/page.tsx:56-83,151-180`
- **Evidence:** The page performs `count` then separate log insert, so concurrent requests can both become first verifications. Any `x-forwarded-for` is trusted and can make the UI label a request `Lokal (Toko) — Terpercaya`. Link preview bots can consume the first-view state.
- **Impact:** “Max 1x” and trusted-network labels can be false; customers may see a valid invoice marked as previously verified before opening it.
- **Fix:** Define exact semantics. For one-time use, persist a unique verification record/nonce atomically. Trust proxy headers only behind configured trusted proxy handling; otherwise remove the trusted-network claim.
- **Mitigation:** Present verification as signature validity, not viewer/network trust.
- **False-positive notes:** JWT signature validation itself is sound and uses a separate purpose claim.

### AUD-014 — Non-Gudang accounts are not manageable in the UI

- **Rule ID:** RBAC-ADMIN-001
- **Severity:** Medium
- **Location:** `src/app/(app)/pengguna/actions.ts:13,28-33`; `src/app/(app)/pengguna/PenggunaForm.tsx:126-130`
- **Evidence:** Active session roles include `ADMIN_NONGUDANG`, but user-management allowlists only Gudang and Kasir.
- **Impact:** Operators cannot create or repair Non-Gudang access through the supported administration flow.
- **Fix:** Either add `ADMIN_NONGUDANG` to the guarded management contract and UI, or document a separate owner-only provisioning process.
- **Mitigation:** Do not use seeds or direct production SQL as an undocumented account-management process.
- **False-positive notes:** This may be intentional separation, but no alternative production workflow is documented.

### AUD-015 — CSP is permissive for scripts

- **Rule ID:** NEXT-CSP-001
- **Severity:** Medium
- **Location:** `next.config.ts:22-45`; confirmed on production response
- **Evidence:** `script-src` includes both `'unsafe-inline'` and `'unsafe-eval'`.
- **Impact:** CSP offers reduced protection if an XSS sink or compromised script appears.
- **Fix:** Introduce report-only nonce/hash CSP, remove `unsafe-eval`, then remove `unsafe-inline` after compatibility verification.
- **Mitigation:** React escaping and absence of discovered raw HTML sinks reduce current exposure.
- **False-positive notes:** Header presence is verified; weakness is policy strength, not absence.

### AUD-016 — Credit/tempo payment semantics are contradictory

- **Rule ID:** FIN-PAYMENT-SEMANTICS-001
- **Severity:** Medium
- **Location:** `src/app/(app)/kasir/KasirClient.tsx:323-360`; `src/lib/checkoutRules.ts:47-58`; `src/app/(app)/kasir/actions.ts:234-280`
- **Evidence:** UI labels `CREDIT` as `Kredit/Tempo`, but server includes CREDIT in `totalPaid`, persists it as a Payment, and may mark the invoice LUNAS.
- **Impact:** Receivable and paid metrics may be semantically wrong even after receipt rendering is fixed.
- **Fix:** Product owner must decide whether CREDIT means paid by a financing method or unpaid receivable. If tempo, exclude it from `totalDibayar`, store it as outstanding allocation, and keep invoice PARTIAL/PENDING.
- **Mitigation:** Do not infer accounting meaning from the current enum name alone.
- **False-positive notes:** Existing verification treated persisted CREDIT as a payment; this is a contract ambiguity, not yet a confirmed defect.
- **Decision and remediation (2026-10-13):** Owner decided CREDIT is an unpaid receivable ([[ADR-004-Credit-Is-Unpaid-Receivable]]). `checkoutRules` counts only CASH/TRANSFER as paid, checkout no longer writes CREDIT Payment rows, and `bayarInvoice` accepts CASH/TRANSFER only. The local database had 0 historical CREDIT Payment rows; production must be checked read-only before release.

### AUD-017 — Audit trail lacks transactional and retention integrity

- **Rule ID:** AUDIT-INTEGRITY-001
- **Severity:** Medium
- **Location:** `src/lib/activity.ts:3-18`; `src/app/(app)/log-aktivitas/actions.ts:8-20`; multiple actions log after mutation
- **Evidence:** Audit writes are generally separate from domain transactions. `ADMIN_GUDANG` can delete the complete audit log and replace it with one clear event.
- **Impact:** Mutations can exist without an audit row, and privileged users can remove historical evidence.
- **Fix:** Write required logs in the domain transaction. Replace clear-all with retention/archive policy and immutable external log export where auditability matters.
- **Mitigation:** Restrict production access and monitor database-level changes.
- **False-positive notes:** This is governance/integrity risk, not proof of malicious activity.

### AUD-018 — Unbounded reads will degrade with growth

- **Rule ID:** PERF-QUERY-001
- **Severity:** Low
- **Location:** `src/app/(app)/page.tsx:101-150,223-248`; master pages including `barang/page.tsx:27-29`, `non-gudang/barang/page.tsx:21`, `non-gudang/konsumen/page.tsx:21`
- **Evidence:** Dashboard loads all transaction rows/items in date windows and all unpaid invoices/items. Several master pages fetch full tables and paginate only client-side.
- **Impact:** Response time and memory usage rise with production history; expensive dashboard requests increase DoS sensitivity.
- **Fix:** Use SQL aggregates and server pagination. Define realistic row-count performance budgets and load-test them.
- **Mitigation:** Current dataset is small and dashboard date windows limit some queries.
- **False-positive notes:** This is a capacity risk, not a current functional failure.

### AUD-019 — Authorization denial surfaces HTTP 500

- **Rule ID:** AUTH-ERROR-001
- **Severity:** Low
- **Location:** `src/lib/auth.ts:108-115`; observed in replay verification
- **Evidence:** `requireRole` throws a generic `Error`. Replayed protected action was blocked with no mutation but returned HTTP 500.
- **Impact:** Monitoring sees false server faults and clients receive an uncontrolled failure contract.
- **Fix:** Return a controlled authorization error/status while preserving fail-closed behavior.
- **Mitigation:** None required for data integrity; authorization already blocks the write.
- **False-positive notes:** No authorization bypass was found.

### AUD-020 — Automated regression coverage does not match release risk

- **Rule ID:** TEST-COVERAGE-001
- **Severity:** Low
- **Location:** `scripts/security-test.ts:1-189`; `package.json:10-14`
- **Evidence:** The 58-case suite validates helper schemas and stock rules. It does not exercise live authentication, Server Actions, DB transactions, receipts, retries, concurrency, deletion, exports, or deployment.
- **Impact:** A green `npm test` can coexist with all high-severity findings in this report.
- **Fix:** Add deterministic DB-backed integration tests for checkout, split/transfer receipts, payment/edit races, return/exchange, deletion, session revocation, and role boundaries.
- **Mitigation:** Continue isolated manual verification until automated coverage exists.
- **False-positive notes:** The existing suite remains useful for input-boundary regression; its name/role should not imply full security assurance.

## Positive controls confirmed

- Session secret and invoice verification secret fail closed in production when resolved.
- Session cookie is `HttpOnly`, `SameSite=Lax`, seven-day bounded, and conditionally `Secure`.
- Every identified protected Server Action has server-side session/role enforcement; login and logout are intentionally public entry points.
- Page role matrix was previously verified across 50 routes.
- Server inputs use Zod/shared validation; no raw HTML, dynamic code execution, command execution, upload, arbitrary file path, or arbitrary outbound-fetch sink was found.
- SQL aggregate uses `Prisma.sql` parameterization.
- Checkout, return, payment, and stock-correction critical read-check-write paths generally use `Serializable` transactions.
- Local database sweep found no current financial/status/stock invariant violation.
- Production login uses no-store and expected security headers; unauthenticated APIs return 401.

## Remediation plan

### Phase 0 — Release blockers

1. **Completed:** Next.js pinned to `15.5.27`; critical/high production dependency audit gate is clear. Triage the remaining moderate `exceljs`/`uuid` advisory.
2. **Completed:** CREDIT is an unpaid receivable ([[ADR-004-Credit-Is-Unpaid-Receivable]]).
3. **Completed in source:** receipt totals use persisted values across POS, invoice thermal reprint, detail page, image, A4, and PDF paths. Remaining: read-only production check for historical CREDIT Payment rows.
4. Make checkout/payment outcomes atomic and idempotent. Include required audit rows in transactions; prevent post-commit helper failures from returning mutation failure.
5. Move Gudang invoice edit and Non-Gudang edit guards into serializable transactions. Add edit-vs-checkout and edit-vs-payment race tests.
6. Verify required Hostinger runtime variables without exposing values, especially `AUTH_SECRET`, `INVOICE_VERIFY_SECRET`, `DATABASE_URL`, `COOKIE_SECURE`, and canonical app URL.
7. Complete and pass a backup/restore rehearsal before enabling destructive release operations.

### Phase 1 — Production safety

1. Add missing stock cache invalidation for invoice edit/delete paths.
2. Enforce inactive-item stock rules in direct actions.
3. Return actionable serialization/stock conflict errors.
4. Convert logout to exact-origin POST only.
5. Revoke sessions after password reset.
6. Decide and implement Non-Gudang account provisioning.
7. Make public verification semantics atomic and remove spoofable trusted-network claims.
8. Replace clear-all audit behavior with retention/archive controls.

### Phase 2 — Deployment and hardening

1. Add CI gates: type-check, lint, security/integration tests, production dependency audit, build, artifact smoke, schema review, and backup confirmation.
2. Deploy immutable release directories and restart only after atomic cutover.
3. Roll out CSP report-only, then remove unsafe script directives.
4. Add server pagination/database aggregation and load tests.
5. Introduce versioned Prisma migrations and tested rollback compatibility.

## Exit criteria

Production release is allowed only when all conditions below are evidenced:

- `npm audit --omit=dev` has no critical/high issue accepted without written owner approval and compensating control.
- Split, transfer-only, credit/tempo, partial, and reprinted receipts match persisted payment and invoice totals.
- Ambiguous retry cannot duplicate checkout/payment; injected post-commit failures return the committed outcome safely.
- Concurrent invoice edit/checkout and NG edit/payment preserve stock and payment invariants.
- Backup restore succeeds on an isolated database; RPO/RTO and rollback owner are recorded.
- Host runtime env preflight passes without printing secret values.
- Deployment performs staged artifact cutover before restart and runs all release gates.
- Authenticated smoke passes for Gudang, Kasir, and Non-Gudang on the release artifact.
- Knowledge validation and source baseline are current.

## Rollback and safety

This audit changed documentation only. No application source, schema, data, dependency, production state, or credentials were modified. If the report must be removed, delete this note and its references; runtime behavior is unaffected.
