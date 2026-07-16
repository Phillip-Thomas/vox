import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = join(repoRoot, 'shared', 'economyCatalog.json');
const targets = [
  join(repoRoot, 'main', 'src', 'game', 'data', 'generatedEconomyCatalog.ts'),
  join(repoRoot, 'server', 'src', 'generated', 'economyCatalog.ts')
];

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const rendered = `// Generated from shared/economyCatalog.json by scripts/generate-economy-catalog.mjs.\n`
  + `// Do not hand-edit this binding; change the shared catalog and regenerate it.\n\n`
  + `export const ECONOMY_CATALOG = ${JSON.stringify(catalog, null, 2)} as const;\n`;
const checkOnly = process.argv.includes('--check');

let stale = false;
for (const target of targets) {
  if (checkOnly) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      // Missing bindings are stale by definition.
    }
    if (current !== rendered) {
      stale = true;
      console.error(`${target} is stale; run node scripts/generate-economy-catalog.mjs`);
    }
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rendered);
}

if (stale) process.exitCode = 1;
