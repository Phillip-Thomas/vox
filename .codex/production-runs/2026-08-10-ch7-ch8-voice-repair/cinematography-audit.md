# Cinematography Continuity Audit

Reviewer: `cinematography-continuity-auditor (independent, Stage 7 first wave)`
Status: complete
Contract revision: `draft-v4` (sha256 `df544b130773c3ba9ab4f0132f0223616db5767bbda7e9e6dd59bf8ab3a1f1e3`)
Disposition: **findings-routed** — one high defect gates the run's mobile-variant claim

## Independence and authorities

- First report completed before reading peer conclusions: `YES`. No Stage 7
  review file was opened — `story-audit.md`, `naive-audience-report.md`,
  `ux-audit.md`, `score-audit.md`, `cohesion-judge.md`, `critic-report.md`,
  `run-summary.md`, `lessons-learned.md` and `final-scorecard.json` are all
  unread. Triad artifacts, contract, dissent register and raw evidence only.
- Cinematography bible, runtime, palette, and shipped-cut references inspected:
  `main/CINEMATOGRAPHY.md`; `production-lock.md` (incl. rulings R1-R5);
  `scene-contract.json` draft-v4 (`shots[0..11]`, `syncAnchors`,
  `evidence.captures`, `evidence.acceptanceCriteria` refs);
  `shipped-visual-baseline.json` (`cameraStates`, `openCaptureGaps`,
  `headedStatus`); `cinematography-treatment.md`; `dissent-register.md` incl.
  both draft-v3 and draft-v4 amendments; `cinematography-contract-signoff.json`
  (conditions C1-C6, CC1-CC4); `check-results.json` iteration 4;
  `verification-report.json`; `defects.json`; `screenshot-report.md`;
  `frame-defect-scan.mjs`; `voice-repair-probe.mjs`; `ladder-verify-probe.mjs`.
- Frame strips, traces, variants, and performance evidence inspected:
  `evidence/verification/ch7-captures-{desktop,potato,mobile-portrait,reduced-motion}/`
  + sidecars; `evidence/verification/ch8-captures-{desktop,potato,mobile-portrait,mobile-landscape,reduced-motion}/`
  + sidecars; `evidence/verification-v3/routeA-ordered/{run1,run2,run3,routeA-ordered.json,routeA-ordered-captures.json}`;
  `routeB-desktop-run2/`, `routeC-desktop-run2/`, `routeC-potato-run{1,2,3}/`,
  `seeded-fly-entry/`, `seeded-midflight-reentry/`;
  `evidence-hires/ch7-reconstruct/`, `evidence-hires/ch8-launch/`;
  `evidence/ch7-board-entry/`, `evidence/ch6-dive/`;
  `evidence/verification/{resets,variants,variant-parity,pause-window,quit-replay,fps-verification}.json`.
  Independent pixel scans run over all 2167 PNGs (1875 v3 + 292 verification).

## Findings

