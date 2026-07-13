import { FAUNA_KINDS } from '../src/utils/faunaModel';
import { buildFaunaProfile, createFaunaGeometry } from '../src/utils/faunaField';

const seed = Number(process.argv.find(arg => arg.startsWith('--seed='))?.slice('--seed='.length) ?? 12345);
const budget = Number(process.argv.find(arg => arg.startsWith('--budget='))?.slice('--budget='.length) ?? 800);
const profile = buildFaunaProfile(seed);
let failed = false;

for (const kind of FAUNA_KINDS) {
  const geometry = createFaunaGeometry(kind, profile);
  const triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  const status = triangles <= budget ? 'PASS' : 'FAIL';
  console.log(`${status} ${kind.padEnd(10)} ${String(triangles).padStart(4)} / ${budget} triangles`);
  failed ||= triangles > budget;
  geometry.dispose();
}

if (failed) process.exitCode = 1;
