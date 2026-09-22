# Score audit — Stage 2 (game mix)

Reviewer: score-continuity-auditor (opus), read-only, independent; filed verbatim by the orchestrator. Contract draft-v3 sha 776d676b…6ba1.

## Verdict: **PASS-WITH-DEFECTS** (Stage 2 game mix)

The shipped tail, buses, duck matrix, snapshot mixer and event queue are built as designed, share one function between live and offline mirror, are tested, and are backed by combined-bus renders. Three contracted acceptance terms are measurably not met, one contract sentence is contradicted by what physics requires, and one Stage 3 hazard (C6) is arithmetically stale. None of these is a code defect I would route back to the builder; all are contract/owner decisions.

---

### 1. Contract fidelity — tail order and the reference gain

Shipped order confirmed in source, not just prose: `/home/thomasphillip/Projects/vox/main/src/audio/audioCore.ts:899-947` (`createMixTail`) builds music → glue (`:954`) → safety −6/20/knee3/3 ms/0.1 s → trim (`:981-996`) → `musicDuck` → `masterOutput`; SFX category buses join at `masterOutput` (`:930-940`, diegetic through one muffle, `ui`/`voice` dry per `mixTuning.ts:80`); limiter −1/20/knee0/1 ms/80 ms → trim → 4× ceiling → route (`:1007-1031`). The offline mirror calls the **same** `createMixTail` (`:772`), so mirror/live parity is structural, not asserted. Route after the ceiling is unity (`:183-231`) — nothing re-amplifies downstream.

**D8 (Low, documentation).** `score.mixIntent` names the order "glue, true-peak limiter, safety device". Only the post-join limiter can protect the sum, which is what every stress-TP measurement is taken on. The shipped order is right; the sentence is wrong. Repair: amend `mixIntent` to the shipped chain. Route: score director → contract amendment.

**D1 (High, loudness architecture — the ruling you asked for).** `TAIL_REFERENCE_GAIN_DB = 1.99` (`mixTuning.ts:37`) rides on the safety trim (`audioCore.ts:983-985`). My judgement: **it honours the rule's intent and violates its letter, and the letter is what should change.** The rule exists so that (a) no stage can lift an authored quiet, and (b) no gain is hidden inside a vendor compressor curve. Both hold: the constant is static, named, unit-tested (`mix/mixTuning.test.ts`), re-measured every run (`audio:check` `tail-reference −0.0074 dB`), and it is level-*preserving*, not level-*raising* — it reproduces the gain every Stage 1 term (bed −20.5, floors, bare/colour hashes) was measured through. Enforcing the letter would silently drop the whole game 2 dB and invalidate four signed measurements. Requested contract text: *"No dynamic and no hidden gain exists anywhere: every DynamicsCompressor's baked makeup is cancelled by a named measured trim. Exactly one static, named, tested reference gain (TAIL_REFERENCE_GAIN_DB) preserves the pre-Stage-2 level architecture; it is unity-in-effect, may only be changed by an owner re-level decision, and no other positive static gain may exist."* Route: score director drafts, owner ratifies at the audition. The alternative (2 dB re-level) is a taste decision, not a defect repair.

### 2. Limiter honesty

It is a **strong bound with measured margin, not a guarantee.** The shaper `y = x/(1+|x/c|⁶)^(1/6)` has an asymptote at c, so sample peaks are mathematically bounded below −1 dBFS; the residual risk is the 4× resampler's reconstruction, measured at <0.01 dB, with worst case −1.58 dBTP on a +12 dBFS burst (0.58 dB spare) and −4.92 dBTP worst on real shipped material. **No worklet is warranted.** Requested wording change: the contract should say "bounded ceiling, measured margin ≥0.5 dB at +12 dBFS" rather than "true-peak limiter"; keep the CEILING_DBTP → −1.5 escape hatch documented.

### 3. Duck matrix

