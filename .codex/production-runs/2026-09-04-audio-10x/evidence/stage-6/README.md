# Stage 6 — scaffolding

Route: `stage-6-scaffold`. Authority: `scene-contract.json` **draft-v4**
(sha256 `672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d`).

This is the **build without the wiring**. Every symbol below exists, is typed and
is tested; **nothing calls any of it**. Stages 3/4 are landing concurrently in
`storyDirector.ts`, `scoreEngine.ts`, `storyScore.ts`, `signedSceneAvRuntime.ts`,
`emergentStoryDirector.ts` and `bedEngine.ts`, and none of those files was
touched here. Until the emitters bind, the shipped runtime behaves exactly as it
did: the caption surface renders nothing, the audit band renders as it shipped,
the oxygen meter renders as it shipped, and the voice bus creates no audio node.

`audioCore.ts` and `src/audio/mix/**` were **not edited**. The voice engine joins
through `getGameAudioCategoryBusInput('voice')` — audioCore's public Stage 2 API —
and through `getMusicChord()` for the published harmonic centre.

---

## What exists

### 1. The caption vocabulary — `main/src/components/hud/soundCaptionTable.ts`

**Chapter owns the words.** Header comment says so; the both-readings rationale
is recorded per row.

- Four bracketed families and **no others** (acceptanceCriteria[19]):
  `[ALARM]`, `[STATIC]`, `[IMPACT]`, `[HATCH]`.
- `[GLITCH]` is **absent by test**, not by omission — it was refused (CN-R4) and
  `[STATIC]` carries `storyGlitch` and `terminalCorrupt`.
- Seven further rows exist to STATE why they carry no bracket and which surface
  discharges their parity: the oxygen pulse (the meter tick), the five objective
  lifecycle cues plus `marker-acquired` (the guidance card and `FreeMarker`), and
  the narrator utterance (the REGULATION line already on screen IS the caption).
- `SOUND_CAPTION_SILENT_BEATS` is built by spreading `VOICE_SILENT_BEATS`
  **imported by reference** from `voiceGrammar.ts` and adding exactly one entry,
  `ch1-lift` — the CN-R4 term that the two silences must be one set.
- Timings: hold 1200 ms, fade 300 ms.

### 2. The caption surface — `main/src/components/hud/SoundCaption.tsx`

- Registers `sound-caption` on layer **`informational`**, never `caption`, so the
  HUD sweep forbids it under `story-caption` / `audit-band`.
- Type inherited from the **audit band**: `theme.font.mono`, 12 px, `0.14em`,
  `text-transform: uppercase`.
- Placement is a pure solver, `solveSoundCaptionPlacement()`: top-right on
  desktop (clearing the vitals band), and on touch or a narrow viewport anchored
  above the **measured** `readTouchControlClearance()` — right-aligned, never
  bottom-centre, which is the story captions' home.
- Reduced motion: `transition: none`, hard show and hide, never a pulse.
- Event API so any emitter can drive it later without this file knowing who:
  `postSoundCaption(id, { reducedMotion })`, `subscribeSoundCaptions`,
  `readSoundCaption`, `clearSoundCaptions`. `postSoundCaption` returns **false**
  for the uncaptioned rows — a voiced line cannot be bracketed through the API.
- One caption per cue kind: a repeat restarts the hold and bumps a token; it does
  not stack.

### 3. Parity members

- **Klaxon ember** — `main/src/story/AuditBand.tsx`: `pulseAuditEmber()` /
  `subscribeAuditEmber()`, `AUDIT_EMBER_COLOR = '#ff5a3c'`, rendered as **one
  frame** of inset ember on the band, disarmed on the next `requestAnimationFrame`.
  No screen flash, no second surface. Already one frame, so reduced motion leaves
  it unchanged. It rides the band, so a klaxon with no band shows no ember — the
  a2 violation flood's parity stays the violation band and the flash on screen.
- **Oxygen tick at every level** — `main/src/components/hud/OxygenMeter.tsx`:
  `pulseOxygenTick()` / `subscribeOxygenTick()`, and a pure
  `solveOxygenTickPresentation(pulse, reducedMotion)`. Non-RM the edge marker
  brightens for `OXYGEN_TICK_FLASH_MS` and never moves; under RM it **moves** one
  `OXYGEN_TICK_RM_STEP_PX` step per pulse and never changes brightness. The
  shipped sub-25% alarm pulse is untouched beside it. The tick renders at every
  level; the audio cadence is read, never made.

### 4. The voice bus — `main/src/audio/voice/`

`voiceGrammar.ts` is pure and WebAudio-free so vitest covers all of it;
`voiceBus.ts` is the thin rim.

