# integration-handoff-standby — progress

Single integration engineer, sixth bounded material repair (CG-IMPL-012,
CG-IMPL-013). Governing documents read before any edit:
`handoff-standby-repair-direction.json`, `producer-handoff-standby-audit-review.json`,
`producer-focused-evidence-review.json`, `flight-discriminator-report.{json,md}`,
`handoff-standby-source-audit.{json,md}`, `producer-handoff-standby-budget-decision.json`,
`integration-inbox.md` (through the 15:45:02Z entry).

Not a creative lane. No plot, copy, geometry, proof, score or camera change. No
publication, no canonical gate/manifest/defect edit, no GPU work, no browser, no
destructive git of any kind (no checkout/restore/reset/stash/clean was run).

## Source ownership and byte preservation

Task-private exact-byte backups (outside `main/`, run-private):
`.private/handoff-standby-repair-backups/`.

| file | pre-repair sha256 |
|---|---|
| `main/src/story/tidegardenRoute.ts` | `e7237efcf339efb599222a171a22b0c4b118712025f3f777030c08482b7e103e` |
| `main/src/story/commonGroundDirector.ts` | `980590b0add81f8e0ce6bdc182cb834940af336454435ff4d304a64e47ad11b5` |
| `main/src/story/commonGroundDirector.test.ts` | `8379b552bd076c4311ba333182e7f0399e0b82a60093a16feddcdc0ed1fb8492` |
| `main/src/App.test.tsx` | absent (created by this repair) |

The first two match the read-only audit's recorded hashes, so the frozen dirty
source was the base. Every counterfactual below restored the exact pre-repair
bytes from those backups and the restored hash was verified against the
post-repair hash immediately afterwards.

**Path note.** `main/src/App.test.tsx` is one of the four commissioned paths but
did **not** exist on disk; the direction assumed it did. It was created rather
than routed, because it is an explicitly listed allowed path. No fifth path was
edited. Files outside the four paths were **read and imported only**
(`world/CommonGroundWorld.tsx` `createFooting`, `utils/agentSurfaceNavigation.ts`,
`utils/agentSurfaceNavigationRuntime.ts`, `story/autopilotSteering.ts`,
`state/systemFlight.ts`) — imports into an allowed test file, zero bytes changed.
Scratch lives only in `verifier/probes/handoff-standby-repair/` and
`logs/handoff-standby-repair/`; nothing temporary was created inside `main/src`.

## Task A — CG-IMPL-013, the ch13-return handoff reset

Accepted the producer's routing and the audit's executed reproduction. The
missing entry is restored in the existing runtime crossing table only:

```ts
// main/src/story/tidegardenRoute.ts
'ch13-return': STORY_PRIMARY_WORLD_ID
```

`resolveStoryBootWorldId` is untouched, so a reload mid-crossing still restarts
from the world the ship launched from — arrival stays earned by flight. No boot
world change, no `SystemTravelDriver`/`ShipController`/state-reset change, no
teleport, no `targetReady` bypass, no radius/speed change, no milestone grant.

Regression: `main/src/App.test.tsx` (new, 10 tests). It drives the **real**
system-flight store through the **real** commit the app performs
(`commitSystemBodyTarget` → `commitSystemPlanetHandoff`, the `onMidpoint` body of
`beginPreparedSystemTargetHandoff`) and then evaluates App's own seam expression
(`App.tsx:537-545`) against the real resolver: post-handoff identity stable and
`storyWorldSwapPending` false; pre-handoff not early-origin; route offline and
mismatched current/active remain uncommitted; the measured reclaim
(`setActiveSystemPlanet` at `ShipController.tsx:472-473`) still un-commits;
ch8-crossing, ch10-ask and boot/Continue behaviour unchanged. No mocks.

Counterfactual: with the pre-repair `tidegardenRoute.ts` restored, exactly the
post-handoff assertion fails (`Expected "-1,-1" / Received "-1,-1:p1"`), 9 pass.
Bytes restored and re-verified.

## Task B — CG-IMPL-012, the standby stall

### Phase and candidate decision (published as root asked, with its rationale)

**Measured cause, reproduced before the patch was designed** (CPU, read-only,
`verifier/probes/handoff-standby-repair/standby-terrain-repro.mjs`, log
`logs/handoff-standby-repair/standby-terrain-repro.log`), on the actual world
identity — seed **3215739679**, world **-1,-1**, planetSize **50**,
`VOXEL_SCALE` 2, shipped generator, shipped `planAgentSurfaceRoute` with
`nextNavigationStep`'s own option set:

- `CG_STANDBY_CLEAR_OF_E = (-42, 51.05, 9)` is **over water**. Its cell
  `(-21, 25, 5)` has no solid column and `isWaterVoxel` is true. So is the
  lattice-aligned `(-42, ·, 10)`, and the whole `x = -42/-44` band south of the
  survey line. The audit's B1 (off-lattice) is therefore **not** the operative
  cause, and root's rejection of the "odd coordinate alone" claim is confirmed.
- From the measured stall pose `(-41.965326, 50.988996, 12.155896)` the shipped
  planner returns `requestedGoalWasWet: true`, `reason: already-at-resolved-goal`,
  `waypoints: 1`, resolved goal `z = 12` — the cell her body already occupied.
  That is the recorded `direct` / `stillTime 0` / `nudges 0` stall exactly, and
  it is B2 answered with a measurement rather than a hypothesis.

