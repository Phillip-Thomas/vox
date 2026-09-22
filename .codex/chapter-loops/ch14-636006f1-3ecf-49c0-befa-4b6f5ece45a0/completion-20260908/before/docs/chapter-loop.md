# Paravoxia Chapter Loop

Default for new chapter creation. The owner explicitly resumed Chapter13 under
this workflow after installation; the original stop remains archived.
The CLI implements creation; `chapter:accept:workflow --chapter-loop` provides
separate release certification using the actual creation review receipts.
There is no automatic publication, promotion, cron, or new
Paraform procedure. Installing the runner does not start a chapter run.

## Scheduling targets guide completion

The owner corrected this policy on 2026-09-08: finishing useful work is the goal;
a timing estimate must not kill a nearly finished builder. New runs default to
`budgetPolicy: {"mode":"adaptive"}`. Time, work-item, role-launch and look/listen
counts are advisory. The runner exposes targets and remaining work items in each
packet and updates that role's `budget.json`. At 80%, the role writes
`progress.md`, stops optional exploration and polish, reuses valid evidence, and
finishes the existing implementation and required checks. Overruns stay visible
in status and events. Generation continues past these targets and retains its
terminal result and usage telemetry.

Owner stops, provider errors, actual token/resource limits, frozen ownership and
all acceptance checks still apply. Each build/browser command retains its own
operational timeout; an expired chapter target cannot prevent validation or turn
it into a one-millisecond command. This is not a relaxation of runtime proof,
independent review, or release requirements. Fixed role commissions and the one
final quality refinement remain unchanged.

Archived runs retain their old policy until a checked owner policy change:
`adopt-adaptive-budget --run <same-run> --authority <receipt>`. It archives the
old state, pins the exact infrastructure changes and passing checks, and retains
the same recipe, stage, source, clock, counters and failed observations. Missing
usage from a previously killed provider remains explicitly unknown, never zero.
A new continuation role works from the retained implementation; it does not replay
planning or impersonate the interrupted role. Explicit `mode: "strict"` remains
available for an actual hard budget. The hard scheduling-stop descriptions below
apply to those strict or unmigrated historical runs.

## Fixed loop

`preflight → plan → (cinema ∥ score-plan) → council → build → compose → verify → (player ∥ av ∥ canon) → decide`

The three creative peers contribute once. The council checks their exact merged
recipe and shared event anchors; it cannot rewrite a peer's direction. One
integrator builds a complete rough playable path before polish, targeting
three checked look cycles. Score/staging targets two
checked listen cycles.
Every role has a fresh provider session, a small explicit packet, a fixed
commission in `.claude/agents/chapter-loop/`, and recorded dispatch/completion.
New runs use the `throughput-v2` schedule: cinema and score planning share the
completed chapter plan and run concurrently; the three independent final reviews
share the sealed candidate and run concurrently. Game-writing roles remain
sequential. The player reviewer and all heavy captures retain the shared machine
lock. Parallel work shares the same cumulative usage and elapsed-time budgets.

A mechanical failure or independent REVISE permits exactly one final sequence:
`refine → verify-final → (player-final ∥ av-final ∥ canon-final) → finish`.
Remaining REVISE ends as NEEDS_REVISION. A planning conflict also ends the run;
there is no treatment/signature repair network. The player reviewer receives
only the preview and controls, tries ordinary inputs and records its own trace.
The AV reviewer receives media and approved references. The continuity critic
receives compact canon, recipe and observed runtime evidence. Scores are 1–5;
PASS requires every role category >=4 and no major/blocking defect.

## Starting and continuing

As the first action on a new chapter request, start its durable clock:

```sh
npm --prefix main run chapter:loop -- begin --chapter ch14
```

`begin --started-at <ISO>` can record the actual earlier request time; a future
timestamp is rejected. Calling `begin` again returns the existing clock. Start
it before brief preparation, repository exploration or role work. A continuation
uses its retained clock and checkpoint rather than opening a replacement run.

