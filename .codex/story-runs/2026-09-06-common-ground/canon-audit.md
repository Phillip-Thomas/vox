Tools here are strictly read-only (no `Write`, `Bash`, or subagents), so the report is delivered below as the message deliverable. No file was created or modified.

---

# Paravoxia — Independent Story-Canon Audit
### Preproduction story-council pass · 2026-09-06 · READ-ONLY · no treatment proposed

**Authority walked, in precedence order:** `main/story-authority.json` → `main/src/story/storyState.ts` + `storyDirector.ts` + `emergentStoryDirector.ts` + `beats/` → `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` → `main/PARAVOXIA_STORY_BIBLE.md` → `main/PARAVOXIA_STORY_EXECUTION_PLAN.md` → `main/chapter-registry.json` → `.codex/production-runs/2026-08-11-ch10-station-introduction/{station-continuation-contract.md, run-summary.md, scene-contract.json}` → `.codex/production-runs/2026-09-05-after-the-hearth/{production-lock.md, README.md, initial-worktree-status.txt}` → shipped station/return runtime.

---

## 0. Source limitations — read these before trusting anything below

- **L-1.** `Bash` is unavailable. I could not run `git status`, `git log`, `npm run verify`, or any probe. **No claim here is a runtime verification.** Working-tree state is taken from the recorded snapshot `.codex/production-runs/2026-09-05-after-the-hearth/initial-worktree-status.txt`, which is at least a day old; current git state is unverified.
- **L-2.** Subagents are unavailable, so this is a single-pass read. I prioritised the commissioned surface — the endpoint after the station — over an exhaustive both-readings sweep of Prologue–ch4. **This is not a full line-by-line sweep of `storyScript.ts`, `prologue/*.tsx`, `feed/*.tsx`, or `senseDiscovery.ts`.**
- **L-3.** Per the commission ("you receive no peer treatment or other review") I deliberately did **not** read `story-intent.md`, the director treatments, `cohesion-judge.md`, `naive-audience-report.md`, `decision-brief.*`, or the candidate at `.codex/story-runs/2026-09-06-common-ground/`. I read only their existence and the two governing records (`production-lock.md`, `README.md`). Independence is preserved at the cost of not knowing what the council has already concluded.
- **L-4.** The `2026-09-05-after-the-hearth` run directory contains a *complete* artifact set including `implementation.diff`, `final-scorecard.json`, `cohesion-judge.md` and `verification-report.json`, while its own `production-lock.md:3` says "locked for preproduction" and its `README.md:7` says "No runtime or current canon changes have been made." **I could not determine whether those artifacts are populated or template-inherited.** A next chapter must verify before citing any of them as evidence of a completed review.

**Exact authority paths (the ones that actually bind):**

```
main/story-authority.json                                  # precedence, ceilings, locked questions
main/src/story/storyState.ts                               # StoryBeat union, resume derivation
main/src/story/beats/{definitions,metadata.generated}.ts   # de-facto authored beat data (see SA-02)
PARAVOXIA_DEMO_FOUNDATION_PLAN.md:5-17                     # 2026-07-28 gate lift + sequencing constraints
main/PARAVOXIA_STORY_BIBLE.md                              # canon, confirmed direction, protected ontology
main/chapter-registry.json                                 # signed chapter/contract registration
.codex/production-runs/2026-08-11-ch10-station-introduction/scene-contract.json          # signed ch10 rail
.codex/production-runs/2026-08-11-ch10-station-introduction/station-continuation-contract.md  # R12 sidecar
.codex/production-runs/2026-09-05-after-the-hearth/production-lock.md                    # Stage 1 lock
```

---

## 1. Findings, ranked by threat to the goal plot

### GAP-01 — CRITICAL — The payoff of the entire station movement is silent

The bonded-cell installation is the terminal act of chapters 10 → station → return. Terra notices cold, exhausts self-sufficiency, asks a stranger, flies a claimed bearing, is processed by a counter, is issued a sealed thing, carries it across a system, and installs it in the fire she built.

```ts
// main/src/story/world/TidegardenSettlementWorld.tsx:310-321
return {
  id: 'story-ch12-install-bonded-cell',
  verb: 'Install the Sealed Bonded Cell',
  perform: () => { const result = installTidegardenBondedCell({...});
                   if (result.changed) saveGlobal(...); }
};
```
```ts
// main/src/story/stationReturnStory.ts:132-133
markMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId);
markMilestone(STATION_RETURN_MILESTONES.hearthRestored, actorId);
```

Two milestones, one save. **No `showCaption`, no `showAuditLine`, no score anchor, no HUD acknowledgment, no work-order clear line.** Compare the beat it is answering:

```ts
// main/src/story/emergentStoryDirector.ts:1487  (ch9-hearth closer)
showCaption('(one fire behind you. one fire here. home is the distance you can keep alive.)', 6500);
```
```ts
// main/src/story/emergentStoryDirector.ts:387  (K11, ch10 closer)
const K11 = '(both fires behind you now. ahead, a light someone else keeps alive.)';
```

The game has an eloquent closer for *leaving* and none for *returning*. **The current narrative endpoint of Paravoxia is a silent inventory decrement.** Every downstream chapter inherits a movement whose thesis was never stated, and the emotional debt of that silence is the largest single liability in the shipped build.

