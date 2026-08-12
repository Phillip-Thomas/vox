# Player Experience Audit — ch10 station introduction

Reviewer: player-experience-auditor (opus), fresh, 2026-08-12
Inputs: main/src/story/ux/README.md; scene-contract.json draft-v6; runtime +
lifecycle evidence; shipped-ux-baseline.json. Recorded verbatim by the
orchestrator from the auditor's return.

## VERDICT: repair

A first-time player can traverse ch10-cold and ch10-ask unaided.
**ch10-transit's first rung breaks that**: it is the one required action with
no locator and an input the player cannot press from where the game puts her.

## Objective matrix

| # | id | verb / locate | verdict |
|---|---|---|---|
|C1|`station:fault-read`|[F] at core, marker ready, chip `…· 46m`|pass|
|C2|`station:fabrication-attempt`|[F] at ship (6m), marker ready; "ATTEMPT" honest about the refusal|pass|
|A1|`station:return:reboard`|marker from ship pose; ch8 grammar reused|pass|
|A2|`station:return:crossing`|`ORIGIN WORLD · COURSE`, spatial bearing|pass|
|A3|`station:return:landfall`|`WRECK SITE · LAND`, spatial|pass (see UX-6)|
|A4|`station:relay-query`|[F] at relay (4.2m); answer lands 1.76s later|pass|
|A5|`station:bearing-claim`|indefinite rite, no timer/nudge/auto-claim|pass|
|T1|`station:transit:ignite`|**markerless; player is on foot at the relay at beat entry**|**fail**|
|T2|`station:transit:hold`|`ISSUED BEARING · HOLD`, range = progress|pass (evidence thin)|
|T3|`station:transit:resolve`|markerless by design; clears to nothing at hand-back|pass|

One-shot entry cue is structural. Marker parity is structural. Reset matrix
clean: sandbox and `done` mount no HUD; three deep links reconstruct the right
rung.

## Defects

**UX-1 (high) — no boarding rung at ch10-transit.** The claim is performed on
foot at the wreck relay (verifier D-13: on foot at beat clock 0.2s); the beat
then publishes `BRING THE KESTREL ONLINE. / HOLD [SPACE] TO IGNITE AND LIFT.`
with requiresMarker false — no chevron to a ship parked wherever she landed,
and on foot the line renders `HOLD [THRUST]`, the jetpack. ch8 ships
`ch8:launch:reboard` → `ch8:launch:ignite`; ch10-transit drops the reboard
half. The movie lane passes only because the autopilot was given an explicit
walk-and-board step. → Chapter Director (add the rung/verb); Integration to
wire it from the existing `chapter10FabricatorPosition()`.

**UX-2 (medium) — mobile has no standing work order.** mobile-potato renders
the entire work order as `JOURNAL` at all six ch10 anchors; the verb is one tap
away. ch10-cold is authored to arrive unannounced, so on touch the chapter's
arrival is a small button. → Cinematography Director (shipped baseline; needs
an accepted exception or a ch10-scoped affordance).

**UX-3 (medium) — variant parity not re-proven post-repair.** The only
four-profile matrix covering C1–A5 predates the deferral fix and still shows
`station:bearing-claim` at missing-marker on all four profiles; the closing
variant trace deep-links past ignite/hold, so T2's marker is unproven outside
LOW movie. → Integration (re-run).

**UX-4 (medium) — invariant is movie-lane only.** All four stamp paths are
movie=1&profile=LOW; manual-lane traces predate the fix. → Integration.

**UX-5 (low) — deferral gap has no legible state.** While deferred, the HUD
does not exist at all. 2.87s cardless on the ask deep link; ≤193ms in
continuous flow. The missing-marker branch already ships an honest standing
line, `ROUTE RECALIBRATING · OBJECTIVE REMAINS ACTIVE`, which deferral
bypasses. → Chapter Director.

**UX-6 (low) — no exit-the-Kestrel rung** after landfall (ch8 ships one); the
order flips to the relay while she is seated.

## Does guidance lie?

No rung asserts false progress. "ATTEMPT" pre-honours the refusal; the bearing
rite never self-completes; the claim's 1.81s null target (D-15) is covered by
deferral. The single dishonesty is T1's `ready` health on a rung whose target
is a place she must find.

## Protect in repair

SANDBOX_POLICY across all ch10 beats (full craft/build/board agency, no
seizure); story-first prompt arbitration; the empty ch10 marker band
(StoryDirectorDriver.tsx:119-124); the "STAND AT THE SECOND HEARTH CORE"
amendment; the ch9 wait-night one-cue fix (8→7, oneCuePerActivation true).

## Recheck

Manual, non-movie, headed: claim the bearing, then stand still — a locator to
the Kestrel must exist before any ignite instruction. Automated: re-run the
variant-anchor probe post-repair at all four profiles across ch10-cold/ask,
and one manual-lane stamp path.