- **Focal hierarchy, blocking, screen direction, and negative space:** The ch8
  exit-hold shot is the strongest focal work in the run — near-black cockpit
  frame, starfield and violet nebula through the canopy, cyan holo ring at
  bottom-center, drift streaks, and both text bands on maximum contrast
  (`ch8-captures-desktop/off_9p7s_ch8-launch.png`,
  `off_15p2s_ch8-launch.png`). The ch7 52° reveal is weak on the only path
  imaged: ~50% of the frame is empty sky, the declared primary ("restored spine
  and surviving scar") never resolves as a ship, and the most legible
  mid-ground object is a palm tree
  (`ch7-captures-desktop/off_2p4s_ch7-reconstruct.png`, `off_3p5s`). A
  saturated near-plane orange mass (the bench salvage crate, cf.
  `evidence/ch6-dive/009_037s_ch7-reconstruct.png`) holds 2.5-3.4% of the
  reveal frames and 13.7% of the boarding-seam frame — measured, and the
  largest saturated accent anywhere in ch7. Screen direction is coherent
  everywhere: one cockpit first-person rig from ignition through the crossing
  seam, no axis break, no cut.
- **Lens/FOV and camera-authority continuity:** No drift from baseline. All
  twelve contracted shots match `shipped-visual-baseline.json.cameraStates`
  exactly — 8× `player-camera` 75°, `cin.reconstruct.09-one-exterior-reveal`
  `cinematic-look` 52°/52° with a 350 ms occlusion transition, and three
  `lens-rig` launch shots (70→72, 74, 70) whose numeric FOV the runtime
  refuses. The exit-window trace confirms `appliedFovDeg 52`,
  `cameraAuthority cinematic-look` and `fx.reconstruct.09` held constant across
  the whole window (`ch7-window-av-score-trace.json`). The run's central claim
  — zero camera/shot/render/PostFX mutation — is verified.
- **Camera motion, cuts, easing, and hand-back:** No cut is introduced; every
  shot declares `declaredCut: false`, matching baseline. The atmosphere-exit
  transition is genuinely eased, not a pop: at `deepSpace-0.3` the canopy is
  already full starfield while the flight phase still reads `descent`
  (`routeA-ordered/run1/082_deepSpace-0.3_t15p22s_ch8-launch_descent.png`).
  Control is never taken in either beat, so hand-back is a verified no-op.
- **Semantic palette, light, fog, material, and grade continuity:**
  `realityStage: alive` on every sample, no grade preset and no lighting
  override declared or added. One shipped route divergence worth recording, not
  owned by this run: the `?story=ch7-board` deep link enters at night
  (`evidence/ch7-board-entry/001_004s_ch7-board.png`) while the continuous
  chain enters the same beat in daylight
  (`ch7-captures-desktop/off_5p2s_ch7-board.png`) — the same beat has two
  atmospheres depending on route.
- **Render-effect causality and reality-stage ceiling:** Nothing added, so the
  ceiling holds by construction. POTATO nonetheless removes vegetation and
  water detail rather than only AO/sampling — see CIN-07.
- **Desktop, mobile, reduced-motion, and lowest-quality focal parity:**
  Reduced motion is genuinely identical in line sequence, offsets and DOM
  rectangles. POTATO is identical in typography, placement and cadence. Mobile
  portrait fails at the ch7 exit window (CIN-01) and diverges compositionally
  at the ch8 hold, where the caption crosses the cyan holo ring
  (`ch8-captures-mobile-portrait/off_4p0s_ch8-launch.png`) and the
  `DEEP SPACE · HANDOFF` card the treatment counted as part of the window's
  composition is collapsed behind the JOURNAL disclosure.
- **Frame budget and graceful degradation:** Clean. LOW 1280×720 medians
  60.09/60.09/60.06 against baseline 60.12/60.11/60.08; the exit-hold window
  itself holds a 60.06 median over five 3 s samples, minimum 60.03. Copy-only
  surface, no regression.
- **Replay, deep-link, pause, quit, completion, and sandbox reset:** All six
  reset cases pass with no state leak. Pause is measured on the game's own
  clock: 0.0 ms story-clock drift across a 5006 ms wall hold applied at window
  +3.0 s, with every beat-runtime offset preserved inside 0.2 s. The advance
  seam is clean in frame — `off_18p0s_ch8-crossing.png` shows the crossing
  entry caption, SIBLING WORLD objective and the resolved marker with nothing
  leaking from the previous beat.
- **Implementation versus signed contract:** Shots, anchors and frozen offsets
  agree with the frames within 0.083 s across three cold runs
  (`routeA-ordered.json.exitWindow`). Four documentary disagreements are
  recorded below (CIN-02, CIN-08, CIN-09, CIN-11) plus two undelivered capture
  terms (CIN-03, CIN-10).

### Pre-recorded items confirmed as authored, not leaks

- `dissent-05` (empty regulation band under L6) reads exactly as authored:
  `ch8-captures-desktop/off_15p2s_ch8-launch.png` shows the band genuinely
  empty — the pill's own fade has reached zero opacity while the DOM node still
  carries `CONTACT LOGGED.` — with L6 revealing beneath over near-black. The
  same emptiness holds at POTATO (`ch8-captures-potato/off_15p2s`). Confirmed
  in-frame, not inferred.
- `dissent-04` (audit-pill TTL into boarding) is confirmed as to duration — the
  `AUDIT NETWORK` pill is on screen at ch7-board +0.2 s and +1.5 s and gone by
  +1.62 s — but its stated image is wrong; see CIN-02.
- `dissent-02` findability record is **complete and correctly framed**. Route A
  ordered-ignition, three cold runs, ~100 ms burst cadence: site, pond, palms,
  deer and the red-fruited hero tree in frame from beat entry through
  ignition +0.5 s (`run1/029_L2+0.2_t8p27s`, `run1/043_ignition+0.2_t10p22s`,
  `run1/046_burst_t10p53s` — last ground frame); nothing but sky from the phase
  edge onward (`run1/052_edge-0.3_t11p21s`); and L3's entire firing and reveal
  window on a canopy that is 100% flat sky
  (`run1/071_L3+2.0_t13p65s`, `078_L3+3.0_t14p59s`, `082_deepSpace-0.3`). The
  verifier's `dischargeMeasurement.treeFindabilityObservation` matches my frame
  read line for line and is correctly labelled "measurement, not ruling". L3's
  image support remains OPEN by dissent; I raise no new finding against the
  line. I do raise CIN-04 against the *scope* of the packet's problem statement.

## Defects

| ID | Severity | Shot/anchor | Observation | Evidence | Owner | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| `CIN-01` | high | `cin.reconstruct.09` / `anchor.ch7.m7-caption`, `anchor.ch7.exit-line` (variant-mobile) | On mobile portrait the ch7 exit-window caption collides with the FPS touch-control cluster. The M7 caption's second line runs through the CONSUME button, whose label is drawn on top of it; the owner-approved exit string `the scar remains. now it can carry me.` has "carry" under the USE button and "me." abutting CONSUME. Caption rect is `18,606 354×47` while the ch7 control buttons begin at y≈600. `verification-report.json.variants.mobile` states "touch controls below y 660 — no band, card or control overlap" and `focalParity: true`; that measurement was taken only at the **ch8** stack-row-1 frame, where the flight control layout (L/R/LAND/THR) does sit at y≥675. The ch7 control layout is higher and was never checked. | `evidence/verification/ch7-captures-mobile-portrait/off_2p4s_ch7-reconstruct.png`, `off_4p8s_ch7-reconstruct.png`; `ch7-captures-mobile-portrait.json` capRect; `verification-report.json.variants.mobile` | `cinematography` → route to UX renderer (caption solver / control-cluster safe band) | Recapture the ch7 exit window at 390×844 with the touch-control container rect recorded per frame, plus the **missing** 844×390 ch7 landscape set required by `cap.variants`. Until then the mobile variant status must read `fail`, not `pass`. |
| `CIN-02` | medium | `anchor.ch7.advance` (`dissent-04`) | The "black boarding frame" that `dissent-04`, `cinematography-treatment.md` §1.2/§2.1 and the signed cinematography condition all describe is a cold-deep-link **boot-black** frame, not an authored boarding occlusion. `evidence/ch7-board-entry/000_000s_ch7-board.png` is the t=0.000 s frame of a `?story=ch7-board` deep link: world entirely black, HUD and caption live, world present by +4 s. The same artefact class is classified in this run's own iteration-4 gap list as "headless cold-boot characteristic of this capture environment". On the continuous chain there is no black at all — ch7-board +0.2 s is a bright daylight exterior. The accept survives (the pill does persist ~1.5 s); its stated image does not. | `evidence/ch7-board-entry/000_000s_ch7-board.png` vs `001_004s_ch7-board.png`; `evidence/verification/ch7-captures-desktop/off_5p2s_ch7-board.png`, `off_6p5s_ch7-board.png`; `verification-report.json.dischargeMeasurement.captureGaps[0]` | `cinematography` (record repair; no runtime change) | Amend `dissent-04` and the treatment to describe the actual seam image, and re-state the accept as TTL persistence over the next beat's daylight exterior. No recapture needed — the frames already exist. |
| `CIN-03` | medium | `cin.reconstruct.09-one-exterior-reveal` / `cap.ch7.reveal-composition` | The money capture is half-delivered. Every ch7 capture set is `?story=ch7-reconstruct&movie=1`; no deep-link or player-vantage frames of `cin.reconstruct.09` exist, though the capture spec and the director's own §6 item 3 require "both the movie path and one deep-link run". The delivered movie-path composition is not the predicted nose-to-hull degenerate (contrast `evidence-hires/ch7-reconstruct/007_015s`, which is), but it is sky-heavy at ~50%, the declared primary subject is not legible as a restored ship, and a saturated orange near-plane mass measures 2.46/3.33/3.35/3.33% at +0.8/+2.4/+3.5/+4.8 s and 13.72% at the boarding seam. A stepped-back vantage in the same beat renders the subject legibly (`evidence/ch6-dive/009_037s_ch7-reconstruct.png`), so the subject exists and the reveal window does not reach it. Owner taste question 1 is now live and answerable; the ruling is the Cinematography Director's, not mine. | `evidence/verification/ch7-captures-desktop/off_0p8s`, `off_2p4s`, `off_3p5s`, `off_4p8s_ch7-reconstruct.png`; `ch7-captures-desktop.json` url; `evidence-hires/ch7-reconstruct/007_015s`; `evidence/ch6-dive/009_037s`; `scene-contract.json` `cap.ch7.reveal-composition` | `cinematography` (headed taste ruling) + `story-verifier` (missing capture) | Capture the reveal on one non-movie route from a player-chosen vantage, then a headed screening of both. If the movie-path frame is ruled degenerate it routes as a separate shot-defect packet per the pre-recorded protocol, not into this run. |
| `CIN-04` | medium | `cin.launch.01`, `cin.launch.02` / `anchor.ch8.at-the-controls`, `anchor.ch8.site-recedes` | On **both** movie routes the ch8-launch beat never shows the departure site at all. Route B (chained, `?story=ch7-board&movie=1`) at t=0.54 s and Route C (`?story=ch8-launch&movie=1`) at t=4.08 s are still `surface` phase on the pad, yet the canopy is flat empty sky — no pond, no tree, no ground, no horizon — because the autopilot pitches the nose up at beat entry. L1 `the pond answered every time i asked…` and L3 both play over a worldless frame, and `cin.launch.01`'s declared primary, "the cockpit horizon reference", is absent. Route A (no autopilot) is the *best* case and is the only case fixed into the packet's problem statement by condition CC4 ("consumed unchanged"), while `dissent-02` constraint (c) obliges movie-path parity. The packet would therefore be commissioned against evidence that understates its own problem. | `evidence/verification-v3/routeB-desktop-run2/001_strip_t0p54s_ch8-launch_surface.png`; `routeC-desktop-run2/005_strip_t4p08s_ch8-launch_surface.png`; `routeC-potato-run2/004_strip_t3p79s`, `011_burst_t4p61s`; contrast `routeA-ordered/run1/004_L1+0.2_t3p76s` | `cinematography` (packet scope) | Attach the Route B and Route C establishing frames to the `cin.launch.02-world-below` packet's problem statement as the movie-path case, or record explicitly in the `dissent-02` amendment trail that the movie path is worse than the standing record. No recapture required. |
| `CIN-05` | medium | all `verification/ch7-*` and `ch8-*` capture sets | `voice-repair-probe.mjs` reads `__voxText()`, `__voxObjective()` and the DOM **after** `page.screenshot()` (lines 288-308), so every per-frame `storeCaption` / `storeAudit` / `objective` / `dom.*` value describes state ~0.15-0.25 s later than the pixels of the same file. Demonstrated at a transition: `off_4p8s_ch7-reconstruct.png` shows the exit string fully revealed with the `WRECK · FLIGHT READY` card, while its sidecar records `(the wreck is waiting for an owner.)` and `board:hatch-in-progress`. `screenshot-report.md`'s tables are built from those fields. The v3 strips do **not** share this bug (`ladder-verify-probe.mjs` samples state before the shutter and discloses per-frame deviation), so the scope is the `verification/` sets only. | `voice-repair-probe.mjs:285-315`; `evidence/verification/ch7-captures-desktop/off_4p8s_ch7-reconstruct.png` vs `ch7-captures-desktop.json` entry for the same file | `story-verifier` | Either re-emit the sidecars with state sampled before the shutter, or annotate every `verification/` sidecar and `screenshot-report.md` with the measured post-shutter bias. Frames themselves are unaffected and need no recapture. |
| `CIN-06` | medium | evidence method / `cap.ch8.paced-ladder`, `cap.variants` | The zero-blank-frame claim is unsupported by the tool that makes it. `frame-defect-scan.mjs` flags a frame only when whole-frame `std < 2.0`, so any frame whose 3D world is black but which carries the objective card and HUD chrome passes. An independent central-crop scan (excluding HUD regions) over all 2167 PNGs finds **58 world-black frames**: two per cold deep-link run in every route and every variant, at ~entry +0.15 s and ~+2.5 s, with the world appearing at +2.4 to +2.9 s, plus three of the four `seeded-fly-entry` frames byte-identical at 25753 bytes. The gap is honestly recorded for `routeA-ordered`, but its classification — "headless cold-boot characteristic of this capture environment" — is an attribution with no headed or real-GPU cold-deep-link capture behind it, and `screenshot-report.md` still asserts "no blank frame, no black frame … in any of the 292 frames". | `frame-defect-scan.mjs:50`; `evidence/verification-v3/routeC-potato-run2/000`,`001`,`002`; `routeA-ordered/run{1,2,3}/000`,`001`; `seeded-fly-entry/` md5 `d8bcdc54…` ×3; `verification-report.json.dischargeMeasurement.captureGaps[0]`; `screenshot-report.md` "Objective visual defects found" | `story-verifier` | Add a world-region (HUD-excluded) blank test to the scan and re-run; and either obtain one headed cold deep link to support the environment attribution, or downgrade the classification to "unattributed, headless-only evidence". |
| `CIN-07` | low | `cin.reconstruct.09` / `quality-potato`; bears on `dissent-02` | POTATO removes vegetation and water detail, not only AO/sampling. At an identical camera (same hull edges, same fin, same crate, same horizon) the palm that is the most legible mid-ground element of the 52° reveal at LOW is absent at POTATO, along with grass tufts, reeds and water shading. Bible law 1 forbids the lowest tier changing the focal subject; `verification-report.json.variants.lowestQuality.focalParity: true` is asserted from typography, placement and cadence only, with no focal measurement. Consequence for the routed packet: because both POTATO ch8 routes are nose-up (CIN-04), **no POTATO frame in this run contains the launch site**, so whether the ch8 hero tree survives at POTATO is unknown — and if it does not, L3 can never be image-supported there regardless of what the camera packet does. | `evidence/verification/ch7-captures-desktop/off_3p5s_ch7-reconstruct.png` vs `ch7-captures-potato/off_3p5s_ch7-reconstruct.png`; `off_2p4s` pair; `routeC-potato-run2/011_burst_t4p61s`; `verification-report.json.variants.lowestQuality` | `cinematography` (record) + `story-verifier` (capture) | One POTATO seated pre-ignition frame on the ordered-ignition route, imaging the site through the canopy. Restate `focalParity` as a measured claim or withdraw it. |
| `CIN-08` | low | `cin.launch.01-engine-finds-weight`, all ch8 shots | Contract-internal drift left by the draft-v3/v4 anchor rebinds. `cin.launch.01` still declares its secondary focal element as "the L2 caption", but L2 was rebound to `anchor.ch8.self-order`, whose own `cinematography[].shotRef` is `cin.launch.02-world-below`; both of shot 01's anchors are recorded as entry-coincident, so L2 cannot fire inside shot 01's window. Separately, all three ch8 shots carry the ch7-specific boilerplate in `framing.exitComposition` ("For cin.reconstruct.09 the composition is unchanged but its screen life grows from about 0.8 s to about 5 s"), and every shot's `subjectOccupancyIntent` and `horizonIntent` read "Unchanged from shipped." — bible law 3's declarations are schema-present and content-free. | `scene-contract.json` `shots[9].focalHierarchy.secondary`, `shots[9..11].framing.exitComposition`, `syncAnchors` `anchor.ch8.self-order`, `anc.launch.ignition.acceptanceCriterion` | `cinematography` (record repair) | Contract-text repair at the next revision; no capture owed. |
| `CIN-09` | low | run record | `verification-report.json` carries two conflicting standing tree-findability records in one file: `repairIteration.treeFindabilityRecord` (iteration 3) names the `routeA-space*` / `routeA-space-late-ignite*` strips as the standing record with no supersession note, while `dischargeMeasurement.treeFindabilityObservation` (iteration 4, condition CC4) and the `dissent-02` draft-v4 amendment fix the record to `routeA-ordered`. The file's top-level `overallStatus` also still reads `fail` from iteration 1, and `contractVersion` at the top reads `draft-v2`. | `verification-report.json` `.overallStatus`, `.contractVersion`, `.repairIteration.treeFindabilityRecord`, `.dischargeMeasurement.treeFindabilityObservation` | `story-verifier` | Add an explicit supersession field to the iteration-3 record and a current top-level roll-up. |
| `CIN-10` | low | `cap.seam-continuity` | Partially delivered. The ch8 hold→crossing seam is contracted at 500 ms across +16.5 to +18.5 s; only +17.0 and +18.0 exist (1000 ms, two frames). No post-implementation strip exists for the ch6-dive→ch7 entry seam or the ch8-landfall→ch9 seam, so "one ch8-landfall to ch9 entry strip proving nothing changed there" rests entirely on pre-change baseline frames — and `vd-02` records a ch8-landfall stall reached from ch8-crossing. | `evidence/verification/ch8-captures-desktop/` listing; absence of ch6/landfall dirs under `evidence/verification/` and `evidence/verification-v3/`; `scene-contract.json` `cap.seam-continuity` | `story-verifier` | 500 ms strip across +16.5→+18.5 s, plus one post-change strip each for ch6-dive→ch7 and ch8-landfall→ch9. |
| `CIN-11` | low | `anchor.ch7.advance` (`dissent-03`) | `dissent-03`'s measured sentence — "the owner-approved exit string holds about 2.0 s in-beat plus about 0.2 s into ch7-board before that overwrite" — is not what the capture shows. On the desktop chain the ch7-board parenthetical begins at ~+4.85 s, i.e. ~0.15 s **before** the +5.0 s advance, because the movie autopilot starts boarding inside the exit hold: the objective flips to `board:hatch-in-progress` while the beat is still `ch7-reconstruct`. The ~2.0 s in-beat figure is correct; the "+0.2 s into ch7-board" clause is not. The exit string does reach full reveal, imaged at `off_4p8s` on desktop and mobile. | `ch7-captures-desktop.json` entries for `off_3p5s` and `off_4p8s` (objective and caption); `ch7-captures-desktop/off_4p8s_ch7-reconstruct.png`; `dissent-register.md` `dissent-03` | `cinematography` / `chapter` (record) | Restate the measured clause. No recapture owed. |

## Continuity matrix (adjacent scenes)

| Dimension | ch6-dive → ch7-reconstruct | ch7-reconstruct → ch7-board | ch7-board → ch8-launch | ch8-launch → ch8-crossing | Status |
| --- | --- | --- | --- | --- | --- |
| Lens / authority | player-camera 75° continuous | 75° → `cinematic-look` 52° (350 ms occlusion, declared) → player 75° | player-camera → `lens-rig`, numeric FOV refused, flight owns FOV | `lens-rig` unchanged across the advance | continuous, no undeclared cut |
| Palette / stage | `alive`, planet-derived, daylight | `alive`, unchanged | `alive`; deep-link route enters at night vs daylight on the chain | `alive`; starfield already full 0.3 s before the phase flip, no pop | one shipped route divergence, recorded |
| Light / atmosphere | daylight terrain | daylight, no override | daylight → cockpit interior → sky → space, gradual | space, unchanged | one atmosphere per route |
| Screen direction | forward, player-owned | forward, player-owned | forward through the canopy, nose-up on movie routes | forward, unchanged | coherent |
| Focal subject | wreck / restored Kestrel | reveal subject illegible on the imaged path (CIN-03) | site absent on movie routes (CIN-04) | starfield + stamping band, legible | two open items |
| Agency | player | player throughout the 5.0 s hold, no letterbox, no forced look | player | player throughout the 17.0 s hold | first-day long-take doctrine preserved |
| Score relation | shipped | shipped `sc.reconstruct.one-instrument`, `score.hit` null | shipped generic ramp | 0.4375 → 0.42 → 0.35 seam, unchanged | no cinematography-caused change |
| Effect / band reset | n/a | audit pill TTL crosses the seam by design (`dissent-04`) | caption slot single-slot, overwrite at ~+4.85 s | `lastResetReason beat-exit`, anchors emptied, band empty at +17.0 | resets verified; one record wrong (CIN-02) |

## Protected strengths (do not "fix" these away)

1. **The empty regulation band under L6.** Confirmed in frame at LOW and
   POTATO. It is the visual half of the bilateral silence law; nothing may fill
   it.
2. **`CONTACT LOGGED.` alone in the band over an empty caption band**
   (`off_9p7s`). Two words, maximum contrast, no competing element. The single
   best composed moment in the run.
3. **The 2.0 s stamp cadence as the window's rhythm.** Rows cut printer-like
   with no fade flicker; the frame never goes static because drift streaks run
   continuously.
4. **The seated pre-ignition attitude on the ordered route.** `run1/004_L1+0.2`
   is the one ch8 frame where line and image agree — pond, deer, grass, palms
   and the hero tree present as L1 names the pond. Any packet that changes climb
   attitude must not disturb this establishing frame.
5. **Agency in both holds.** Live stick, no letterbox, no forced look, and
   pause-safe on the game clock (0.0 ms drift over a 5 s hold). The holds are
   pacing, not seizure.
6. **The audit band's fixed top-13.5% self-backed placement below the letterbox
   line.** It survives every route, tier and orientation tested.
7. **The "measurement, not ruling" framing of the tree-findability
   observation,** and the per-frame deviation disclosure in
   `routeA-ordered-captures.json`. Both are exemplary evidence discipline.
8. **The gradual atmosphere-exit** — starfield resolved before the phase flip,
   so the run's biggest world change arrives without a pop.

## Evidence gaps

1. `cin.reconstruct.09` on a non-movie route from a player-chosen vantage —
   the unfulfilled half of `cap.ch7.reveal-composition`.
2. ch7 exit window at mobile **landscape** 844×390 — required by `cap.variants`,
   entirely absent.
3. ch7 exit window at mobile portrait recaptured with the touch-control
   container rect recorded per frame (CIN-01).
4. One POTATO seated pre-ignition frame on the ordered route, imaging the site
   and hero tree through the canopy (CIN-07).
5. Route B/C establishing frames formally attached to the `cin.launch.02`
   packet problem statement (CIN-04).
6. ch8 hold→crossing seam at 500 ms across +16.5→+18.5 s (CIN-10).
7. Post-implementation ch6-dive→ch7 and ch8-landfall→ch9 seam strips (CIN-10).
8. One headed / real-GPU cold deep link to test the "capture environment"
   attribution of the 58 world-black frames (CIN-06).
9. **Headed taste screening remains correctly open.** `shipped-visual-baseline.json`
   records `headedStatus: pending` and no headed capture exists anywhere in the
   run. Nothing in this audit substitutes for it, and the composition ruling in
   CIN-03 is explicitly reserved to the Cinematography Director.

## Single highest-leverage repair

**Recapture the ch7 exit window on mobile — portrait with the touch-control
container rect recorded, and the missing 844×390 landscape set — and withdraw
the `variants.mobile` pass until it clears (CIN-01).** It is the only defect
that makes the run's own added copy, including the single owner-approved string
of the whole run, partially unreadable on a target device; it is the only
finding contradicted by an affirmative "pass" in the run's own verification
record; and the missing landscape capture is the one contracted variant that
could still be hiding a second instance of the same collision.

## Verdict

`repair` — the run's central visual claim is true and verified: zero
camera/shot/render/PostFX mutation, twelve shots matching the shipped baseline
exactly, no undeclared cut, agency intact, both holds pause-safe, resets clean,
no frame-rate cost. The ch8 exit hold is genuinely well composed and both
intended-accepts behave as authored in frame (with `dissent-04`'s stated image
wrong, not its behaviour). One high defect gates the mobile-variant claim, three
medium defects are documentary or scope-of-record repairs needing no runtime
change, and two contracted captures — the deep-link reveal composition and the
mobile-landscape ch7 set — are undelivered. Composition judgement on the 52°
reveal frames is deliberately left open: they are the first frames of
`cin.reconstruct.09` ever captured, they are technically valid, and the taste
ruling belongs to the Cinematography Director in a headed screening.

---

# DELTA RE-AUDIT — 2026-08-11 (review pass 2 of 2)

Reviewer: `cinematography-continuity-auditor (independent, delta pass)`
Contract revision audited: `draft-v5` (sha256 `36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb`, re-hashed on disk and matched)
Evidence base: `evidence/verification-final/` (2456 frames, 9 sidecar sets + `routeA-ordered/`),
`verification-report.json` `.closingVerification` / `.currentRollUp`, `dissent-register.md`
draft-v5 amendments, `implementation.diff`, `production-lock.md` mutation boundary.
Disposition: **conditional** — every finding I raised is now either resolved or
honestly recorded; two new medium defects and one measured behaviour change are
raised against the closing evidence itself.

## Independence

No Stage 7 review file was opened in this pass either. `story-audit.md`,
`naive-audience-report.md`, `ux-audit.md`, `score-audit.md`, `cohesion-judge.md`,
`critic-report.md`, `run-summary.md`, `lessons-learned.md`, `final-scorecard.json`
and `creative-run-quality-report.json` remain unread. Triad artifacts, the
contract, the dissent register, the lock, the diff and raw evidence only.

## Authority re-check

`implementation.diff` touches exactly `main/src/story/emergentStoryDirector.ts`,
`emergentStoryDirector.test.ts` and `storyText.test.ts` — inside
`production-lock.md` machine-allowed paths, and no protected AV path
(`signedSceneAvRuntime.ts`, `generatedSceneAvRuntime.json`) is touched. The run's
central visual claim — zero camera/shot/render/PostFX mutation — remains
structurally true, and is re-proven in frame state on desktop LOW by
`closingVerification.ch7QueueGuard.exitWindowFrameState` (appliedFovDeg 52,
cameraAuthority `cinematic-look`, `fx.reconstruct.09-one-exterior-reveal` constant
across all eight in-beat anchor samples). See CIN-13 for where that re-proof does
not reach.

## Per-finding disposition

| ID | Disposition | Basis (verified independently in this pass) |
| --- | --- | --- |
| `CIN-01` | **confirmed, now honestly recorded — render fix rides to the owner** | I recomputed the rect intersections from `ch7mobile-mobile-portrait.json` / `-landscape.json` myself and reproduce the closing numbers exactly: portrait 59/76 caption-bearing frames collide, worst 3224 px²; landscape 23/76, worst 2914 px². `mobileRecapture.portrait.status: "fail"` with the statement "does not pass and is not softened". The false `variants.mobile` pass is gone: `currentRollUp` marks `variants` superseded and `overallStatusNote` names CIN-01 as a recorded exception with owner scope open. Pixel-confirmed at `ch7mobile-mobile-portrait-run1/051_anchor+2.8` — "paying attention." is overprinted by the CONSUME label — and at `058_anchor+4.8`, where the owner-approved string renders "…now it can **carry**" across the USE ring and "me." abutting CONSUME. Landscape is materially better but I would not call it clean: at `anchor+0.0/+0.4` the M7 caption's first-line tail "now." sits under the CONSUME pill (2914 px²). **Status: finding upheld; record repaired; runtime defect open and correctly routed.** |
| `CIN-05` | **resolved** | Every `verification-final` sidecar carries per-frame `stateReadOrder: "state-before-shutter"` (unique value across 490 fields in `ch7queue-desktop.json` alone) plus its own `shutterSpanMs`. The bias is not annotated, it is re-measured. Residual, disclosed not hidden: the read is now *earlier* than the pixels by the shutter span (ch7queue p50 159 ms, p90 191 ms, max 2011.7 ms on 7 of 260 frames), so per-frame reconciliation is still required for sub-200 ms claims — which is precisely how CIN-12 below had to be read. |
| `CIN-06` | **resolved as a method fix** | `world-region-blank-scan.mjs` crops HUD bands (x 10–90 %, y 16–70 %, fractions written into the report) and reports both numbers per frame. 2456 frames, 34 world-black, 0 whole-frame blanks, median worldStd 34.8. I pixel-checked a flagged frame (`seams/ch8-landfall-to-ch9/seam_t1p93s_ch8-landfall.png`): world entirely black, objective card and HUD live — genuine. Attribution now reads "UNATTRIBUTED, HEADLESS-ONLY EVIDENCE … the earlier classification is withdrawn and not replaced". That is exactly repair option (b) I asked for. The headed/real-GPU cold deep link remains an open evidence gap, correctly labelled as such. |
| `CIN-09` | **resolved** | `currentRollUp` names `closingVerification` authoritative, lists ten superseded sections verbatim-for-lineage, and `standingTreeFindabilityRecord` binds the record to `verification-final/routeA-ordered/run{1,2,3}` with an explicit `supersedes` array naming both prior conflicting records. Top-level `overallStatus` now `pass-with-recorded-exceptions`, `contractVersion` `draft-v5`, sha matching. Residual (folded into CIN-14): `.iterationNote` still asserts "Every field outside repairIteration is the iteration-1 (draft-v2) record", which the existence of `closingVerification` contradicts. |
| `CIN-10` | **resolved** | On disk: `seams/ch8-hold-to-crossing/` holds exactly the contracted five frames at 16.497/17.002/17.509/17.998/18.499 s; `seams/ch6-dive-to-ch7/` seven frames; `seams/ch8-landfall-to-ch9/` 26 frames crossing genuinely into `ch9-settle`. I read `seam_t16p50s_ch8-launch.png` and `ch9entry_t0p00s_ch9-settle.png`: the first proves the empty regulation band under L6 by pixel (no pill rendered, L6 alone over the starfield), the second proves ch9 entry is clean — new palette, own entry caption, no ch8 band, marker and prompt live, nothing leaking. Residual (low, folded into CIN-14): the ch6→ch7 strip images only the ch7 side of that seam; no ch6-dive frame precedes it. |
| `CIN-11` | **withdrawn — my finding was itself the artefact** | `mod02Remeasure` shows the ch7-board parenthetical onset equals the advance to Δ 0.0000/0.0000/−0.001 s on 3 cold runs. I confirmed the causal half independently from the unbiased sidecars: at `anchor+4.8` the objective reads `reconstruct:ready` with beat `ch7-reconstruct`, and only flips to `board:hatch-in-progress` at `anchor+5.2` with beat `ch7-board`. My claim that "the movie autopilot starts boarding inside the exit hold" is disproven; it was a post-shutter-bias read. What survives is not a defect at all — the exit string reaches full reveal in-beat and the overwrite is exactly beat-coincident, which is the cleanest possible shape for that seam. MOD-02 resolves against the old numbers. See CIN-14(b): the dissent register's draft-v5 "correction" now needs a third restatement, because it enshrined *my* wrong number. |
| `CIN-02` | **record repaired; one residual** | `dissent-register.md` `dissent-04` carries "**Stated image corrected at `draft-v5` (CIN-02)**" and restates the accept as TTL persistence over the next beat's daylight exterior, preserving the original wording so the correction is legible as a correction. Residual: `scene-contract.json` `cap.ch7.exit-window.acceptanceCriterion` still requires proof of "the audit-pill persistence over the boarding **black**" — a capture term for an image now known not to exist. Folded into CIN-14(a). |
| `CIN-03` | **open by design; observation unchanged on new evidence** | `cap.ch7.reveal-composition` remains `status: "planned"` and the deep-link half is still undelivered. On the new desktop capture (`ch7queue-desktop-run1/059_anchor+4.8`) the composition reads exactly as before: sky-dominant, the declared primary "restored spine and surviving scar" not legible as a restored ship, the palm still the most legible mid-ground object, the saturated orange crate still the largest accent. Mobile portrait is worse — the portrait crop raises the sky fraction further and the subject reads as an undifferentiated black mass. Contract now records the shot honestly (`cin.launch.02` primary rewritten to "the receding ground the shot declares but the captured frames do not deliver"). Taste ruling remains the Cinematography Director's in a headed screening; I raise nothing new. |
| `CIN-04` | **record repaired; capture ask satisfied by attachment** | `dissent-register.md` draft-v5 amendment "packet problem statement extended" attaches the Route B (t 0.54 s) and Route C (t 4.08 s) worldless establishing frames to the packet, states Route A is the BEST case, and says explicitly "so the packet is not commissioned against evidence that understates its own problem". That is the repair I asked for, verbatim in substance. Residual: the same amendment's `ux-06` caveat carries pre-patch numbers — CIN-14(c). |
| `CIN-07` | **record repaired; capture still owed** | The POTATO caveat is attached to the packet ("POTATO removes vegetation and water detail, not only ambient occlusion and sampling … whether the ch8 hero tree survives at POTATO is unknown"). The capture half is not delivered: `routeA-ordered` runs at LOW only; there is no POTATO ordered-ignition strip, so no POTATO frame in this run still contains the launch site. `variants.lowestQuality.focalParity` is now superseded rather than restated. Correctly disclosed; remains an evidence gap. |
| `CIN-08` | **half repaired** | Repaired: `shots[9].focalHierarchy.secondary` now reads "no caption of this run: both of this shot's anchors are recorded entry-coincident and L2 was rebound to `anchor.ch8.self-order`, whose shot relation is `cin.launch.02-world-below`, so no L-line can fire inside this shot's window", and the ch7-specific `exitComposition` boilerplate is gone from all three ch8 shots ("Shipped exit composition, unmodified."). Not repaired: all twelve shots still carry `subjectOccupancyIntent: "Unchanged from shipped: …"` and `horizonIntent: "Unchanged from shipped."` — bible law 3 ("Each shot declares … subject occupancy and horizon/negative-space intent", `main/CINEMATOGRAPHY.md:114`) is still satisfied only in schema. Folded into CIN-14(d). |

## Conditioned v5 capture items — verified

- **`cap.ch7.exit-window` anchored on `t_M7Anchor`, both times recorded: SATISFIED.**
  All three movie runs and the manual run record `tM6`, `tCalibrationReceipt`,
  `tM7Anchor`, `anchorFormulaExact: true` and `anchorShiftSeconds`. I checked the
  arithmetic on run 1: `tM6` 12.748 + revealSeconds(M6) 2.788 = 15.536 = `tM7Anchor`;
  shift 15.536 − 12.396 = 3.140 = `anchorShiftSeconds`. On the paced manual run
  `anchorEqualsReceipt: true`, exactly as the criterion predicts for a drained
  queue. Exit cadence holds to ≤ 0.035 s on every row of every run.
- **Route A / Route B clamp evidence: SATISFIED, with one item withdrawn (below).**
  Route A: `l2Cause: "timer"` and `dueTimeFormulaExact: true` on 3/3, margin
  1.850–1.856 s against a 0.3 s floor, variance 0.006 s. Route B:
  `l2Cause: "reveal-guard"`, `dueTimeFormulaDeltaSeconds: 0` on 3/3.
- **Seated pre-ignition L2 frames: SATISFIED and they are the best frames in the run.**
  `routeA-ordered/run1/022_L2-0.5_t7p66s` images pond, deer, palms, grass, reeds and
  the red-fruited hero tree through the canopy while L1 names the pond, with the
  objective still reading `KESTREL FLIGHT CONTROLS · IGNITE`. `L2+0.2` and `L2+0.7`
  are present in all three runs. Protected strength 4 of the original audit survives
  the patch intact.

### Ruling on the two recorded impossible-frame gaps

I asked for both frames; the verifier reports both as unobtainable. They are not
the same kind of gap and must not be closed the same way.

- **Gap A — `t_L2 −0.1 s with L1 fully revealed`: ACCEPTABLE reading of my capture
  text. No new capture; editorial amendment only.** The reveal guard *defines*
  `l2DueAt = t_L1 + revealSeconds(L1)`, so L1 reaches 94/94 exactly at `t_L2` and at
  −0.1 s it necessarily owes ~3 characters. I verified the delivered nearest frame:
  `routeB-desktop-run3/013_L2-0.1_t3p24s` sits at `t_L2 −0.005 s` with `domCaption`
  94 chars and `revealComplete: true`. That frame proves the clause's *purpose* —
  the clamp advanced the line without cutting the thought — better than a −0.1 s
  frame could. Amend the capture text from a fixed −0.1 s offset to "the last
  sampled frame before the swap, with L1 at full reveal".
- **Gap B — `t_L2 +0.2 s with L2 replacing it`: NOT an acceptable reading as
  classified. Requires a text amendment *and* a finding.** The closing record calls
  both gaps "capture-spec impossibilities created by the laws the spec itself
  freezes, not misses". That is true of Gap A and false of Gap B. Pre-patch, L2 held
  the slot 1.32–1.71 s and a +0.2 s frame was trivially obtainable; it became
  unobtainable because of the change under review, which compressed L2's slot
  ownership to 0.06–0.19 s. The correct disposition is to withdraw the capture item
  as unobtainable **and record why** — as a measured consequence of the patch, not
  as an artefact of the spec. That record is CIN-12.

## New defects

| ID | Severity | Shot/anchor | Observation | Evidence | Owner | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| `CIN-12` | medium | `cin.launch.02-world-below` / `anchor.ch8.self-order`, `anc.launch.atmosphere-exit` (movie routes, all tiers) | **On the movie path L2 never renders a single glyph, and the caption slot goes blank at the exact frame the world changes.** The closing record states L2's screen life as 0.06–0.19 s; measured in pixels it is zero. I scanned every `verification-final` sidecar: across Route B, Route C desktop, mobile, reduced-motion and POTATO — 664 frames — **0 frames render any character of L2**, and `maxDomL2chars` is 0 on every route. On the frames where L2 owns the store slot the DOM caption is `""`. The rendered sequence at the atmosphere exit is therefore: L1 completes (89–94 of 94 chars, the patch's genuine win) → **empty caption slot for 0.06–0.19 s across the phase flip** → L4 begins typing. `routeC-desktop-run1/010_deepSpace+0.0_t6p68s` is the frame: starfield and violet nebula resolve through the canopy — the single largest world change in the run — with the caption band empty but for the first glyph of the *next* line. On POTATO L2 is dropped outright (3/3 runs), which is visually *cleaner* than desktop, because a dropped line leaves no dead slot; the lowest tier delivers the better caption cut. Contract-conformant (criterion [22] drop rule, [23] retires the mid-reveal exception) and correctly recorded as `measuredBehaviourChange`. But `anchor.ch8.self-order` declares "the only visual obligation is that the reveal-guard clamp is imaged … so reviewers can see that an early edge advanced the line without cutting the thought" — and the product of that clamp, L2 on the slot, is now unimageable on every movie route. The clamp is proven in a trace and in one −0.005 s frame; it is never proven in a movie frame. | `evidence/verification-final/routeB-desktop.json`, `routeC-{desktop,mobile,reduced-motion,potato}.json` (`storeL2` 0–2 frames, `domL2-rendered` 0 on all); `routeB-desktop-run{1,2,3}/014_L2-0.02` and `015_L2+0.2` (`""`, then `"i cam"` = L4, never L2); `routeC-desktop-run1/010_deepSpace+0.0_t6p68s_ch8-launch_deep_space.png`; `closingVerification.routeCandD.measuredBehaviourChange`; pre-change reference `evidence/verification-v3/routeC-desktop.json` | `cinematography` + `chapter` (joint: this is the visual consequence of a voice law) | No new runtime work is authorized by this run. Required: (a) withdraw the `t_L2 +0.2 s` capture item with this as its stated reason; (b) attach `routeC-desktop-run1/010_deepSpace+0.0` to the autopilot-pacing packet's problem statement as the movie-cut case — it is the strongest single frame in favour of that packet, because it shows the run's best world reveal arriving under an empty caption band; (c) record in `dissent-register.md` that on the movie path the ch8 ladder is L1 → blank → L4, two voice beats of four. |
| `CIN-13` | medium | all variant routes (`quality-potato`, `variant-mobile` portrait + landscape, `variant-reduced-motion`, ch8 deep-link movie) | **Camera/shot/effect state was not captured on any variant in the closing pass, and the failure is undisclosed.** The sidecar `av` field — the only place `cameraAuthority`, `appliedFovDeg`, `shotId`, `declaredCut` and `activeEffectIds` are recorded — contains `{"error":"TypeError: Cannot read properties of undefined (reading 'declaredCut')"}` on 633 of 1125 av-bearing frames: 69/76 mobile landscape, 71/76 mobile portrait, 147/156 routeC desktop, 149/156 routeC POTATO, 100/104 routeC mobile, 97/102 routeC reduced-motion. The failure is exactly inverted from noise: **every frame that succeeds has `anchorId: null`**, i.e. the bridge throws precisely on the anchored frames where camera state matters. `ch7queue-desktop`, `ch7manual` and `routeB-desktop` are clean (0 errors, and their anchor frames do carry FOV 52 / `cinematic-look` / `fx.reconstruct.09`). I then checked the superseded sets: `evidence/verification/ch7-captures-mobile-portrait.json`, `ch7-captures-potato.json` and `ch8-captures-reduced-motion.json` carry **0 frames with a non-null `appliedFovDeg`** either. So variant camera state has never been measured in this run, at any iteration, on any tier — the shot-parity claim rests entirely on desktop LOW plus the diff scope. `closingVerification` reports Route C/D `status: "pass"` with no mention of this; the `environment` note discloses a different bridge failure (`getEmergentStoryVoiceDiag`) that was fixed, which makes the silence on this one easy to miss. Consequence for my lane: CIN-07's POTATO vegetation loss was found by pixel, not by state, and there is no state evidence anywhere that would have caught a second such divergence on mobile or reduced-motion. | `evidence/verification-final/{ch7mobile-mobile-portrait,ch7mobile-mobile-landscape,routeC-desktop,routeC-mobile,routeC-potato,routeC-reduced-motion}.json` `av.error` counts (recomputed independently); `ch7mobile-mobile-portrait.json` frames `000/001/002` and `060_anchor+5.2` are the only successes, all with `anchorId: null`; contrast `ch7queue-desktop.json` (230 av frames, 0 errors) | `story-verifier` (probe null-guard) + `cinematography` (disclosure) | Null-guard the `av` bridge where it reads `declaredCut` off an undefined shot record, then re-run the three cheapest variant strips (`routeC-potato`, `routeC-mobile`, `ch7mobile-portrait`) recording av. If that is out of budget, add an explicit line to `closingVerification` stating that variant AV state was not captured and that shot parity across tiers is unverified by measurement in this run. Do not leave the variant "pass" statuses reading as though camera state were checked. |
| `CIN-14` | low | run record / contract text | **Residual doc drift after draft-v5**, six items, none needing capture: (a) `cap.ch7.exit-window` still requires proof of "the audit-pill persistence over the boarding **black**", the image `dissent-04` corrected at draft-v5; (b) `dissent-03`'s draft-v5 correction enshrines my wrong number — "about **+4.85 s**, roughly **0.15 s BEFORE** the +5.0 s advance, because the movie autopilot starts boarding inside the exit hold" — which `mod02Remeasure` disproves at Δ 0.0000 s on 3/3 and which the unbiased objective trace disproves causally; a third restatement is owed ("the parenthetical begins at the advance; the exit string holds ~2.0 s in-beat and 0.0 s into ch7-board"); (c) the draft-v5 packet amendment's `ux-06` caveat carries pre-patch numbers ("L1 is cut at about 42 of 94 characters and L2 at about 54 of 65") which the closing evidence supersedes in both directions — L1 now renders 89–94/94, L2 now renders 0/65 — and the owner will read that caveat before deciding; (d) all twelve shots still declare `subjectOccupancyIntent`/`horizonIntent` as "Unchanged from shipped.", so bible law 3 (`main/CINEMATOGRAPHY.md:114`) is met in schema only; (e) `verification-report.json.iterationNote` still reads "Every field outside repairIteration is the iteration-1 (draft-v2) record", contradicted by the presence of `closingVerification` and `currentRollUp`; (f) `cap.variants` requires "`data-caption-placement` recorded per frame" and no `verification-final` sidecar records that attribute — what was delivered instead (`captionRect` + full `touchRects` in CSS px) is strictly stronger and the capture text should be amended to describe it. | `scene-contract.json` `cap.ch7.exit-window`, `cap.variants`, `shots[*].focalHierarchy`; `dissent-register.md` `dissent-03` and the draft-v5 packet amendment; `verification-report.json.iterationNote`; sidecar key scan | `cinematography` (a,b,d,f) / `chapter` (b,c) / `story-verifier` (e) | Text-only repair at the next revision. No recapture owed. |
| `CIN-15` | low | closing record precision | The closing statement "At the M7 anchor +2.4 s frame the owner-approved M7 caption renders with its final word occluded by the CONSUME control" names the wrong exemplar frame. At `anchor+2.4` the caption is mid-reveal at 50 of 62 characters ("…something has started paying") — the final word is not yet typed; the frame where "attention." actually renders under the CONSUME label is `anchor+2.8` (`051_anchor+2.8_t21p58s`, same 2914 px² overlap, `revealComplete: true`). Separately, the M7 caption is not the owner-approved string; the owner-approved string is the exit line at `anchor+4.8`, which is also occluded and is the stronger example. The fail verdict, the 59/76 count and the 3224 px² worst overlap are all correct and I reproduced them — only the exemplar is misnamed, and in the direction of overstating rather than softening. | `evidence/verification-final/ch7mobile-mobile-portrait-run1/049_anchor+2.4` vs `051_anchor+2.8` vs `058_anchor+4.8`; `ch7mobile-mobile-portrait.json` anchor rows | `story-verifier` (record) | One-sentence correction in `mobileRecapture.portrait.measuredStatement`. |