The orchestrating agent then prepares one brief using the owner's existing request,
last accepted chapter, bounded canon excerpts and actual existing probe bindings.
Do not ask the owner to compose JSON or reconfirm routine reversible choices.
The shape is documented in [brief.example.json](chapter-loop/brief.example.json).
Its unbound placeholders intentionally fail validation; never use sample hashes
or invented capabilities as proof. `check` verifies context/command structure.
`init` requires `verification.preflight`; `run` executes that deterministic
capability check before any model role. It must write `capabilities.json` under
`{out}`, with schema `paravoxia.runtimeCaptureCapabilities.v1`, `supported: true`,
`sourceIdentity: true`, matching `config.chapter` and `route.chapter`, and all five `bindings` true. Missing tools, source
identity or capture bindings block the run before creative spend. Availability
does not prove a chapter passes or can finish in time. Runtime execution still
requires actual served bytes, hardware, observations and cleanup evidence.

For newly authored chapters, `tooling-preflight.mjs` emits the distinct
`paravoxia.chapterToolingCapabilities.v1` schema. It checks the current game
identity and all five transport implementations before authoring; chapter
actions, journey data, build and media remain explicitly pending. This avoids
requiring a chapter to exist before its plan. Final capture still validates the
authored chapter configuration and exact candidate bytes before browser work.
`capture-case.mjs --config main/chapter-<id>-controls.json` binds the ordinary
control cases and AV/continuity capture. The builder owns that chapter config.
It contains the chapter id plus manual, recovery, continue, continuity and av
objects; control objects use the checked schema in `control-capture.mjs`.
Observation adds `--build`; final verification supplies the runner's sealed
candidate context and persistent preview. A tooling pass is never acceptance.

```sh
npm --prefix main run chapter:loop -- check --brief path/to/brief.json
npm --prefix main run chapter:loop -- init --brief path/to/brief.json
npm --prefix main run chapter:loop -- run --run .codex/chapter-loops/<run-id>
npm --prefix main run chapter:loop -- status --run .codex/chapter-loops/<run-id>
npm --prefix main run chapter:loop -- stop --run .codex/chapter-loops/<run-id>
```

Paths resolve from the repository, regardless of npm's working directory.
`init` freezes explicit provider/model bindings, source/context references,
commissions, command bindings and numerical budgets, and binds the existing
chapter clock. It registers one allowance per chapter. A different directory
cannot reset either allowance or clock. `run` resumes the same stage
and remaining allowance. Terminal verdicts cannot be reopened by `run`.
There is deliberately no reset/force-complete command. A new commission after
a terminal stop needs a new explicit owner instruction and a separately reviewed
allowance; do not edit the checkpoint to manufacture one.

The current explicit "do it all" commission may use `renew --run <existing>
--authority <receipt> --brief <brief>` for an expired imported verification
checkpoint with no completed model roles. It archives the exact previous state,
keeps its index, recipe, usage and retries, checks every source handoff hash,
and binds the original time of the new request. It cannot replay creative roles
or renew the same checkpoint twice. This is an explicit reviewed renewal, not
an automatic extension of an expired run.

An explicitly renewed legacy continuation supplies `continuation` in its brief:
hash references to the owner resume receipt, frozen scene contract, all three
matching director signoffs, the intact implementation source manifest, and the
historical usage audit. The runner imports the exact approved direction and
starts at verification. It retains historical spend in `priorSpend` and applies
the installed ceilings to the newly authorized work. This cannot reopen a
terminal Chapter Loop checkpoint or silently reset its allowance.

Legacy continuations retain their pinned manual, recovery and Continue probes.
New chapters need chapter-specific manual/recovery/Continue commands and current candidate source/build manifests. The Chapter 13 compatibility adapter cannot certify another chapter. The reusable runtime capture helper supplies AV and earned continuity bindings where its
preflight supports them, with fresh browser state, actual decoded media and the
shared heavy lock. A binding or a passing preflight is not a runtime pass.
Previously captured context remains context unless the exact success-cache
checks below permit reuse; reused evidence retains its original provenance.
Missing or timed-out earned continuity remains INCONCLUSIVE. Diagnostic coverage
cannot be promoted to an earned journey or audible-media obligation.

