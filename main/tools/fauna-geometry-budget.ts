import { FAUNA_KINDS } from '../src/utils/faunaModel';
import { buildFaunaProfile, createFaunaGeometry } from '../src/utils/faunaField';
import { FAUNA_TRIANGLE_BUDGET, type FaunaGeometryDetail } from '../src/utils/faunaGeometry';

const seed = Number(process.argv.find(arg => arg.startsWith('--seed='))?.slice('--seed='.length) ?? 12345);
const detailArg = process.argv.find(arg => arg.startsWith('--detail='))?.slice('--detail='.length);
const details: FaunaGeometryDetail[] = detailArg ? [detailArg as FaunaGeometryDetail] : ['high', 'medium', 'low'];
const budgetOverride = process.argv.find(arg => arg.startsWith('--budget='))?.slice('--budget='.length);
const profile = buildFaunaProfile(seed);
let failed = false;

for (const detail of details) {
  const budget = budgetOverride ? Number(budgetOverride) : FAUNA_TRIANGLE_BUDGET[detail];
  for (const kind of FAUNA_KINDS) {
    const started = performance.now();
    const geometry = createFaunaGeometry(kind, profile, detail);
    const ms = performance.now() - started;
    const triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    const status = triangles <= budget ? 'PASS' : 'FAIL';
    console.log(`${status} ${detail.padEnd(6)} ${kind.padEnd(10)} ${String(triangles).padStart(5)} / ${budget} triangles  ${ms.toFixed(0).padStart(4)} ms`);
    failed ||= triangles > budget;
    geometry.dispose();
  }
}

if (failed) process.exitCode = 1;