## Assessment: L2's movie screen-life and the POTATO drop

Asked directly, honestly, as a cinematography reading rather than a contract test.

**What the movie audience sees.** On every movie route the ch8 launch ladder is
authored as four voice beats and delivers two. L1 completes (the patch's real and
visible win — pre-patch it was cut at ~42 of 94 characters, post-patch it renders
89–94). L3 never fires. L2 fires, owns the caption slot for 0.06–0.19 s, and in
that window renders nothing: the typewriter has not emitted its first glyph before
the slot is taken. What lands on screen is not a short line — it is a **hole**.
The slot empties, the phase flips to `deep_space`, the starfield and violet nebula
resolve through the canopy, and only then does L4 begin to type. The run's single
best world reveal arrives under a blank caption band.

**Why this reads as a defect and not as restraint.** Silence in this run is a
composed instrument — `dissent-05`'s empty regulation band under L6 is exactly
that, and I re-confirmed it by pixel at `seam_t16p50s`. But that emptiness is
*held*: the band is empty for seconds, under a line that is present, and the
absence is legible as absence. L2's blank is 0.06–0.19 s wide, sits between two
lines that are both mid-motion, and coincides with the largest render change in
the beat. At that duration and in that company it does not read as silence; it
reads as a dropped frame in the voice. A caption band that empties and refills
inside a fifth of a second, at the same instant the whole canopy changes, competes
with the reveal for the eye and loses — which is the worst of both outcomes.