`recover --run ...` runs the frozen deterministic infrastructure health command
once. Success makes the existing checkpoint resumable, with all spend retained;
it cannot rerun a completed role. Missing model accounting and interrupted,
unreconciled model calls fail closed. They are not free recovery attempts.
When the diagnosed fault is in the capture/transport itself, `recover --run ...
--repair-receipt <json>` checks an audited before/after hash list and relevant
passing tests before updating those infrastructure pins. It cannot change game
paths, commissions, the budget contract, models, or consumed usage, and uses the
same single recovery. Unlisted edits or an automatic second recovery are refused.
If the owner subsequently explicitly requests a blocker repair, its repair receipt
may bind `ownerAuthorization` to a `paravoxia.chapterLoopOwnerRepair.v1` receipt
containing the actual request, run ID, current failure hash and
`extraInfrastructureRetries: 1`. This grants one recovery for that failure in the
same checkpoint. The runner records and pins the authorization, retains all spent
counters and original numerical limits, and refuses reuse of that failure's grant.
It does not authorize another creative refinement or weaken chapter acceptance.
A repair receipt may `amends`-link the previous receipt to reconcile its final
infrastructure changes before resumed work starts. That transition grants no
retry, runs no roles and preserves the same spent counters.
Use `stop` while the runner is active; its control poll terminates its owned
process group. A hard-killed parent leaves an interrupted checkpoint blocked,
requiring investigation of the recorded PID/transcript rather than blind replay.

## Numerical targets and resource limits

Scheduling rows are advisory in adaptive mode; resource rows remain enforced.

| Target or resource limit | Default |
| --- | ---: |
| End-to-end chapter elapsed time | 8 hours from `begin`, including preparation, waits and machine release checks |
| Cumulative active execution | 8 hours, also bounded by the elapsed deadline |
| First complete rough playable proof | 90 minutes from the chapter clock start |
| Role launches, including recovery | 14 |
| Model turns / reported Codex work items | 400 total; 60 per role |
| Fresh input plus cache creation | 1,000,000 tokens |
| Cache reads | 20,000,000 tokens |
| Output | 250,000 tokens |
| One role | 45 minutes |
| Reported context | 32,000 tokens |
| Input packet, including commission | 48,000 bytes |
| One transcript | 16,000,000 bytes |
| Look / listen / final refinement / infrastructure recovery | 3 / 2 / 1 / 1 |

`init --limits limits.json` can lower target/resource values, never increase them.
Adaptive scheduling overruns change no stored value or historical count. Planning,
capture, refinement, provider failures and recovery consume the same allowance.
State records active time and total elapsed time separately. The clock lives at
`.codex/chapter-loops/clocks/<chapter>.json` and survives process exits, resource
waits, repairs and restarts. Release finalization uses the same clock and limits each command to its remaining time; it cannot grant another allowance. Human response time after the machine handback is outside execution. Brief preparation consumes elapsed time even though
it is outside provider model-usage telemetry. An older run without a clock uses
its original creation time; installation does not grant it eight fresh hours.

Provider telemetry is a practical boundary: Claude exposes live message usage;
Codex reports token totals at turn completion and work items during the turn.
The adapter meters the data actually available, preserves cumulative usage and
stops further work when a cap is reached. A currently executing provider request
can overshoot its token allowance before its usage arrives. Codex does not expose
per-request context size here; packet bytes, work items, time and transcript size
remain enforced. These are not exact prepaid API token caps or billing figures.
Explicit model bindings are required; there is no silent model fallback.

The owner authorized unattended child work with full permissions. New briefs
bind `provider.permissionMode: "full"`; the adapter passes Claude's
`bypassPermissions` or Codex's `--dangerously-bypass-approvals-and-sandbox` on
each fresh child launch. Role input restrictions, game ownership, budgets and
publishing scope still apply. Existing frozen bindings change only through a
recorded owner-authorized handoff; native parent sandbox permissions remain
controlled by the hosting application.

## Reusable evidence bindings

The brief binds existing deterministic tools using argv arrays and cwd; no shell
interpolation. Available variables are `{repo}`, `{chapter}`, `{out}`,
`{candidate}` and, during final probes, `{preview}`. Commands also receive
`CHAPTER_LOOP_OUTPUT`, `CHAPTER_LOOP_CANDIDATE` and `PARAVOXIA_URL`.
Freeze every referenced tool/helper/contract in `toolRefs`. The game identity
hashes runtime source, assets, game configuration, generators and runtime/build
dependencies separately from chapter-loop, probe and test infrastructure. The
ownership inventory still detects unauthorized edits before and after dispatch.
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

`verification.checks` binds affected static commands with a stable `id`, explicit
`argv`, `cwd` and `timeoutMs`; use `resource: "cpu"` only for checks that do not
need the GPU lock. Perform the broad suite once for the stable candidate, using
the resulting successful receipt rather than repeating it for each role.