- **Refusal at the API boundary, both halves.** `admitVoiceLine()` requires an
  allowlisted `surfaceId` (`terminal`, `feed`, `audit-band`, `ch10-relay`,
  `station-panel`) **and** `register: 'institutional'` **and** a line that passes
  `classifyVoiceLine()` — which refuses parenthetical intrusions, lowercase-led
  lines, the em-dash `i—` fragment and empty lines — **and** a non-silent beat.
  `utter()` refuses before any audio node exists, so a refusal is identical with
  or without a running context.
- **Silence set.** `VOICE_SILENT_BEATS` = `ch4-defy`, `a1-ramp`, `a2-awakening`,
  `a3-dawn`, `a4-exhale` (whole beats, per Chapter). `seam-ebb` is a ch10 score
  **mood**, so it silences through `VOICE_SILENT_MOODS`; the ch6 dive silences
  through `underOxygen`.
- **Era ladder** (`resolveVoiceRung` off `resolveEraGates`-shaped input, never the
  beat): `bare` one blip/char no formants → `colour` two-pulse formant pairs →
  `material` granular 20 ms grains through the bank → `alive` smooth 40 ms grains,
  full comb, noise floor. Source is `square` at **every** rung. Fidelity rises;
  gain is flat across the utterance so nothing can read as prosody.
- **Pitch** snaps to `getMusicChord()`'s published tones, one octave above the pad
  (`snapVoicePitch`), with a `carrierSemitone` override for the ch10 relay.
- **Radio chain** per slot (`createVoiceChain`): parallel 3-band formant bank
  (Q 8) → highpass 300 → lowpass 3400 → `tanh(1.6)` waveshaper → comb
  (1/1100 s, fb 0.35) → summed noise floor (−48 dB) → the `voice` category bus.
  Two slots (`VOICE_SLOT_COUNT`) so the ch10 relay overlap has somewhere to land.
- **Determinism**: `voiceSeedFromString` (FNV-1a) + `voiceRandom` (mulberry32);
  `setVoiceRunSeed()` rebuilds the speaker tables only when the seed changes; one
  narrator table serves `crawl` → `station-resolved`, and station vendors take
  their own ids through the same chain.
- **`speak(buffer, { text, … })`** is the TTS-ready stub. It takes the line's TEXT
  beside the buffer on purpose: a buffer must not be able to smuggle a lowercase
  caption past the boundary `utter()` enforces.
- **Offline**: `renderVoiceInto(ctx, destination, opts)` builds the chain and
  schedules the grains into **any** `BaseAudioContext`, so the Stage 6 evidence
  render measures the same chain the player hears. See "How each term gets
  proven" for how it attaches to `renderCombinedOffline`.

**RELAY_ANSWER_LEAD_S is deliberately absent.** Chapter retired it and
`askLastKeyTime` in CN-N5: the answer's first glyph and first voice grain both key
off `anc.ch10.relay-answer` in the same frame — simultaneity by shared anchor,
never by a tuned offset. A comment in `voiceGrammar.ts` records this so the
constant is not re-added from score-treatment §6's earlier wording.

---

## What is NOT wired (the Stage 4/6 integration surface)

None of these call sites was edited. Each is where the emitter must land:

| Cue | Call site |
| --- | --- |
| Klaxon ember | `main/src/story/storyDirector.ts:1887` — `playSfx('terminalAlarm')` in the ch3-signal klaxon repeat. Add `pulseAuditEmber()` on the **same tick**. (Treatment cites `:1881`; the shipped line is `:1887` at this revision, inside the same `signalKlaxons` block at `:1885-1888`.) A second `playSfx('terminalAlarm')` exists at `main/src/story/storyDirector.ts:1270` — Chapter must rule whether that one embers too; the contract names only the ch3-signal repeat. |
| Oxygen body clock | `main/src/audio/oxygenAudio.ts` — the per-pulse callback Score adds in Stage 6 calls `pulseOxygenTick()`. Audio cadence untouched. |
| Lifecycle cues | `main/src/story/ux/feedbackCues.ts` — must **not** post a sound caption (`postSoundCaption` already returns false for all five plus `marker-acquired`); parity stays the guidance card and `FreeMarker`. |
| `[ALARM]` / `[STATIC]` / `[IMPACT]` / `[HATCH]` captions | The SFX emit path for `terminalAlarm`, `terminalCorrupt`/`storyGlitch`, `shipCrash`, and the dock-hatch iris in `main/src/game/spaceStation/` — gated on the accessibility setting and on `isSoundCaptionSilentBeat(beat)`. |
| Narrator utterance | Prologue terminals (`main/src/story/prologue/**`), the feed, `AuditBand`, the ch10 relay, and the station AI client — each calls `utter(text, { surfaceId, register: 'institutional', rung, silence })` on its own `terminalKey` typewriter tick. |
| `SoundCaption` mount | Not mounted in any tree yet. It must mount behind the "sound captions" accessibility setting, default off, and be **absent from movie mode** (owner-taste item, both lanes concurring). |
| `setVoiceRunSeed` | Must be called once from the session/render seed so live and offline reproduce one voice. |