**The POTATO inversion.** On `quality-potato` L2 is dropped outright on 3/3 cold
runs, so the slot never empties: L1 holds, then L4. The lowest quality tier
therefore delivers the *cleaner* caption cut than desktop LOW. This does not
violate bible law 1 — the focal subject is unchanged — but it is a fidelity-causality
inversion worth naming: the drop rule, applied honestly, produces a better cut
than the reveal-guard clamp does, and the tier that is supposed to be the degraded
one is the tier without the artefact.

**Effect on the routed packet.** This strengthens the autopilot-pacing packet's
case materially, and along a new axis. Until now the packet's problem statement
was about *what the frame contains* — nose-up attitude, no site, no horizon, L1 and
L3 over a worldless canopy (CIN-04). CIN-12 adds *what the frame's text does*: the
autopilot's pacing is fast enough that the caption system's own laws cannot deliver
a line inside it. That is a stronger argument than "the composition is poor",
because it is not a taste claim — it is arithmetic. `t_deepSpace − t_L2` is
0.06–0.19 s on 8 of 8 non-POTATO movie runs, against a per-character reveal cost
that needs ~2.2 s for L2's ~65 characters. No caption authoring can fix that; only
the pacing can. I would put `routeC-desktop-run1/010_deepSpace+0.0_t6p68s` at the
front of the packet.