This is also the highest-leverage *opportunity*: it needs no owner-only decision, no new ontology, and no new mechanic.

---

### VO-01 — CRITICAL — The perspective law and shipped practice have silently diverged

Bible law:

> `main/PARAVOXIA_STORY_BIBLE.md:1183-1186`
> - **Pre-conscious Terra** speaks in lowercase parentheses. Parentheses mean a private thought not yet permitted to become speech.
> - After the first "i—", Terra's embodied interior voice **must not return to parenthetical grammar.**

Shipped practice, from `ch4-defy` onward, is overwhelmingly parenthetical:

```
emergentStoryDirector.ts:950   '(the world exhales where it had been holding still.)'
emergentStoryDirector.ts:1414  '(a world does not begin when you see it. it begins when it holds your weight.)'
emergentStoryDirector.ts:1487  '(one fire behind you. one fire here...)'
emergentStoryDirector.ts:377   K1  '(the hum has dropped a step...)'
emergentStoryDirector.ts:380   K4  '(a world gives stone, water, wood. it does not give this...)'
emergentStoryDirector.ts:382   K6  '(the channel at the wreck never closed...)'
emergentStoryDirector.ts:385   K9  '(the answer came back before the asking finished.)'
emergentStoryDirector.ts:386   K10 '(issued, not offered. the going is still yours.)'
emergentStoryDirector.ts:387   K11 '(both fires behind you now...)'
```

Chapter 10's *entire* narrator register is parenthetical. So either the bible's law is stale, or every chapter since A4 violates it.

**My reading of the evidence:** the runtime has re-specified the grammar, coherently and probably better. The **bare** lines are exactly the *acts* — the moments Terra commits rather than observes:

```
emergentStoryDirector.ts:898   'no.'
emergentStoryDirector.ts:1093  'the scar remains. now it can carry me.'
emergentStoryDirector.ts:1217  'nothing answers. the query does not close.'
storyDirector.ts:1558          'i—'
```

That is a real and elegant system: **parentheses = observation addressed to no one; bare lowercase = a claim Terra is willing to own.** But it is *unwritten*. A next chapter will either (a) inherit the shipped grammar without knowing it is unratified, or (b) "correct" ch10 toward a bible law that ch5–ch9 already abandoned. Both are damage.

**Minimal fix:** ratify the shipped grammar in the bible §8. Do **not** de-parenthesise ch10. This is a canon-record repair, not a copy repair.

**Compliance that is exemplary and must be protected:** the lift owns the first "i", the pre-lift line is impersonal, and the ordering is explicit in code —

```ts
// main/src/story/storyDirector.ts:1553-1558
// Consciousness arrives WITH the perspective: the watcher's parenthetical
// voice all the way in (pre-lift grammar), then the first pronoun in the
// story — the story's first BARE lowercase line, one flicker before the feed clamps.
if (t >= 2.4) fireCaptionOnce('lift-inward', '(the seeing is being moved inside.)');
if (t >= 5.4) fireCaptionOnce('lift-i', 'i—');
```

---

### SA-02 — HIGH — The declared beat authority no longer holds the authored beats, and the module that does is untracked

`main/story-authority.json:12` declares `"runtimeBeatAuthority": "src/story/storyState.ts"`.

But `storyState.ts` now *delegates*:

```ts
main/src/story/storyState.ts:2            import { BEAT_METADATA } from './beats/metadata.generated.ts';
main/src/story/storyDirector.ts:1-2       import { resolveMarkerTarget } from './beats/markerTargets.ts';
                                          import { BEAT_METADATA } from './beats/metadata.generated.ts';
main/src/story/storyObjectiveGuidance.ts:3-5   BEAT_DEFINITIONS + `export * from './beats/objectivePrimitives.ts'`
main/src/story/storyInputPolicy.ts:3-6         `export * from './beats/inputPrimitives.ts'` + BEAT_DEFINITIONS
main/src/story/autopilot/rails.ts:3            BEAT_DEFINITIONS
```

**Every player-visible ch10 marker label and work-order line now lives in `beats/objectivePrimitives.ts:478-580`, not in `storyScript.ts`.** The beat registry is real (`beats/registry.ts:10-42`) and the director already reads it for reactivation (`emergentStoryDirector.ts:1593`).

And per the run's own recorded snapshot:

```
.codex/production-runs/2026-09-05-after-the-hearth/initial-worktree-status.txt:228
?? main/src/story/beats/
```

**The entire authored-beat tree is untracked**, alongside 100+ modified story/audio/tool files (lines 1-154). Subject to L-1 (I could not re-check git today), the current source of narrative truth is uncommitted, concurrently-owned work.

**Consequence for a next chapter:** it must declare, in writing, *which* module it authors into. Adding a chapter to `storyScript.ts` today would put it in the wrong place; adding it to `beats/` writes into someone else's in-flight refactor. `story-authority.json`'s `sources` block needs a `beats/` entry before any new beat is authored. Per `CLAUDE.md:40-44`, do not "fix" a module someone is actively splitting.

---

### SA-03 / DD-01 / DD-02 / DD-03 — HIGH — Three of the top five canon documents stop one whole chapter short

