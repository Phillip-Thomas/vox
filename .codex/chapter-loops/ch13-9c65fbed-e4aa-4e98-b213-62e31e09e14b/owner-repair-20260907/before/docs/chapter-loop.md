# Paravoxia Chapter Loop

Default for new chapter creation. The owner explicitly resumed Chapter13 under
this workflow after installation; the original stop remains archived.
The CLI implements creation; `chapter:accept:workflow` remains separate release
certification. There is no automatic publication, promotion, cron, or new
Paraform procedure. Installation itself starts no models or game probes.

## Fixed loop

`plan → cinema → score-plan → council → build → compose → verify → player → av → canon → decide`

The three creative peers contribute once. The council checks their exact merged
recipe and shared event anchors; it cannot rewrite a peer's direction. One
integrator builds a complete rough playable path before polish, using at most
three checked look cycles. Score/staging gets at most two checked listen cycles.
Every role has a fresh provider session, a small explicit packet, a fixed
commission in `.claude/agents/chapter-loop/`, and recorded dispatch/completion.

A mechanical failure or independent REVISE permits exactly one final sequence:
`refine → verify-final → player-final → av-final → canon-final → finish`.
Remaining REVISE ends as NEEDS_REVISION. A planning conflict also ends the run;
there is no treatment/signature repair network. The player reviewer receives
only the preview and controls, tries ordinary inputs and records its own trace.
The AV reviewer receives media and approved references. The continuity critic
receives compact canon, recipe and observed runtime evidence. Scores are 1–5;
PASS requires every role category >=4 and no major/blocking defect.

## Starting and continuing

The orchestrating agent prepares one brief using the owner's existing request,
last accepted chapter, bounded canon excerpts and actual existing probe bindings.
Do not ask the owner to compose JSON or reconfirm routine reversible choices.
The shape is documented in [brief.example.json](chapter-loop/brief.example.json).
Its unbound placeholders intentionally fail validation; never use sample hashes
or invented capabilities as proof. `check` verifies context/command structure;
execution additionally verifies imports through the configured commands, fresh
outputs, source ownership, actual served bytes, hardware and cleanup evidence.

```sh
npm --prefix main run chapter:loop -- check --brief path/to/brief.json
npm --prefix main run chapter:loop -- init --brief path/to/brief.json
npm --prefix main run chapter:loop -- run --run .codex/chapter-loops/<run-id>
npm --prefix main run chapter:loop -- status --run .codex/chapter-loops/<run-id>
npm --prefix main run chapter:loop -- stop --run .codex/chapter-loops/<run-id>
```

Paths resolve from the repository, regardless of npm's working directory.
`init` freezes explicit provider/model bindings, source/context references,
commissions, command bindings and numerical budgets. It registers one allowance
per chapter. A different directory cannot reset it. `run` resumes the same stage
and remaining allowance. Terminal verdicts cannot be reopened by `run`.
There is deliberately no reset/force-complete command. A new commission after
a terminal stop needs a new explicit owner instruction and a separately reviewed
allowance; do not edit the checkpoint to manufacture one.

An explicitly renewed legacy continuation supplies `continuation` in its brief:
hash references to the owner resume receipt, frozen scene contract, all three
matching director signoffs, the intact implementation source manifest, and the
historical usage audit. The runner imports the exact approved direction and
starts at verification. It retains historical spend in `priorSpend` and applies
the installed ceilings to the newly authorized work. This cannot reopen a
terminal Chapter Loop checkpoint or silently reset its allowance.

Chapter13 uses the compatibility capture adapter with its existing pinned
probes, fresh output directories and the shared heavy lock. Previously captured
evidence is context, not a fresh pass. Missing full continuity or audible-media
bindings remain explicit INCONCLUSIVE results; diagnostic coverage cannot be
promoted to those obligations.

`recover --run ...` runs the frozen deterministic infrastructure health command
once. Success makes the existing checkpoint resumable, with all spend retained;
it cannot rerun a completed role. Missing model accounting and interrupted,
unreconciled model calls fail closed. They are not free recovery attempts.
When the diagnosed fault is in the capture/transport itself, `recover --run ...
--repair-receipt <json>` checks an audited before/after hash list and relevant
passing tests before updating those infrastructure pins. It cannot change game
paths, commissions, the budget contract, models, or consumed usage, and uses the
same single recovery. Unlisted edits or a second recovery are refused.
Use `stop` while the runner is active; its control poll terminates its owned
process group. A hard-killed parent leaves an interrupted checkpoint blocked,
requiring investigation of the recorded PID/transcript rather than blind replay.

## Numerical limits

