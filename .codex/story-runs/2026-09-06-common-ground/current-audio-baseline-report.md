# Current audio baseline — 2026-09-06 common-ground

**OFFLINE RENDER, NOT a listening / live combined-AV / performance acceptance.**
Nothing here was heard. No taste judgement, no new composition. Three short
excerpts of the CURRENT authored moods, rendered through the shipped offline
mirror so the Score lane has a dated grounding artifact instead of the
2026-08-12 ch10-run renders.

## VERDICT

pass — 3/3 excerpts rendered, decoded, hashed, and verified clean.
0 NaN, 0 clipped samples, 0 silence, 0 smoothness violations, 0 probe failures.

## Provenance

- git HEAD `b631a52065a1a69fecac0331e69515c306408641`, captured 2026-09-06T01:36Z
- render path: `main/src/audio/soak/offlineRender.ts :: renderStoryBeatOffline`
  (shipped offline mirror, real scoreEngine + musicEngine graph)
- `main/` was **not** modified: no source, no `dist`, no `renders`. The probe
  esbuild-bundles current source into `tmp/current-audio-baseline/` and serves
  it from its own ephemeral-port node server with a checked title identity
  (`Paravoxia current-audio-baseline harness`). No vite dev watcher (ENOSPC).
- one headless Chromium (`chromium-1217`), `--disable-gpu --use-gl=swiftshader`.
  No GPU/canvas work; shared GPU untouched.
- source hash manifest (14 audio/story files) in the JSON.

## Excerpts (exact mood / era / seed / mix)

| excerpt | beat | mood source | era | intensity | seed | mix |
|---|---|---|---|---|---|---|
| `ch4-audit_current` | `ch4-audit` | MOODS entry | 1 | 0.42 (authored baseline) | none (`planetSeed` omitted → legacy walk) | score + legacy rim, scene `deepSpace`, glue on, tail `shipped` |
| `ch9-hearth_current` | `ch9-hearth` | MOODS entry | 1 | 0.28 (authored baseline) | none | same |
| `ch10-station-resolved_current` | `ch10-transit` | `getChapter10ScoreMood('station-resolved', carrierAlive=true)` via runtime override | 1 | **0.24 — not the authored 0.44** | none | same |

Resolved mood tables are recorded verbatim in
`evidence/current-audio-baseline/moods-resolved.json`. Render wall time ~1.05 s each.

## Measured metrics (each WAV independently ffprobe-decoded and re-hashed)

All three: `pcm_s16le`, 2 ch, 44100 Hz, 16-bit, 10.000000 s, 1,764,044 bytes on
disk — byte count matches the in-page encode exactly.

| excerpt | sha256 (12) | peak | rms | rms dBFS | integrated LUFS | true peak dBTP | L/R corr | max inter-sample step | NaN | clip | ≥FS | longest silence | smoothness viol. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ch4-audit | `b9f4af0f9024` | 0.25598 | 0.078688 | −22.08 | −22.58 | −11.83 | 0.981 | 0.01433 | 0 | 0 | 0 | 0 s | 0 |
| ch9-hearth | `32f80b133c0f` | 0.27199 | 0.073205 | −22.71 | −22.40 | −11.31 | 0.917 | 0.01970 | 0 | 0 | 0 | 0 s | 0 |
| ch10-station-resolved | `438abbace216` | 0.28020 | 0.074715 | −22.53 | −22.50 | −11.05 | 0.949 | 0.01952 | 0 | 0 | 0 | 0 s | 0 |

Per-second RMS dBFS (onset second first):
- ch4-audit: −29.8 −23.8 −21.2 −22.2 −18.7 −24.3 −29.0 −25.0 −20.9 −18.8
- ch9-hearth: −30.2 −24.3 −22.0 −22.4 −19.9 −23.3 −24.2 −23.2 −21.9 −21.5
- ch10-station-resolved: −30.1 −24.3 −22.0 −22.7 −19.7 −24.0 −25.2 −24.1 −21.5 −19.7


## Scope limits (must not be over-read)

1. Music bus only. No SFX or voice cues were scripted, so these do **not**
   satisfy the 2026-09-04 "combined renders only" mix-evidence law.
2. Excerpt intensity is a flat rail, not a scene timeline; ch10 used 0.24, below
   its authored 0.44 baseline — comparisons against it must account for that.
3. `era` is pinned to 1 for all three; no per-beat era table exists in source.
4. No planet seed / genome was set, so the §10.5 planet-tune filter is absent.
5. No engine defect was found and none was fixed. Zero source edits.

## Artifacts

- `.codex/story-runs/2026-09-06-common-ground/current-audio-baseline-probe.mjs`
- `.codex/story-runs/2026-09-06-common-ground/evidence/current-audio-baseline/`
  — 3 `*.wav`, `current-audio-baseline-report.json` (full metrics + source hash
  manifest + notes), `moods-resolved.json`
- scratch bundle: `tmp/current-audio-baseline/`

Previous artifacts, including `shipped-audio-baseline.json` and the 2026-08-11
ch10 evidence tree, were left untouched.