| Record | Claim | Contradicted by |
|---|---|---|
| `main/STORY.md` | content ends at the ch4 era; `## Known gaps / next` (line 276) defers forward | ch5–ch10 shipped. `run-summary.md:134` admits "`main/STORY.md` still ends at ch4-arrival" |
| `PARAVOXIA_STORY_BIBLE.md:1381` | "The state machine now contains every beat from the crawl through `ch9-hearth`, then enters `done`." | `storyState.ts:107` — `'ch10-cold' \| 'ch10-ask' \| 'ch10-transit'` |
| `PARAVOXIA_STORY_BIBLE.md:1384` | runtime ceiling `ch9-hearth` | `story-authority.json:7` — `"runtimeStoryCeiling": "ch10-transit"` |
| `PARAVOXIA_STORY_BIBLE.md:329-339` (A0–A8 table) | no ch10 row; A4 still `WORKTREE-IMPLEMENTED` | ch10 registered in `chapter-registry.json:1934` |
| `PARAVOXIA_STORY_EXECUTION_PLAN.md:146-156` | implementation lane described as `ch4-audit` → `ch9-hearth` | same |

`STORY.md` is canon rank **2** in the auditor's own precedence list and is `story-authority.json`'s declared `shippedOverview`. It currently describes a game two chapters and one station visit behind the runtime. **A next chapter cannot use rank-2 or rank-5 documents to answer "what shipped".** Only `storyState.ts` + `beats/` + `emergentStoryDirector.ts` + the two station modules are trustworthy on that question today.

---

### CT-01 — HIGH — A concourse trader can be seeded with the name "Nine"

```ts
// main/src/game/spaceStation/spaceStationVendors.ts:55-58
const VERNACULAR = [
  'Six', 'Kite', 'Marget', 'Pell', 'Third', 'Bell', 'Onni', 'Vask',
  'Dray', 'Salt', 'Nine', 'Tam', 'Ro', 'Wick', 'Hob', 'Esk'
];
```

Vendor display is `${designation} · ${name}` (`StationStoryPanel.tsx:56`; `spaceStationStory.ts:258`). A seeded stall can therefore read **`R-4102 · Nine`** on the marker and in the panel header.

"Nine" is the game's single most protected identity (`PARAVOXIA_STORY_BIBLE.md:205-232`; `story-authority.json:296` `worker9-reveal-timing` is a locked question). The `station-continuation-contract.md:84` protected-unknown list even guards against a *reflex* being attributed to Worker 9 — while the name itself sits in a random pool. A player who has been told to notice names since the prologue naming beat will read a trader called Nine as a deliberate plant, and will be wrong.

`'Six'` and `'Third'` carry a milder version of the same problem (numeric worker-style vernacular). **Cheap, zero-canon fix: remove `'Nine'` from the pool.** This is ordinary hygiene, not an owner decision.

---

### RG-02 — MEDIUM — The registry's ch10 reveal record now contradicts what ships

`main/chapter-registry.json:2027` registers `scene:ch10-station-introduction@draft-v9#reveal:r5-non-spends`, whose text is:

> `scene-contract.json:306` — "the hard non-spends: **no warp, no W-7744, no Makers, no crowd, no interior**, no station proper name, no Worker 9 trace"
> `:311` — "Authored absence, contracted as such: no line, no frame, no cue in this run may reference any of these."

Shipped today: `main/src/components/spaceStation/SpaceStationCrowd.tsx`, `SpaceStationInterior.tsx`, a concourse, an apron, seeded vendors with personas, and a full interior light contract (`2026-09-04-station-interior-light`).

The supersession is legitimate in substance — `station-continuation-contract.md` is explicitly "a separate post-Chapter-10 movement" with owner authorization 2026-08-14 — but it is a **markdown file with no tri-signature and no registry entry**, while the registry still points a signed reveal at the old prohibition. `run-summary.md:134` lists "formal registration of the R12 sidecar as ch11/ch12 StoryState beats" as *deferred*.

**A next chapter must not inherit r5 as live.** It must also not assume the R12 boundary carries the same signed weight as draft-v9.

---

### RG-01 — CORRECT, AND MUST BE PROTECTED — ch11/ch12 are namespaces, not chapters

Verified, and the codebase is honest about it:

- `storyState.ts:79-108` — `StoryBeat` union ends `'ch10-cold' | 'ch10-ask' | 'ch10-transit' | 'done'`. **No ch11, no ch12.**
- `storyState.ts:250` — `if (hasMilestone(ch10Complete)) return { chapter: 'complete', beat: 'done' }`. The station visit and the return both happen inside `done` free play.
- `chapter-registry.json:1934-2136` — ch10 is the last chapter object, `"after": []`. No chapter covers the station or the return.
- The ch11/ch12 strings exist only as milestone ids: `spaceStationStory.ts:29-39`, `stationReturnStory.ts:16-21`.
- Player-facing header is correct: `SpaceStationSandbox.tsx:1425` → `STATION VISIT · ISSUED COMPONENT`, never "CHAPTER 11", exactly as `station-continuation-contract.md:7-9` requires.
- `production-lock.md:9` states the distinction explicitly.

