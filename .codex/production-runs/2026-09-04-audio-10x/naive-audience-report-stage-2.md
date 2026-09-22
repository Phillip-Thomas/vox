# Naive-audience report — stage 2 (blind signal analysis)

**I cannot hear.** All of this is measurement plus inference from waveforms and
spectrograms; "sounds like" means "the numbers predict". An ear must confirm.

**Method:** 19 `before`/`after` + 6 `*-pretail` pairs, matched by filename;
ffmpeg ebur128 + numpy envelope/FFT. Spectrograms (before over after) in
`evidence/stage-2/spectrograms-blind/`.

**Alignment fact:** every `after` file is the *same performance* delayed by
exactly **456 samples (10.34 ms)**; aligned, the pairs null to −35…−61 dB, so
this is a true A/B. Looks like an added lookahead stage — inaudible alone, but
it wrecks any sample-accurate comparison done without it.

## Numbers (aligned; gain = after − before, dB)

| file | I b→a | LRA b→a | TruePk b→a | crest b→a | median gain | worst dip | recovery |
|---|---|---|---|---|---|---|---|
| bed-check | −20.4→−20.3 | 3.2→3.3 | −9.1→−8.8 | 11.0→11.3 | +0.11 | none | — |
| combined-check | −20.4→−20.4 | 3.3→3.5 | −9.1→−8.8 | 11.0→11.4 | +0.10 | −6.4 dB | 0.73 s |
| shipcrash-bloom | −20.5→−20.4 | 3.6→3.6 | −9.4→−9.0 | 10.4→10.7 | +0.11 | −6.5 dB | 0.76 s |
| jetpack-splash | −20.7→−20.7 | 3.1→3.2 | −9.8→−9.5 | 10.6→10.8 | +0.10 | −6.4 dB | 0.71 s |
| terminal-storylead | −20.4→−20.4 | 2.5→2.5 | −9.8→−9.5 | 11.4→11.7 | +0.07 | −3.0 dB | 0.52 s |
| oxygen-dive | −21.5→−21.7 | 2.8→4.5 | −9.2→−8.9 | 13.4→13.9 | 0.00 | −3.1 dB | 5.7 s |
| mining-burst | −20.6→−20.5 | 3.4→3.4 | −4.8→−4.9 | 14.5→14.3 | +0.11 | none | — |
| bare/color/floor-*, all `*-pretail` | ±0.1 | same | same | same | −0.01 | none | — |

## Listener-language findings

**(a) Gain riding.** No pumping. Between events the gain curve is flat within
**±0.15 dB** — the music is not breathing. What exists is a handful of
**sidesteps**: the bed drops **≈6.4 dB** in 35–105 ms, holds ~0.47 s, returns
over ~0.72 s. It steps aside and walks back; it does not snap. The 3 dB
story-lead dips (26/30/40 s) are a polite lean, gone in ~0.5 s. Oxygen-dive is
different in kind: −3 dB faded in over 4.9 s, released over 5.7 s, 17% of the
file — mood, not a ducker. Reservation: the 6.4 dB ducks are *broadband*, equal
to 0.1 dB in every octave, so the bed does not stay present underneath — the
whole music recedes. That may read "mixed" rather than "orchestrated".

**(b) Limiter artefacts.** None. Crest factor **rose** 0.2–0.3 dB in nearly
every file (only mining-burst fell, 0.17 dB). True peaks rose 0.3–0.4 dB but
stay ≤ −4.8 dBFS; zero clipped samples. Mining-burst transient peaks are
+0.2…+0.3 dB *higher* after. Band spectra at burst windows show no new energy
above the source (16–22 kHz moves 0.0…−1.7 dB, never up).

**(c) Quiet passages.** Quietest 1 s window unchanged to 0.01 dB everywhere. No
added noise, no gated silence. `floor-*`, `bare-*`, `color-bed` are untouched
(null −52…−61 dB) — the change never reaches the sparse cues.

**(d) Effects "in" vs "on top of".** Isolating SFX (combined-check minus
bed-check, per side): effect events sat **20.0 dB below** the bed before,
**9.5 dB below** after — a ~10.5 dB relative lift. Before, the two files null at
−32.7 dB: the effects were near-invisible. After, they are present but still
under the music. With the duck added, an impact momentarily clears the bed by
~16 dB. That is "in the music, given room" — if 16 dB isn't too much room.

**(e) Clicks.** None introduced. The largest sample-step in the set (0.51 at
**20.013 s, stress-mining-burst**; 16 steps >0.2) is **identical in before and
after** — inherited, but a real snap candidate for a human listen. Also
inherited: oxygen-dive has a brick-wall ~6.3 kHz lowpass switching in at 8.5 s
and out at 53.5 s with no transition, in both versions.

**Verdict:** narrow and clean — lookahead delay, ~+0.1 dB, and a shaped 6 dB
event duck lifting effects ~10 dB over the bed at no limiter, noise or click
cost. Two questions for the ear: is 6.4 dB broadband too much recession, and is
the 20.013 s mining snap a defect?
