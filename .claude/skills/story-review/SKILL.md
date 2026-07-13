---
name: story-review
description: Run the full Paravoxia story-coherence review — a fresh naive-player read, an omniscient canon audit, and an intent-vs-perception alignment judgment — then synthesize one report for the owner. Use after significant story/copy changes, or when the owner asks whether the storyline is coherent with the goal plot.
---

# Story review — the three-lens workflow

Run this as ORCHESTRATOR. The value comes from fresh, isolated agent sessions
— never reuse a prior agent for these roles, and never leak canon to the naive
reader.

## Model policy (fable limits are the binding constraint)

- `story-naive-reader` and `story-canon-auditor` run on **opus** (set in their
  frontmatter). The judge and the synthesis run on the session model.
- **Pre-ship exception**: when the owner says this is the final review before
  shipping a chapter, override the reader and auditor to `model: "fable"`.
- **Delta mode**: after a SMALL copy change (a few lines, one beat), do not
  run all three lenses. Run only the canon auditor, scoped in its prompt to
  the changed lines plus the both-readings and timelessness tests. Reserve the
  full three-lens review for chapter-sized changes or an explicit owner ask.
- Any general-purpose fallback spawn below MUST pass `model: "opus"` —
  fallbacks must never inherit fable.

## Steps

1. **Launch two agents IN PARALLEL (one message, two Agent calls), both fresh:**
   - `story-naive-reader` — no extra context beyond its role file. Do NOT
     mention the pillar, the AI, or any design intent in the prompt. If the
     registry doesn't have the agent type yet, use general-purpose with
     `model: "opus"` and tell it to first read
     `.claude/agents/story-naive-reader.md` and obey it.
   - `story-canon-auditor` — same fallback pattern with its role file.

2. **When the naive reader returns, launch `story-alignment-judge`** (fresh),
   pasting the naive reader's FULL report into its prompt (and optionally the
   canon auditor's findings). Same fallback pattern (fallback runs on the
   session model — the judge is the taste-critical lens).

3. **Synthesize for the owner** — one report, in this shape:
   - **Verdict first**: is the storyline coherent and is the goal plot landing
     at the intended loudness? Cite the naive reader's own synopsis as the
     headline evidence.
   - **Cross-reviewer agreements** (strongest findings — two or three lenses
     flagging the same thing).
   - **Cross-reviewer CONFLICTS** surfaced explicitly (e.g. one lens says cut
     a line, another calls it a strongest line) — these are owner taste calls,
     never silently resolved.
   - **Story-breaking issues** (bugs in the fiction: dead keys advertised,
     characters despawning mid-scene, promises the code breaks) — separated
     from copy polish.
   - **Intended-confusions KEEP list** (from the judge) so nobody "fixes" the
     mystery.
   - **Recommended fix round** split into: mechanical/uncontroversial (offer
     to send the chapter-director agent) vs owner taste calls (list them as
     questions).

## Rules

- All three agents are READ-ONLY; the review changes nothing.
- Never paste canon into the naive reader's prompt; never paste the naive
  reader's report into the canon auditor (independence is the method).
- If the owner asks for fixes afterward, commission the `chapter-director`
  agent with the agreed subset — not the reviewers.
