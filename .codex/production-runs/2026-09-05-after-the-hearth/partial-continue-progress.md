# Bounded partial WorldSave / Continue check — progress

Owner: fresh bounded `story-verifier` (partial-continue). Scope: ONE actual
partial WorldSave / Continue test on the current frozen source. No chapter
verification, no new production run, no source/test/contract/ledger edits.

## 2026-09-06T12:55:21+00:00 — phase boundary: context read, probe written, not yet run

Read: `verification-ready.json`, `implementation-source-manifest.json`,
`producer-world-source-review.json`, `verifier/artifacts/preview-ownership.json`,
current `verifier-inbox.md` (through the 12:43:16 note), and the relevant actual
source: `game/systems/persistence.ts` (WorldSave/saveWorld/loadWorld/
restoreCommonGroundForWorld), `story/commonGroundState.ts` (serialize/stage/
hydrate + `CG_POSES`), `story/commonGroundDirector.ts` (tickSurvey,
commitCommonGroundSpanOffer, interaction candidates, probe snapshot schema),
`story/storyState.ts` (storyEntryPoint/canContinueStory/beginStory/seedForBeat),
`components/ui/LandingMenu.tsx`, `components/ui/PauseMenu.tsx`, `App.tsx`
autosave + quitToMenu, `story/world/CommonGroundWorld.tsx` (restore wiring).

Identity checks actually performed (no build, no verify, no preview change):

- `sha256 implementation-source-manifest.json` =
  `d9e36ae314ba547a292e55376d54eecbf0ff47dc3d6710c4f9b5ae3fee96caf2` — matches.
- All **97** manifest source paths re-hashed from the live worktree: **0
  mismatches**.
- Root preview `http://127.0.0.1:40131/` HTTP 200, `<title>Paravoxia</title>`,
  index bytes sha256 `dd60733c…a6a8e` (= ownership `indexSha256`), served
  `/assets/index-D6fwfFv7.js` sha256 `c35941dd…1cbe9` (= ownership
  `bundleSha256`). Preview left running; root owns its lifetime.
- Heavy lock `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`
  present, `fuser` reports no owner. Will be taken with non-blocking `flock -n`
  for the headed run and released on exit.

New run-local probe (own file only):
`verifier/probes/partial-continue/partial-continue-probe.mjs`. Reuses
`lib/cgContract.mjs`, `lib/ownedSession.mjs`, `lib/sourceSnapshot.mjs` and the
shipped `main/tools/lib/evidence.mjs` (`openParavoxia`/`waitReady`/`readState`).
Offline `--self-test` passes (exit 0): key-choice, along-leg vs lateral
projection and distance helpers.

Planned lifecycle, all shipped paths, no fixtures beyond the labelled deep link:
earn a real ≥4-sample unfinished drawing at `?story=ch13-survey&movie=1`; save
via the shipped `beforeunload` autosave fired by a same-tab navigation; copy the
ACTUAL serialized `localStorage` WorldSave bytes out as evidence; press the real
landing **Continue** button with storage retained; compare survival; then a NEW
act — ordinary WASD to E `(-42,51.05,12)` and `[F]` to offer the span. Movie rail
is used only to reach the drawing state; every key press is labelled
scripted-input and is never a zero-rescue movie claim.

Not yet done at this boundary: the browser run itself.