**This is intentional design, not a defect.** A next chapter must preserve it, and must decide *deliberately* (not by drift) whether it registers as ch11 — which would collide with the reserved namespace — or as a further sidecar.

---

### GAP-02 / GAP-03 / DD-04 / DD-05 — MEDIUM — The station's most loaded moments are under-voiced, and the contract's copy is not the shipped copy

`station-continuation-contract.md:25-27` specifies apron REGULATION copy:

> `THRUST COLD · CLAMPS ENGAGED.` / `PRESSURE EQUALIZING.` / `ENTRY REQUIRES A DESIGNATION RECORD · PROCEED TO COUNTER.`

**None of these strings exist in `main/src`.** (Greps for `EQUALIZ`, `CLAMPS`, `DESIGNATION RECORD ·` return only physics constants and unrelated identifiers.) The apron — the first inhabited, administered, public place Terra has entered since refusing the Authority — is narratively silent. **GAP-02.**

`station-continuation-contract.md:32` places `(your body takes its place before the marker does.)` at the counter "before the action". Shipped:

```tsx
// main/src/components/spaceStation/SpaceStationSandbox.tsx:1435  (HUD, step 'registry')
<div ...>(your body takes its place before the marker does.)</div>
```
```tsx
// main/src/components/spaceStation/StationStoryPanel.tsx:89  (panel, after registryRecorded)
<Line low>(the suit is accepted before you are.)</Line>
```

The second line is **excellent** — it is the best line in the station visit and it survives both readings cleanly (a worker whose paperwork precedes him; a system that authenticates a designation rather than a person). It is also **in no ledger**: not in the continuation contract, not in `shipped-ux-baseline.json`'s low-line list, not in the ch10 reveal ledger. **DD-05.** A ledger that does not contain the shipped copy cannot defend the pillar.

Departure carries one line, and it is on the objective HUD rather than the caption channel — presentationally a work order, not a thought:

```tsx
// SpaceStationSandbox.tsx:1441
(one fire waiting. carry back what the world could not give.)
```
**GAP-03.**

**DD-06:** `station-continuation-contract.md:84` protects "no statement that the queue reflex belongs to Worker 9" — there is no queue reflex in shipped copy. A protected-unknown guarding an asset that was never built; harmless, but it shows the contract text has drifted from the build.

---

### VO-03 — MEDIUM — The concourse gives away the first person for free

```ts
spaceStationVendors.ts:173  'weight or volume? i price both, you will prefer one.'
spaceStationVendors.ts:178  'i can attest to all of it. i can attest to the attestation, if you like.'
spaceStationVendors.ts:186  'i keep two ledgers. the interesting one is not on the counter.'
StationStoryPanel.tsx:105   'bonded cell. habitat grade. one left with a clean seal.'
StationStoryPanel.tsx:115   'the cell carries an issuance record. break the record and the core will not take it.'
spaceStationStory.ts:300    'nothing i am permitted to have an opinion about.'
```

Against bible §"Rank-issued selfhood" (`:1194-1197`): *"Auditors casually say 'I' because rank permits it. Workers are not issued a first person. W-7744's easy 'I' must continue to contrast with Terra's earned one."*

The station is the first place in the game where a **crowd** of ordinary people uses the first person casually, in Terra's own bare-lowercase register. It is defensible — traders are a civil economy, not site labour, and their lowercase reads as vernacular rather than rank — and `spaceStationStory.ts:300` ("nothing i am permitted to have an opinion about") is a genuinely fine Kafka line. But the rule is **unwritten**, and the game's scarcest token is now spent freely by seeded NPCs.

Before a next chapter writes more station characters, this needs one sentence of canon: *who on a station is issued a first person, and in what register.* That is ordinary craft, not an owner-only decision — but it must be written down or it will be decided by accident.

---

### TL-01 / TL-02 — Timelessness

**TL-01 — clean.** Greps across `main/src` for `pronoun|gender|identity politic|diversity|inclusi` return only shader tuning, biome variables and palette scores. No shipped line pattern-matches a contemporary flashpoint. The satire is bureaucratic, not cultural. **KEEP.**

**TL-02 — one word to raise.** "Resettlement" is used as cargo provenance:

```
spaceStationVendors.ts:81   'the last resettlement took half a pallet and gave back a different one'
spaceStationVendors.ts:234  'the resettlement took a bonded pallet with it'
spaceStationStory.ts:318    'it entered resettlement as one lot. it came back with more history than weight.'
```

Read once, it is fine Kafka. Read twice — goods returning from a *resettlement* with "more history than weight" — it lands on the property of deported populations. That is not a culture-war trip-wire, but it is the one shipped word that borrows a specific real-world atrocity vocabulary rather than inventing a Paravoxia-native one (bible §"Names remain Paravoxia-native", `:1312-1316`). Flag for an owner taste call **before** the station's vocabulary is extended; a coined term would carry the identical chill without the borrowing.

---

### SA-01 — MEDIUM — `story-authority.json` is internally half-updated

`snapshotDate: 2026-07-15`, yet `runtimeStoryCeiling` was advanced to `ch10-transit` (`:7`) and the ch10 evidence chain added (`:245-277`). Meanwhile `activeProduction` (`:55-62`) and `dynamicSources.ownerApprovedSceneContract.activePath` (`:43`) still name `2026-07-13-distance-between-fires`, three production runs ago. `main/chapter-registry.json:29-39` registers `ch10-station-introduction@draft-v9` that the authority file's active-production block does not know about. `run-summary.md:134` lists "multi-production registration in the authority gate" as an open deferral — i.e. the schema itself cannot express two live productions.

