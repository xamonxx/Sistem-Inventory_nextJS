---
type: template
status: template
last_verified: YYYY-MM-DD
source_files: []
related: []
tags: [template, api]
---
# <Endpoint or Action>

## Contract
- Kind: Route Handler / Server Action
- Method/signature:
- Path/caller:
- Authentication:
- Authorized roles:

## Input
Schema, normalization, bounds, defaults.

## Output
Success shape, redirect/revalidation, client-visible errors.

## Effects
Database reads/writes, transaction isolation, cache invalidation, audit.

## Failure semantics
Validation, authorization, conflicts, not-found, rollback.

## Evidence
Exact source path and exported symbol.

## Verification
Observed command/scenario; never claim unrun tests.
