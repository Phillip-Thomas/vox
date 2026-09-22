# Score Treatment — station interior light (polish pass)

Author: Score Director
Status: independent treatment, written without reading the cinematography treatment
Contract target: `station-interior-light` revision `1`
Disposition: **no cue, by contract.** Audio is a lock non-goal; `main/src/audio/` is protected.

## 1. Harmonic / motif / cue intent — cue ledger declined

Every cue is declined, including any audible objective-entry acknowledgement (the HUD flash
is Cinematography's). Reasoning, so the next run inherits a decision, not an accident:

- **The silence is unspent inventory, not a protected baseline.** Audio dies at the
  `?spacestation=` page swap (ch10 record: "audio-at-the-station dies at the page swap;
  deferred with docking"). Nobody composed it. A future run may score the station without
  a "you broke the silence" objection from me, provided it goes through the deferred
  station-audio packet rather than a polish lock.
- **What the silence means today:** it fits the intent's thesis by luck. A station that
  withholds by showing wants no music that likes you; the one room that does
  (`concourse-open`) is carried by the light cross-fade and the low line. Music under this
  pass would blur which sense is doing the work while Cinematography is measured on
  luminance. Silence keeps the evidence clean.
- **Future obligations recorded for the packet**, from the district targets: apron and hall
  want *room tone*, not score — a fixed-cardinality bed that never "notices" the player,
  mirroring the lighting law. The counter's flatness is silence-with-hum. Only
  `concourse-open` earns a score moment: warmth you did not make = the first pitched
  material since the dock, arriving before the line. None of this is owed by this run.

## 2. Sync-anchor relations — none active

No score anchor binds to this revision. Intent anchors a future packet would promote, in
order of likelihood: `concourse-open` (the one certain cue boundary), `airlock-threshold`
(room tone in), `airlock-return` (room tone out, hand back to the ship), `registry-desk` and
`issuer-stall` (one acknowledgement per objective id only). `hall-plain` and `racking-aisle`
stay musically unanchored.

## 3. Era fidelity — n/a

Shipped full stage; no ladder rung is exercised.

## 4. Mix / performance plan — verify the silence is intact

Source findings (working tree at `b631a52`+):

- No file under `main/src/components/spaceStation/` or `main/src/game/spaceStation/` imports
  from `main/src/audio/` or `storyScore` (grep, zero hits). `StationScreeningDriver.tsx`
  imports only React and a story type; `stationScreening.ts` imports nothing.
- `main/src/main.tsx` mounts `SpaceStationSandbox` alone under `?spacestation=`; `App`, and so
  `AudioDirector`, never renders on that branch.
- **Transitive caveat:** the station chunk still reaches audio code via
  `spaceStationDevFlag → storyState → debrisSalvage → sfxEngine → audioCore` and
  `PostFX → signedSceneAvRuntime → storyScore`. All of it is lazy: `getAudioContext()`
  constructs only when called; `SfxEngine` exists only after `getSfxEngine()`, which is also
  the sole installer of `window.__voxSfxDiag`; `playSfx` in `debrisSalvage` fires only in
  `collectDebris`. The provable claim is **no context is constructed**, not "no audio module
  is loaded".

Verifier check, in the `baseline-probe.mjs` idiom (`?spacestation=1&dock=0&t=17.5`, port
4321, the Paravoxia title tag identity check):

1. `addInitScript` wraps `AudioContext`, `webkitAudioContext`, `OfflineAudioContext`, and
   `HTMLMediaElement.prototype.play` with counters. Expect `0` after teleporting through
   `apron → counter → concourse → floor → shelves`, a pointer-lock click, a vendor
   open/close, and in story mode each objective id change (`registry-entry`,
   `certified-source`, `stow-cell`).
2. `typeof window.__voxSfxDiag === 'undefined'` at every sample.
3. Console errors mentioning `AudioContext` are a failure here, unlike `objective-hud-probe.mjs`.
4. Run before and after implementation; both zero. No combined-bus render — there is no bus.

## 5. Grounding evidence cited

`production-lock.md` (non-goals, protected paths, "Audio evidence: none");
`story-intent.md` §Constraints for Score; ch10 `production-lock.md` line 51 and ch10
`score-treatment.md` §Non-goals; esbuild metafile of `SpaceStationSandbox.tsx` (chains
above); `main/dist/assets/SpaceStationSandbox-*.js` has zero `AudioContext` strings;
`sfxEngine.ts` 249–253 and 587–598; `audioCore.ts` `getAudioContext` 313–320.

## 6. Constraints on Cinematography

- **No periodic luminance**: no flicker, strobe, pulse, or breathing fitting anywhere,
  including "faulty" lamps in the hall or shelves. A rhythmic light installs a tempo a future
  cue grid must obey or fight; it also breaks Chapter's "light may not notice the player".
- **The `concourse-open` cross-fade duration must be a named constant** (per-threshold or
  `FILL_FADE_SECONDS`). A future bloom lands on that number; a literal cannot be anchored.
- The HUD entry flash, if added, is one-shot per objective id with no repeat or tempo.
- Do not fake audio with vision: no visualiser bars, no speaker-grille glow.

## 7. Accessibility / quality

Nothing to add: no caption, no reduced-sensory duck, no small-speaker check. The verifier
check above is this run's entire audio evidence.
