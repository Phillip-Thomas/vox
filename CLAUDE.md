# Paravoxia — orchestration & token discipline

Fable weekly limits are the binding constraint; most spend is long-context
cache reads, not output. Every session in this repo follows these rules.

## New chapter creation — Chapter Loop default

For a NEW chapter creation request, use `docs/chapter-loop.md` and
`npm --prefix main run chapter:loop`. Its checked runner and fixed commissions
in `.claude/agents/chapter-loop/` replace the legacy chapter-mode treatment,
peer-note, signoff, child-scene and repeated review procedures below. Do not
stack those procedures on this loop or dispatch its roles outside the adapter.
The three creative directors remain peers; explicit creative/mechanical model
bindings preserve the model policy. Routine authorized implementation, checks
and the one refinement proceed without asking the owner again.

Start `npm --prefix main run chapter:loop -- begin --chapter <id>` before
preparing the brief. The persistent eight-hour elapsed target includes
preparation, waits, interruptions and recovery; aim for the first complete rough
playable proof within 90 minutes. The owner corrected scheduling policy on
2026-09-08: time, work-item, role-launch and capture-count targets guide focus and
checkpointing; they must not kill unfinished generation. New runs use adaptive
budgets, including advisory cumulative token estimates. Explicit strict token
budgets and provider quotas remain enforced; estimates never reset actual usage.
At 80% of a target, save progress and finish the existing path, avoiding
optional exploration/polish. Actual resource limits, owner stops, scope and
acceptance checks remain enforced. New `throughput-v2` runs require
capability preflight before any model dispatch, then run cinema/score planning
and the three final reviewers in parallel in their separate contexts. Game
writes and GPU jobs remain serialized. Keep the existing commissions and caps:
32,000 reported context tokens, 48,000 packet bytes and 16,000,000 transcript bytes.

Run broad verification once for a stable release candidate; reuse only successful
receipts with matching game/build, command dependencies and evidence hashes.
Release certification uses `chapter:accept:workflow --chapter-loop <run-directory>`
to validate and reuse the three independent creation reviews. Current registry,
authority, mechanical and journey gates remain required, with an independent
specialist review for changed shared engine, persistence, audio or rendering
code. Human taste and publishing authority remain separate. Existing legacy
release runs retain their original path. See `docs/chapter-loop.md` for commands.

Existing runs keep their archived instructions, original clock and spent
allowances; a new brief or directory cannot reset them. Installation alone does
not resume a stopped run. A checked `adopt-adaptive-budget` policy change may
resume a scheduling-only stop under the owner's explicit correction, preserving
the exact stage, clock, source, usage, failed attempts and unknown accounting.
Never restart planning or fabricate the killed role's completion. The owner subsequently resumed Chapter13 with "now
continue using this new workflow"; its Chapter Loop continuation imports the
signed recipe and records the previous run's spend alongside the new allowance.
Paraform's workflow, provider, schedule and publishing authority are unchanged.

## Model tiering (frontmatter already set — don't override upward casually)

- **fable (inherit)**: `chapter-director`, `score-director`,
  `cinematography-director`, `story-alignment-judge`,
  `scene-cohesion-judge` — creative build and taste-critical judgment only.
- **opus**: `story-naive-reader`, `story-canon-auditor`, `story-verifier`,
  `scene-naive-viewer`, `cinematography-continuity-auditor`,
  `score-continuity-auditor`, `player-experience-auditor` — blind reading,
  auditing, and mechanical verification.
- Any ad-hoc Explore/general-purpose agent for searching, doc-reading, log
  triage, or probe-running: pass `model: "opus"` (or `"haiku"` for trivial
  greps). A mechanical subagent must never inherit fable.

## Main-session context hygiene

- Stay an orchestrator. Don't pull the design corpus (~65k tokens:
  `PARAVOXIA_PROGRESSION.md`, `PARAVOXIA_CH4_PLAN.md`, `main/STORY.md`) into
  the main context unless doing the creative work directly here — delegate
  reading to a subagent and keep only its conclusions.
- Verification (movie probes, screenshot strips, `npm run verify`) goes to
  `story-verifier`, not inline Bash loops. Run dev servers and long probes in
  the background; read back tails, never full logs.
- Guided-play changes require both the verifier's objective/marker/feedback
  lifecycle proof and a fresh read-only `player-experience-auditor` report.
  Neither role patches or substitutes for a creative director.
- After finishing a chapter or review, remind the owner to `/clear` before the
  next task; suggest `/compact` before starting a long build phase when
  context is already large.

