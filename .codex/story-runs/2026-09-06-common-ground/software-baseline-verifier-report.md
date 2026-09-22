# Software Baseline Verifier Report — fresh mechanical harvest

**Run:** `.codex/story-runs/2026-09-06-common-ground`
**Harvest date:** 2026-09-06
**Scope:** mechanical harvest and inspection of preserved artifacts only.

## Disclosure

This report is a **fresh harvest by a new verifier**, not the original agent's
role report. The originating transport (`software-baseline-transport-interruption.json`,
session `c6e470c6-98e4-43c4-868b-fa554da20a5a`, pid `3939029`) exited before emitting
its CLI role final report (`finalModelResultPresent: false`). Its capture subprocess
**did** complete both source-pinned software bundles at `2026-09-06T04:58:51.428Z`.

No rerender, build, browser, GPU, server, or runtime action was taken. No original
transport artifact was modified or deleted. Only two files were written, both inside
the run: this report and `shipped-visual-baseline.json`.

## VERDICT

**Harvest complete and internally consistent — NOT gate-ready, NOT approved.**
The preserved evidence is a software-only SwiftShader diagnostic. Both original
chapter-evidence verdicts (`exit code 1`, `fail-software`) are retained unchanged.

## Confirmed data

### Build and Paravoxia identity — recorded and immutable

| Item | Value |
|---|---|
| Build sha | `b631a52` |
| Build manifest sha256 | `4c9d71ceb6b142ad5e855e72eafc4e1325db44c77f489d8fc04aafc3a28b208e` |
| Preview URL | `http://127.0.0.1:34147/` |
| Preview snapshot dir | `/tmp/paravoxia-preview-pV3HaE/dist` |
| Paravoxia identity recorded | **yes** |
| Source driver sha256 | `3cb028df7f8a2b5b3542628bd3d489d65f7154b3789064fa63f57799fc4d43c4` |
| Diagnostic driver sha256 | `8786f024e06e86c3b1b3e129c34a0fe522b2aa997d2cfa3c3eb9e7b2da6d7a2a` |

Identity evidence (four independent records): `runner.log` — *"serving Paravoxia at
http://127.0.0.1:34147/ (owned build 4c9d71ce…)"*; both `capture.log` files —
*"[preview] using http://127.0.0.1:34147/ (identity confirmed)"*; and
`document.title == "Paravoxia"` in all four `software-state-*.json` files.
The served build hash equals the `build-manifest.json` aggregate sha256.

### Source identity and drift — none

| Snapshot | capturedAt | revision | aggregate sha256 | files |
|---|---|---|---|---|
| before-build | 04:52:52.521Z | `b631a52065a1a…08641` | `1bfeb00a…77038` | 1060 |
| after-build | 04:52:59.371Z | `b631a52065a1a…08641` | `1bfeb00a…77038` | 1060 |
| after-captures | 04:58:51.402Z | `b631a52065a1a…08641` | `1bfeb00a…77038` | 1060 |

Verified this harvest by `jq -S '.files'` pairwise diff: **byte-identical** for
before→after-build and after-build→after-captures. The git `status` string is
sha256-identical across all three (`3954b602…a7749`). `sourceChangedDuringBuild:
false`, `sourceChangedAfterBuild: false`. **No source drift.**

`sourceRevision` in the baseline JSON is taken from the original lock
(`production-lock.json`): `b631a52065a1a69fecac0331e69515c306408641+working-tree`.

### Renderer — explicit SwiftShader, headless

