import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const check = process.argv.includes('--check');
const root = path.resolve(import.meta.dirname, '..');
const beatsDir = path.join(root, 'src/story/beats');
const stateFile = path.join(root, 'src/story/storyState.ts');
const ast = ts.createSourceFile(stateFile, readFileSync(stateFile, 'utf8'), ts.ScriptTarget.Latest, true);
const orderNode = ast.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(decl => decl.name.getText(ast) === 'STORY_BEAT_ORDER'));
const order = orderNode.declarationList.declarations[0].initializer.elements.map(element => element.text);
const contracts = [];
for (const directory of readdirSync(beatsDir, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^(ch\d+|prologue)$/.test(entry.name))) {
  for (const name of readdirSync(path.join(beatsDir, directory.name))) {
    if (!name.endsWith('.ts') || /^(rail-|index\.)|\.test\./.test(name)) continue;
    const source = readFileSync(path.join(beatsDir, directory.name, name), 'utf8');
    const symbol = source.match(/export const (beat\w+) = defineBeat\(/)?.[1];
    if (!symbol) continue;
    contracts.push({ id: name.slice(0, -3), chapter: directory.name, symbol });
  }
}
contracts.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const missing = order.filter(id => id !== 'done' && !contracts.some(contract => contract.id === id));
const extra = contracts.filter(contract => !order.includes(contract.id));
if (missing.length || extra.length) throw new Error(`Beat declarations disagree with sequence: missing=${missing} extra=${extra.map(c => c.id)}`);
let stale = false;
function emit(file, content) {
  const full = path.join(root, file);
  if (readFileSync(full, 'utf8') === content) return;
  if (check) { console.error(`Generated beat view is stale: ${file}`); stale = true; }
  else writeFileSync(full, content);
}
for (const chapter of [...new Set(contracts.map(c => c.chapter))]) {
  const rows = contracts.filter(c => c.chapter === chapter);
  emit(`src/story/beats/${chapter}/index.ts`, "import { registerBeat } from '../registry.ts';\n" + rows.map(c => `import { ${c.symbol} } from './${c.id}.ts';`).join('\n') + `\n\nexport const ${chapter.toUpperCase()}_BEATS = [${rows.map(c => c.symbol).join(', ')}] as const;\nfor (const contract of ${chapter.toUpperCase()}_BEATS) registerBeat(contract);\n`);
}
emit('src/story/beats/definitions.ts',
  "// Generated from authored beat declarations. Run npm run chapter:registry:generate.\n"
  + "import type { StoryBeat } from '../storyState.ts';\nimport type { BeatContract } from './beatContract.ts';\n"
  + contracts.map(c => `import { ${c.symbol} } from './${c.chapter}/${c.id}.ts';`).join('\n')
  + "\n\nexport const BEAT_DEFINITIONS: Partial<Record<StoryBeat, BeatContract>> = {\n"
  + contracts.map(c => `  '${c.id}': ${c.symbol}`).join(',\n') + '\n};\n');
if (stale) process.exit(1);
const command = spawnSync(process.execPath, [path.join(root, 'node_modules/vite-node/vite-node.mjs'), '--config', 'tools/beat-tools.config.mjs', 'tools/generate-beat-views.ts', ...(check ? ['--check'] : [])], { cwd: root, stdio: 'inherit' });
process.exit(command.status ?? 1);