**Not blocking, but a next chapter cannot register itself cleanly until this is resolved.**

---

## 2. Fact ledger — separated by reveal level

### Shipped and reachable (player-visible)
- Beats `crawl` → `ch10-transit` → `done` (`storyState.ts:79-108`; `chapter-registry.json`).
- Chapter 10: the second hearth's core runs on **one bonded cell**, degrading; it is an **issued component** and fabrication is **not authorized**; the wreck relay channel is still open; a **source exists in this system**; a bearing is attached, **advisory**; the answer returns before the asking finishes; a station resolves at standoff. (`emergentStoryDirector.ts:377-387`, `1850-2094`.)
- The station visit: docking, a **counter** that accepts designation **W-7743** and records a need; concourse access; **B-7073 "Bell"**, certified components; one sealed `bonded_cell` issued against that designation; a cargo receipt; general trade unlocked only after the story cargo is secure; departure; return to Tidegarden; installation. (`spaceStationStory.ts:29-284`; `StationStoryPanel.tsx:62-135`; `stationReturnStory.ts:56-135`.)
- A civil economy exists: ore, water, polymer, **sealed parts, attested grain, allowances, aged lots**; tariffs; a seal office; queues; resettlements; haulers. (`spaceStationVendors.ts:88-105, 157-191, 232-239`.)
- ST-0: an unmarked moving point of light at the station's true bearing, seen at the second hearth. (`run-summary.md:16-20`.)

### Player inference (supported, never stated)
- **The relay answered too fast.** `K9` (`emergentStoryDirector.ts:385`) states only speed. The signed ledger names this the run's single pillar spend: r1, `"levelBefore": "author-only"` → `"levelAfter": "player-inference"`, evidence = *"The reply's speed, and one lowercase line… The line states only speed, never meaning… Leak risk: a knowing caption."* (`scene-contract.json:246-260`.)
- **Terra re-entered the Authority's paperwork voluntarily**, and was accepted as W-7743. Inferable from `StationStoryPanel.tsx:74` + `:89`. Never commented on.

### Contracted (authored, not shipped)
- Apron REGULATION copy (`station-continuation-contract.md:25-27`) — **DD-04**, unshipped.
- The reserved ch11/ch12 chronology and its eleven receipts (`:52-62`) — the receipts ship; the chapter registration does not.

### Author-only / protected-open (must not be resolved)
From `story-authority.json:290-302` — `player-third-consciousness-mapping`, `third-consciousness-form-and-mechanics`, `third-consciousness-persistence-and-separability`, `third-consciousness-evidence-grammar`, `worker9-reveal-timing`, **`w7744-return-cause`**, `greater-threat-ontology`, `maker-identity-number-and-motive`, `terra-authorship-literalness`, `simulation-status`, `final-frame-ontology`.

From `scene-contract.json:293-313` — r4 *"who issues; whether she asked herself"* stays `author-only`, *"budgeted to A7/A8; nothing this run may touch it."*

From `station-continuation-contract.md:77-85` — no station proper name; no credit-balance explanation; no claim about W-7743's wider legal status; no W-7744 aboard or in records; no Makers/greater threat/Terra-origin/station-builder answer; no sealed-volume explanation; no vendor recognition of Terra; **no definition of the bond beyond an issuance record the core accepts**.

Shipped copy honours the last one exactly: `StationStoryPanel.tsx:115` — *"the cell carries an issuance record. break the record and the core will not take it."* Nothing more. **This is disciplined work.**

### Explicitly NOT credited to the shipped experience
No player-visible evidence exists in the shipped build for: **Worker 9's survival**, the **shared body**, the **third consciousness**, or **W-7744's future motives**. The ch10 contract states the Worker 9 non-spend as deliberate: *"any Worker 9 trace is a hard non-spend this run — the authored withholding is the evidence"* (`scene-contract.json:220`). The last W-7744 fact on screen remains `emergentStoryDirector.ts:724` — `'(something tore free when he ran.)'`.

---

## 3. Character and causal spine, as of the shipped endpoint

### Terra
- **Desire:** keep the second fire alive. Not a resource goal — `ch9-hearth`'s closer already defined home as *"the distance you can keep alive"* (`:1487`).
- **Opposition:** a category of thing a world does not produce. `K4` states it as ontology, not inventory: *"a world gives stone, water, wood. it does not give this. this was issued."* (`:380`.)
- **Tactic:** exhaust self-sufficiency **on camera** first (read the fault → attempt fabrication → be refused), then ask. `beats/ch10/ch10-cold.ts:44` names this precisely: *"Exhausts self-sufficiency on camera before anything is asked of another party."*
- **Belief turn (shipped):** `K6` — *"the channel at the wreck never closed. asking is still a thing that can be done."* The self that refused the system now voluntarily addresses it.
- **Unpaid setup — the strongest one in the build:** she presented the suit record. `W-7743 · RECORD ACCEPTED` (`StationStoryPanel.tsx:74`). She is **back in a registry**, by choice, and the game has not charged her a single line for it. `(the suit is accepted before you are.)` gestures at the cost and then the movement ends in silence (GAP-01).
- **Micro-arc that works:** `K10` — *"issued, not offered. the going is still yours."* Being answered is not being rescued.