**What I am not claiming.** I am not calling this a contract failure — criterion
[22]'s drop rule and criterion [23]'s retirement of the mid-reveal exception both
cover it, and the verifier's `contractPosition: "conformant"` is correct. I am not
claiming the strips would have missed a partial render: the sampling is 100–160 ms
against a 60–190 ms slot, so a 1–2 character frame *could* be missed, and the
honest statement is "at most a couple of glyphs, and every captured frame shows
zero". The mechanism, not the sampling, is what makes this decisive.

## Continuity matrix — delta (closing evidence only)

| Dimension | ch6-dive → ch7 | ch7 → ch7-board | ch7-board → ch8-launch | ch8-launch → ch8-crossing | ch8-landfall → ch9 | Status vs pass 1 |
| --- | --- | --- | --- | --- | --- | --- |
| Lens / authority | 75° continuous | 75° → 52° `cinematic-look` held across all 8 in-beat anchor samples → 75° | player → `lens-rig` | `lens-rig` unchanged across the advance | shipped, untouched | **unchanged on desktop; now unverified on every variant (CIN-13)** |
| Palette / stage | `alive` daylight | `alive`, unchanged | daylight → cockpit → sky → space, gradual | space | daylight sibling world, own palette, clean | improved: ch9 side now imaged |
| Light / atmosphere | daylight | no override | gradual, no pop | unchanged | new atmosphere, no leak | unchanged |
| Screen direction | forward | forward | forward, nose-up on movie routes | forward | forward | unchanged |
| Focal subject | wreck | reveal subject still illegible (CIN-03) | site absent on movie routes (CIN-04) | starfield + band, legible | habitat marker + tree, legible | unchanged |
| Agency | player | player, 5.0 s hold, no forced look | player | player, 17.0 s hold | player | unchanged; dive probe adds 0.0 ms clock drift over a 10.6–10.9 s real dip |
| Score relation | shipped | shipped | shipped ramp | seam unchanged | shipped | no cinematography-caused change |
| Effect / band reset | — | audit TTL crosses by design | caption single-slot, overwrite **at** the advance (Δ 0.000 s) | `anc.launch.atmosphere-exit` + `fx.launch.03` at +16.497 s → `anchorId: null`, `effects: []` at +17.002 s | no ch8 band in ch9 | **improved**: reset now proven in frame on both sides of two seams |
| Caption continuity (new row) | entry line types cleanly | full reveal before advance | — | **movie routes: L1 → blank slot → L4 (CIN-12)**; POTATO: L1 → L4 | ch9 entry line only | **new defect** |

