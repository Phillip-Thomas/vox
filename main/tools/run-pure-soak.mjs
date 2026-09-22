// No-watch runner for the pure (symbolic) score soak.
//
//   npm run score:soak:pure -- --minutes 45 --seed 123
//
// `vite-node` starts a Vite server, and Vite's default watcher walks the whole
// repo — including captures/ and renders/ — which exceeds this machine's
// inotify budget and kills the run with ENOSPC before a single bar is planned
// (audit 1 §7). PROBE_NO_HMR=1 selects the no-watch server config in
// vite.config.ts, so the soak runs anywhere the watcher limit is tight.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(toolsDir);
const viteNode = path.join(root, 'node_modules', 'vite-node', 'vite-node.mjs');
const cli = path.join(toolsDir, 'score-soak-cli.ts');

const result = spawnSync(process.execPath, [viteNode, cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PROBE_NO_HMR: '1' }
});
process.exit(result.status ?? 1);
