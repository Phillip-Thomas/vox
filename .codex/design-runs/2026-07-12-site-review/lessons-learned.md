# Lessons Learned

## Product

- Owner direction: make the current Story Demo and systems foundation incredible before advancing the story.
- Owner direction: the existing audio engine is protected and should not be refactored in this lane.
- Owner direction: desktop controls feel good; preserve their feel/bindings and improve only missing discovery/recovery/accessibility essentials.
- Paravoxia is closest to award quality when it acts like an authored game about perception, not when it acts like a catalogue of voxel systems.
- The story premise is more differentiated than the generic sandbox entry; the menu hierarchy should admit that.
- A deliberate endpoint now is more valuable than an unfinished continuation later.
- Existing shelter, fire, food, vitals, wreck, and crafting work becomes much stronger when one consequence loop connects them.

## Visual

- Macro identity is already excellent; ground-level composition is the gap.
- Machine-clean atlases prove determinism and health, not taste. Human hero-atlas scoring and a full in-motion screening must remain separate gates.
- Procedural generation should stay, but the camera needs a small authored near-field layer for characters, ship, wreck, anomaly, and select fauna.
- Recovered performance budget should fund grounding, material response, animation, and sound before additional decorative effects.

## Engineering

- The existing world-prep worker is a high-leverage asset; use it at initial boot instead of inventing another pipeline.
- A quality-setting API is not complete until live scene counts/features change and a browser test proves the delta.
- Audio decoding can dominate memory even when render metrics look healthy.
- A large pure-test suite did not catch profile non-reactivity, Long Tasks, HMR-sensitive flows, pointer-lock UX, or visual composition; golden browser journeys are necessary.
- Accepted shader-explosion and human-taste-pending states must not be summarized as visual completion.

## Process

- Reuse one canonical preview URL; multiple same-repo Vite servers make evidence easier to poison.
- Branch state changed during review, so final evidence must record the commit and exclude transient HMR captures.
- Headless screenshots are useful for composition and structure, but final color, exposure, aliasing, audio, and feel decisions need headed real-GPU/manual review.
- Future run artifacts should distinguish observed facts, inferred design judgment, and hypotheses requiring play/audition.
