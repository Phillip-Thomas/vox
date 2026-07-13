---
name: story-review
description: Run Paravoxia's isolated story review or the full existing-story correction and new-direction council: blind player read, canon/runtime audit, independent Chapter/Score/Cinematography treatments, cross-notes, signed authority candidate, bounded documentation patch, deterministic gates, alignment review, and cohesion judgement.
---

# Story review and story-council workflow

Run this as ORCHESTRATOR. Fresh isolation, explicit source authority, and
durable artifacts are the method. Never leak canon to the blind reader, let a
director review itself, or turn the owner into a message bus.

## Authority first

Read, in order:

1. `PARAVOXIA_CREATIVE_COUNCIL.md` and `main/story-authority.json`;
2. `main/STORY.md` and reachable runtime;
3. `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` and the latest repo checkpoint;
4. `main/PARAVOXIA_STORY_BIBLE.md`;
5. `main/PARAVOXIA_STORY_EXECUTION_PLAN.md`;
6. only the relevant Progression/CH4/Revision lineage.

The current story-correction lane is documentation and council work. The
post-arrival/runtime lane remains blocked until its named gates and owner Gate
G1 lift. A treatment, consensus, or passing review does not authorize story
copy, audio, camera, rendering, save, or runtime mutation.

Use the portable workflow and profile:

```text
docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json
docs/architecture/workflow-orchestration/run-profiles/paravoxia-story-reconciliation.run-profile.json
```

## Choose a mode

- **Delta review:** a few shipped lines or one bounded beat; canon audit plus
  both-readings, timelessness, reveal-level, and agency checks.
- **Shipped-story review:** isolated blind reader + canon auditor, then the
  alignment judge. READ-ONLY.
- **Story correction / new direction:** the complete council workflow below.
  Use this for plot, character, chapter sequencing, whole-story audiovisual
  direction, Bible/Execution Plan updates, or readiness for future production.

## Model and isolation policy

- `story-naive-reader` runs fresh with **no tools, no repository path, and no
  inherited creative context**. Inline the hashed intent-free corpus in its
  invocation. `story-canon-auditor` runs separately on opus unless the owner
  explicitly asks for final pre-ship fable review.
- `story-alignment-judge` and `story-cohesion-judge` are fresh independent
  reviewers; never reuse a director.
- Chapter, Score, and Cinematography receive the same measured input packet and
  write their first treatments independently.
- Mechanical inventory, path checks, and deterministic validation may use a
  cheaper agent, but their artifacts must be reproducible.
- Never give the blind reader the Bible, Execution Plan, manifest, contracts,
  treatments, source paths, comments explaining intent, reviewer prose, or git
  history. Preserve its invocation receipt, corpus hash, and exact allowed
  resource hashes; a prose claim of blindness is not evidence.

## Shipped-story review

1. Build an intent-free shipped-copy corpus and exact beat-order inventory.
2. Launch fresh `story-naive-reader` and `story-canon-auditor` agents in
   parallel. The canon auditor receives authority sources; the blind reader is
   a no-tool invocation containing only the exported corpus, observable order,
   corpus hash, and one-resource allowlist.
3. Launch a fresh `story-alignment-judge` with the full naive report and canon
   audit. It must compare perceived loudness to intended loudness without
   crediting author-only or future truth.
4. Synthesize: verdict, agreements, conflicts/taste calls, fiction-breaking
   issues, intended-confusions KEEP list, agency/fallback findings, and ranked
   repairs. The review changes nothing.

## Full story correction / new-direction council

Create a run directory under `.codex/story-runs/YYYY-MM-DD-<scope>/` and keep
all artifacts there. Do not reuse a scene production run as the authority
record.

### 1. Lock and inventory

- Write a production lock that allows only the named documentation,
  orchestration, agent, template, schema, and deterministic-check paths.
- Inventory the reachable shipped beat order, player-visible copy, current
  terminal handoff, fallbacks/rescues, source precedence, contracted IDs, open
  owner questions, and protected paths.
