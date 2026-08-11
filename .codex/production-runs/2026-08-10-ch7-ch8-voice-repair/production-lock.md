# Production Lock

Status: locked — bounded runtime mutation authorized

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `2026-08-10-ch7-ch8-voice-repair` |
| Mode | `scene` |
| Scope | ch7-reconstruct / ch8-launch copy repair: per-step voice pressure, one-way parenthetical exit, ch8 launch-anchor copy, `CONTACT LOGGED.` consequence stack |
| Date | `2026-08-10` |
| Source revision | `03e975a666767dd3d75fc339a3b3d61dfa755c4c` |
| Canonical preview URL | `http://localhost:5176` |
| Preview server owner | story-verifier baseline capture (vite pid 718119; ports 5173/5174 are held by the sibling Paraform project — do not use them) |
| Orchestrator | Claude (main session, creative-triad skill) |

## Authority

- Governing plan: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` — Owner Gate Lift 2026-07-28 ("Making the existing story enjoyable comes first"), Owner Lane Override 2026-07-13, Locked Owner Decisions (story content lock, audio lock).
- Latest checkpoint: `.codex/design-runs/2026-07-28-story-enjoyability/` — corpus, blind read, and the Chapter Director's `ch7-ch8-repair.md` treatment (enters triad with `contractChangeRequired: true`).
- Owner instruction: `owner-decision.md` (2026-08-10) — the ch7 exit line change `(the scar remains. now it can carry you.)` → `the scar remains. now it can carry me.` is **approved**; this satisfies `DEMO_FOUNDATION_PLAN:72` for the single shipped string this run modifies.
- Authority verified at: `2026-08-10T00:00:00Z`
- Runtime mutation permitted: **yes** — bounded to the allowed paths below
- Publish permitted: **no** unless separately recorded by the owner

Why this run is allowed: the 2026-07-28 owner gate lift authorizes post-arrival
story work, and its binding sequencing direction is that making the existing
story enjoyable comes first — this run is exactly that work. Release surface is
unchanged (`ch4-arrival`); ch7/ch8 remain unshipped-surface content behind it.
The one shipped-string change carries an explicit owner decision. Audio remains
a protected baseline: the Score Director's lane in this run is ruling-only.

## Locked scope

- Included beat(s): `ch7-reconstruct`, `ch8-launch`
- Allowed files/areas: `.codex/production-runs/2026-08-10-ch7-ch8-voice-repair/`, `main/src/story/emergentStoryDirector.ts(+test)`, `main/src/story/storyText.ts(+test)`
- Permitted changes: per-repair-stage caption/audit-line latches in ch7 (ten lines, `WRECK RELAY` / `AUDIT NETWORK` headers via existing `showAuditLine`/`showCaption` routes); ch8 copy on the three existing signed anchors (`anc.launch.ignition`, `anc.launch.liftoff`, `anc.launch.atmosphere-exit`) plus entry Variant B and Variant D; the one approved ch7 exit-string change; tests for latch once-only behavior.
- Non-goals: no new `stateRef`, milestone, or persistence; no registry/journey-contract change; no printed worker name; no `{name}` substitution; no score/audio mutation; no camera/render mutation (cinematography rules on the liftoff tree-findability question and may route a separate packet); no ch5/ch6/ch9 caption changes (escalated as follow-on).
- Shipped versus draft status: post-arrival draft surface; release surface stays `ch4-arrival`.

## Protected paths and strengths

- Protected paths: `main/public/audio/`, `main/src/audio/`, `main/src/components/audio/`, `main/src/story/emergentScoreDirector.ts`, `main/src/story/voyageDeck.ts`, `main/src/story/signedSceneAvRuntime.ts`, `main/src/story/generatedSceneAvRuntime.json`, `main/chapter-registry.json`, `main/chapter-journey-contract.json`, `firebase.json`, `.firebaserc`
- Protected narrative/camera/score strengths: reserved payoffs (A5/Light, W-7744's return, the Authority's answer, Worker 9's legibility, the typed name's A8 first-return); the naming interstitial `(retained.)`; the refusal; ch4-vigil star lines; ch7's eight gameplay-derived score variants and their signed-rail exclusion; `(repair is not return.)` as the last parenthesis.
- Required owner decisions: ch7 exit line — **recorded and approved 2026-08-10**. The §4 designation line (`they asked for a designation. what i have is not one.`) requires canon sign-off inside this cycle (routed to the canon auditor; escalate to owner only on conflict).

## Execution and evidence budget

| Dimension | Locked value |
| --- | --- |
| Repair loops | `3` (scene profile) |
| Time/token budget | deep; directors on session model, auditors/verifier on opus |
| Target devices | desktop primary; mobile parity check on caption/audit-line legibility |
| Quality tiers | LOW strip captures (headless perf constraint); HIGH state traces |
| Reduced motion | required variant for any timed caption behavior |
| FPS/frame-time target | no regression vs. shipped baseline at LOW headless |
| GPU/draw/shader/memory limits | unchanged — copy-only runtime surface |
| Capture density | before/at/after frames per repair-stage latch and per launch anchor; previous/next beat continuity (ch6 exit, ch9 entry) |
| Audio evidence | protected — no score mutation; combined-bus render only if Score ruling requires proof of near-silence fit at `CONTACT LOGGED.` |

## Stop conditions

- Authority conflict or protected-path requirement.
- Critical/high defect cannot be repaired inside scope.
- Configured repair budget is exhausted.
- Weighted score improves less than 0.05 twice.
- A headed taste, canon, scope, exception, or publish decision is required.
- Canon auditor rejects the §4 designation line as spending the A8 payoff — stop and route to owner rather than rewording unilaterally.

## Lock disposition

- Status: `locked`
- Locked by: Claude orchestrator (creative-triad skill)
- Locked at: `2026-08-10T00:00:00Z`
- Open authority questions: none — copy decision recorded; canon sign-off routed inside the cycle.

## Orchestrator rulings (addendum, 2026-08-10, post story-intent)

Recorded after the Chapter Director's Stage 1 deltas (story-intent.md §10);
the machine-lock fields are unchanged.

- **R1 — ch7-board / ch8-crossing parentheticals (intent delta D5):** accepted
  as known drift for this run. They sit inside the one-way voice window but are
  outside the locked beats, and de-bracketing them would change two additional
  shipped strings without an owner decision (`DEMO_FOUNDATION_PLAN:72`).
  Escalated with the ch5/ch6/ch9 follow-on. Reviewers and the cohesion judge
  must treat this as a recorded accepted exception, not a run-failing defect;
  the option to approve those two strings is surfaced to the owner.
- **R2 — ch8 exit breathing-room hold (intent delta D1):** the scene contract
  MAY carry the bounded, named-constant exit hold (~15–17 s) in
  `emergentStoryDirector.ts`. Without it the commissioned consequence stack
  cannot exist on screen (`tickLaunch` exits the same tick `deep_space` is
  observed). It changes pacing only, creates no durable state, mirrors the
  shipped 0.65 s hold pattern, and stays inside the allowed paths. Recorded as
  a scope note for owner visibility in the run summary.

- **R3 — pre-existing gate failure on a protected path (2026-08-10):** the
  contract-phase gate flags `main/chapter-journey-contract.json` schema drift
  (`entryStateContracts[].assertions[].equals` holds arrays where the schema
  allows only scalars). The file is a protected path in this lock and the
  drift predates the run (present at source revision `03e975a`). Accepted as
  a known, out-of-scope failure for every gate phase of this run; escalated
  to repo maintenance alongside the ch5/ch6/ch9 caption follow-on.
- **R4 — lock schema conformance (2026-08-10):** `currentRestrictions.
  reservedPayoffs`, `.scoreLane`, and `.escalatedOutOfScope` were removed from
  `production-lock.json` (the lock JSON schema forbids additional properties).
  Their content remains normative in this document — Protected strengths,
  Authority (score lane), and Locked scope/README (escalations) — with no
  change in meaning.

- **R5 — baseline hashes of mutated allowed paths (2026-08-10, post-implementation):**
  `shipped-ux-baseline.json` hashed `emergentStoryDirector.ts` and its test at the
  shipped revision, but the gate re-verifies baseline source hashes against the
  working tree in every phase while also requiring a non-empty implementation
  diff — mutually exclusive for the exact files this lock authorizes mutating.
  Ruling: both entries moved to `excludedSourceFiles` with their SHIPPED hashes
  preserved for provenance and the disposition stated inline. The baseline
  remains a record of the shipped state; the working tree intentionally differs
  by the signed implementation.

- **R7 — authority re-hash after authorized annotation (2026-08-10):** the canon
  audit's F11 routed an annotation duty to the orchestrator: the design-run
  treatment `.codex/design-runs/2026-07-28-story-enjoyability/ch7-ch8-repair.md`
  asserted a false world premise (the wreck "hosts" the ch4-comply relay; the
  relay is a separate adjacent console, `storyWorld.ts:589-605`). The annotation
  was appended 2026-08-10; the lock's authority hash for that file is
  re-recorded (`bd844d39…` → `7e7681cb…`). The original treatment text above the
  annotation is unchanged.

- **Numbering note (critic MOD-04):** there is no ruling R6 in this document;
  the orchestrator's addendum sequence runs R1–R5 then R7 (a numbering skip,
  not a missing ruling). The `R6` appearing in `repair-contract-disposition.json`
  belongs to the Chapter Director's separate rulings sequence (R1–R8 of the
  loop-3 rulings) and is unrelated.

## Machine-lock mirror

This block must repeat the exact finalized values in `production-lock.json`;
the contract gate rejects drift.

- Machine run ID: `2026-08-10-ch7-ch8-voice-repair`
- Machine mode: `scene`
- Machine source revision: `03e975a666767dd3d75fc339a3b3d61dfa755c4c`
- Machine run profile: `paravoxia-creative-scene@v1`
- Machine release candidate: `false`
- Machine mutation boundary: `bounded-runtime`
- Machine authority paths: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`, `PARAVOXIA_CREATIVE_COUNCIL.md`, `.codex/design-runs/2026-07-28-story-enjoyability/ch7-ch8-repair.md`, `.codex/design-runs/2026-07-28-story-enjoyability/owner-decision.md`, `.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json`, `main/src/story/ux/README.md`
- Machine allowed paths: `.codex/production-runs/2026-08-10-ch7-ch8-voice-repair/`, `main/src/story/emergentStoryDirector.ts`, `main/src/story/emergentStoryDirector.test.ts`, `main/src/story/storyText.ts`, `main/src/story/storyText.test.ts`
- Machine protected paths: `main/public/audio/`, `main/src/audio/`, `main/src/components/audio/`, `main/src/story/emergentScoreDirector.ts`, `main/src/story/voyageDeck.ts`, `main/src/story/signedSceneAvRuntime.ts`, `main/src/story/generatedSceneAvRuntime.json`, `main/chapter-registry.json`, `main/chapter-journey-contract.json`, `firebase.json`, `.firebaserc`
