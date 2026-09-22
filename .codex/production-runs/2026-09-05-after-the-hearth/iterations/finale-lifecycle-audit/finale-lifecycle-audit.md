# Finale lifecycle — read-only mechanical source audit

**Question:** why does the fresh actual COMMON completion show `finalTextureSeconds` 0.0235 at 61793 ms and `null` by 62095 ms — and does the frozen source contain a causal normal-handback cleanup path, or is the responsible path unobserved?

**Answer in one line:** the source contains exactly such a path, and every other clear route is excluded by the capture — but the firing caller itself is still unobserved, because the cancel reason is discarded at runtime.

All 99 manifest files verified byte-identical before and after this audit. No game, probe, contract, gate or manifest file was touched; no browser, GPU, build or verify was run; no audio was heard and no audible claim is made. Contract `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`. Final trace `verifier/captures/arrival-common/journey-common-1/trace.ndjson`, sha256 `3ad4bda044795529b686110f8a50f3de13770c44fe39e3ef8fed5c6911bcc72b` (2525 records); the director-read prefix `c7473a70…` is a prefix of the same file and is unchanged in this window.

## First correction: the 61793 sample is not atomic

`journey-probe.mjs:286-399` builds one sample from **three awaited reads**: `readState()` (story/beat/milestones), then a second `page.evaluate` (`avFull`), then a third (`cgDiagnostic`, `cgScoreDiagnostic`). Frames run between them. So in record 61793 the story fields (`active:true`, `ch13-common`, no `story:ch13-complete`, `avFull` still at `anc.cg.independent-test`) are **older** than the score fields in the same record. There is no paradox of a live finale token during an active chapter beat.

What the *later* half of that same record actually shows is the **post-handback** state: `cgDiagnostic.value.beat = null`, `diagnostic.beat = null`, score `{beat:null, mood:null, finalTextureSeconds:0.0235}`.

## What the capture proves (executed evidence)

1. **The token began, and audio was not blocked when it began.** `beginCommonGroundFinalTexture` (commonGroundScore.ts:207-216) returns false unless `restoredCompletion` and `audioUnavailable` are both false; `commonGroundAudioUnavailable()` (commonGroundDirector.ts:550-559) reads mute, musicVolume, and requires `context.state === 'running'`. A token existing at all is state-level proof those checks passed ~24 ms before the read. (State fact, not audibility.)
2. **The handback frame retained the token, exactly as signed.** `beat`/`mood` are null while the token lives — that is `enterCommonGroundScoreBeat(null)` (commonGroundDirector.ts:718-720) with `storyDirector.ts:1232` deliberately skipping `setScoreBeat(null)` because `commonGroundFinalTextureHolds()`. The retention exception worked.
3. **It was not the deadline.** Age 0.0235 s, gone within ≤ ~0.33 s; the deadline needs 5 s (commonGroundScore.ts:94, 234-240).
4. **It was not a reset or the optional repeat.** `story.runId` is constant `1` across the window (excludes `resetCommonGroundScoreRuntime`, reachable only from `syncCommonGroundRun` on a runId change, commonGroundDirector.ts:685-691 → :252); `prompts: []` and an unchanged `interactionTrace` exclude `commitCommonGroundRepeatSurvey` (:1711).
5. **`releaseCommonGroundChapter` (:1769-1774) has no production caller at all** — grep across `main/src` minus tests returns only its definition.

That leaves exactly two live routes: the driver's suspend, and the audio-block cancel.

## The causal path in the frozen source

Handback frame (all synchronous):

- `commonGroundDirector.ts:1405-1411` — commit → `anc.cg.complete` → **begin token** (:418-425) → `anc.cg.handback` holds (:426-431) → `completeChapter13()`.
- `storyState.ts:980-983 → completeStory():939-954` — `setSnapshot({active:false, chapter:'complete', beat:'done'})`.
- `storyDirector.ts:1201-1242` — `onBeatEntered(null)` → `emergentStoryDirector.ts:798` → `enterCommonGroundBeat(null)` → score beat/mood nulled, **token kept** by the :1232 exception.

