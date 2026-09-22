# Station integration CPU handoff — tune2

Updated 2026-09-05T17:58:16.947761+00:00. Engineer: `/root/story_harness_recovery`, reused by root after the station integrator spawn hit the thread limit. This is implementation, not independent review. Story settlement candidate and early-grid planning/source are unchanged during this pass. No build, browser, GPU, long verification, commit, publish, baseline replacement or contract mutation ran.

## Evidence and bounded adjustment

Viewed the retained actual `evidence/recovery-tune1/03-registry.png`, `09-warehouse.png`, and `01-dock.png`. The registry has a dark foreground figure under bright overhead strips; warehouse has a cool bright deck and dark rack undersides; dock's first vantage is slightly over its signed upper luminance bounds. Tune1 still records **9 failures**. These are not declared repaired by CPU tests.

Source explains the warehouse's directional imbalance: `ceilingStrips` default reach is height × 1.25, so a 14 m room gives 17.5 m reach at 10.5 m fitting height. Its cool pool dominates upward-facing floor surfaces while the sodium ambient and hemisphere ground are weak on down-facing racks. Tune2 keeps every fitting and the seven-point-light allocation and changes only existing fill/reach values:

| District | Tune1 → tune2 | Purpose |
| --- | --- | --- |
| apron | ambient 1.05 → 1.0; overhead reach 15 → 14 m | Reduce the first deck pool without flattening the cold industrial room. |
| counter | ambient 2.3 → 3.05; hemisphere intensity .3 → .15 | Lift the figure/ceiling with less orientation-dependent contrast, toward the existing clinical-flat target. |
| shelves | ambient 1.15 → 1.45; hemisphere .5 → .6; ground `0x948168` → `0xa18d74`; overhead reach 17.5 → 11 m | Reduce the bright cool floor while lifting sodium rack undersides. |

The hall and concourse fill entries, fog values, source colors for point lights, global exposure/PostFX, geometry, crowd palette, and light count were not changed by this pass. Fixed light cardinality, instance limits, signed targets, and clinical flatness remain actual acceptance gates. Counter standard deviation in particular requires rendering; if the bounded fill cannot satisfy it, return that evidence to the existing Cinematography Director rather than altering the signed test.

## Probe corrections

`spaceStation-shots.mjs` now defaults to canonical headed ANGLE hardware with actual renderer assertion, serves a private immutable preview by default, and verifies actual HTTP index/assets against local archived dist (an explicit root-owned URL must also match). An explicit `--swiftshader` selects the original signed software numeric lane and asserts an actual SwiftShader renderer; software labels in the old run were truthful. Hardware numeric comparisons are reference-only, with `signedNumericGate.applicable=false` and `passed=null`, so they cannot close the signed software numeric gate. Runtime console errors fail the command. A failed threshold strip preserves the completed numeric sweep in `luma.json` instead of losing it.

New `tools/lib/stationThresholdCapture.mjs` records every actual rAF timestamp, occupied-cell transition, separate fill transition, progress, and computed low-line opacity. It snapshots the rendered canvas on the requested frame via `createImageBitmap`, then encodes PNG asynchronously; no sequential screenshot wait defines the ramp clock. The retained pre-threshold frame has its actual offset. A requested frame more than 100 ms away fails evidence coverage. This is an added capture-integrity rejection, not a widened timing/light criterion. A later composite HUD screenshot is explicitly context only. Canvas frames plus same-frame computed DOM opacity are the threshold evidence. If a lighting update lags physical cell entry, both timestamps are retained and the initial signed timing gate fails; the clock does not move to conceal the lag.

`recovery-ux-probe.mjs` now requires **headed ANGLE hardware**, rejects a software renderer even if a permissive environment variable is present, and records a per-variant served-build proof. It retains partial results on failure, asserts exactly one active objective, checks desktop pointer lock before F, records a walked threshold/low-line timeline including reduced-motion stepping, and retains station-only AudioContext/media/diagnostic counters across reload and departure. It performs actual F/USE at G3 after reload, then requires the normal undock URL, both stowed/departed receipts, and exactly one persisted bonded cell. These are new executable checks, **not yet executed**.

## CPU proof and source identity

