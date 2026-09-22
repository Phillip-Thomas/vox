# C6 amendment — Cinematography Director ruling on score-audit-stage-2 D3 / D4

Run `2026-09-04-audio-10x`. Ruling against `scene-contract.json` draft-v3
(sha256 `776d676b90cc9c1007694b26f0000cfc61ecf85c256c81a72a0cdd324ea26ba1`),
`cinematography-contract-signoff.json` condition C6, `evidence/stage-2/README.md`
deviation 5, and `main/src/audio/mix/mixTuning.ts:67-70`. This file is the
contract-ready text for draft-v4; it does not edit the contract or my signoff.
I re-sign when the orchestrator folds it in.

## Ruling

1. **D3 — upheld.** C6's literal trigger fires (25.215 ms > 16.7 ms) on a
   rationale Stage 2 made false: SFX now pass the post-join limiter, so the
   quantity that separates an SFX member from the image and from the music
   onset is `LATENCY_COMP_MUSIC_VS_SFX_S` 14.875 ms (0.89 frame), not the
   music-path figure. The compared quantity is corrected below. Image members
   target device + music-path latency. No global SFX delay.
2. **SFX forward-scheduling becomes binding, not optional.** 0.89 frame is
   under the frame but consumes it; with display-refresh phase jitter the image
   lands at +1 or +2 against the SFX onset while landing at 0 against the
   music onset — one bundle, two felt onsets. Scheduling the SFX member forward
   by `LATENCY_COMP_MUSIC_VS_SFX_S` puts every audible member of a bundle on the
   same instant the image is scheduled to. It also settles the a4 alive bundle,
   whose only audio member is the SFX: without forward scheduling that image
   would be 0.89 frame late against its only sound.
3. **Census correction.** The audit and deviation 5 say "three SFX-bearing
   bundles"; the contract carries **five** (`playSfx storyAwaken` at the a1
   unbolt, the a2 FOV liberation, and the a4 alive bundle; `shipCrash` at the
   crash; `storyGlitch` at the glitch). The rule is written per bundle member,
   not per SFX id, so no site is missed.
4. **D4 — partially dissented** (see `dissent-register.md` D-2). Deriving
   seconds from a sample count assumes the whole tail latency is sample-fixed.
   The three `DynamicsCompressorNode` pre-delays are, in Chromium and Gecko,
   specified in seconds (6 ms each) and converted to frames at the context
   rate; only the oversampled shaper resamplers are sample-fixed. At 48 kHz a
   samples-derived figure (23.17 ms) is therefore not more correct than the
   44.1 kHz seconds figure (25.215 ms); my estimate of the true 48 kHz value is
   ~24.6 ms, and neither constant is within the 0.5 ms tolerance of it. The
   binding form below is: measure at each supported context rate, pin each,
   select by `ctx.sampleRate` at arming. The measurement decides, not a model.

## Amended C6 — contract-ready wording

> **C6 (tail latency in bundleAt).** Stage 2 publishes three measured
> constants in `mixTuning.ts`, each measured on the finished tail by
> `measureTailLatencyS` and re-measured by `audio:check` every run within
> `LATENCY_COMP_TOLERANCE_S` 0.5 ms: `LATENCY_COMP_MUSIC_PATH_S` (music onset
> through glue, safety, both shapers and limiter), `LATENCY_COMP_SFX_PATH_S`
> (SFX join through limiter), and their difference
> `LATENCY_COMP_MUSIC_VS_SFX_S`. The constants are published **per context
> sample rate**: a table keyed by 44100 and 48000 (and any rate the soak mirror
> can render), each entry measured at that rate in an `OfflineAudioContext` of
> that rate, none derived from another rate by seconds or by samples. At
> arming the derivation selects the entry whose key equals `ctx.sampleRate`,
> else the nearest key, and the capture overlay names the key used.
>
> From Stage 3 on, `latencyComp` in the bundleAt derivation for **every image
> member** is the device term (`ctx.outputLatency` if finite and positive, else
> `ctx.baseLatency` if finite, else 0) plus `LATENCY_COMP_MUSIC_PATH_S`
> selected as above, sampled once at arming, clamped as a whole to
> `LATENCY_COMP_MAX_S` 0.25 s, and applied identically to every image member
> of a bundle so no member is split.
>
> **Every SFX member of a bundle** (today five: `playSfx storyAwaken` at the
> a1 unbolt, the a2 FOV liberation and the a4 alive bundle; `shipCrash` at the
> crash; `storyGlitch` at the glitch — the rule binds any bundle that carries a
> `playSfx`, not these ids) is scheduled forward by
> `LATENCY_COMP_MUSIC_VS_SFX_S` so its audible onset lands on the audible
> music onset the image members target. This offset is applied only inside
> bundleAt scheduling; the global SFX path, the per-frame SFX queue, the
> held-level law and unbundled `playSfx` calls are not delayed. A bundle with
> no music member (the a4 alive bundle) still uses the summed music-path
> target for its image and the forward offset for its SFX, so the two coincide.
>
> **Budget.** The compared quantity is `LATENCY_COMP_MUSIC_VS_SFX_S`, not
> `LATENCY_COMP_MUSIC_PATH_S`. With forward scheduling in force the residual
> SFX-versus-image error is the re-measurement tolerance (0.5 ms), and the
> image budget stays: image member visible at frame 0 or +1 against the
> post-tail envelope-start onset, never at −1, at most +2. If
> `LATENCY_COMP_MUSIC_VS_SFX_S` at the selected rate ever reaches 16.7 ms, the
> capture must additionally prove the SFX member and the image member within
> one frame of each other at every SFX-bearing anchor, or the tail is
> re-measured and this condition reopens.
>
> **Evidence.** The per-anchor capture overlay's `latencyCompMs` field reports
> the summed value, the sample-rate key used, and the separate device and
> music-path terms; the vertical waveform line marks the post-tail music
> envelope start, and at SFX-bearing anchors a second marked line shows the
> SFX audible onset so their coincidence is visible in the frame. Stage 3
> captures are covered by this signature only if `LATENCY_COMP_MUSIC_PATH_S`
> is applied to image members, SFX forward scheduling is present at all five
> SFX-bearing bundles, and both onset lines appear in the overlay.

## What this changes for the other lanes

- **Score / Integration:** `mixTuning.ts` gains the per-rate table (measure at
  48 kHz; do not compute it); `audio:check` pins each entry. Cost: one extra
  offline render per rate per run.
- **Integration (Stage 3):** bundle scheduler applies the forward offset to
  `playSfx` members only; a test proves an unbundled `playSfx` is not shifted.
- **Chapter:** no change to canon or beat flow; the a4 alive caption remains
  an image member of its bundle.
- **Contract change required:** yes — shared anchor timing semantics change,
  so draft-v4 needs three new signatures.
