# Scene-contract assembly notes

Producer mechanical preparation, 2026-09-06. `scene-contract.assembly.json` is a
DRAFT (`status: draft`, `contractVersion: scene-v1`) awaiting lane review. It
claims no approval, no runtime authority, no signature and no measured result.
The active `scene-contract.json`, the lock, signatures, source, schema,
validator and director-owned treatments were not modified.

## Validation performed

Ajv is not installed in this repo, so the file was checked with a local
draft-subset validator against the checked-in scene-contract schema, plus a
mirror of the gate's structural reference, guidance-lifecycle, placeholder and
band-prose checks. Result: 0 schema errors; 1 mirrored gate failure (below).
Every `evidenceRefs`, authority, palette, cut and probe path resolves today.

## Open, unbound and conflicting fields

1. `ux.contract-work-order` fails for `station:return:tidegarden`: its exact
   shipped last line, "DELIVER THE BONDED CELL TO THE SECOND HEARTH.", contains
   no verb in the gate's `travel` lexicon. Copy was preserved rather than
   rewritten. Lane decision required.
2. `ch13:return:launch` is bound as `kind: wait`, `requiresMarker: false`,
   `targetMode: none` with a nominated `targetContract`, because "[Space]" is
   not a single-letter bracket token. Confirm or re-map.
3. `performance` draw-call, shader and GPU-memory budgets are deliberately
   unbound fail-safe zeros; delta budgets are Cinematography and measurement
   work.
4. `mutationBoundary: bounded-runtime` is proposed and does not yet match the
   planning-only lock; `canonicalPreviewUrl` is provisional localhost, not a
   running preview.
5. `evidence.headedTaste.required` is set true from the intent's hardware and
   listening obligations; confirm.
6. Geometry is recorded only as producer-nominated range 12 from
   `geometry-instrument.json`; the qualification is still running and no pass is
   claimed.

Contingent holds and resumes use equivalent-order anchor slots so no route is
implied to fail.