- `npx tsc --noEmit`: PASS.
- Five focused station files: 22 tests PASS (dressing, signed light timing, presentation, story receipts, existing root navigation including four seeds and obstacle/portal cases).
- Three timing-evidence regressions PASS: actual timing succeeds, a late frame with the old nominal label fails, and early caption/fill failure/reduced-motion fade fail independently.
- Both modified probe entrypoints pass `node --check`.
- Owned six-file candidate hash: `3d055afa25af799eb393c615f7d95b12a05c57ee8fde9cdb17515df9bafa22bb`. Exact per-file hashes are in `recovery-tune2-source.json`; this is **not** a full app/build hash. Signed contract remains `291e75b0c19294f68d00add730b8fedf9ae232288b5ecb744ff2f39d6a969cc1`.

## Exact next capture handoff (root must grant build/GPU)

From an immutable archived candidate cwd containing its own `dist`, first archive a fresh complete source manifest and build exactly once under the shared heavy lock. Do not reuse candidate1's build as tune2 evidence. Then, sequentially:

```bash
node tools/spaceStation-shots.mjs --swiftshader --out /home/thomasphillip/Projects/recovery/2026-09-05-claude/station-light-tune2-software --label tune2-software
node tools/spaceStation-shots.mjs --out /home/thomasphillip/Projects/recovery/2026-09-05-claude/station-light-tune2-hardware --label tune2-hardware
node ../.codex/production-runs/2026-09-04-station-interior-light/recovery-ux-probe.mjs /home/thomasphillip/Projects/recovery/2026-09-05-claude/station-ux-tune2
```

The first command preserves the signed 1600×900 DPR1 SwiftShader numeric lane and captures the corrected sandbox threshold strip. The second captures the same vantages and actual-time strip on headed hardware; its numeric comparisons cannot satisfy the software-bound gates. The third requires headed hardware and earns station story actions in desktop, portrait, landscape, and reduced-motion variants. All use already built dist and private previews. The exact software-lane authority is `scene-contract.json:evidence.acceptanceCriteria[0]` (line 2805), ordering is `[1]` (2806), threshold is `[3]` (2808); original draft-v1 contract SHA is preserved. Existing `station-runtime-candidate1` natural-walk images are hardware evidence for different vantages, not closure of these nine numeric failures. Archive the run-local tool/dependency paths together if the full tree is copied for immutability. Headed driver/GPU availability must be granted by root; this task did not touch wrapper2465955's lease.

## Original remaining station and ship gates

1. All 9 tune1 numeric failures must close in fresh tune2 evidence, while every passing vantage and ordering gate stays valid. Same-frame canvas capture must be exercised and nonempty; source tests do not establish WebGL canvas capture correctness.
2. Corrected actual-time strip in sandbox and story, zero HUD overlap at desktop/portrait/landscape, reduced-motion delay/step, reload/panel/pointer-lock lifecycle, exact shipped labels/reaches/copy and prompt discovery. The current UX script adds several checks but is not the complete signed `hud-overlap-sweep`/contrast/perceptual review.
3. Station silence remains **zero contexts/media and no SFX diagnostic**, including generic vendor open/close and every district. The UX script covers story panels and four districts; a generic vendor cycle and explicit shelves silence sample still need the original complete sweep. The separate institutional-audio amendment has no authority to rewrite this baseline packet.
4. Fresh same-source program/material/draw/instance parity: 13 programs, 3 diagnostic meshes, 7 point lights, ≤+80 instances per district and ≤baseline+2 draws. Do not run the original `baseline-probe.mjs` in its default output location: it writes the signed retained baseline paths. Use a separate recovery output wrapper or add an explicit recovery output path before collecting this gate.
5. Mobile contrast against its own measured backdrop; outlined 5px crosshair on dark floor/bright registry; crowd/backdrop ≥.08 linear at 06-concourse-look; preserved cold→clinical→warm→coldest→sodium continuity and all four quality tiers. Independent triad/player/continuity review and existing owner taste boundary still apply; this engineer cannot sign them.
6. Existing immutable natural station driver success remains **69.337 s registry→issuer, one bonded cell**. Departure/stow remains unverified until the new actual action check runs; it is not implied by that earlier success. Preserve root's BFS/A*, normal walk intent, shared look, collision and DOM transaction path.
7. Ship: fresh source-bound headed hardware cockpit all-tier budget/60FPS and first-person bearing/clipping evidence, adjacent station entry/exit continuity, independent visual review of the original procedural cockpit. Historical 18 images and original performance claims are context only. `tools/cockpit-probe.mjs` is available and already requires hardware; do not accidentally allow its default build while another heavy job runs.

Root navigation, shared preview/gate helpers, worldgen-owned render paths, audio paths, story candidate and early-grid/mobile source were not edited here. No historical signature, verdict or baseline was regenerated.
