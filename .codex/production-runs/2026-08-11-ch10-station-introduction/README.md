# ch10 — the space station enters the story

Creative-triad production run, 2026-08-11 → 2026-08-12. Chapter mode.

This directory is the durable record. Chat is not an authority; where this
directory and anyone's recollection disagree, this directory wins.

## Read in this order

1. **`run-summary.md`** — what was built, where it lives, state at close, and
   the resume point. Start here every time.
2. **`production-lock.md`** — the authority this run acted under, and its twelve
   revisions. Each revision names the defect or contract term that forced the
   boundary to move, so the scope creep is auditable rather than implicit.
   R8 records an out-of-band publish; read it before trusting any claim about
   what is live.
3. **`scene-contract.json`** — draft-v9, tri-signed. The sole creative
   authority for signed Chapter 10. Prior revisions are in `snapshots/`.
   **`station-continuation-contract.md`** is the R12 authority for the separate
   post-terminal station visit and return; it does not rewrite or extend the
   signed Chapter 10 rail.
4. **`human-decision.json`** — eight owner decisions: two resolved and six
   still pending.
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

- **R10 extends the authored cut line into the existing docking route.** The
  draft-v9 chapter still resolves and hands back at the same 1,500-unit frame;
  after that hand-back, the player may close the normal corridor, request
  clearance, enter the shipped station interior, and return to the same berth.
  The owner selected the proven page-transition architecture on 2026-08-13;
  `human-decision.json` records that decision as resolved.
- **R12 carries the story through the station and home again.** The station
  restores the incoming save, gives the player an authored registry exchange,
  optional bounded vendor conversations, and the required B-7073 “Bell”
  issuance. The real `bonded_cell` survives reload and undock; the return work
  order then points to Tidegarden's existing second hearth, where installing
  the sealed cell consumes it and durably restores the hearth. The signed
  Chapter 10 reveal remains unchanged. See `station-continuation-contract.md`
  and `evidence/verification/ch11-station-story.json`.
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
- **The ten Chapter 10 operational canon debts are discharged by R10/R12.**
  Docking stays advisory and player-flown; the station is inhabited; REGULATION
  and the registry establish the issuance grammar without currency; the exact
  station issues the cure; the player physically carries it home and installs
  it. The protected unknowns remain guardrails: station name, credit origin,
  W-7743's wider legal status, Makers, W-7744, and the sealed volume.
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
