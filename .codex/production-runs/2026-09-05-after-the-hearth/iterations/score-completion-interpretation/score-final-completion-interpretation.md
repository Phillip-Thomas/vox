# Final completion — bounded Score interpretation

**The contract specifies no audible minimum, fixed five-second performance or guaranteed final attack. The observed null diagnostic proves neither audible failure nor a correct completed release.** No runtime repair is inferred from it.

Exact signed scene-v3: `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`. `/score/cues/5`, complete/handback anchors and `reset-score` require a fresh eligible completion, **at most five live seconds**, then the existing **4.5-second release**, with immediate control/progression handback. Declared cancellations can end the token early; no deferred, hydrated or repeated finale is permitted. Normal handback/transition to `done` is explicitly the retention exception, not an ordinary cancelling beat exit. The absence of an audible minimum does not authorize unexplained generic cleanup of an eligible token.

## What the capture establishes

Read `verifier/captures/arrival-common/journey-common-1/trace.ndjson`, SHA-256 `6dac3177c0cf0e0987bfa18a4edf392c3536090fbd93f92ee142def8cc243172`. The supplied immutable preview is port 34413; supplied application manifest is `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6`.

| Sample | Captured state |
|---|---|
| 61793 ms | Terra 18 / worker 18; comparison proved and committed true. Score token age 0.0235 seconds; separate beat/mood fields already null. |
| 62095 ms | Story `done`, required objective null; actual `avFull` history contains complete and handback. Token diagnostic null. |
| 65063 ms | Story remains `done`; token diagnostic remains null. |

These observations establish reported completion, anchor activation and a briefly observed live token. They do not establish exact token lifetime, an audible note, waveform silence, mix quality or completion of the release envelope. The roughly 302 ms between two records is sampling separation, not measured audible duration; the broad snapshots are not demonstrated to be atomic across subsystems.

In the inspected `commonGroundScore.ts`, `finalTextureSeconds` is token age or null. Normal release clears the token **before** the existing score/bed release; `enterCommonGroundScoreBeat(null)` can clear beat/mood while leaving the token. Cancellation and runtime reset can also remove it. The diagnostic does not identify which path occurred. The captured samples lack the complete cancellation/output-state history needed to attribute this clear. Local source-read hashes and supplied preview identity are distinguished in the JSON companion.

## Precise next measurement

Use one synchronized **12-second window**, about one second before a real eligible completion through eleven seconds after it. Reuse existing aligned evidence where available; this interpretation starts no probe or GPU work.

Record token-begin eligibility/result, actual completion/handback, and every token-clear timestamp **with caller and reason**. Align monotonic time with audio-context time; include context/output state, mute/music volume, pause/focus/visibility, actor/world/run identity, reset/quit and new story/optional-action transitions. Capture existing score/bed ownership and release-envelope state plus synchronized audio output through the release. Actual audition is required before an audible or musical judgment; telemetry and decoded metrics cannot supply it.

A documented allowed cancellation can explain an early clear. A clear caused solely by ordinary handback/done would conflict with its explicit retention exception. Without that attribution, neither conclusion is justified. Preserve independent controls and the current score; do not force an attack or replay the finale to obtain evidence. This is contract/evidence interpretation only, not a score review, creative acceptance or source/contract amendment.
