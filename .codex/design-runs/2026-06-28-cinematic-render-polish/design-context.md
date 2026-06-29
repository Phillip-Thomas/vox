Run mode: single-surface
Surface: shared in-game world rendering
Execution budget: standard
Exploration depth: 3
Approval threshold: 4.55 for this targeted visual-polish pass
Canonical preview URL: http://127.0.0.1:5173/
Browser path: Browser plugin unavailable; use Playwright.

Hard guardrails:
- Preserve the current Paravoxia identity: stylized, vivid, slightly cartoony voxel worlds.
- Do not redesign HUD/gameplay controls in this pass.
- Keep older laptop performance in mind; changes must degrade gracefully by quality profile.
- Avoid large asset additions or a new rendering engine.
- Keep the current deploy/build path intact.

Creative brief:
- Smooth out harsh screen-dependent aliasing and crunchy contrast.
- Make the world feel more cinematic, premium, and unified.
- Retain crisp voxel readability and the existing color schema.
- The result should feel like the current style with better lens/render finishing, not a different game.

Open field:
- Tone mapping exposure and postprocessing order/strength.
- Anti-aliasing strategy.
- Outline/contact AO harshness.
- Color grade softness, saturation, lift, warmth, and highlight rolloff.
- Quality-profile gating.

Required states:
- Desktop world render.
- Mobile-sized world render.
- At least one in-game settled state after Play.

Stop conditions:
- Build/test verification passes.
- Screenshots show a softer, more cohesive render without obvious blur or washed-out color.
- No severe perf regression in bench overlay.