Static and build receipts bind the game source, exact command configuration and
dependency identity. Runtime cases additionally bind the exact archived build,
assertions and media layout. `dependencies` lists repo-relative helper files or
directories, including subprocess entry points; absent case/check declarations
fall back to `toolRefs`. Static imports, re-exports and literal `require` helpers
are followed transitively, with relevant lockfiles and validation-tool hashes.
Optional `binaryDependencies` bind executables such as ffmpeg and ffprobe.
Missing or dynamic dependencies that cannot be bounded force fresh execution.

Only successful commands and fully passing cases are reusable. Each case is
saved immediately, so a later infrastructure fault preserves earlier exact
successes. Report bytes, recursively referenced raw files and media bytes must
still match; failed or inconclusive evidence never supplies a cached pass.
Reused bundles identify the original artifacts with `reused: true`; the original
raw report is not rewritten or relabelled as fresh. Game, build, configuration,
probe/helper or evidence drift invalidates the corresponding receipt. An
unrelated runner-only repair does not change the game candidate.

Successful independent PASS reviews can also be reused only for the same
candidate, recipe, canon, media and retained scope/evidence. Changed reviewed
material requires fresh independent review; a REVISE is never promoted to PASS.

The runner archives the built dist, owns a free-port
server, verifies HTTP bytes against the archive, and hashes media/reports. A
legacy continuation reuses its existing persistent server when its owner PID,
source-manifest identity and every served build file match the frozen candidate;
the borrower never stops that server. All capture commands explicitly disable
the software-renderer override. An archived candidate can be reopened:

```sh
npm --prefix main run chapter:loop -- preview --run .codex/chapter-loops/<run-id>
```

The preview reports whether its start is normal-save or diagnostic. It remains
alive until Ctrl-C. A completed handback does not claim its old port is live.
Capture/build commands and the blind player role use the same machine heavy
lock as Paraform: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`.
A busy lock waits at most 30 seconds and parks final verification as
WAITING_RESOURCE (exit 75). Resume later; do not busy-poll models. Waiting time
counts toward the elapsed deadline and conservatively toward active budget.
Builder/composer observation waits
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

## Release handoff

For a completed Chapter Loop candidate, validate the actual three independent
reviews and current deterministic gates through the existing release CLI:

```sh
npm --prefix main run chapter:accept:workflow -- --chapter-loop .codex/chapter-loops/<run-id>
```

This verifies provider transcripts and sessions, result scores, review scopes,
the current game source, archived build/media, recipe and canon. It reuses those
three real reviews; it does not create six aliases or dispatch another general
review panel. Current registry structure, chapter authority certification and
the journey contract must still pass. Original legacy release runs retain their
existing workflow and identities.

When release work is authorized, run any required mechanical and earned journey
gates against that candidate:

```sh
npm --prefix main run chapter:accept:workflow -- --chapter-loop .codex/chapter-loops/<run-id> --run-mechanical --run-journey --journey-lane continuous --journey-mode manual --headed
```

These invoke the existing acceptance and journey tools after the lighter gates
pass. The journey command owns a preview of the archived build. Heavy work uses
the shared lock; direct-entry evidence cannot certify the earned journey, and
manual mode requires a headed browser. Successful deterministic command receipts
are reusable only for the same candidate and command dependency identity.
`--release-gates <repo-relative-json>` supplies a previously generated
`paravoxia.chapterLoopReleaseGates.v1` command-ref packet; bare PASS statements
or raw report paths cannot replace it.

Changes to shared engine, persistence, audio-engine or rendering paths require
a separate independent, provider-backed specialist review. Supply its artifact
with repeatable `--specialist-review <repo-file>` arguments. Chapter content
does not automatically trigger those specialist gates. The finalizer records
`release/release-review.json` and `release/release-gates.json`; missing evidence
or reviews produce exact blockers. Its strongest disposition is
`machine-ready-for-human-taste`. Human viewing and publication remain separate.

Run `npm --prefix main run chapter:loop:test` for synthetic adapter/checkpoint
tests and `npm --prefix main run creative:workflow:check` for legacy configuration
compatibility. No real chapter pilot or measured production speedup is claimed
by these tests. The first authorized pilot should measure quality and end-to-end
time before changing these provisional ceilings.