## This machine runs concurrent sessions

Other agents and the owner work in this repo at the same time. Two incidents in
one session on 2026-09-04:

- A parallel refactor of `main/src/utils/fauna*.ts` landed mid-`verify` and made
  it fail on files the running session had never touched. **Before treating a
  gate failure as yours, check `ls -l` timestamps against your last edit.** Do
  not "fix" a module someone is actively splitting — you will collide with work
  whose destination only they know.
- A probe pointed at `127.0.0.1:5199` measured a DIFFERENT PROJECT after that
  port was taken over. It returned 200 and rendered a real app, so nothing
  looked wrong. **Probes must verify identity, not liveness** — check for
  `<title>Paravoxia</title>` before trusting a measurement. `npm run
  verify:visual` picks a free port and does this check; copy that pattern.

`npm run dev` fails here with `ENOSPC: System limit for number of file watchers
reached` (the `captures/` tree is enormous). Use `npm run build` plus
`npx vite preview`.

Two more harness traps, both hit on 2026-09-04:

- **A background shell that waits with `until ! pgrep -f "<name>"` waits forever**,
  because the pattern matches the waiting shell's own command line. Use the
  bracket trick — `pgrep -f "[n]ame"` — or run dependent steps sequentially in
  one shell instead of polling.
- **Probes must own their server's lifetime.** Nine orphaned `vite preview`
  processes were left behind by probes that crashed. `tools/lib/previewServer.mjs`
  now kills the child on exit/signal; use it rather than spawning a preview by
  hand. Its `assertHardwareGl` check is also mandatory: without `--use-gl=angle`
  headless Chromium here silently used SwiftShader and a boot profile showed a
  20-second stall that the real GPU never produces.
- **Probe switches** (players never set these): `?worldprep=sync` forces the legacy
  synchronous world generation; `?beatregistry=off` serves the legacy story tables
  instead of beat contracts. Both exist so a baseline and a candidate come from ONE build.
- **Edit-then-measure ordering.** A build started 27 seconds after a source edit
  contains that edit. Capture a baseline BEFORE changing the code path it
  measures, or use the same-build A/B switches (`?worldprep=sync`,
  `?beatregistry=off`) so baseline and candidate come from one build.

## Focused verification

For an unchanged-contract repair, use `creative:repair:check`: prove the affected
runtime action first, then focused static checks. Run full verification once for
the stable candidate; reuse exact successful command/source receipts rather than
having implementer and verifier rerun the same suite. Runtime evidence and affected
independent review remain required. See the creative-triad skill for the narrow
repair route. Existing runs retain their archived instruction versions.

## Creative triad

For standalone scene work outside a new Chapter Loop run, awakening, substantial cutscene recut, or audiovisual
polish pass, invoke the `creative-triad` skill. The Chapter, Score, and
Cinematography directors are peers. They communicate through the run's scene
contract and structured director notes; they do not race edits in shared
timeline files or approve their own implementation.

Chapter, Score, and Cinematography are exactly the three peer creative
directors. Auditors, verifiers, judges, and integration engineers provide
checks, evidence, and repair routing; they never become a fourth creative lane.

Durable contracts live in:

- `PARAVOXIA_CREATIVE_COUNCIL.md`
- `main/CINEMATOGRAPHY.md`
- `main/src/story/ux/README.md` (the executable player-guidance context
  contract for objective, marker, HUD, and feedback lifecycles)
- `docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json`
- `.codex/production-runs/_template/`

## Story scope

Post-arrival story work is **authorized**. The owner lifted the post-arrival
gate on 2026-07-28 (recorded at the top of `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`):
story beyond `ch9-hearth` may be designed, built, and registered, including the
space-station chapter. Do not refuse or defer this work on the basis of an
older freeze — earlier revisions of this file carried one, and it expired.

What still applies:

- **Use the Chapter Loop for new chapter creation**, retaining runtime/registry
  gates and separate release certification. Legacy creative-triad gates still
  apply to their archived runs and standalone scene work.
- **Sequencing is owner-directed: do not rush to the station.** Making the
  existing story enjoyable comes first, and the need to leave must emerge from
  play rather than from a new content hook.
- **The demo's release surface is unchanged** — it still stops at
  `ch4-arrival`, and publishing remains a separate decision. Building past it
  is allowed; shipping it in the demo is not implied.
- **Shipped copy and audio remain protected baselines.** Changing a protected
  audio/runtime path is still a contracted change, not an incidental one.
- **"Anchorage" is retired as a name.** The location is the **space station**.
