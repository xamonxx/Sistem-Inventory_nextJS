# Durable Memory

## Stable facts
- App Router under `src/app`; no Pages Router or middleware file found.
- 20 Prisma models and 8 enums in `prisma/schema.prisma`.
- Auth cookie `si_session`; JWT HS256; DB recheck of active user/role; seven-day lifetime.
- Stok is derived from initial stock plus signed ledger rows; cache tag `stock`, 60 seconds.
- Checkout/return/stock-sensitive paths use Serializable transactions where races matter.
- Non-gudang models and reports are isolated from warehouse stock.
- Only three Route Handler groups: search, notifications, logout; core writes are Server Actions.
- No server queue, cron, worker, or scheduler found; notification refresh is browser polling.
- Deployment uses GitHub Actions, Node 22, SSH/SCP to Hostinger; no migration deploy step.
- Caveman is the mandatory default chat-response skill. Its source is `.agents/skills/caveman/SKILL.md`; explicit `stop caveman` or `normal mode` disables it.
- Context7 `find-docs` is mandatory for current external library/API documentation; source is `.agents/skills/find-docs/SKILL.md`.

## Traps
- README says stock may be negative and mentions importer/API export artifacts not found; current checkout rules reject insufficient stock.
- Negative exchange difference is stored but no refund Payment write was found.
- `InvoiceStatus.DRAFT` exists but active create actions do not use it.
- `NgInvoice.userId`, `NgPayment.userId`, and ledger polymorphic refs have no FK.
- Never infer production state/data from schema or seeds.

## Where to verify
Start at [`CONTEXT.md`](CONTEXT.md), then the relevant Vault module and exact source path listed in its frontmatter.
