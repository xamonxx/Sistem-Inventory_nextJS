# Completion Protocol

A task is complete only when:

- Requested end-to-end behavior is implemented; no placeholders.
- All affected callers/contracts/docs are updated or intentionally unchanged.
- Relevant runtime smoke is observed; tests alone are insufficient for behavior changes.
- Exact checks and failures are recorded without fabrication.
- `git diff` was reviewed; unrelated user changes remain intact.
- Vault/module/graph and `.ai` status/progress/tasks are synchronized.
- Daily changelog and `handoffs/latest.md` include risk and rollback.
- Knowledge validator passes and source baseline is current.
- Secrets, customer data, generated output, and credentials are absent from documentation.

If blocked, finish reachable work and record exact missing prerequisite plus attempts. Do not mark pending work complete.
