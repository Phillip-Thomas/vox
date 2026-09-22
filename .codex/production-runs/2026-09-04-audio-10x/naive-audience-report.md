# Naive A/B report — stage-1 excerpts

**Honesty note:** I cannot hear. This is signal analysis (ebur128,
spectrograms, numpy STFT, mid/side), not listening. "Brighter"/"wider" are
predictions, not testimony. Set A = `before/`, Set B = `after/`; I was told
nothing about which is newer.

## Table

| Excerpt | A LUFS / TP / LRA | B LUFS / TP / LRA | What I'd expect to hear |
|---|---|---|---|
| bare-bed | -34.5 / -25.2 / 0.5 | -34.5 / -25.2 / 0.4 | **Identical.** Mono, whisper-quiet, hard-gated comb to 20 kHz; a raw oscillator, not music. |
| bare-story-ch1-fixed | -36.0 / -25.3 / 16.6 | -36.0 / -25.3 / 16.6 | **Identical.** Mono, half the clip near-silent. |
| color-bed | -27.3 / -19.2 / 1.5 | -27.3 / -19.2 / 1.5 | **Identical.** Mono hum, 60-170 Hz. |
| story-beat_a3-dawn | -20.0 / -8.6 / 2.5 | -20.2 / -9.6 / 2.4 | Effectively identical. Warm, dense, stereo. |
| bed-check / combined-check | -23.1 / -9.7 / 6.9 | -20.4 / -9.1 / 3.2 | B +2.7 dB louder, brighter and wider above 300 Hz. |
| bed-contrast-A (frozen) | -25.0 / -6.6 / 4.0 | -20.5 / -8.6 / 3.7 | B +4.5 dB, +4 dB at 120-300 Hz and 3-8 kHz; **three clicks in A gone in B**. |
| bed-contrast-B (volcanic) | -25.3 / -11.9 / 5.1 | -21.1 / -9.5 / 5.1 | B +4.2 dB, +4.4 dB low-mid, +4.6 dB presence, wider top. |
| bed-sandbox-day | -24.6 / -11.5 / 3.8 | -20.5 / -9.4 / 3.6 | Same again; A would sound dull and hollow beside it. |
| bed-sandbox-night | -22.9 / -8.6 / 3.5 | -19.0 / -7.2 / 3.0 | B +3.9 dB, +6.5 dB at 120-300 Hz; one click in A removed. |
| era-transition | -26.1 / -5.2 / 11.2 | -22.6 / -9.0 / 15.2 | B louder *and* more dynamic (LRA 11.2→15.2). Two loud clicks in A gone. |

## Weight, width, air

Five of eleven pairs are unchanged. All movement is in the five procedural
"bed" renders plus `era-transition`.

Where it moved, B wins on every axis I can measure. **Weight:** +4 dB at
120-300 Hz — the region that gives a bed a body instead of a sub-rumble plus a
whistle. **Air:** +4 to +6 dB at 3-8 kHz and 8-16 kHz. **Width:** side energy
up 3-7 dB above 300 Hz, and *down* 16-26 dB below 60 Hz. B's bass is properly
mono'd; A's was smeared across the image — the classic cause of a low end that
sounds loose on speakers and vanishes on a phone. That is the most
professional-sounding change in the set.

## Synth patch vs score

A's beds are extremely tonal — median spectral flatness 0.005-0.02 at 1-3 kHz,
almost pure sustained partials with nothing between them. That is what "a synth
patch left running" measures like. B raises flatness to 0.07-0.14: breath and
texture between the pitches, closer to a score. Not there yet — B is still
tonal-dominant, and the gain is spread evenly rather than arriving in gestures.

The three mono near-silent excerpts (`bare-bed`, `bare-story-ch1-fixed`,
`color-bed`) sound like isolated oscillator stems in both sets: hard-edged comb
blocks, no stereo, no tail, peaks 25 dB down.

## Artefacts I would hear

- **Clicks in A, fixed in B.** Sample-level jumps 6.6x-10x RMS: `bed-contrast-A`
  at 5.75 s, 126.06 s, 166.55 s; `era-transition` at 52.57 s and 86.30 s;
  `bed-sandbox-night` at 108.54 s. All absent in B. The clearest audible
  defects anywhere in the material.
- **No pumping** in either set. The only periodic amplitude modulation I found
  is 0.1 dB deep — inaudible.
- **No spray-can reverb tails.** B adds broadband texture but does not extend
  decay times; nothing smears.
- **Harshness risk in B**, mild: crest factor drops 1-5 dB (16.3→11.2 dB on
  `bed-contrast-A`). B is denser and flatter. Loud but not squashed.
- **`bed-check` and `combined-check` are the same render** (differ by 30 dB).
  If they are meant to prove a combined bus, they don't.
- One loss in B: at the 71 s section change in `bed-check`, A drops 9 dB of
  3-8 kHz, B holds level. Smoother — and less sectional.

**Same piece?** Yes, unmistakably — identical section boundaries, and an
identical first 62 s in `era-transition`. B is the same music, better built.