| Limit | Default ceiling |
| --- | ---: |
| Cumulative active execution | 4 hours |
| First complete rough playable proof | 90 minutes from runner work start |
| Role launches, including recovery | 14 |
| Model turns / reported Codex work items | 400 total; 60 per role |
| Fresh input plus cache creation | 1,000,000 tokens |
| Cache reads | 20,000,000 tokens |
| Output | 250,000 tokens |
| One role | 45 minutes |
| Reported context | 64,000 tokens |
| Input packet | 96,000 bytes |
| One transcript | 32,000,000 bytes |
| Look / listen / final refinement / infrastructure recovery | 3 / 2 / 1 / 1 |

`init --limits limits.json` can lower ceilings, never increase them. Planning,
capture, refinement, provider failures and recovery consume the same allowance.
State records active time and total elapsed time separately. Brief preparation
outside the runner is not model-usage telemetry and must remain a compact task.

Provider telemetry is a practical boundary: Claude exposes live message usage;
Codex reports token totals at turn completion and work items during the turn.
The adapter meters the data actually available, preserves cumulative usage and
stops further work when a cap is reached. A currently executing provider request
can overshoot its token allowance before its usage arrives. Codex does not expose
per-request context size here; packet bytes, work items, time and transcript size
remain enforced. These are not exact prepaid API token caps or billing figures.
Explicit model bindings are required; there is no silent model fallback.

## Reusable evidence bindings

The brief binds existing deterministic tools using argv arrays and cwd; no shell
interpolation. Available variables are `{repo}`, `{chapter}`, `{out}`,
`{candidate}` and, during final probes, `{preview}`. Commands also receive
`CHAPTER_LOOP_OUTPUT`, `CHAPTER_LOOP_CANDIDATE` and `PARAVOXIA_URL`.
Freeze every referenced tool/helper/contract in `toolRefs`; the game source
inventory is separately hashed before and after every dispatch/capture.
Use the existing journey contract/probe, chapter evidence and media helpers.
Do not copy private probes, use bundle offsets, or equate a successful process
exit with gameplay success. An unsupported capability blocks the binding step.

Five cases are required: manual, recovery, Continue, continuity and AV.
Each has an existing raw-report schema, explicit JSON-pointer assertions and
media paths relative to its fresh output directory. Required semantic assertions
are listed in `main/tools/chapter-loop/evidence.mjs`. Continue must establish a
real click, restored state equality and a **new** accepted action. Continuity
must establish earned entry/exit without fixtures. The binding's assertion
pointers are substantive engineering choices: inspect them against the actual
probe schema and trace; a renamed PASS field is not proof of all obligations.
Hardware and owned-process/audio cleanup are mandatory. Missing/malformed probe
output is PROBE_ERROR_INCONCLUSIVE, not a game restore failure or a pass.

AV bindings must provide video, audible media and frames, with actual decoder
and nonblank checks from the media tools. Judges must perceive the supplied
media; unavailable perception is BLOCKED. A mechanical fixture or synthetic
transport test cannot establish artistic quality.

The runner builds once per verification attempt, archives dist, owns a free-port
server, verifies HTTP bytes against the archive, and hashes media/reports. Source
or evidence changes invalidate reuse. An archived candidate can be reopened:

```sh
npm --prefix main run chapter:loop -- preview --run .codex/chapter-loops/<run-id>
```

The preview reports whether its start is normal-save or diagnostic. It remains
alive until Ctrl-C. A completed handback does not claim its old port is live.
Capture/build commands and the blind player role use the same machine heavy
lock as Paraform: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`.
A busy lock waits at most 30 seconds and parks final verification as
WAITING_RESOURCE (exit 75). Resume later; do not busy-poll models. Waiting time
counts conservatively toward active budget. Builder/composer observation waits
also consume their existing role budget and observation allowance.

## Ownership and outputs

Only build/compose/refine may edit explicitly owned game paths. Source changes
outside ownership stop the run and preserve the dirty checkout. Frozen inputs
cannot be rewritten. Only the active role's ticket permits `observe` calls.
Role input restrictions and provider sandboxes reduce accidental context leakage;
this is not a security sandbox against a malicious local actor with Bash access.
The runner uses no global process kills or shared audio-device mutations.

The principal artifacts are `recipe.json`, `state.json`, the sealed evidence
bundle, `findings.json`, and `handback.json`. Role outputs, raw transcripts and
events are retained for recovery/accounting, not additional authored handoffs.
Handback includes spent/remaining budgets, verdict, candidate, preview command,
evidence and material issues. READY_FOR_REVIEW means the creation checks passed;
it does not certify release or replace current registry/runtime authority.
Compatibility certificates must be generated only by the existing gates, never
fabricated from an artistic score or a transport fixture.

Run `npm --prefix main run chapter:loop:test` for synthetic adapter/checkpoint
tests and `npm --prefix main run creative:workflow:check` for legacy configuration
compatibility. No real chapter pilot or measured production speedup is claimed
by these tests. The first authorized pilot should measure quality and end-to-end
time before changing these provisional ceilings.