## Protected strengths — re-confirmed on the closing captures

All eight from pass 1 survive the patch. Three are now proven more strongly than before:

1. **The empty regulation band under L6** — now proven by pixel, not inference, at
   `seams/ch8-hold-to-crossing/seam_t16p50s_ch8-launch.png`, with the correct
   framing that the aria-live DOM node still carrying `CONTACT LOGGED.` is *not*
   the authority and the frame is. Nothing may fill this band.
2. **The seated pre-ignition attitude on the ordered route** — `routeA-ordered/run1/022_L2-0.5`
   still shows pond, deer, palms, grass, reeds and the hero tree while L1 names the
   pond. Any packet that changes climb attitude must not disturb this frame.
3. **Agency in both holds, now measured harder** — the dive probe holds the exit
   clock frozen with 0.0 ms drift across a 10.6–10.9 s physical boundary dip, 148–149
   samples, zero rows emitted, zero re-fire, no catch-up burst, minimum inter-row gap
   1.93–1.99 s against a 2.0 s cadence. This is the strongest pause/agency evidence
   in the run and must not be traded away for pacing.

Two new mechanisms to protect:

4. **The honest fail on mobile portrait.** `mobileRecapture.portrait.status: "fail"`
   with "is not softened" is the correct handling of a defect the run cannot fix
   inside its boundary. Do not let a later pass convert it to a pass by narrowing the
   measurement.
