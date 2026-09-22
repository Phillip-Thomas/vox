# Naive audience report — stage 3 sync strips

I am a first-time viewer. **I cannot hear anything.** I only looked at the JPGs
and `index.json` files under `evidence/stage-3/sync/`. Every timing claim below
is image-vs-burned-marker, never image-vs-sound. Frames are ~16.7 ms apart, so
"one frame" ≈ 17 ms.

## What I saw, anchor by anchor

| Anchor | Earliest frame vs fire | What visibly happens | Decisive? | 3 runs agree? |
|---|---|---|---|---|
| `anc.a1.color-stabilizes` (a1-ramp) | −49 ms (onset judgeable) | **Nothing.** Seven frames of a flat pale off-white field with the debug overlay. Runs 2/3 show a ~1% pixel twitch at +104/+120 ms, far too small to read as a colour "stabilizing". | No event at all | Yes — all three equally empty |
| `anc.a2.hand-back` (a2-awakening) | −47 ms (judgeable) | The pale blank holds through k=0, then at **+25 ms (frame +1)** the whole picture hard-cuts in: a tree with red fruit, ground, HUD panel. 93% of pixels change in one frame. | Very decisive, but this reads as the scene *loading*, not as a hand returning | Yes — +25.5 / +23.5 / +27.8 ms, identical |
| `anc.a2.feed-wall-falls` | **+2836 ms — cannot judge onset** | Four blank pale frames, pixel-identical. **The burned overlay says `anchor anc.a2.hand-back`, not feed-wall-falls.** | Nothing visible | Consistent, and consistently wrong |
| `anc.a3.material-lands` (a3-dawn) | −48 ms (judgeable) | A sunlit meadow with palms. Grass sways, but at k=0 nothing lands. The only real change is a dark caption panel fading up bottom-left over **two** frames, starting +36 ms (run1) / +23 ms (run2) / +56 ms (run3). | Smeared: a two-frame fade, 1–3 frames late | Onset wanders ~33 ms run-to-run |
| `anc.a3.first-blade` | **+15139 ms — cannot judge onset** | Letterboxed meadow, subtitle "everything is what it always was. i am more." frozen across all four frames. **Overlay again names `anc.a3.material-lands`.** | Nothing | Consistent; all three arrive ~15 s late |
| `anc.a4.life-front` (a4-exhale) | **+4423 ms — cannot judge onset** | Letterboxed cutscene: pond, deer, banner "FAULT: N-7744 / MODEL REFUSED BY OBSERVATION", caption "(the world exhales…)". Camera drifts steadily right; caption and banner are already up and stay up. | Nothing steps — only a held drift | Yes |
| `anc.lift.perspective-issued` (ch1-lift) | **+251 ms — cannot judge onset** | Blank pale screen under a black letterbox bar. Four frames, zero change. | Nothing | Yes |
| `anc.track.unbolt` (ch1-track) | **+3436 ms — cannot judge onset** | Blank pale screen, four pixel-identical frames. | Nothing | Yes |
| `anc.maw.repair-answer` (ch5-maw) | **+7386 ms — cannot judge onset** | Gameplay: palms, a deer, a pond, HUD "CURRENT OBJECTIVE / POND RESPONSE — ATTEND" and a "13 m" marker, all already present. Camera drifts. | Nothing steps | Yes |
| `anc.descent.impact` (descent) | **+193 ms — cannot judge onset** | A pale, faintly banded field dimming smoothly ~2 grey levels per frame. It looks like the **tail of a flash decaying**, and I arrive after the flash. | The decay is smooth, not doubled | Yes, all three mid-decay |

## Viewer-language notes

- Six of ten anchors hand me only frames **after** the fire — 0.2 s to 15 s
  after. For those I genuinely cannot say whether the picture hit early, late,
  or on the marker. A strip that starts 15 seconds after the event is not
  evidence about that event.
- The two worst-offending folders (`feed-wall-falls`, `first-blade`) also carry
  the **neighbouring anchor's name burned into the frame**. As a viewer I have
  to say the folder and the picture disagree about what I'm looking at.
- Only three anchors are actually judgeable: `a1.color-stabilizes` (nothing
  happens), `a2.hand-back` (one clean frame-+1 cut, but it looks like a load-in
  pop, not authored), `a3.material-lands` (a soft two-frame caption fade, 1–3
  frames late and jittering ~33 ms between runs).
- Four anchors are captured on a **blank pale screen** with only the debug
  overlay drawn — `a1-ramp`, `feed-wall-falls`, `ch1-lift`, `ch1-track`. Whatever
  the audio is doing, there is no picture to sync to.
- Nothing fires twice. The recurring failure is the opposite: events held flat
  across the whole strip, or missed entirely.
- **`sync/before-two-clock/` contains only `.json` and `.log` files — no frame
  strips.** There is nothing to compare visually, so I cannot say which reads
  more decisive.
