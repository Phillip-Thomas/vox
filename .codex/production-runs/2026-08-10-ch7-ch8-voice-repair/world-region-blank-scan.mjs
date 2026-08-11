// World-region (HUD-excluded) blank scan — defect CIN-06.
//
// frame-defect-scan.mjs flags a frame only when the WHOLE frame's luminance
// std falls under 2.0, so a frame whose 3D world is black but which carries the
// objective card, the caption band and the audit band passes. This scan crops
// the HUD bands away and tests the world region alone, then reports both
// numbers per frame so the two scans are directly comparable.
//
// The crop is stated, not implied: the caption band sits low-centre, the audit
// band top-right and the guidance HUD top-left in every captured layout, so the
// world region is the central box below/above those bands. The fractions are
// written into the report with every result.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = process.argv.slice(2).filter(a => !a.startsWith('--'));
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : null;
if (roots.length === 0) {
  console.error('usage: node world-region-blank-scan.mjs <dir> [dir...] [--out file.json]');
  process.exit(1);
}

// World region: x 10%..90%, y 16%..70%. Excludes the top HUD/audit band and the
// bottom caption band in every captured aspect (1280x720, 390x844, 844x390).
const CROP = { x0: 0.10, x1: 0.90, y0: 0.16, y1: 0.70 };
const WORLD_BLANK_STD = 2.0;

const PY = `
import sys, json
from PIL import Image
x0, x1, y0, y1 = [float(v) for v in sys.argv[1:5]]
out = []
for p in sys.argv[5:]:
    im = Image.open(p).convert('L')
    W, H = im.size
    full = im.resize((160, 90))
    fpx = list(full.getdata())
    fn = len(fpx)
    fmean = sum(fpx) / fn
    fvar = sum((v - fmean) ** 2 for v in fpx) / fn
    box = (int(W * x0), int(H * y0), int(W * x1), int(H * y1))
    crop = im.crop(box).resize((128, 72))
    cpx = list(crop.getdata())
    cn = len(cpx)
    cmean = sum(cpx) / cn
    cvar = sum((v - cmean) ** 2 for v in cpx) / cn
    out.append({
        "path": p, "size": [W, H], "cropBox": box,
        "fullMean": round(fmean, 3), "fullStd": round(fvar ** 0.5, 3),
        "worldMean": round(cmean, 3), "worldStd": round(cvar ** 0.5, 3),
        "worldMax": max(cpx), "worldMin": min(cpx)
    })
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

const report = {
  scannedAt: new Date().toISOString(),
  method: 'per-frame luminance std over the HUD-excluded world crop, alongside the whole-frame std that frame-defect-scan.mjs uses',
  worldCropFractions: CROP,
  worldBlankStdThreshold: WORLD_BLANK_STD,
  attributionNote: 'A world-black frame here is recorded as UNATTRIBUTED, HEADLESS-ONLY EVIDENCE. No headed or real-GPU cold deep link was captured in this run, so the earlier "headless cold-boot characteristic" classification is not supported and is withdrawn (CIN-06).',
  roots,
  directories: []
};

for (const root of roots) {
  if (!fs.existsSync(root)) { report.directories.push({ dir: root, missing: true }); continue; }
  const files = walk(root).sort();
  const stats = [];
  for (let i = 0; i < files.length; i += 50) {
    const chunk = files.slice(i, i + 50);
    const r = spawnSync('python3',
      ['-c', PY, String(CROP.x0), String(CROP.x1), String(CROP.y0), String(CROP.y1), ...chunk],
      { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
    stats.push(...JSON.parse(r.stdout));
  }
  const worldBlank = stats.filter(s => s.worldStd < WORLD_BLANK_STD);
  const fullBlank = stats.filter(s => s.fullStd < WORLD_BLANK_STD);
  report.directories.push({
    dir: root,
    frameCount: stats.length,
    worldBlankCount: worldBlank.length,
    wholeFrameBlankCount: fullBlank.length,
    worldBlankFrames: worldBlank.map(s => ({
      path: path.relative(process.cwd(), s.path),
      worldStd: s.worldStd, worldMean: s.worldMean, fullStd: s.fullStd,
      classification: 'world-black frame — unattributed, headless-only evidence'
    })),
    minWorldStd: stats.length ? Math.min(...stats.map(s => s.worldStd)) : null,
    medianWorldStd: stats.length
      ? stats.map(s => s.worldStd).sort((a, b) => a - b)[Math.floor(stats.length / 2)] : null
  });
  console.log(root, 'frames', stats.length, 'worldBlank', worldBlank.length, 'wholeFrameBlank', fullBlank.length);
}

if (OUT) {
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log('wrote', OUT);
}