Next frame:

- `StoryDirectorDriver.tsx:145` computes `foreground = story.active && !paused && phase==='playing' && !documentIsHidden()`. `story.active` is now **false**, so `foreground` is false, so `:151` calls `suspendCommonGroundPresentation(paused ? 'pause' : 'visibility-loss')` → `commonGroundDirector.ts:1754` → `cancelCommonGroundFinalTexture` → token cleared. The document was visible and nothing was paused; the label is incidental.
- Only *afterwards*, at default priority 0, does `:226 tickCommonGroundEntry` → `commonGroundDirector.ts:653 tickCommonGroundScore` run — the very path whose comment (`StoryDirectorDriver.tsx:223-226`, `commonGroundScore.ts:229-233`) says it exists to carry the deadline past the handback. Ordering is not a guess: `@react-three/fiber` sorts frame subscribers ascending by priority (`main/node_modules/@react-three/fiber/dist/events-485b18b5.cjs.dev.js:1085`) and only `priority > 0` manualizes the loop (`:1077`), so `-1` runs first.

**Quantitative fit:** 0.0235 s ≈ 1.4 frames at 60 Hz — precisely "survived the handback frame, died on the next one". Not a same-frame kill, not a 5 s deadline.

**Contract relation:** if confirmed, this is a clear attributable *solely* to ordinary handback/done with no declared cancellation — the exact case the Score interpretation and the producer review flag as conflicting with the explicit retention exception. Nothing here claims an audible minimum, a fixed 5 s performance, a forced attack, or that anything was or was not heard.

## Alternatives and what is still missing

- **A1 — audio-block cancel** (`commonGroundDirector.ts:576-579`): would be a *declared* cancellation and would legitimately explain the early clear. Made unlikely by evidence 1 and by frame ordering, but not excluded, because no capture samples context/mute state.
- **A2 — the `'pause'` branch** (`StoryDirectorDriver.tsx:230`): same causal family, different label. Note `App.tsx` never sets `storyCompleteOpen` true (only `:764/:772/:786` set false), so that conjunct of `App.tsx:1690` is dead; the other conjuncts were not sampled.
- **Missing, decisively:** there is **no clear-cause ledger**. `cancelCommonGroundFinalTexture(_reason)` discards the reason (`commonGroundScore.ts:259`). No current capture can name the caller. Sample cadence (110-300 ms) plus non-atomicity bounds the lifetime only to (0.0235 s, ~0.33 s]. No audio/focus/visibility/pause sample, no captured output.

So: **the source reveals a causal normal-handback cleanup path, and the responsible firing is still unobserved.** Both halves of the question are yes.

## Smallest next step (read-only, existing hooks only)

One poll loop in the existing arrival-common journey lane, from 2 s before the commit to 8 s after, at ~4-8 ms, with **every read inside a single `page.evaluate`** so the record is atomic (that alone repairs the artefact in evidence 1). No new hook is required:

`performance.now()` · `__paravoxiaCommonGround.snapshot().score` and `.diagnostic.beat` · `__paravoxiaJourneyProbe.getSnapshot().state.story` (active/beat/runId) · `__voxBundleDiag()` (bundle trace + `heldChain`, i.e. the existing release as state) · `__voxAudioDiag()` · `document.visibilityState` / `hasFocus()` / `hidden`.

Derive `t_begin`, `t_clear`, `t_inactive`. Decide:

- `t_clear - t_inactive` ≈ 1-2 frames, page visible and focused, audio route running across the window ⇒ the story-inactive foreground branch (`StoryDirectorDriver.tsx:145-151`) is the cause: cancellation attributable solely to normal handback.
- audio route not running / muted at or before `t_clear` ⇒ the declared audio-block cancellation is the cause, and no audible-minimum question arises.
- `t_clear` before `t_inactive` ⇒ neither; re-open the enumeration.

No CPU experiment was run: a task-private harness over the real score functions can only restate module semantics already legible in source, and cannot identify the firing caller — which is the entire open question. No simulated integration was produced, and no repair, patch or acceptance is proposed here.
