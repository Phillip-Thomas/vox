import '../src/story/beats/index.ts';
import { getBeatContract } from '../src/story/beats/registry.ts';
import { STORY_BEAT_ORDER } from '../src/story/storyState.ts';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const check = process.argv.includes('--check');
const contracts = STORY_BEAT_ORDER.filter(beat => beat !== 'done').map(beat => getBeatContract(beat)!);
let stale = false;
for (const filename of ['chapter-registry.json', 'chapter-journey-contract.json']) {
  const prior = readFileSync(filename, 'utf8');
  const document = JSON.parse(prior);
  for (const chapter of document.chapters) {
    const declarations = contracts.filter(beat => beat.chapter === chapter.id);
    if (filename === 'chapter-registry.json') chapter.beats = declarations.map(beat => beat.id);
    else chapter.objectives = declarations.flatMap(beat => beat.journey ?? []);
  }
  const generated = `${JSON.stringify(document, null, 2)}\n`;
  if (prior === generated) continue;
  if (check) { stale = true; console.error(`Generated beat view is stale: ${filename}`); }
  else writeFileSync(filename, generated);
}
const metadataPath = 'src/story/beats/metadata.generated.ts';
const metadata = Object.fromEntries(contracts.map(({ id, chapter, disposition, entry, hud, rail }) =>
  [id, { chapter, disposition, entry, hud, rail: { stuckAfterSeconds: rail.stuckAfterSeconds, waitReason: rail.waitReason } }]));
const metadataSource = '// Generated from authored beat declarations. Run npm run chapter:registry:generate.\n'
  + 'export const BEAT_METADATA = ' + JSON.stringify(metadata, null, 2) + ' as const;\n';
if (!existsSync(metadataPath) || readFileSync(metadataPath, 'utf8') !== metadataSource) {
  if (check) { stale = true; console.error(`Generated beat view is stale: ${metadataPath}`); }
  else writeFileSync(metadataPath, metadataSource);
}
if (stale) process.exitCode = 1;
else console.log(`Beat declarations: ${contracts.length}; registry and journey ${check ? 'match' : 'generated'}.`);