### Worker 9
- **No shipped movement since ch9.** The registry's last trace is `chapter-registry.json:1828` → `rev-worker9-trace`. Desire, opposition and tactic are all author-only.
- **Thread open:** everything. `worker9-reveal-timing` is locked (`story-authority.json:296`); the clue ladder at bible `:945-960` is explicitly *recommended staging*, not owner-locked.

### W-7744
- **Last shipped act:** he ran, and something tore free (`:724`).
- **Confirmed direction:** he recurs, begins opposed, recognises Terra is not the greatest threat, awakens on his own (bible `:249-262`, `:1330-1332`).
- **Locked:** his **reason for returning** — twice. Once as `w7744-return-cause` (`story-authority.json:297`), once as a Before-A5 gate (bible `:1782`: *"Define W-7744's reason for returning and what he believes Terra has done."*).
- **Threads open:** whether he concealed his fault; whether he was believed; whether the fault progressed.

### Thematic events driven only by a timer or fallback
I found **one class** worth naming, and the code is honest about it. The ch10 beat advances are dwell-gated on reading time rather than on player acts:

```ts
// emergentStoryDirector.ts:1880-1887
if (runtime.elapsed < runtime.completionObservedAt
  + regulationRevealSeconds(K5) + CH10_REGULATION_DWELL_SECONDS) return;
markMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId);
advanceToBeat('ch10-ask');
```

This is defensible — the *act* (`commitChapter10FabricationAttempt`) already happened and the timer only protects the line from being cut. Contrast the one place a timer was correctly refused:

```ts
// beats/objectivePrimitives.ts:537-538
// The rite. It waits indefinitely and never acquires a timer, a nudge, or
// an automated claim — the wait IS the meaning.
```

**No thematic event in ch10 occurs *because* a timer fired.** Clean. Worth preserving as a standard.

---

## 4. Reveal budget and rendering/perception rules for a next chapter

### A4 → A5 — the rendering ceiling
- A5's trigger is **the first interstellar warp**, thrice restated: bible `:52-53`, `:336`, `:1505-1511`. *"That nearby crossing does not trigger A5"* (`:157`); *"Continuous travel to a sibling planet may occur as an Emergent story movement, but it does not replace A5's canonical first-warp trigger"* (`:376-379`).
- The station is **inside the local system** — `storyStationAddress()` resolves from `STORY_COORDINATE` (`spaceStationStory.ts:86-89`).
- **Therefore: a station-adjacent chapter renders at A4/`alive` stage.** No full light quality, no post-effect escalation, no resolved interstellar space.
- **Available without spending A5:** micro-awakenings — *"brief gains in chromatic, geometric, material, temporal, biological, relational, historical, symbolic, causal, or ontological resolution"* (bible `:356-362`). The **relational** and **historical** axes are entirely unspent and are exactly what a station of other people affords.
- **Owner-only if approached:** any A5 timing or rendering change. The Before-A5 gate list (bible `:1780-1785`) is the exact question set.

### W-7744 recurrence and limited cooperation
- **Permitted without a new decision:** his **presence**, his **opposition**, his **observable acts**, his **concealments**, and a **perceptual fault the player sees but he does not explain**. Recurrence is CONFIRMED DIRECTION (`:1330`).
- **Owner-only:** *why he came back* (`w7744-return-cause`; bible `:1782`), and any **cooperation as a settled state**.
- **Hard rendering/perception rules, all already canon:**
  1. *"he remains partially opaque and is never exhaustively explained"* (`:260`);
  2. *"Terra cannot simply install its own way of seeing in him"* (`:261`);
  3. *"his decisive awakening must follow from his own attention, doubt, or refusal"* (`:262`);
  4. *"His turn must happen because he discovers something, not because Terra lectures him into agreement"* (`:942-943`);
  5. *"His actions, concealments, contradictions, and perceptual faults should carry the arc more than access to his interior monologue"* (`:1856-1858`);
  6. his easy issued "I" must keep contrasting with Terra's earned one (`:1194-1197`).
- **Corollary the council should hold:** a chapter may stage cooperation as a *transaction under duress* — two parties needing the same thing — without either party's belief changing. That is inside canon. A chapter may **not** stage cooperation as trust, forgiveness, or recognition.

### Worker 9
- **Permitted:** nothing new that is legible as Worker 9.
- Bible `:950-955` offers the ladder (bodily knowledge Terra cannot source → emotion before interpretation → mismatched memory → a motif that survives fidelity change) but explicitly as **recommended staging**, and `worker9-reveal-timing` is locked.
- **A chapter may deposit rung-1 material** (a reflex, a competence Terra has no source for) **provided it is not resolvable as Worker 9 by any shipped evidence**, and provided it is entered in the seeds ledger. Anything a player could confidently attribute is an owner decision.
- **Rendering rule from the score lane:** bible `:956-960` — a motif that survives instrument and reality-stage change is the sanctioned carrier. That is the safest possible Worker 9 spend, because music cannot over-tell.

