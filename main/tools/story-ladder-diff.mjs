// --- Ladder diff classifier ----------------------------------------------------------
//
// `story:ladder:trace -- --compare` says WHICH beats differ from the baseline.
// This says WHETHER each difference is the kind a batch is allowed to make.
//
// Rule for the marker-gate batches (PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md
// §2.3): publishing a mandatory rung one frame LATER, once its target exists,
// may turn an entry state's `health` from `missing-marker` into `ready` and
// may drop a leading state that was identical except for that field. Nothing
// else may change, and no objective the baseline shows may be absent now — an
// absent objective is a rung with no findable target, which is exactly the
// defect the gate exists to expose.
//
//   node tools/story-ladder-diff.mjs                 # baseline vs captures/story-ladder
//   node tools/story-ladder-diff.mjs --allow-health  # apply the marker-gate rule

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { classifyLadderDifference } from './lib/storyLadderDiff.mjs';

const allowHealth = process.argv.includes('--allow-health');
const baseline = JSON.parse(readFileSync(path.resolve('..', '.codex/production-runs/2026-09-story-pipeline/ladder-baseline.json'), 'utf8')).trace;
const now = JSON.parse(readFileSync(path.resolve('captures/story-ladder/ladder-trace.json'), 'utf8')).trace;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let disallowed = 0;
for (const beat of Object.keys(baseline)) {
  const a = baseline[beat] ?? [];
  const b = now[beat] ?? [];
  if (same(a, b)) continue;

  const { allowed, missing } = classifyLadderDifference(a, b, { allowHealth });
  const verdict = missing.length > 0 ? 'DISALLOWED (objective missing)' : allowed ? 'allowed' : 'DISALLOWED';
  if (verdict !== 'allowed') disallowed++;
  console.log(`${verdict.padEnd(30)} ${beat.padEnd(14)} baseline=${a.length} now=${b.length}${missing.length ? '  missing: ' + missing.join(',') : ''}`);
  if (verdict !== 'allowed') {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (same(a[i], b[i])) continue;
      for (const k of new Set([...Object.keys(a[i] ?? {}), ...Object.keys(b[i] ?? {})])) {
        const va = JSON.stringify(a[i]?.[k]), vb = JSON.stringify(b[i]?.[k]);
        if (va !== vb) console.log(`    state[${i}].${k}: base=${String(va).slice(0, 110)}  now=${String(vb).slice(0, 110)}`);
      }
      break;
    }
  }
}
console.log(`\n${disallowed} disallowed difference(s)`);
process.exit(disallowed > 0 ? 1 : 0);
