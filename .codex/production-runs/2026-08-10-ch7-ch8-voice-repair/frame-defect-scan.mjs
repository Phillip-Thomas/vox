// Objective frame-defect scan over a capture directory tree.
//
// Flags only measurable defects: a frame whose pixel variance is at or below a
// blank threshold (black/blank frame), and frame-to-frame luminance jumps that
// exceed the pop threshold. It renders no aesthetic judgement.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('usage: node frame-defect-scan.mjs <dir> [dir...]');
  process.exit(1);
}

const PY = `
import sys, json
from PIL import Image
out = []
for p in sys.argv[1:]:
    im = Image.open(p).convert('L').resize((160, 90))
    px = list(im.getdata())
    n = len(px)
    mean = sum(px) / n
    var = sum((v - mean) ** 2 for v in px) / n
    out.append({"path": p, "mean": round(mean, 3), "std": round(var ** 0.5, 3)})
print(json.dumps(out))
`;

const walk = (dir, acc = []) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith('.png')) acc.push(full);
  }
  return acc;
};

const report = { scannedAt: new Date().toISOString(), roots, directories: [] };
for (const root of roots) {
  const files = walk(root).sort();
  const chunks = [];
  for (let i = 0; i < files.length; i += 60) chunks.push(files.slice(i, i + 60));
  const stats = [];
  for (const chunk of chunks) {
    const r = spawnSync('python3', ['-c', PY, ...chunk], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
    stats.push(...JSON.parse(r.stdout));
  }
  const blank = stats.filter(s => s.std < 2.0);
  const pops = [];
  for (let i = 1; i < stats.length; i++) {
    const d = Math.abs(stats[i].mean - stats[i - 1].mean);
    if (d > 40) pops.push({ from: stats[i - 1].path, to: stats[i].path, meanJump: Number(d.toFixed(2)) });
  }
  report.directories.push({
    dir: root,
    frameCount: stats.length,
    blankFrames: blank,
    luminanceJumps: pops,
    minStd: stats.length ? Math.min(...stats.map(s => s.std)) : null,
    meanRange: stats.length ? [Math.min(...stats.map(s => s.mean)), Math.max(...stats.map(s => s.mean))] : null
  });
  console.log(root, 'frames', stats.length, 'blank', blank.length, 'jumps>40', pops.length);
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`.slice(0, 0));
fs.writeFileSync(path.join(roots[0], '..', 'frame-defect-scan.json'), `${JSON.stringify(report, null, 2)}\n`);
