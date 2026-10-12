# Documentation Sync Protocol

## Impact mapping
- Route/page changed → Routes + module/frontend note.
- Component/hook/store changed → component/state note and module relationship.
- Action/handler contract changed → API/Server-Action note and flow.
- Prisma schema/invariant changed → table group, ER/data integrity, affected ADR/flow.
- Role/permission changed → Authorization + module + security risks.
- Cache/revalidation changed → Data Flow + performance note.
- Deployment/env changed → Deployment + Local Development/Recovery.

## Verification
1. Re-read changed source symbols.
2. Update `last_verified` on notes actually reviewed.
3. Add/remove wikilinks only when target note exists.
4. Keep Mermaid graphs small and source-grounded.
5. Run `node scripts/knowledge-sync.mjs validate`.
6. Refresh baseline only after documentation matches source.

Historical notes remain historical; do not rewrite prior evidence. Add a new daily/session entry.
