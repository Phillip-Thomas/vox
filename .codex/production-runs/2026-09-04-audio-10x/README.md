# audio 10x — the sound catches up with the grammar

Creative-triad production run, opened 2026-09-04. Chapter mode, deep budget,
profile `paravoxia-creative-chapter.run-profile.json`.

This directory is the durable record. Chat is not an authority; where this
directory and anyone's recollection disagree, this directory wins.

## Read in this order

1. **`production-lock.md`** — the authority this run acts under, the six locked
   stage beats, the allowed and protected paths, the five owner decisions, and
   the stop conditions. Read it before proposing any change.
2. **`shipped-reference-map.md`** — twenty rows of shipped audio behavior with
   the plan's own file and line anchors, plus the unverified assumptions that
   must be closed before the parent contract freezes.
3. **`run-summary.md`** — scope, stage list, state at close, and the resume
   point. Start here on any later visit.
4. **`human-decision.json`** — the five owner decisions of 2026-09-04.
5. **`scene-contract.json`** — the parent chapter contract, not yet authored.

## What this run governs

`PARAVOXIA_AUDIO_10X_PLAN.md` describes seven stages. This run governs six of
them:

| Locked beat | Plan stage | One line |
| --- | --- | --- |
| `audio-stage-1-bed-timbre-mastering` | Stage 1 | Bed timbre and a mastering pass on the music path |
| `audio-stage-2-game-mix-buses` | Stage 2 | Buses, limiter, duck matrix, mix snapshots |
| `audio-stage-3-composed-sync` | Stage 3 | Composed sync and one harmonic truth |
| `audio-stage-4-spatial-sfx` | Stage 4 | Spatial, varied, roomed SFX |
| `audio-stage-5-long-form` | Stage 5 | Phrase planner, whole-bar memory, sidechain source |
| `audio-stage-6-voice-bus` | Stage 6 | The narrator's voice as a fidelity of the terminal |

**Stage 0 is not governed here.** It is additive, it is not contracted, and it
is being implemented separately right now. This run consumes its output: the
combined music-plus-SFX render, the LUFS and true-peak measurement path, and
the spectral fingerprints that replace the retired byte-identical SFX policy.
**Stage 0 baselines will be pulled in from the plan document's section 7
scorecard when its agent finishes**, and copied into `run-summary.md`. No stage
contract may be signed against an unmeasured baseline.

The run is structured as a parent chapter contract with one child scene
contract per stage. Stage order is fixed by the plan's section 4: 1, then 2,
then 3, then 4; 5 benefits from hearing 1 and 2 first; 6 waits on Chapter.

## Canonical preview URL policy

- **Canonical URL: `http://127.0.0.1:5212`.** That is a pre-existing `main/`
  vite dev server, pid 95250, started with `PROBE_NO_HMR=1 BROWSER=none npx
  vite --host 127.0.0.1 --port 5212 --strictPort`.
- A `vite preview` of the built bundle is also already running on
  `http://127.0.0.1:5231`, pid 88210. Use it only for build-output checks.
- **Do not start a duplicate server.** If a probe needs a server, use 5212.
- Because 5212 runs with no file watcher, it serves stale modules after an edit.
  Restart that one server; do not add a second.
- Ports 5173, 5174, 5199 and the whole 3xxxx probe range belong to the sibling
  Paraform project. Never point a Paravoxia probe at them.
- Re-check ownership with `ss -ltnp` before every capture session, and record
  what was actually running in the ledger entry for that iteration.

## Headed taste gate

Headless proof cannot approve timbre, loudness, width or feel. The taste gate
for this run is an **owner audition of A and B excerpts, per stage**, over the
six owner excerpts defined in `main/src/audio/soak/excerpts.ts`. A stage is not
done when its numbers are green; it is done when the owner has heard the pair
and chosen. Every stage's excerpts are rendered from the **combined** music and
SFX bus, never score-only.

## Evidence law for this run

- Combined renders only. A score-only render cannot prove or disprove a mix
  complaint.
- True peak at or below −1 dBTP on every combined render.
- Integrated loudness within 1 LU of −18 LUFS at Stage 1, within 1.5 LU at
  Stage 2.
- Zero smoothness violations; the thresholds may only tighten.
- `score:fps` median at or above 60 on the desktop SwiftShader gate; the `lean`
  quality tier proven there with the CPU throttled four times.
- Every measurement hashed into `evidence-registry.json` and probe-matched.

## Model tiering

Chapter, Score and Cinematography Directors and the cohesion judge run on
fable. The verifier, the three continuity auditors, the blind viewer, the
player-experience auditor, and every render, soak, grep and probe run on opus.
No mechanical agent inherits fable.
