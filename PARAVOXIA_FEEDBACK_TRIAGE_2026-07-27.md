# Paravoxia feedback triage — 2026-07-27 (wave 5: the stuck EXTRACT latch)

Owner report (mobile, story mode): on the supply-pod beat (ch1-depth) "we had
an extract button on the previous chapter but the button went away when
transitioning to this, and furthermore the player is now non-stop extracting
and won't stop."

Predecessors: waves 1–4 in `PARAVOXIA_FEEDBACK_TRIAGE_2026-07-{20,21,26}.md`.
All lanes mechanical opus; zero fable spend. Status: **FIXED & VERIFIED.**

## Root cause (confirmed by code trace, then disproven live post-fix)

The EXTRACT hold-button (TouchDPad, ch1-fixed/raster only by design — pods
are walk-over recovery, no extract verb on ch1-depth) synthesizes `KeyE`
with **pointer capture**. On the raster→depth transition the per-beat spec
drops the button and React unmounts it mid-hold; a captured pointer on a
removed element fires no pointerup → `releaseKey('KeyE')` never ran → the
synthetic key stayed latched in the KeyboardControls state →
`harvestHeld` true every frame → non-stop extraction with no button left on
screen to release it. The existing unmount cleanup never fired because the
d-pad itself stays mounted across ch1 beats (only the button set changes).
The button's *disappearance* is intended; the missing *release* was the bug.

## Fixes

1. **Held-button reconciliation at the beat/grid seam** (the whole
   disappear-while-held class, not just EXTRACT):
   - `TouchDPad.tsx:96` effect keyed on the story beat releases any held
     arm/action whose button the new spec no longer renders
     (`dpadStaleHeldDirections`/`dpadStaleHeldActionIds` pure models;
     `heldActions` is now a Map id→code). Still-valid holds (◀▶, JUMP)
     deliberately carry across transitions — no blunt release-all.
   - `TouchControls.tsx:141` same discipline for the embodied grid
     (`staleHeldTouchActionCodes`): the concrete case is SPRINT hidden by
     build-mode/policy flips while held; codes shared by a surviving button
     (MINE/PLACE both KeyE) correctly carry over.
   - `mobileInput.ts` already had the synthetic-only pressed registry with
     idempotent press/release + `releaseAllKeys()` — unchanged, now
     covered by its own test file.
2. **ch1-depth mining gate** (defense-in-depth incl. desktop):
   `storyInputPolicy.ts` — new optional `allowMine?: boolean`, false only on
   `ch1-depth`; `EfficientPlayer.tsx:1950` gates the `updateMining` input on
   `allowMine !== false`. Build placement unaffected; every other beat
   unchanged (undefined = allowed).
3. Checked-clean same-pattern sites: BuildIndicator tapKey (momentary,
   self-releasing), look-drag (stateless), joystick (surface never
   disappears mid-hold), existing `releaseAllKeys` overlay seams.

## Verification

- Unit: +20 tests (mobileInput registry 8; d-pad/grid reconcile 12) plus the
  ch1-depth/neighbours `allowMine` policy test. Full
  `npm --prefix main run verify`: **261 files / 1950 tests green**.
- Live story-verifier battery: **VERDICT PASS** (trusted pointer events on
  the real on-screen buttons, touch mode via ≤820 px viewport):
  - **A (owner's exact sequence)**: EXTRACT held across raster→depth —
    exactly one KeyE keydown and one keyup, the keyup fired AT the beat
    seam (definitive registry proof); button gone from DOM; on depth
    mining never active, inventory flat over 15 s, zero `mine` SFX admits.
    (The +1 item at beat entry is the scripted pod-recovery grant — proven
    with a no-hold control run.)
  - **B (carry-over)**: held ▶ survives the same transition (x advanced
    +8.9 across the boundary, no spurious release; clean stop on real
    release).
  - **C (sprint class-fix)**: SPRINT held → build-mode flip → ShiftLeft
    released, no stuck sprint after leaving build.
  - **D (desktop gate)**: holding E 10 s on the ch1-depth pod row = zero
    extraction; same harness on ch1-raster = +10 items (gate correctly
    scoped to depth only).
  - **E (regression)**: full ch1 ladder honest in 109 s, zero rescues,
    zero page errors, zero SFX loop-guard engages; autopilot completes
    depth without mining and raster extraction still fills quotas.
  - All probe servers confirmed killed.

## Owner notes

1. Design confirmation: ch1-depth intentionally has no EXTRACT (walk-over
   pods). If you'd rather it exist there, it's a one-line
   `dpadActionForBeat` + `allowMine` matrix change — say so.
2. Device check: replay your sequence (hold EXTRACT through the raster→depth
   transition). Expect: extraction stops at the transition; ◀▶/JUMP holds
   carry over; E does nothing on the pod row.
3. The worktree now carries FIVE green-verified uncommitted waves —
   committing in coherent batches remains the top recommendation.