### Third consciousness
- **Nothing.** Four locked questions (`story-authority.json:291-294`), and bible `:1210-1213`: *"The story should not announce that overlapping world models create reality. It should let two observers discover a property neither could perceive alone."*
- **The one permitted grammar:** a property that requires two observers to become perceptible. That is embodiment, not statement. Note it also requires a second observer to exist in scene — which is why the station and W-7744 are both structurally interesting and structurally dangerous.

### Budget arithmetic for the next chapter
Chapter 10 spent **one** pillar nudge (r1, via K9) and **one** protected-open → player-visible move (r2: inhabited space exists). That is a defensible ceiling.

- **At most one pillar nudge**, and it must be a **different kind of evidence**. Speed was used. Re-using speed is repetition, not escalation.
- **Zero** movement on r4, Worker 9, the third consciousness, Makers, the greater threat, the station's name, the credit balance, or the sealed volume.
- The strongest *free* move available: **consequence of the counter**. It spends nothing protected and pays a debt already incurred on screen.

---

## 5. Contradictions and stale records a next chapter must NOT blindly inherit

| # | Do not inherit | Why |
|---|---|---|
| 1 | `STORY.md` as a description of the shipped game | ends at ch4 (**SA-03**) |
| 2 | Bible §10 / §3 table / Execution Plan §3 as the shipped-vs-contracted status of ch5–ch10 | one chapter behind (**DD-01/02/03**) |
| 3 | `story-authority.json`'s `activeProduction` and `ownerApprovedSceneContract.activePath` | still July's run (**SA-01**) |
| 4 | `storyState.ts` as the place authored beats live | they live in untracked `beats/` (**SA-02**) |
| 5 | `scene-contract.json` r5-non-spends ("no crowd, no interior") | R12 shipped both (**RG-02**) |
| 6 | "ch11 exists" | ch11/ch12 are milestone namespaces only; `StoryBeat` has neither; registry ends at ch10 (**RG-01**) |
| 7 | `station-continuation-contract.md` §Movement 1–2 as a description of shipped copy | apron copy unshipped; low-line placement and text differ (**DD-04/05**) |
| 8 | Bible §8's "no parentheses after `i—`" as live practice | contradicted by every chapter since A4 (**VO-01**) |
| 9 | `check-results.json` / `verification-report.json` from the ch10 run | explicitly superseded: *"Their cut-line-era `dockingAuthorized:false` / no-interior observations are not rewritten; R10 and R12 truth lives in the later browser evidence"* (`run-summary.md:174-177`) |
| 10 | The `2026-09-05-after-the-hearth` artifact set as completed review evidence | status ambiguous; see **L-4** |
| 11 | Any belief that the live site reflects current work | *"the live site still serves that commit and predates every review-wave repair"* (`run-summary.md:116`) |
| 12 | `PARAVOXIA_STATION_FEATURE_PLAN.md` | its title still says "the Anchorage" — a retired name (`CLAUDE.md:116`; `PARAVOXIA_DEMO_FOUNDATION_PLAN.md:17`). Runtime is clean; the doc is not |

Also binding and easy to forget: **`PARAVOXIA_DEMO_FOUNDATION_PLAN.md:15-16` — "Do not rush to the station. Making the existing story enjoyable comes first; the need to leave must emerge from play."** The ch10 build satisfied that by making the *need* emerge from a failing hearth. A next chapter inherits the same constraint in a new form: **the need to do the next thing must emerge from what the player already did**, and right now the only unspent emergent need on the board is the counter's record.

---

## 6. KEEP — strengths and intended uncertainty (do not "fix" these)

- **K-1. The Chapter 10 causal engine.** Need is discovered in the body (a hum drops a step), self-sufficiency is exhausted **on camera**, and only then does she ask. `beats/ch10/ch10-cold.ts:42-49` reasons about this explicitly. This is the cleanest desire→opposition→tactic chain in the game.
- **K-2. The bearing rite refuses a timer.** `beats/objectivePrimitives.ts:537-538` — *"It waits indefinitely and never acquires a timer, a nudge, or an automated claim — the wait IS the meaning."* Protect this standard.
- **K-3. K9's restraint.** One line, stating only speed, with the camera and score contracted to give it no acknowledgment (`scene-contract.json:259`). This is exactly how the pillar should be spent.
- **K-4. The issuance-not-purchase design.** `station-continuation-contract.md:20-22` — the transaction runs against the W-7743 suit record, *"not a purchase made with the sandbox's unexplained credits."* This guarantees acquisition **and** leaves the credit balance unauthored. Two problems solved by one decision.
- **K-5. Idempotency that is also thematically correct.** `issueBondedCell` adds only when count is 0 (`spaceStationStory.ts:184-187`); `reconcileStationStoryCargo` repairs partial writes and *"never duplicate or invent eligibility"* (`:208-225`); install removes exactly one and is milestone-idempotent (`stationReturnStory.ts:115-134`). **The one thing a world could not give cannot be duplicated by a reload.** Arithmetic and metaphor agree.
- **K-6. The eligibility fence.** `from=game` + the exact seeded address + all three ch10 receipts (`spaceStationStory.ts:91-102`), with `?spacestation=` remaining a noncanonical ephemeral sandbox. Canon cannot leak in through a URL.
- **K-7. Required dialogue never touches the model path.** `StationStoryPanel.tsx:27-31` — *"a network failure or improvised answer cannot strand the story or decide who Terra is."* Live AI is opt-in only (`spaceStationAiClient.ts:30-34`, default `fixture`), budget-capped at 60 calls, and every failure lands on authored copy.
- **K-8. `(the suit is accepted before you are.)`** — `StationStoryPanel.tsx:89`. Ledger it; do not touch it.
- **K-9. The lift's perspective staging.** `storyDirector.ts:1553-1558`. Textbook.
- **K-10. Intended uncertainty that is working:** the station has no name; the credit balance is unexplained; the bond is only "an issuance record the core accepts"; nobody recognises Terra; who answered the relay is unanswered. **These are not gaps. They are the chapter's best work.**

