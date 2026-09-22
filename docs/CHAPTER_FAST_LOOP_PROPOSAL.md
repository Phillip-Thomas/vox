# Paravoxia Chapter Loop — approved design

Status: implementation authorized by the owner. The operational contract and commands are in [chapter-loop.md](chapter-loop.md). This file preserves the approved design rationale. Chapter13 remains stopped. Installation does not start a production run, promote a chapter, or authorize publishing.

## Aim

Make one compelling, playable chapter through a fixed creative loop. Spend the work on story, player discovery, staging and music. Return a concrete candidate at the end of the budget, with an honest verdict. The orchestrator cannot turn that verdict into more repair rounds.

The model is Paraform's current fast loop: fixed role commissions, fresh contexts, builder look loops, audible evidence before critique, blind judges, a keep-list, one final refiner and an enforced terminal handoff. Its documented median is about3hours, ceiling8hours; a complete Paravoxia chapter should not be promised in90minutes. Ninety minutes is a proposed first-playable checkpoint.

## The fixed sequence

1. **Canon packet and chapter direction.** Build a compact packet from the last accepted chapter, unresolved promises, character knowledge, permitted revelations and actual entry/exit state. Keep authored canon distinct from a player's save and from debug fixtures. The Chapter Director proposes a dramatic question, playable actions, signature moment and earned ending. Use the previous chapter and one relevant approved standout as references; do not randomly breed the plot.
2. **One creative-triad exchange.** Chapter, Cinematography and Score remain peers. Cinema specifies spatial readability, reveal, camera/control handback and visual identity; Score specifies motif transformation, rhythm, silence and shared event anchors. One bounded exchange produces a single chapter recipe. No repeated treatment/reconciliation/signature network after unchanged-contract bug fixes.
3. **Build and play.** One integrator owns shared code. Produce a complete rough playable path before polishing. The builder observes real frames and real player actions during at most3 local build/look cycles. Default to one principal new gameplay idea using proven movement, save and interaction machinery. An unsupported engine capability gets an early bounded feasibility check; it cannot silently become a chapter-long infrastructure project.
4. **Score and stage.** Realize the score and the cinematic beats against the actual playable chapter and shared anchors. Allow at most2 listen/polish rounds within the run's total budget. Produce audible/rendered evidence before critique. Keep the sound and camera responsive to the player's actual actions, including free exploration and interruptions.
5. **Independent experience review.** A reusable runner captures the affected playable path, one meaningful recovery, affected Continue behavior and entry/exit continuity. A blind player reviewer attempts the chapter with ordinary controls and no solution. An AV judge reviews the actual audiovisual cut. A continuity critic sees the compact canon packet and the final content. Mechanical measurements are computed; judges report experience and cite evidence. Compare presentation with approved references without requiring every chapter to be louder or more spectacular.
6. **One ranked refinement.** Merge findings into one list: blockers first, then the few improvements with greatest player impact. Include an explicit keep-list. The integrator makes one refinement; the relevant creative director contributes only where meaning changes. Recheck changed behavior and obtain a fresh verdict on the affected experience. A remaining REVISE ends this run.
7. **Hand back the chapter.** Deliver a working preview when available, a normal-save start point or clearly labelled diagnostic entry, a short audiovisual walkthrough, the verdict and concise known issues. The runner writes provenance, cost and evidence receipts automatically. A broken required action prevents acceptance; a failed probe produces INCONCLUSIVE, not a game defect or a pass. Publication remains separate.

## What makes it stronger than the experiment loop

- **Persistent narrative causality:** character knowledge, open promises and revelations are checked across chapters.
- **Embodied storytelling:** progression must come from actual actions; an autopilot movie cannot substitute for player comprehension or manual play.
- **State continuity:** the chapter must consume the real previous state and leave a usable next state. A fixture is never evidence of that transition.
- **Creative evolution:** preserve strong motifs, staging and verbs while adding a deliberate new contribution. Review the emotional change and discoverability as well as polish.

## Budgets and stopping

Suggested initial profile: first playable checkpoint90minutes; whole-run target3hours and hard ceiling4hours, subject to a small measured pilot before making speed claims. Planning, retries, handoffs, capture and review all consume the same cumulative budget. Shared GPU lock waiting may park execution without repeatedly spending model calls; record total elapsed time separately.

Use a fixed roster with a maximum14 role launches, including repeat judges and refinement. Keep role inputs to a compact packet plus owned source excerpts, not the orchestration transcript. Before enabling the loop, the profile must also contain explicit cumulative model-turn and token limits (new input/cache creation, cache reads and output tracked separately). Missing limits refuse initialization. The pilot must also start with explicit provisional token caps; it receives no exemption. Calibrate production defaults from its measurements rather than claiming that wall time alone controls token cost.

Permit one infrastructure recovery only after a deterministic diagnosis confirms the cause has been corrected, within the same remaining budget. It cannot reopen a completed role. Repeated tool failure ends the run as BLOCKED_INFRASTRUCTURE. No replacement run, extra repair allowance, or continuation may reset consumed limits. A new owner instruction is needed to begin further work after a terminal stop.

## Runner architecture and verification scope

Implement the stage order, allowed transitions, ownership and budgets in one checked runner, following Paraform's adapter/checkpoint pattern. Role commissions live once in agent definitions; the producer passes variables. Reuse existing Paravoxia build, journey, media and source-snapshot helpers. Do not fork a probe suite for every chapter or depend on copied minified bundle offsets. A preflight checks imports, actual build identity, output freshness and observable capabilities before taking the GPU lock.

A chapter declares its new actions and affected state transitions once; the runner selects the relevant checks. Shared gameplay safety remains a deterministic gate. Run the broad suite once for a stable candidate, reuse source-bound receipts, and run wider device/performance/full-story coverage when the change affects it or at the separate release milestone. Essential prior-to-next chapter continuity stays in the chapter loop.

Keep one chapter recipe, one run-state record, one evidence bundle and one review/handback. Generate existing registry/signature/quality metadata from these where compatibility requires it. Retire overlapping orchestration rules when the new workflow is adopted; do not place a new layer on top of the existing full triad and chapter-acceptance processes. Existing Chapter13 evidence remains archived and production stays paused during migration.

## Grounding

- Paraform: ../Paraform/harness/fast-loop.md; ../Paraform/harness/fast-loop-rationale.md; ../Paraform/harness/fast-loop-contract.mjs; ../Paraform/harness/fast-loop-codex.md.
- Paravoxia: CLAUDE.md; .claude/skills/creative-triad/SKILL.md; docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-chapter.run-profile.json; main/tools/creative-chapter-acceptance-workflow.mjs.
- Observed failure costs: .codex/production-runs/2026-09-05-after-the-hearth/owner-requested-waste-audit.md.
