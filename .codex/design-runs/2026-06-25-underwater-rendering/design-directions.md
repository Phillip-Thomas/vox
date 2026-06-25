# Design Directions

Direction A: Source-gated cinematic shafts

- Keep godrays, but source them only from the sun/Snell aperture.
- Tint shafts analytically with water haze instead of copying bright terrain pixels.
- Add a mild medium wash to cool close warm terrain.

Direction B: Disable or heavily damp shafts

- Reduce underwater godrays to near-zero intensity and rely on fog plus particles.
- Lowest artifact risk, but loses the requested sun peeking through water effect.

Selected: Direction A.

Reason:

- It directly addresses the artifact source while preserving the visual feature the user wanted to keep.