---

## 7. Strongest five lines in the game

1. `emergentStoryDirector.ts:1487` — *"(one fire behind you. one fire here. home is the distance you can keep alive.)"* — redefines home as a relation in eleven words, and survives both readings without strain.
2. `emergentStoryDirector.ts:385` — *"(the answer came back before the asking finished.)"* — the entire hidden pillar, spent as a measurement rather than a meaning.
3. `emergentStoryDirector.ts:380` — *"(a world gives stone, water, wood. it does not give this. this was issued.)"* — makes a supply problem into an ontology, and makes leaving inevitable.
4. `StationStoryPanel.tsx:89` — *"(the suit is accepted before you are.)"* — corporate reading: your paperwork precedes you. AI reading: the container is authenticated, not the occupant.
5. `emergentStoryDirector.ts:898` — *"no."* — the smallest line in the game and the one everything before it was building.

## 8. Weakest five lines (and one absence)

1. **The absence at `TidegardenSettlementWorld.tsx:313-320`** — the install has no line at all. The weakest moment in the game is one that contains no words (**GAP-01**).
2. `spaceStationStory.ts:318` — *"it entered resettlement as one lot. it came back with more history than weight."* — beautifully built, and borrowing a real-world atrocity vocabulary the timelessness law asks us to coin around (**TL-02**).
3. `spaceStationVendors.ts:178` — *"i can attest to all of it. i can attest to the attestation, if you like."* — a good joke that is one clause too pleased with itself, and it is the **story-critical** issuer's default greeting.
4. `SpaceStationSandbox.tsx:1441` — *"(one fire waiting. carry back what the world could not give.)"* — the right thought in the wrong channel; on the objective HUD it reads as an instruction, not a thought (**GAP-03**).
5. `beats/objectivePrimitives.ts:543` — *"A BEARING IS ATTACHED (ADVISORY)."* — the parenthetical hedge is genuinely funny bureaucracy, but it is the only work-order line that asks the player to parse a joke at the exact moment the rite begins.

---

## 9. Verdict

**Is the goal plot structurally safe? Yes — with one caveat and one hole.**

The pillar is intact. Worker 9, the shared body, the third consciousness, and W-7744's motives have **zero** player-visible evidence in the shipped build, and the one pillar spend (K9) was made as a measurement rather than a meaning. The protected-unknown list held under a full station build: no name, no credit explanation, no bond definition beyond an issuance record, no recognition of Terra. The reveal ladder A4 → A5 is unspent and correctly gated on interstellar warp. Every hard non-spend the ch10 contract declared for *story* was honoured.

**The caveat** is that the canon **records** have degraded faster than the game has. Three of the top five authority documents describe a game that ends at `ch9-hearth` or earlier; the declared beat-authority file no longer holds the authored beats, and the module that does is untracked; the seeds/low-line ledgers do not contain the best line in the station visit. The pillar's defence mechanism is a ledger, and the ledger is stale. That is a documentation failure, not a story failure — but it is exactly the failure mode that lets a next chapter over-tell by accident, because it will be reading a map of a smaller game.

**The hole** is GAP-01.

### Single highest-leverage fix

**Author the installation of the bonded cell.** One REGULATION line from the restored core and one bare-lowercase line from Terra, at `stationReturnStory.ts:132`, plus a score anchor.

It is the highest-leverage fix because:
- it is the **terminal moment of the entire shipped game**, and it currently says nothing;
- it is the only place where the movement's thesis — *a self that cannot make a thing must meet one that can, and pay for the meeting* — can be stated as experience rather than as an errand;
- it converts Terra's voluntary re-entry into the Authority's registry from an unremarked mechanic into a **belief turn**, which is precisely the causal ground a next chapter needs;
- it spends **nothing protected**: no Worker 9, no W-7744, no third consciousness, no A5, no station ontology;
- it requires **no owner-only canon decision**, and is therefore ordinary authorized work under the 2026-07-28 lift and the Stage-1 lock.

**Second-highest, and it should run alongside:** reconcile the authority records — `STORY.md`, Bible §3/§10, Execution Plan §3, `story-authority.json`'s `sources`/`activeProduction`, and the low-line ledger — so the next chapter is designed against the game that exists rather than the one the documents remember.

*This audit approves nothing. It is an independent source read, not a chapter gate, and it does not constitute runtime verification.*