- Produce `runtime-story-inventory.json`, `shipped-copy-corpus.md`,
  `shipped-audio-baseline.json`, and `source-of-truth-map.json`. The audio
  baseline inventories current cue/mood ownership, silence, transitions,
  audible reveal exposure, and evidence through the shipped ceiling. Record
  hashes and source revision.

### 2. Isolated audits

Run the blind reader and canon auditor in parallel. Require the blind reader to
report character wants/opposition/change, seen versus inferred facts, agency,
waiting, and visible fallback/rescue. Require the canon auditor to separate
shipped, contracted, proposed, author-only, player-visible, and open ontology.

Gate: both reports are substantive, the blind invocation receipt proves the
one-resource allowlist and zero canon exposure, and contradictions have stable
IDs.

### 3. Independent director treatments

Give Chapter, Score, and Cinematography the same commission brief, inventory,
blind report, canon audit, and contradiction register. Do not share first
treatments between peers.

- Chapter: desire, opposition, tactic, belief before/after, causal setup/payoff,
  reveal/withhold, agency type, mandatory path, fallback and rescue semantics.
- Score: motif ownership, emotional causality, harmonic belief turns, silence,
  chapter-scale setup/development/payoff, reveal-leak risks, candidate anchors.
- Cinematography: character/presence legibility, blocking, focal story,
  whole-arc palette/color script, camera-era and lens evolution, rendering
  meaning, reveal discipline, candidate anchors.

Gate: each treatment corrects measured problems, preserves protected strengths,
addresses the complete affected range, and does not mutate runtime.

### 4. Cross-examine and preserve dissent

Each director writes notes to both peers; each recipient answers every note.
Compile the six losslessly into `director-notes.json` and keep a separate
`dissent-register.md`. No director may close its own objection. Do not average
strong competing theses into generic compromise.

### 5. Freeze a candidate

The creative producer compiles `canon-decision-register.json` and
`story-authority-candidate.md`. Every entry records current state, proposed
state, evidence, affected beats/chapters, reveal level, owner authority, peer
disposition, and unresolved dissent. Collect three lane-specific signatures
over the same candidate hash.

Owner-only questions stay explicitly open. Director consensus cannot resolve
Makers, literal Terra authorship, simulation status, consciousness mapping,
W-7744 motive, or final-frame ontology.

After the three deterministic signatures validate, route the exact candidate
hash and decision register to the Human Story Authority Approver. The owner
decision is a separate artifact and gate; it cannot substitute for missing or
mismatched director signatures.

### 6. Patch documentation only

Apply only the signed, owner-approved, bounded authority/documentation patch. Preserve prior
rationale with status banners and supersession pointers; do not delete lineage
or silently rewrite historical decisions. No player-visible copy or runtime
change belongs in this lane.

Run:

```bash
npm --prefix main run story:authority
npm --prefix main run story:authority:smoke
```

### 7. Independent post-patch judgement

Run a documentation authority audit and the intent/perception alignment judge,
then give the complete packet to a fresh `story-cohesion-judge`. It scores the
portable story rubric and emits defects through the story taxonomy.

Approval requires weighted score >= 4.7, every category >= 4.25, no open
critical/high defect, no unaccepted blocking medium defect, complete director
signoffs, preserved dissent, passing deterministic checks, and no lock breach.
The judge cannot patch or accept an owner exception.

Route repairs to the owning director or documentation engineer, re-run the
affected deterministic and independent reviews, and keep every iteration. Stop
after the profile's attempt limit or a repeated low-gain loop; do not call the
run complete because the budget ended.

## Owner synthesis

Lead with what the shipped story currently communicates and the highest-leverage
causal correction. Separate:

- confirmed shipped truth;
- approved documentation/canon changes;
- contracted future direction;
- open owner taste/ontology decisions;
- runtime readiness obligations and still-blocked gates.

Record final score, defects, dissent, validation, decisions, and lessons in the
run. “Story authority reconciled” is not “future runtime authorized.”