Declared policy: *"SwiftShader required; no hardware fallback."*
Measured `actualCanvasRenderer` in all four state files and both capture logs:
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`
Tier `swiftshader-low`, `headed: false`, viewport 1280x720, DPR 1, colourManagement `none`.
Both capture logs carry the runtime's own caveat: *"evidence is swiftshader-low,
not the delivered look."* `headedStatus: pending` — hardware is reserved by an
unrelated Paraform job. **This creates no new capture obligation.**

### Frame probe — 4 frames of record, 0 blank, all hashes re-verified

| Chapter/beat | file | t (s) | role | sha256 (recomputed = manifest) | bytes | probe | meanLuma | blank |
|---|---|---|---|---|---|---|---|---|
| ch4 / ch4-audit | `frames/f0000_t2.01s_opening-2.0s.png` | 2.008 | keyframe | `e3969f53…52ef2` | 953246 | png_pipe png 1280x720 rgb24 | 0.5091 | false |
| ch4 / ch4-audit | `frames/f0001_t66.97s_strip.png` | 66.971 | temporal | `f503338d…160bae` | 1193837 | png_pipe png 1280x720 rgb24 | 0.1978 | false |
| ch9 / ch9-hearth | `frames/f0000_t2.00s_opening-2.0s.png` | 2.003 | keyframe | `05a08521…b56b02` | 744673 | png_pipe png 1280x720 rgb24 | 0.6110 | false |
| ch9 / ch9-hearth | `frames/f0001_t46.09s_strip.png` | 46.088 | temporal | `4f3e648b…b48d28c` | 718119 | png_pipe png 1280x720 rgb24 | 0.5876 | false |

All 10 PNGs in the two bundles (4 frames of record, 4 HUD composites, 2 contact
sheets) were re-hashed with `sha256sum` and re-probed with `ffprobe` this harvest:
**10/10 match the recorded manifests, 0 mismatches.**

Confirmed absent, as stated: `continuousVideo: null`, `additionalVideo: []`,
`audio: []`, `bursts: []`, `audioFormat: null`, 0 videos, 0 bursts, 0 page errors.

### Camera authority and FOV

Recorded only at entry/exit samples, under `boundary.runtime.camera`:

| Beat | stage | fov | perspective | lookMode | feedBlend | sideBlend | externalCameraMix | signedAuthority |
|---|---|---|---|---|---|---|---|---|
| ch4-audit | entry | 75 | true | free | 1 | 1 | 0 | `player-camera` |
| ch4-audit | exit | 75 | true | free | 1 | 1 | 0 | `player-camera` |
| ch9-hearth | entry | 75 | true | free | 1 | 1 | 0 | **null (pending)** |
| ch9-hearth | exit | 75 | true | free | 1 | 1 | 0 | **null (pending)** |

### Palette — source ref only, not measured

No palette, grade, or colour value exists anywhere in these bundles, and
`colourManagement` is `none`. Recorded as **source-ref only**, using the sha256
from the run's own source snapshot (byte-identical before-build and after-captures):
`main/src/utils/planetArtDirection.ts` = `7c137680…3c3e50`;
`main/src/utils/planetVisualProfile.ts` = `129e004e…931ab0`.
No image-derived colour value was invented.

### Other measured runtime state

| Beat | reality.stage | control | objective (entry → exit) | marker label (entry → exit) | health |
|---|---|---|---|---|---|
| ch4-audit | `material` | fps / surface | `ch4:audit:attend-fire` → same | `CAMPFIRE · ATTEND` → same | ready |
| ch9-hearth | `alive` | fps / surface | `settle:scan-waterline` → `settle:attend-waterline` | `LIVING WATERLINE · SCAN` → `LIVING WATERLINE · ATTEND` | ready |

ch4 signed-AV anchor at t=2.01s: `anc.audit.arrival-handback` /
`arrival_handback_authenticated`. ch9-hearth has **no** signed-AV anchors recorded.

### Milestones — not reached, verdicts retained

| Beat | exit milestone | reached | evidence exit code | disposition | page errors |
|---|---|---|---|---|---|
| ch4-audit | `story:ch4:audit-complete` | **no** | 1 | `fail-software` | 0 |
| ch9-hearth | `story:ch9:hearth` | **no** | 1 | `fail-software` | 0 |

Both original `fail-software` verdicts are preserved verbatim. No navigation,
pace, or acceptance claim is made or implied.

## Frame inspection (objective observation only, no taste judgment)

All four frames of record render scene content; none is blank, black, or a
solid fill. HUD is suppressed in all four, as the manifest declares.

- `ch4/…/f0000_t2.01s_opening-2.0s.png` — bright pale-teal overhead sky, palm
  canopies, terraced voxel shoreline, water body. Silhouette, occlusion and
  projection all resolve; no geometry tearing or missing-surface artifact visible.
- `ch4/…/f0001_t66.97s_strip.png` — same vantage and framing, dark sky with a
  moon disc and magenta nebula banding. This is an observation of the two
  recorded instants only; **no day/night cycle causality is claimed**, since
  nothing between t=2.01s and t=66.97s was captured (0 bursts).
- `ch9/…/f0000_t2.00s_opening-2.0s.png` — an antlered fauna body occupies roughly
  the left half of frame at very close range; blue-leaved branch top-right;
  settlement structures and waterline in the background band.
- `ch9/…/f0001_t46.09s_strip.png` — same vantage; the fauna body is nearer still
  and occludes slightly more of the left frame.

**Flagged, objective:** in both ch9 frames of record the near-camera fauna body
occludes roughly half the frame, and no hearth subject is resolvable in either
frame. Recorded as a measurement of what the two preserved instants contain;
whether that constitutes a defect is not this report's call, and the ch9 exit
milestone was independently not reached.

No blank frame, no letterbox or scanline artifact, and no wrong-era content was
observed. Frame-to-frame smoothness and flicker remain **unmeasured** — the
digests state so explicitly (0 bursts); do not assume smooth.

## Limitations and pending fields

Recorded as `pending` with real uncertainty, not faked:

- `headedStatus: pending` — hardware reserved by an unrelated Paraform job.
- `gateReady: false` — a software diagnostic is **not** final approval.
- ch9 `signedAuthority` — explicitly `null` in the raw file; no signed camera
  authority was recorded for `ch9-hearth`.
- Per-frame FOV/rig/letterbox/grade/DPR — never sampled at frame instants; only
  entry/exit samples exist. No rig or letterbox state exists in these bundles.
- Palette family and measured colour — pending; source refs only.
- `realityStage` — not expressible as the template's single value; the two beats
  reported different stages (`material` vs `alive`), recorded per beat.
- `adjacentEntryRefs` / `adjacentExitRefs` — empty; no previous/next beat
  captures, and no mobile, reduced-motion, lowest-tier, or desktop-parity
  variants exist in this run.
- `sceneId: common-ground` is **provisional** at this stage; root later maps
  copies and anchors to the scene production contract.
- Not proven and not claimed: audio of any kind, "unheard" audio, night
  behaviour as a cycle, two-route behaviour, hardware colour/light, authored
  timing/feel, performance, continuous play, navigation, pace, acceptance.

## Artifacts

- Report: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/software-baseline-verifier-report.md`
- Baseline: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/shipped-visual-baseline.json`
- Preserved evidence root: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/evidence/software-baseline/`
- Preserved transport record: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/software-baseline-transport-interruption.json`

The original run's hardware capture plan is unchanged.