5. **The withdrawn attribution in the blank scan.** "UNATTRIBUTED, HEADLESS-ONLY
   EVIDENCE … withdrawn and not replaced" is the right shape for a claim with no
   headed evidence behind it. Do not let it be re-attributed without a headed capture.

## Evidence gaps still open

1. `cin.reconstruct.09` on a non-movie route from a player-chosen vantage — the
   unfulfilled half of `cap.ch7.reveal-composition` (unchanged from pass 1).
2. One POTATO seated pre-ignition frame on the ordered-ignition route (CIN-07);
   `routeA-ordered` is LOW only, so no POTATO frame in this run contains the site.
3. Variant camera/shot/effect state on POTATO, mobile portrait, mobile landscape,
   reduced-motion and the ch8 deep-link movie route — never captured at any
   iteration (CIN-13).
4. ch8 mobile **landscape** (844×390): `routeC-mobile` is portrait only, so
   `cap.variants`' "ch8 stack rows 1 and 4" is covered on portrait (I recomputed:
   74 caption frames, 0 collisions, clean) but not on landscape.
5. Reduced-motion **ch7** not re-captured post-patch; the loop-3 patch changed ch7
   caption queueing (M5 drop, M7 anchor), so `cap.variants`' "one full reduced-motion
   ch7 plus ch8 pass" rests on pre-patch, post-shutter-biased captures for its ch7 half.