---

## How each contract term gets proven

- **acceptanceCriteria[18] — the refusal test.** Already proven, here:
  `voiceGrammar.test.ts` walks every shipped `VOYAGE_STRANGE_LINES` entry from
  `main/src/story/storyScript.ts` and asserts every `watcher` intrusion is
  refused while every `system` line is admitted. No copy string is read into or
  written out of `storyText.ts`.
- **acceptanceCriteria[19] — caption parity.** The four-family closure and the
  "no others" clause are proven by `soundCaptionTable.test.ts`. The
  silence-set-by-reference term is proven by asserting
  `SOUND_CAPTION_SILENT_BEATS.size === VOICE_SILENT_BEATS.size + 1`. The
  "voiced lines get no cue caption" term is proven at the API:
  `postSoundCaption('narrator-utterance')` returns false and renders nothing.
  The per-beat silence at runtime needs the wiring and lands with Stage 4/6.
- **acceptanceCriteria[17] — the measured half.** Band-energy intelligibility per
  rung, duck depth −9 ±1 dB on music, one caption event per voiced line, and a
  combined render with narration over a BLOOM holding −1 dBTP all require an
  offline render. `renderVoiceInto()` is the hook: `renderCombinedOffline()`
  (`main/src/audio/soak/offlineRender.ts:481`) already exposes the drive-step
  seam its options carry (`onDriveStep(ctx, now)` on `renderStoryBeatOffline`),
  and the combined path builds its own context and post-compressor join. **The
  attachment itself was NOT made here**, because `offlineRender.ts` is outside
  this stage's allowed paths and the Stage 3 agent is live in the adjacent score
  files. Stage 6 evidence should add a `voiceScript` option to
  `CombinedRenderOptions` alongside the existing `sfxScript`, resolve the voice
  bus destination the same way the SFX rim resolves its join, and call
  `renderVoiceInto(ctx, voiceBusDestination, …)` per scripted utterance. Nothing
  in `voiceBus.ts` needs to change for that: it already takes a
  `BaseAudioContext` and a destination.
- **The blind-viewer term** ("the terminal speaking, not a person") is a
  `scene-naive-viewer` read against that combined render, after wiring.
- **Reduced motion.** The caption's hard-cut form and the oxygen tick's
  positional form are proven by unit test here; the frame evidence (RM strips)
  lands with the Stage 6 capture pass.
- **HUD sweep.** `sound-caption` is registered in `hudSurfaces.ts`, so
  `npm run story:hud:sweep` will measure it as soon as the surface mounts. It
  cannot be swept while nothing mounts it — that measurement belongs to the
  wiring stage, not to this one.

---

## Verification run here

```
npx vitest run src/audio/voice/ \
  src/components/hud/soundCaptionTable.test.ts \
  src/components/hud/SoundCaption.test.tsx \
  src/components/hud/OxygenMeter.test.tsx \
  src/story/AuditBand.test.tsx
→ 6 files, 58 tests, all passing
```

`npx tsc --noEmit -p main` was **deferred**: `free -g` reported 16 GB available,
under the 20 GB floor this box requires (tsc has leaked 100+ GB here before) and
a concurrent Stage 3 build was running. Vitest's transform-time type resolution
covered the new modules; a full typecheck should run on the Stage 6 integration
pass when the box is quiet.

No browser probe, no `npm run verify`, no movie run — none is meaningful before
the emitters are bound.

---

## Files

New:

- `main/src/audio/voice/voiceGrammar.ts`
- `main/src/audio/voice/voiceGrammar.test.ts`
- `main/src/audio/voice/voiceBus.ts`
- `main/src/audio/voice/voiceBus.test.ts`
- `main/src/components/hud/soundCaptionTable.ts`
- `main/src/components/hud/soundCaptionTable.test.ts`
- `main/src/components/hud/SoundCaption.tsx`
- `main/src/components/hud/SoundCaption.test.tsx`
- `main/src/components/hud/OxygenMeter.test.tsx`
- `main/src/story/AuditBand.test.tsx`

Modified (all within the lock's allowed paths):

- `main/src/ui/hudSurfaces.ts` — registers `sound-caption` on `informational`.
- `main/src/story/AuditBand.tsx` — the ember pulse member and its event API.
- `main/src/components/hud/OxygenMeter.tsx` — the breath tick member and its
  event API.

`main/src/audio/voice/**` is a new directory outside the lock's enumerated
allowed paths; it was commissioned by the Stage 6 assignment and touches no
protected file. It should be added to `production-lock.json` `allowedPaths` on
the next amendment.

`implementation.diff` was NOT regenerated — another agent owns it. The ten new
files and three modified files above are this stage's contribution to it.
