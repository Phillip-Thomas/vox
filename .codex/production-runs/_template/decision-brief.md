# Decision brief — {{RUN_ID}}

Every decision only the owner can make, asked once, before Stage 2. The
chapter director writes it at the end of Stage 1 from the routed decisions in
`story-intent.md`, the mutation boundary in `production-lock.json`, and the
release questions the run will raise. `decision-brief.json` is the record the
gate reads; this page is the owner's reading copy.

Rules:
- **Creative** — taste, canon and voice calls the intent cannot decide.
- **Boundary** — every file and symbol outside `allowedPaths` the intent will
  need, named exactly (path + symbol), so the owner opens paths once instead
  of being asked mid-run.
- **Release** — surface, redeploy, predeploy policy.
- A director recommends; the owner decides. No item may be decided by its author.
- The contract phase does not pass while any item is `pending`. A
  `contract-question` recorded later without a `briefItemRef` is a gate finding.

| id | kind | question | recommended | decision |
|---|---|---|---|---|
| {{creative-item-id}} | creative | {{question}} | {{option A}} | pending |
| {{boundary-item-id}} | boundary | {{path#symbol}} | open the path | pending |
| release-surface | release | release surface | {{recommendation}} | pending |