6. The standalone `?story=ch7-board` deep link proving no ch7 line replays — required
   by `cap.ch7.exit-window`, proven only in a superseded iteration against pre-patch code.
7. The ch6-dive side of the ch6→ch7 seam; the delivered strip starts at ch7 +0.013 s.
8. One headed / real-GPU cold deep link to test the 34 world-black frames (CIN-06).
9. **Headed taste screening remains correctly open.** No headed capture exists
   anywhere in the run. Nothing in this delta substitutes for it, and the CIN-03
   composition ruling remains reserved to the Cinematography Director.

## Single highest-leverage repair

**Attach `evidence/verification-final/routeC-desktop-run1/010_deepSpace+0.0_t6p68s_ch8-launch_deep_space.png`
to the autopilot-pacing packet's problem statement, with the arithmetic beside it
(`t_deepSpace − t_L2` = 0.06–0.19 s on 8 of 8 non-POTATO movie runs, against ~2.2 s
of reveal cost for L2's ~65 characters), and withdraw the `t_L2 +0.2 s` capture
item citing that measurement rather than "spec impossibility" (CIN-12).**

It is text-only and needs no capture; it converts the run's most subtle measured
change into the packet's strongest and least arguable argument; it corrects the one
place where the closing record explains away a real consequence as an artefact; and
it puts in front of the owner the single frame that shows what the movie cut
actually looks like — the best world reveal in the run, arriving under an empty
caption band.

## Delta verdict

**conditional.**

Resolved: CIN-05, CIN-06, CIN-09, CIN-10 fully; CIN-11 withdrawn as my own
measurement artefact, with the truth (Δ 0.0000 s) better than either prior
statement. Confirmed and honestly recorded rather than softened: CIN-01 — the run
now says "fail" where it previously said "pass", which is the outcome I asked for;
the render fix correctly rides to the owner. Record-repaired with captures still
owed: CIN-02, CIN-04, CIN-07, CIN-08. Open by design and correctly reserved: CIN-03.

Raised in this pass: CIN-12 (medium — L2 renders zero glyphs on every movie route
and the caption slot empties across the atmosphere-exit flip), CIN-13 (medium —
variant camera state uncaptured and the instrumentation failure undisclosed),
CIN-14 (low — six residual doc-drift items including a corrected clause that
enshrined my own wrong number), CIN-15 (low — misnamed exemplar frame).

The run's central visual claim still holds and is now re-proven in frame state on
desktop LOW: zero camera/shot/render/PostFX mutation, 52° `cinematic-look` and
`fx.reconstruct.09` constant across the whole exit window, no undeclared cut,
agency intact through a measured 10.9 s frozen-clock dip, effect and band reset
proven in frame on both sides of two seams, no frame-rate cost (60.04–60.10 medians
against 60.08–60.12 baselines). What is conditional is scope, not truth: the claim
is verified on one tier and one viewport, and the movie cut — the route most
audiences will see — now carries a measured hole in its voice at its best frame.

**Conditions to clear.** (1) Record CIN-12 and re-file the Gap B capture item
against it. (2) Either fix the av null-guard and re-run three variant strips, or
state plainly in `closingVerification` that variant camera state was not captured
(CIN-13). (3) Land the CIN-14 text repairs, especially (b) and (c), before the
owner packet goes out — the owner must not read pre-patch numbers or a twice-wrong
timing clause. CIN-01, CIN-03 and the headed screening remain the owner's and the
Cinematography Director's, not mine.

*Gate-format restatement of the delta re-audit's re-hash attestation above
(orchestrator clerk note, 2026-08-11): Contract revision: `draft-v5`*