`mix/duckMatrix.ts:39-61` matches the treatment table row-for-row; measured depths land within 0.0 dB and attacks inside the specified windows (ab-results duck rows). The −3 dB cap (`duckMatrix.ts:74`, state from `sfxEngine.ts:442`) **does** respect story authority and the floor laws: ducks only subtract, envelopes end at unity and never above, start-anchored via `scheduleMusicSceneEnvelopeParam` (`audioCore.ts:571-588`) — SYMPHONY LAW compliant (named slews, held-value anchor, 3-tau in `rampParamAt:695`), corroborated by 0 smoothness violations across three batteries.

**D10 (Low).** The cap is resolved at schedule time only: a beat that begins mid-duck leaves a −6 dB duck under the score for up to ~1.04 s. Accept-and-document, or re-resolve on story-lead onset. Route: score director, Stage 3.
**D9 (Low).** `voice` (−9 dB, the deepest row), `lifecycleCue`, the `station` snapshot state and `roomPresetId` have no live driver (`sfxCategories.ts:42-47`, `mixSnapshot.ts:62`). Legitimate Stage 4/6 plumbing, but the contract should label them inert-this-run so the audition isn't credited for untested depths.

### 4. Snapshot mixer

`mixSnapshot.ts` is pure; sandbox/menu are unity by law; music is never re-levelled (`audioCore.ts:1076` guard); writes are dirty-checked and slewed 0.6 s (`:479-486`). Precedence station > dive > story-lead > menu > sandbox is deterministic. **D11 (Low):** two doors write the SFX muffle (`setMixSnapshot` and `setSfxSubmerged:453`); only the offline rim uses the second today, so no live conflict — worth a single-authority comment.

### 5. Event queue / metronome

**D7 (Medium-low, contract fidelity).** The contract and treatment say "flushed once per frame, deduped by `(id, frame)`". Shipped is deduped **per flush**: `audioEventBus.ts:54-58` flushes on a microtask and `audioEventQueue.ts:53` clears `queuedThisFrame` on flush, so two posts of the same id in the same frame but different tasks both sound (`previous === frame`, not `frame − 1`, so the held-level law does not catch them either). The design choice (no added latency) is right; the wording is wrong. Repair: either key `queuedThisFrame` to the frame and clear on frame change, or amend the contract to "deduped per flush within a frame, held-level across frames". Metronome regression risk is **low and evidenced**: suppressed/3 s fell 5 → 0 with the loop guard never engaging — the structural queue now absorbs what the rate limiter used to, and the limiter/guard remain untouched as backstop (`sfxEngine.ts:311`).

### 6. BLOOM — where the window belongs

**D2 (High, acceptance not met).** −17.90 vs −14 ±1. **Rule: the window belongs to the arrangement (Stage 5), not the tail, and BLOOM_ST_LUFS should not simply be retargeted to hide the miss.** A subtract-only, makeup-free tail can only *reduce* short-term-minus-integrated spread; asking it to add 4 LU of crest is asking for the compressor-as-expander it was explicitly forbidden to be. The tail's total available authority is measured at 0.21 LU. Settling evidence, in order: (a) pre-tail S-max − I spread per excerpt (already ~2.5 LU vs the 6.5 LU required — publish it as a named `composedSpread` field); (b) a Stage 5 offline probe with a BLOOM-only arrangement rail showing S-max −14 ±1 **while** bed-alone I stays −20.5 ±1 and TP ≤ −1 on the same four beds; (c) owner A/B of that render against today's. Until (b) exists, record −17.9 as the measured Stage 2 value with the −14 term **deferred to Stage 5**, not waived.

**D5 (Medium).** Stress-script integrated −20.4…−21.7 vs −18 ±1.5 is the same architecture question: the −18 sum presumes SFX energy the shipped recipes (0.012–0.09 linear) do not carry. Route both to one owner "loudness architecture" decision.

### 7. Latency / C6