**Candidate qualification** (`standby-candidate-qualification.mjs`, log
alongside). Clearance is measured from polyline **SEGMENTS**, and includes the
**actual sampled offered route** — the 57 body samples the witness-2 hardware
trace recorded between `after-F-at-S` and `at-E-after-draw`, extracted to
`offered-route-witness2.json` — not static vertices:

| candidate | footing | recorded offer | LONG | SHORT | COMMON | E→H | W | verdict |
|---|---|---|---|---|---|---|---|---|
| shipped `(-42,9)` | **false (water)** | 3.60 | 3.00 | 3.00 | 3.00 | 3.00 | 8.06 | rejected — no ground |
| audit `(-42,20)` | true | **0.30** | **0.00** | 8.00 | 2.83 | 8.00 | 12.81 | rejected — ON the long survey |
| audit `(-42,22)` | true | **0.46** | **0.00** | 10.00 | 4.47 | 10.00 | 14.42 | rejected — ON the long survey |
| authored `W` | true | 5.42 | 7.21 | **2.00** | 8.25 | 6.32 | **0.00** | rejected — it is HIS inspection pose, occupied at the moment the standby is needed, and only 2.0 off the short survey |
| authored `T` | true | 2.38 | 2.00 | 2.00 | 2.00 | 2.00 | 10.20 | rejected — his far reference, 2.0 from everything |
| `(-40,8)` | true | 4.89 | 4.47 | 4.00 | 4.47 | 4.00 | 6.32 | **qualifies** |
| `(-38,8)`, `(-36,6)`, `(-36,16)`, `(-30,8)`, `(-46,22)`, `(-48,22)` | true | ≥4.97 | ≥4.00 | ≥4.00 | ≥4.00 | ≥4.00 | ≥4.47 | qualify |

The producer's rejection of `(-42,20)/(-42,22)` is therefore reproduced
numerically: they are supported ground, they clear COMMON, and they sit exactly
on the span W-7744 is about to walk (0.30/0.46 from her actual recorded offer).
Authored `W` was checked rather than presumed and is **not** usable: it is his
occupied pose and it is 2.0 from the short survey — inside the required margin.

**Selected repair (chapter-local, `commonGroundDirector.ts` only).** The single
arithmetic constant is replaced by a *selection* over a small list of candidate
waiting places, all voxel-cell centres on the site's dry shelf, each confirmed
supported by the shipped footing over the real generator and reachable from S,
E, W and C by the shipped planner with `dry-surface-path` (never a substituted
goal). At runtime the nearest candidate wins that

1. the **live** footing supports (real terrain, not a fixture), and
2. clears, by `2 × BODY_BODY_CLEARANCE_UNITS + CG_RAIL_POSE_ARRIVE = 2.6`, the
   segments of every span he still has to walk: his current leg from where he
   actually stands through the untested remainder of the **recorded** samples,
   his positioning leg `E→H`, and `CG_ROUTE_COMMON` (which is also his
   independent test and the span she walks afterwards), plus his live body.

If nothing qualifies the rail publishes a **hold**, not a walk — the refusal is
surfaced, never hidden. Both existing call sites (survey stand-clear, common
positioning) share the one selection; the published reasons are unchanged.

What this does **not** touch: `CG_POSES`, `CG_ROUTE_SHORT/LONG/COMMON`,
`CG_LEG_*`, the 1-unit capsule/body clearance, the 0.6 standby arrival radius,
dry/cross-face/obstacle navigation safety, `agentSurfaceNavigation`,
`autopilot/primitives`, the exact-goal handoff, or any shared util. No bound was
widened, no body pose forced, no progress granted, no rescue enabled, no new F,
objective or target added for the player, and no required reference occupancy
removed.

Regression: 9 new tests in `commonGroundDirector.test.ts`, run against the REAL
`createFooting` over the real generator (earlier chapter tests used a flat
fixture plot that answers "supported" over water and would have passed on the
broken target) and the real planner: the stall reproduction; a supported and
genuinely reachable standby (`dry-surface-path`, >1 waypoint, resolved goal ==
requested target — not a cell substitution labelled "arrived"); segment
clearance of every span; explicit rejection of the two long-route candidates
even though they clear COMMON; an arbitrary **recorded** excursion that runs over
the preferred candidate, forcing selection elsewhere; the common-lane
positioning case; the honest hold when no ground qualifies; and the control that
W-7744 still holds for `body-clearance` when her body really is on his path and
releases only once she has actually moved.

Counterfactual: with the pre-repair `commonGroundDirector.ts` restored, 4 of the
9 fail (reachable standby, recorded span, common positioning, honest hold); the
reproduction and control tests pass either way, which is what they are for.
Bytes restored and re-verified.

## Evidence / limits

- Everything in Task B's terrain and planner work is a **CPU reconstruction** of
  terrain and navigation, plus the real vitest footing boundary. It is not a
  live proof and claims no GPU acceptance. The remaining physical gates are
  listed in the report.
- The recorded-offer polyline is the witness-2 body trace, which is the actual
  walked recording; the accepted route was 42 samples of the same walk.
- Ordering, stated plainly: the measurement and the candidate decision were made
  before any source edit; this progress file was written after the edits and
  before the final checks, at root's 15:45:02Z request.
