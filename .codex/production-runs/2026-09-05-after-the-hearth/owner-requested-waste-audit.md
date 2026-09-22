# Owner-requested waste audit — chapter work stopped

The owner explicitly stopped chapter production on 2026-09-07 around00:22UTC. The active probe was terminated through its cleanup handler; the browser, recorder and isolated sink are gone, default audio sink unchanged, and the active CLI was then terminated. All103 game-source hashes are unchanged. No new chapter roles, probes, tests or implementation will run. The existing static preview remains available. Prepared commissions are inactive. A later generic oversight continuation must not override this explicit stop.

## What the retained receipts show

Since the earliest retained invocation at2026-09-06T07:12:57Z: 93 invocation records,84 distinct completed CLI results,5,246 model turns. Those84 receipts report570,758,839 cache-read input tokens,9,747,851 cache-creation input tokens,9,232 other input tokens and4,098,892 output tokens. This excludes the root Codex conversation, the initial native creative directors and missing/interrupted results. Cached reads are repeated processing, not571million unique new tokens or a direct quota reading. The receipts sum to$485.57 in provider list-price estimates; that is not an observed bill or subscription-quota conversion.

Fifteen implementation invocations account for376.69million cache reads and1.585million output tokens. Sixty-nine verification, tooling and diagnosis invocations account for194.07million cache reads and2.514million output tokens. One initial integration session alone used301 turns and118.61million cached input tokens. No defensible exact fraction can be labelled wasted from token counters alone.

The run also accumulated21 ledger entries,165 producer JSON documents,109 commission text files and277 private probe JavaScript files. These counts show fragmentation; they are not independently a measure of waste. The source-repair record reached a ninth pass. An implementation-ready ledger entry was recorded09:02UTC; the grounded-recovery proof arrived after00:12UTC the next day. That elapsed period includes useful repairs, but it demonstrates the loss of a useful delivery boundary.

## Where the waste went

1. **Long implementation contexts.** Hundreds of model/tool turns repeatedly reread growing source, logs and history. The largest token sink was repeated input in implementation sessions, not just the final verifiers. Scope crossed movement, coordinate frames, world ownership, save restoration, story state, audio and UI guidance.
2. **Building and repairing the test machinery.** Copied probes carried stale build hashes, minified coordinates, role names and assumptions. Concrete failures included waiting for story runtime before clicking Continue, stale audio breakpoints, reusing a nonempty capture directory, a waiter started after the process already exited, instantaneous F instead of the game's frame-sampled held input, and measuring a return before settling. These consumed role launches without testing the game successfully.
3. **Too many handoffs and documents.** I split probe preparation, wiring, transport, pinning, execution, diagnosis and closure into separate AI commissions, then reread and corrected their reports. Some reports invented elapsed windows, treated hardcoded endpoint labels as evidence, or overclaimed coverage. Orchestration became another project.
4. **Repeated broad verification.** The ledger records implementer and verifier full suites for the same3026-,3068- and3091-test candidates. Current source103 eventually used one reused3,207-test receipt, which is the better pattern. New changes can justify reruns; duplicate same-candidate checks added little.
5. **No effective total stop budget.** I kept authorizing bounded continuations and additional repairs without enforcing a total chapter cost/elapsed limit. I pursued release-level lifecycle, variants, full-story continuity and audio instrumentation before giving a useful playable handback. The owner's routine autonomy instruction did not justify unlimited scope or spend.
6. **Excessive root supervision.** Frequent polling, verbose tool output, repeated checkpoint rewrites and corrective reviews grew my own context. That cost is absent from the totals above. I should have recognized and reported this pattern much earlier.

## A leaner future workflow

- Agree a small playable chapter slice and an overall time/token budget. Target a first playable handback in60–90minutes; treat that as a planning target, not a promise for every scope.
- Keep the required three creative peers to one concise initial contract/signoff. Use one implementer at a time with small fresh task context, then one verifier and one consolidated affected review. Do not create an AI role for every helper or log diagnosis.
- Use one reusable deterministic probe runner. Before consuming GPU time, it checks current build identity, imports, role, fresh output, actual observable sites and ownership. Derive identities instead of copying hardcoded pins.
- Verify the new chapter path, one meaningful invalid action and affected save/Continue behavior. Run the full suite once on the stable candidate; broaden only for a demonstrated risk. Reserve full release matrices for a separate explicit milestone.
- Allow at most two repair cycles inside the agreed total budget. On repeated failure, stop with the playable state and a causal blocker; do not silently start more allowances. A broken harness becomes a separately bounded infrastructure task.
- Carry a one-page state/diff/evidence handoff. Reset large contexts, cap log output, batch independent reads and have deterministic scripts emit concise results. Reuse passed source-bound receipts.
- Report wall time, new input/cache creation, cache reads and output separately at stage boundaries. A passing probe does not equal acceptance, but pending paperwork should not erase already-proved progress.

## Preserved useful result

Chapter13 Common Ground is implemented. The stable suite passes353 files/3,207 tests. Real earned Continue preserves saved route points and walking position and accepts a new action. Actual shortcut rejection, supported return, all9 legal route vertices and the final shared passage are proved. The chapter is not fully accepted;16 defect records remain open pending remaining evidence/review. Preview: http://127.0.0.1:34825/?story=ch13-home . Source manifest2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63.

Raw accounting: owner-requested-waste-audit-metrics.json. Repair chronology: iteration-ledger.jsonl. Stop/cleanup: owner-stop-audit-checkpoint.json and verifier/captures/manual-credit-finale/pause-cancel-20260907T002300Z/runtime-record.json. The proposed workflow changes are recommendations only; no repository policy or source was changed during this audit.
