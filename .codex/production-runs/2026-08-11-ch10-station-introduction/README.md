# ch10 — the space station enters the story

Creative-triad production run, 2026-08-11 → 2026-08-12. Chapter mode.

This directory is the durable record. Chat is not an authority; where this
directory and anyone's recollection disagree, this directory wins.

## Read in this order

1. **`run-summary.md`** — what was built, where it lives, state at close, and
   the resume point. Start here every time.
2. **`production-lock.md`** — the authority this run acted under, and its nine
   revisions. Each revision names the defect or contract term that forced the
   boundary to move, so the scope creep is auditable rather than implicit.
   R8 records an out-of-band publish; read it before trusting any claim about
   what is live.
3. **`scene-contract.json`** — draft-v9, tri-signed. The sole creative
   authority for the implementation. Prior revisions are in `snapshots/`.
4. **`human-decision.json`** — seven decisions that are the owner's, unanswered.
5. **`lessons-learned.md`** — the transferable part. If you read only one file
   after the summary, read this one.

## What the artifacts are

**Authored by the three directors** (never edit these to satisfy a gate):
`story-intent.md`, `score-treatment.md`, `cinematography-treatment.md`, the
`*-peer-notes.jsonl` and `*-reconciliation.jsonl` pairs, the three
`*-contract-signoff.json`, and the three `*-repair-direction.json`.

**Authored by independent reviewers** (likewise): `story-audit.md`,
`score-audit.md`, `cinematography-audit.md`, `ux-audit.md`, and
`naive-audience-report.md` — the last from a viewer given only frames and audio,
with no contract, no source and no canon. Section indexes and attestation lines
at the foot of those files were added by the orchestrator to satisfy structural
checks; no reviewer's words were altered.

**Compiled, not authored:** `director-notes.jsonl` and `director-signoffs.json`
are mechanical joins of the director-authored sources — `compile-director-notes.mjs`
regenerates the first, and the gate rejects any rewriting of a statement.

**Measured:** `verification-report.json` (per-criterion verdicts),
`evidence-registry.json` (every file hashed, media ffprobe-matched),
`raw-audiovisual-evidence.json` (intent-free, feeds the blind viewer),
`objective-lifecycle-evidence.json`, and `evidence/`.

**Adjudicated:** `defects.json` (canonical, 16 entries), `dissent-register.md`
(declined alternatives preserved, not averaged away), `cohesion-judge.md` and
`final-scorecard.json`.

## Things a future reader will want to know

- **The player never docks.** That is the authored cut line, not an unfinished
  edge. Docking is a second run, blocked on an owner decision recorded in
  `human-decision.json`.
- **Four contract terms in this run were unsatisfiable by construction**, and
  each read as bad craft for one or more rounds. All four are superseded with
  their cause recorded inline in the contract. Every measurement term in
  draft-v9 now carries its derivation, and where impossibility was conceivable,
  a reachability sentence. See `lessons-learned.md` §1 — it is the most
  expensive thing this run learned.
- **The evidence budget was an owner instruction and a lock term**: LOW frame
  strips, three HIGH hero stills, and zero movie renders. Movie-lane traversal
  is proven by state traces. Do not add video to this run's evidence without
  changing the lock first.
- **Ten canon debts** are created by this chapter's shipped lines and bind the
  docking run. They are listed at the foot of `story-audit.md`. Read them before
  scoping run two — several constrain what the station is allowed to be.
- **Six pre-existing defects outside ch10 were fixed here**, because ch10 was
  the first thing to walk into them. Chapter predicates that never anticipated a
  two-digit chapter, a boot-world resolver that stopped at ch9, and four
  verification tools that had quietly rotted.

## Probe discipline (learned at cost)

- Resolve in-page modules through the app's own HMR-timestamped specifier. A
  bare `import('/src/...')` returns a second, pristine instance and measures a
  runtime nobody is playing.
- One browser page at a time. Concurrent pages caused renderer deaths that
  looked exactly like scene defects.
- Record the URL you actually opened, read back from `location.href` — never
  the one you intended. A probe here reported `movie=1` while opening the
  manual lane, and three readers reasoned from it.
