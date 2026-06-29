Implementation handoff:
- Keep the existing rendering stack and quality profiles.
- Tune direct renderer exposure in `App.tsx` so non-composer profiles match the softer target.
- In `PostFX.tsx`, enable composer multisampling for HIGH/ULTRA, reduce AO/outline harshness, and lower bloom into a subtle cinematic glow.
- In `ColorGradeEffect.ts`, add a restrained filmic shoulder/lift/vignette-like edge tone without changing hue identity.
- Keep all changes deterministic and profile-gated.

Acceptance criteria:
- Desktop and mobile screenshots after Play show smoother edges and less crunchy contrast.
- Colors remain recognizably Paravoxia.
- Bench overlay still settles near 60 FPS on the test machine.
- `npm run test -- graphics` or relevant focused tests, then full `npm run verify`, pass.