| path | measured | source |
|---|---|---|
| music (glue+safety+limiter+shapers) | 25.215 ms | `mixTuning.ts:67`, `audio:check tail-latency` |
| SFX (limiter+ceiling) | 10.340 ms | `mixTuning.ts:68` |
| music − SFX skew | **14.875 ms (0.89 frame)** | `mixTuning.ts:70`, pinned `< 1/60` in test |

**D3 (High, Stage 3 hazard).** C6's literal trigger — "if LATENCY_COMP_MUSIC_PATH_S exceeds 16.7 ms and SFX-forward scheduling is not adopted, this signature does not cover Stage 3 captures" — **fires on 25.2 ms**, but its stated rationale ("the SFX-versus-image lead equals LATENCY_COMP_MUSIC_PATH_S") is now false because SFX also pass the limiter. The governing quantity is the 14.9 ms skew. My ruling: **do not delay SFX globally.** 14.9 ms is under one frame, and forward-scheduling SFX inside bundles (C6's own option) is the surgical fix for the three SFX-bearing bundles. Repair: cinematography director amends C6 to compare `LATENCY_COMP_MUSIC_VS_SFX_S` against 16.7 ms and to state that image members use device + music-path. This is not the score lane's to edit.

**D4 (Medium, precision).** The latency constants are published in **seconds, measured only at 44.1 kHz** (`excerpts.ts:1751`, `RENDER_SAMPLE_RATE`), while live contexts commonly run 48 kHz and the compressor pre-delay is frame-based — ~23.2 ms, a 2 ms (0.12 frame) error that `audio:check` structurally cannot catch. Repair: export `LATENCY_COMP_MUSIC_PATH_SAMPLES` (1112) / `_SFX_PATH_SAMPLES` (456) and derive seconds from `ctx.sampleRate` at arming. Cheap, and it protects the −1/+2 budget.

### 8–10. Attribution, mirror, tests

**D6 (Medium, term unmet, attribution confirmed).** 2276 → 590.4 writes/s; target <60. Source confirms the residual: `scoreEngine.ts:1241` `applyRails` runs unconditionally from the 60 ms `setInterval` scheduler (`:1052`, called at `:1070`) with no dirty check, 17 direct `setTargetAtTime` in the body plus helpers. Probe split (`after-param-writes.log`: setTarget 528/s, cancelAndHold 60/s) corroborates — though the README's arithmetic double-counts: applyRails contributes ~468/s of the 528, not 528. Correct the README line and add an explicit Stage 3 acceptance term ("applyRails dirty-checked, writes <60/s") or the deferral will rot. Mirror parity: structural (same builder function, `tail:'pre-tail'|'pre-stage-2'` taps). Tests: 8 new suites covering topology (live + mirror), matrix, snapshot, queue, bus, ceiling curve, dirty check and pinned constants; `verify` 2460 passing, `score:fps` 60.39, pure soak PASS.

### Taste risks for the owner audition (not defects)

1. The 0.1–0.3 LU rise at alive — is the removed programme squash an improvement or a lost glue?
2. Held-level law: two pickups in **consecutive** frames now sound once. Listen for a thinned mining pass.
3. The −3 dB story-lead cap: does a ship impact under a beat still read as an impact?
4. story-lead world bus −2 dB / dive −1.5 dB — the only new standing level changes.
5. The 2 dB question inside D1: keep today's level, or re-level down and re-baseline everything.

### Protected strengths

One `createMixTail` shared by live and mirror; every trim measured by the contract's own probe method and re-measured each run; combined-bus-only evidence; the honest limiter write-up; sandbox unity by law; the music bus untouched by snapshots; deviations declared rather than smoothed over.

### Single highest-leverage repair

**Split the loudness architecture out of Stage 2 into one owner decision packet (D1 + D2 + D5) and amend C6 to the 14.9 ms skew (D3) before Stage 3 opens.** Everything else is documentation or a two-line constant change; those two decisions are what Stage 3, 4 and 5 all depend on.