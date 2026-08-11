# Dissent Register — ch7/ch8 voice repair

Run ID: `2026-08-10-ch7-ch8-voice-repair`
Contract revision: `draft-v2`
Compiled by: orchestrator contract compiler, from the three peer-note files, the
three reconciliation files, and the three director contract signoffs.

Material disagreement is preserved here until an authorized role resolves it.
The author of an objection cannot close it. Canon, scope, exception, and taste
disputes route to the human approver when the Cohesion Judge cannot resolve
them. Every entry below is recorded, ruled, and routed — none of it is an
oversight for a naive viewer, an auditor, or the cohesion judge to rediscover
as new.

## Standing dissent

| ID | Anchor | Competing theses | Raised by | Severity | Evidence | Decision owner | Status | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dissent-01` | `anchor.ch8.contact-logged` | commissioned near-silence at the two-word reply / shipped generic ramp holding the beat maximum across the whole window | Score Director (SC-N3) | major | `score-treatment.md` section 2, `evidence/score-ch8-window-analysis.json`, four hashed combined-bus renders | human approver (packet decision) | open by design | copy commission proceeds; musical defect carried by a separately-routed score packet |
| `dissent-02` | `anc.launch.liftoff` | L3 as authored interior truth, frozen as written / L3 unsupported by every captured liftoff frame | Cinematography Director (CN-N3), routing chosen by Chapter (CH-N5) | high | `cinematography-treatment.md` section 3, `evidence-hires/ch8-launch/002_005s_ch8-launch.png`, `evidence-hires/ch8-launch/001_003s_ch8-launch.png` | human approver (packet decision) | open by design | line freezes; image support open pending the routed camera packet |
| `dissent-03` | `anchor.ch7.advance` and `anchor.ch8.advance` | one-way voice exit inside the locked beats / interleaved parentheticals at the two adjacent seams | orchestrator ruling R1 on intent delta D5 | medium | `production-lock.md` rulings addendum, `evidence/ch7-board-entry/000_000s_ch7-board.png` | orchestrator, escalated to owner with the ch5/ch6/ch9 follow-on | accepted known drift | recorded exception, not a run-failing defect |
| `dissent-04` | `anchor.ch7.advance` | audit-band persistence as a state-clear leak / as authored index following the worker | Cinematography Director (CN-N4), accepted by Chapter (CH-R9) | low | `cinematography-treatment.md` section 2.1, `evidence/ch7-board-entry/000_000s_ch7-board.png` | triad, closed | intended-accept | pre-recorded so no reviewer scores it as a defect |
| `dissent-05` | `anchor.ch8.open-query` | empty regulation band under L6 as a missing stamp / as authored emptiness | Cinematography Director (CN-R1) | low | `cinematography-treatment.md` section 2.2, cadence slot math in CH-N3 and CN-R1 | triad, closed | intended-accept | pre-recorded so no reviewer scores it as a defect |
| `dissent-06` | `anc.reconstruct.bench-online` | shipped objective covering two player actions under one ID | pre-existing shipped defect, recorded by Chapter (intent section 7, delta D11) and concurred by Cinematography (section 2.3) | medium | `shipped-ux-baseline.json` marker map, `main/src/story/ux/README.md` guardrails 1 and 3 | follow-on run | out of scope, routed | recorded as known and routed, not introduced by this run |

---

### `dissent-01` — the ch8 near-silence is UNMET BY SHIPPED SCORE

**Co-signed dissent text, verbatim** (authored by the Chapter Director in CH-N1,
co-signed by the Score Director in SC-R1 "exactly as CH-N1 wrote it"):

> CONTACT LOGGED. lands mid-anthem (-19.93 dBFS vs -23.83 composed-near-silence yardstick) until the separately-routed ch8-launch score packet lands; the dramatic ask of the commission is unmet by construction in the shipped ramp.

**Mechanism (deterministic, measured).** ch8-launch is not a score-owned beat, so
it runs the generic signed ramp, which rises by anchor order to the beat maximum
at the atmosphere-exit anchor. As shipped, that value raced the same-tick beat
exit; under the R2 hold the race is gone, so the beat maximum lands and persists
for the whole window. The intensity plateau inside the window is flat by
mechanism — the anchor applies the value once at window start and nothing time
varies it until the advance — so moving the two-word reply from 10.0 s to 8.5 s
sits in the identical measured state. The measured seam falls entirely at or
after the 17.0 s advance, in the next beat, under the next beat's caption.

**The four SC-N3 signature terms, carried into the frozen contract:**

1. Cue relations freeze the SHIPPED behaviour only (`score-treatment.md`
   section 3, shipped column): the held generic-ramp state across the window.
2. The near-silence intent at `anchor.ch8.contact-logged` and the composed
   emptiness at `anchor.ch8.open-query` are recorded as UNMET-BY-SHIPPED,
   carried by the separately-routed packet `ch8-launch atmosphere-exit window
   score authority` (bounded scope in `score-treatment.md` section 5).
3. This dissent-register entry stands until the packet lands or the owner
   declines it.
4. No contract, evidence, or review text may describe the shipped window as
   near-silent.

**Chapter-side constraints inherited by the packet commission (CH-N1, confirmed
in SC-R1):**

- (a) the exit-decay variant keys on the SAME durable `deep_space` fact the R2
  hold observes, never on a stack cadence offset — the score must not know the
  copy's clock;
- (b) no score event may stamp the two-word reply — silence is the cue;
- (c) the L6 window's emptiness is composed output and no one may fill it,
  packet or no packet.

**Square-wave clause (CH-N2, confirmed in SC-R2).** The square wave as the
system's one taught timbre may enter the packet's audition cycle as a *creative
option, not an obligation*: it may exist as an ambient foreign body while the
rows file, and it must never behave as a stinger acknowledging any row —
constraint (b) attached.

**Why the run proceeds anyway (CH-N1, verdict (c) accepted by both lanes).** At
the measured level the stack is legible and nothing breaks; the failure is
dramatic, not functional. The hold exposed a defect the same-tick exit was
hiding rather than creating one. ch7 and ch8 are unshipped surface behind the
`ch4-arrival` release ceiling, so there is runway for the packet before any
player hears the mismatch. The copy itself needs no change: the stack cadence
works identically with or without the packet.

**Recorded fallback if the owner declines the packet.** The stack plays over the
departure anthem at the measured level — legible, sane, dramatically flattened —
and this dissent stays in the register.

**Status:** open by design. Closure requires the packet landing or an explicit
owner decline. The objection SC-N3 itself is closed against the contract freeze
by the Chapter Director's full acceptance of all four terms (CH-R3) plus the
Score Director's own closable acknowledgement (SC-R6); the underlying musical
defect remains open here, which is the recorded mechanism, not a blocker.


#### 2026-08-10 — packet scope amended at contract revision `draft-v5` (sa-01)

The draft-v2 record above stands unchanged. This amendment fixes the packet's
scope so an owner "approve" is executable, per finding sa-01:

- **File list must name the exclusion surface.** The packet's files now include
  `main/src/story/signedSceneAvRuntime.ts:scoreIntensityFor`, because delivering
  the exit decay requires a ch8-launch entry in the score-intensity exclusion,
  mirroring the shipped ch7-reconstruct/ch7-board exclusion. Without it the
  generic ramp keeps reapplying the beat maximum and the packet cannot execute
  as previously scoped.
- **Protected-path authority is required.** `signedSceneAvRuntime.ts` is a
  protected path in this run's lock, so the packet cannot be executed under this
  lock: it needs its own recorded authority to touch that file. This must be
  visible in the owner decision, not discovered during implementation.
- **Ordering guarantee.** The exclusion must land before or with the variant
  set; a variant that resolves while the generic ramp still applies would be
  overwritten, so the packet's steps are ordered and the ordering is part of the
  commission.

Constraints attached to the packet (sa-06, sa-08, sa-11):

- **sa-06** — inside the held window the ch8-launch progression still steps
  every 6.667 s, so two chord changes land under the seven text events at a
  phase set by how long the player took to climb, because `patternStep` runs
  from beat entry and no anchor resets it. The copy cadence is not merely
  unsupported by the score; it is crossed by two harmonic moves at a
  route-random offset. An `exit-decay` variant entered at window start would
  reset `patternStep = 0` and phase-lock the harmonic rhythm to the window for
  the first time. Recorded in the packet's problem statement; no repair owed
  this run.
- **sa-08** — implement the decay as a slewed intensity ramp, not a mood swap,
  and audition it against the smoothness law: two of the four combined-bus
  renders already carry one marginal pre-existing smoothness violation each.
- **sa-11** — the three contracted ramp values are a function of the SIGNED
  ANCHOR COUNT. The six contract-local ch8 window anchors correctly did not
  enter `generatedSceneAvRuntime.json`, so the denominator is unchanged;
  promoting any of them later silently re-scales every ch8-launch ramp value.
  The packet must not add a signed anchor without re-deriving the ramp.

---

### `dissent-02` — L3's image support is OPEN

**Co-signed dissent text, verbatim** (drafted by the Chapter Director in CH-N5,
restated in CH-R8, and co-signed verbatim by the Cinematography Director in
CN-R3, "including the fallback clause"):

> L3's image support is OPEN — the hero tree is not findable in any captured liftoff frame (nose-up sky-only framing, evidence-hires/ch8-launch/002_005s and siblings); the line ships as authored interior truth pending the routed cin.launch.02 camera packet; if the owner declines the packet, L3 returns to me as a routed repair with contractChangeRequired: true (line meaning changes), not as a silent reword.

**Ruling (CN-N3).** On the evidence the hero tree is not findable in frame at the
liftoff anchor: every captured liftoff frame is nose-up with the canopy full of
sky, no ground, no site, no tree; the shot's declared focus of receding ground is
undelivered; the downward view is hull-occluded; and no headed capture exists to
prove free-look findability. The tree is provably visible from the cockpit on the
pad at ignition, and at the wreck-site horizon in ch6-dive.

**Routing decision (CH-N5, CH-R8).** Option (i) — the separately-routed bounded
camera packet on `cin.launch.02-world-below` — is chosen. L3 freezes as written
in this contract. The Chapter Director will not reword: the refusal seen from the
air is story truth, rewording to match a nose-up sky frame would surrender the
payoff to shot convenience, and retiming the tree clause to ignition kills the
"site gets small" meaning.

**Chapter-side constraints attached to the packet commission (CH-N5, accepted in
full in CN-R3):**

- (a) attitude authoring over any forced glance — no look seizure, agency stays
  with the player; if only a control-taking glance can deliver the tree, that
  returns to the triad rather than being assumed. Cinematography amended its own
  draft accordingly: the bounded rear-quarter glance option is demoted and
  attitude authoring is the packet's only presumed route.
- (b) no marker, glint, or HUD affordance on the tree — finding it stays
  voluntary and unrewarded, or the line lies in a new way.
- (c) movie autopilot inherits the same attitude so the movie path stops
  contradicting the line.
- (d) hand-back unchanged at `anc.launch.atmosphere-exit`, so the L4 to L6
  cadence window is untouched by construction.

**Honest interim reading, recorded by both lanes.** "i keep finding it" is the
voice claiming repeated voluntary glances the shipped frame cannot witness —
defensible as interiority, and agreed to be weaker than seeing the tree, which is
why the packet is the ask.

**Return path if the owner declines.** L3 returns to the Chapter Director as a
routed repair with `contractChangeRequired: true`, because the line's meaning
would change. It is never a silent reword.

**Standing record.** Capture-spec item 5's liftoff frames remain the findability
record until the packet decision lands.

**Packet independence (SC-N7, CN-N7, CN-R5, SC-R5).** The routed camera packet and
the routed score packet share no files, no anchor-semantics changes, and no
ordering dependency. Neither owner decision may be presented as gating the other,
and this independence finding rides into both packet commissions verbatim.


#### 2026-08-10 — packet problem statement extended at contract revision `draft-v5`

The draft-v2 record and the draft-v3 and draft-v4 amendments above are all left
untouched. This amendment attaches what the owner must see before deciding, per
CIN-04, CIN-07, ux-06 and the Chapter Director's R2 fallback:

- **CIN-04, the movie-path case.** On BOTH movie routes the ch8-launch beat
  never shows the departure site at all. Route B (chained) at t=0.54 s and
  Route C (deep link) at t=4.08 s are still `surface` phase on the pad, yet the
  canopy is flat empty sky — no pond, no tree, no ground, no horizon — because
  the autopilot pitches the nose up at beat entry. L1 and L3 both play over a
  worldless frame, and `cin.launch.01`'s declared primary, the cockpit horizon
  reference, is absent. Route A is the BEST case and was the only case fixed
  into the packet's problem statement by condition CC4. The Route B and Route C
  worldless establishing frames are therefore attached here, so the packet is
  not commissioned against evidence that understates its own problem. No
  recapture is required; the frames exist.
- **CIN-07, the POTATO caveat.** POTATO removes vegetation and water detail,
  not only ambient occlusion and sampling. Because both POTATO ch8 routes are
  nose-up, no POTATO frame in this run contains the launch site, so whether the
  ch8 hero tree survives at POTATO is unknown — and if it does not, L3 can never
  be image-supported on that tier regardless of what the camera packet does.
- **ux-06, the route caveat.** On the chained and deep-link movie routes L3
  never renders, L1 is cut at about 42 of 94 characters and L2 at about 54 of
  65. The contract declares this authored degradation under the drop rule and
  the canonical route is ordered ignition. The owner must see that the canonical
  ordered-ignition route is NOT the route a chapter-select or movie playthrough
  produces.
- **The Chapter Director's R2 fallback.** A guaranteed exit-window slot for the
  tree clause is NOT a contract term — it would reopen the co-signed drop rule
  and the frozen exit window. It rides here as the Chapter Director's recorded
  fallback option inside this packet's decline path: if the owner declines the
  camera packet, the fallback is available for a separate decision rather than
  being applied silently.

---

### `dissent-03` — R1 and delta D5 accepted drift at the two adjacent seams

The one-way voice exit is fully coherent inside the two locked beats. Across the
seams it flickers: `ch7-board` opens with a parenthetical and `ch8-crossing`
opens with a parenthetical, both of which sit inside the one-way voice window but
outside the locked beats. **Measured severity, stated plainly:** ch7-board's
parenthetical arrives **0.2 s after** the ch7 exit caption and overwrites it
mid-typewriter, so the bracket-fall is visibly re-bracketed almost immediately at
the chapter seam. With the frozen ch7 exit cadence the owner-approved exit string
holds about 2.0 s in-beat plus about 0.2 s into ch7-board before that overwrite.

**Measured clause corrected at `draft-v5` (CIN-11).** The sentence above —
"holds about 2.0 s in-beat plus about 0.2 s into ch7-board before that
overwrite" — is not what the capture shows. On the desktop chain the ch7-board
parenthetical begins at about **+4.85 s**, roughly **0.15 s BEFORE** the +5.0 s
advance, because the movie autopilot starts boarding inside the exit hold: the
objective flips to `board:hatch-in-progress` while the beat is still
`ch7-reconstruct`. The about-2.0 s in-beat figure is correct; the "+0.2 s into
ch7-board" clause is not. The exit string does reach full reveal, imaged on both
desktop and mobile. The original wording is left above so the correction is
legible as a correction.

Orchestrator ruling R1 accepts this as **known drift for this run**: de-bracketing
those two strings would change two additional shipped strings without an owner
decision. It is escalated with the ch5, ch6, and ch9 parenthetical follow-on, and
the owner may approve de-bracketing later as a repair-loop fold-in. Reviewers and
the cohesion judge must treat this as a recorded accepted exception, not a
run-failing defect.

Boundary restated so the record cannot drift (CH-R9): this accepted drift covers
the **caption band's** parenthetical overwrite at the seam, and is separate from
the intended-accept in `dissent-04`, which covers only the **audit band's** TTL
persistence at the same seam.

---

### `dissent-04` — intended-accept: the M7 audit pill into ch7-board's boarding black

With the M7 audit line at cadence offset +0.0 s and the audit band's 6.5 s
lifetime, the `AUDIT NETWORK` pill persists about 1.5 s into ch7-board's black
boarding-occlusion frame after the +5.0 s advance. This is by design, not a leak:
the audit band is built to survive cutscene treatment — fixed at top 13.5 percent,
below the letterbox line, on a self-backed pill — and tonally the index following
the worker into the cockpit is correct. **Stated image corrected at `draft-v5` (CIN-02).** The "black boarding frame"
described above and in the treatment is a cold-deep-link **boot-black** frame,
not an authored boarding occlusion: the cited capture is the t=0.000 s frame of
a `?story=ch7-board` deep link, world entirely black with HUD and caption live
and the world present by +4 s. On the continuous chain there is no black at all
— ch7-board at +0.2 s is a bright daylight exterior. **The accept survives** —
the pill does persist about 1.5 s — but it is restated as TTL persistence over
the next beat's daylight exterior, not over a boarding black. No recapture is
needed; the frames already exist.

Recorded by Cinematography (CN-N4) and
accepted verbatim by Chapter (CH-R9), so reviewers and the cohesion judge find it
pre-recorded rather than rediscovering it as a state-clear defect.

---

### `dissent-05` — intended-accept: the empty regulation band under L6

Under the frozen ch8 window table the two-word reply stamps at +8.5 s and expires
at +15.0 s, so the audit band is **empty** for the final 2.0 s before the +17.0 s
advance — the open query gets a visibly empty regulation band underneath it. Both
lanes record this as authored rather than as a missing stamp: it is a cleaner seam
than the superseded table gave, and it is the visual half of the bilateral silence
law. Recorded by Cinematography (CN-R1, restated in its signoff) with the score
side confirming that the printer-cut rhythm survives the compression at the final
values (SC-R4).

Bound to this entry: the **silence law is bilateral and binding on both lanes**
(SC-N6, CN-R4). Nothing may fill L6's emptiness musically or visually — no drone
swell, no resolution, no cadence, no added framing support, no letterbox, no
effect, no grade shift — without reopening the triad contract.

---

### `dissent-06` — pre-existing shipped UX defect adjacent to M2 (out of scope, routed)

Objective `reconstruct:repair:bench_online` covers two different player actions —
claim salvage, then install the keel workbench — under one objective ID. The
publish guard changes nothing when the objective ID is unchanged, so the HUD keeps
showing the salvage label while the required action is the keel install. This
violates the executable guidance contract's guardrails 1 and 3, and it appears
exactly on the common path where the player can afford the install immediately.

It is **pre-existing shipped behaviour, not introduced by this run**. The M2
caption latches on the `bench_online` stage edge — the install commit — so it sits
beside, and is unaffected by, the stale label. It is outside this run's mutation
scope and is escalated for a follow-on rather than repaired here. Recorded so the
player-experience auditor sees it was known and routed.

---

## Owner taste questions carried forward

Both are carried from the Cinematography Director's treatment and repeated in its
contract signoff. Neither gates this contract; both become live only if the
post-implementation captures come back marginal.

1. **Movie-path reveal composition.** In the movie path the autopilot finishes
   calibration parked against the pad geometry, so the 5 s exterior reveal may
   hold on a degenerate nose-to-hull close-up. If the reveal frames come back that
   way, does the owner accept an abstract reveal on the autopilot path, or route
   the shot-defect packet before the demo cut? Taste judgment on those frames
   belongs to the Cinematography Director, not the verifier, and a degenerate
   frame routes as a separate shot-defect packet rather than folding into this
   run.
2. **Caption ink on daylight terrain at mobile LOW.** The caption band has no
   backing plate, and the caption-only ch7 moments land over sunlit terrain. If
   the mobile and POTATO captures come back marginal, is a caption scrim in the
   UX-owned renderer acceptable as a follow-on, or is unplated ink a protected
   part of the awakening voice's look?

## Amendments

### 2026-08-10 — `dissent-02` re-pointed at contract revision `draft-v3`

Repair loop iteration 1 (defect `vd-01`) rebound L3 from the signed anchor
`anc.launch.liftoff`, which measurement proved entry-coincident and unable to
carry a caption, to the new contract-local anchor `anchor.ch8.site-recedes` on
the paced ladder. The `dissent-02` record above is **not rewritten** — it stands
as the draft-v2 finding, and its co-signed text remains verbatim. This amendment
records what moved, per Cinematography condition C1:

- **Tracked moment.** `dissent-02` now tracks `anchor.ch8.site-recedes`, the
  moment L3 actually fires, rather than the liftoff instant. The dissent's
  substance holds and strengthens there: the new firing moment is later and
  higher in the climb than physical departure, so tree findability is the same
  or worse. The ruling is unchanged.
- **Packet deliverable re-scoped from an instant to a window.** The routed
  camera packet must hold the site and the hero tree findable in the canopy view
  from physical departure through L3's firing moment and its full reveal. The
  line claims repeated finding, which was always a climb-window claim rather
  than an instant one.
- **Shot identity and constraints unchanged.** The packet remains bounded to
  `cin.launch.02-world-below`, and chapter-side constraints (a) attitude over
  any forced glance, (b) no marker, glint or HUD affordance on the tree,
  (c) movie-autopilot attitude parity, and (d) hand-back unchanged at
  `anc.launch.atmosphere-exit` all bind exactly as recorded above. The
  rebinding does not touch hand-back.
- **Scope note added.** The findability guarantee applies only to routes where
  L3 actually fires — the manual and paced routes. Under the drop rule L3 is
  dropped or truncated on fast routes, and the packet must not be tuned to serve
  a dropped line.
- **Story-positive recorded.** The later moment strengthens "the site gets
  small": more altitude, so the packet's target image is a small site with a
  persistent tree.
- **Standing findability record superseded.** Route A's frames, from physical
  departure through L3's reveal, become the standing tree-findability record for
  the packet. The old liftoff frames are retained as the shipped-moment record
  and are not recaptured.

The owner-declines fallback is unchanged: L3 returns to the Chapter Director as
a routed repair with `contractChangeRequired: true`, never a silent reword.

### 2026-08-10 — `dissent-02` findability record fixed at contract revision `draft-v4`

Repair loop iteration 2 re-scoped the canonical verification route to
ordered-ignition. The draft-v2 record and the draft-v3 re-point amendment above
are both **left untouched**; this entry adds only what the second amendment
changed for this dissent, per Cinematography condition CC4:

- **Standing findability record fixed.** Route A's frames — captured on the
  canonical ordered-ignition script, from physical departure through L3's
  firing moment and its full reveal — are the standing tree-findability record,
  and the routed `cin.launch.02-world-below` packet consumes them **unchanged**.
  No recapture is owed to the packet by this amendment.
- **Note added to the packet's problem statement.** L3 now fires at the phase
  edge, later and higher in the climb than physical departure, so the window the
  packet must serve runs from departure through that firing moment and its full
  reveal. This sharpens the existing finding rather than altering it: findability
  at the later moment is the same or worse, which is why the packet was routed in
  the first place.
- **Unchanged.** The ruling, the four chapter-side constraints (a) through (d),
  the fired-routes-only scope note, the small-site/persistent-tree target image,
  and the owner-declines fallback all stand exactly as recorded above.

## Resolution standard

For each item that is later resolved, record the selected thesis, the rejected
alternative, the reason, the evidence, the contract revision at resolution, the
resolver, and the timestamp. `dissent-01` and `dissent-02` are **open by design**
and may not be marked resolved by any director: each requires either its routed
packet landing or an explicit owner decline, and `dissent-02`'s decline path
returns L3 to the Chapter Director as a routed repair with
`contractChangeRequired: true`. `dissent-03` is resolved only when the ch5, ch6,
ch9, ch7-board, and ch8-crossing parenthetical follow-on lands with an owner
decision on those shipped strings. `dissent-04` and `dissent-05` are closed
intended-accepts and are recorded so that re-raising them requires new evidence,
not a fresh opinion. `dissent-06` is resolved only by the follow-on run that owns
the objective-identity repair.

## Provenance map

The citations throughout this register use the directors' original per-item note
and reconciliation labels. At Stage 4 each director consolidated its lane into
two composite notes and two composite reconciliations to match the gate's
authorship contract. The original labels are preserved verbatim as section
headings inside the composites, so every citation below still resolves by text
search. The mapping is:

| Original labels | Composite fragment |
| --- | --- |
| `CH-N1`, `CH-N2`, `CH-N6` | `chapter-note-01` (chapter to score) |
| `CH-N3`, `CH-N4`, `CH-N5` | `chapter-note-02` (chapter to cinematography) |
| `SC-N1` through `SC-N5`, objection core `SC-N3` | `score-note-01` (score to chapter) |
| `SC-N6`, `SC-N7` | `score-note-02` (score to cinematography) |
| `CN-N1`, `CN-N2`, `CN-N3`, `CN-N4`, `CN-N5` | `cinematography-note-01` (cinematography to chapter) |
| `CN-N6`, `CN-N7` | `cinematography-note-02` (cinematography to score) |
| `CH-R1` through `CH-R5` (chapter answering score) | `chapter-recon-01` |
| `CH-R6` through `CH-R10` (chapter answering cinematography) | `chapter-recon-02` |
| `SC-R1`, `SC-R2`, `SC-R3`, and the `SC-R6` closable ruling | `score-recon-01` |
| `SC-R4`, `SC-R5` | `score-recon-02` |
| `CN-R1`, `CN-R2` | `cinematography-recon-01` |
| `CN-R3`, `CN-R4`, `CN-R5` | `cinematography-recon-02` |

Nothing in the consolidation changed a statement, a response, a disposition
outcome, or any term recorded above. In particular, the objection that carries
`dissent-01` now lives inside `score-note-01`; it is dispositioned by the
chapter director in `chapter-recon-01`, and the score director's own closable
ruling rides in `score-recon-01` — so the objection is still not closed by its
author.

## Compilation note

This register was compiled mechanically from director-authored sources. Every
block quoted above is reproduced verbatim from the note or reconciliation that
authored it; no dissent text was reworded, softened, or summarized in place of
its author. One further open item is recorded outside this register because it is
an authority question rather than a disagreement: canon sign-off on the section 4
designation caption is still pending inside this cycle, and a canon-auditor
rejection is a stop condition under the production lock, never a unilateral
reword.
