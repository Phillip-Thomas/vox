import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'screenshots');
const baseUrl = 'http://127.0.0.1:5173/?agent=1';

async function waitForBridge(page) {
  await page.waitForFunction(() => window.__game && typeof window.__game.ready === 'function', null, { timeout: 25000 });
}

async function waitForGrass(page) {
  await page.waitForFunction(() => {
    let grassCount = 0;
    window.__game.scene.traverse(object => {
      if (grassCount > 0 || !object.isInstancedMesh) return;
      let key = '';
      try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
      if (/grass-pbr/.test(key)) grassCount = object.count ?? 0;
    });
    return grassCount > 0;
  }, null, { timeout: 45000 });
  await page.waitForTimeout(900);
}

function grassProbeScript() {
  const findGrass = () => {
    let found = null;
    window.__game.scene.traverse(object => {
      if (found || !object.isInstancedMesh) return;
      let key = '';
      try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
      if (/grass-pbr/.test(key)) found = object;
    });
    return found;
  };

  const dominantUp = p => {
    const ax = Math.abs(p.x);
    const ay = Math.abs(p.y);
    const az = Math.abs(p.z);
    if (ax >= ay && ax >= az) return { x: Math.sign(p.x) || 1, y: 0, z: 0 };
    if (ay >= ax && ay >= az) return { x: 0, y: Math.sign(p.y) || 1, z: 0 };
    return { x: 0, y: 0, z: Math.sign(p.z) || 1 };
  };

  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  });
  const len = v => Math.hypot(v.x, v.y, v.z) || 1;
  const norm = v => {
    const l = len(v);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };

  const mesh = findGrass();
  const result = {
    grassCount: mesh?.count ?? 0,
    grassCapacity: mesh?.instanceMatrix?.count ?? 0,
    grassKey: '',
    target: null
  };
  if (!mesh || mesh.count <= 0) return result;
  try { result.grassKey = mesh.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }

  const arr = mesh.instanceMatrix.array;
  let best = -1;
  let bestY = -Infinity;
  for (let i = 0; i < mesh.count; i++) {
    const y = arr[i * 16 + 13];
    if (y > bestY) {
      bestY = y;
      best = i;
    }
  }
  if (best < 0) return result;

  const p = {
    x: arr[best * 16 + 12],
    y: arr[best * 16 + 13],
    z: arr[best * 16 + 14]
  };
  const up = dominantUp(p);
  const seedSide = Math.abs(up.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const side = norm(cross(seedSide, up));
  const forward = norm(cross(up, side));
  const eye = {
    x: p.x + up.x * 1.65 + side.x * 4.2 + forward.x * 1.2,
    y: p.y + up.y * 1.65 + side.y * 4.2 + forward.y * 1.2,
    z: p.z + up.z * 1.65 + side.z * 4.2 + forward.z * 1.2
  };
  const target = {
    x: p.x + up.x * 0.45,
    y: p.y + up.y * 0.45,
    z: p.z + up.z * 0.45
  };
  window.__game.lookFrom(eye.x, eye.y, eye.z, target.x, target.y, target.z);
  result.target = { p, eye, target };
  return result;
}

async function collectProof(page) {
  return page.evaluate(() => {
    const errors = Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay'));
    const bodyText = document.body.innerText.slice(0, 300);
    const metrics = window.__game.metrics();
    return { title: document.title, url: location.href, bodyText, frameworkOverlay: errors, metrics };
  });
}

async function capture(page, name, url, viewport, preSetup, postSetup) {
  console.log(`capture:start:${name}`);
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForBridge(page);
  const preProof = preSetup ? await preSetup(page) : {};
  await waitForGrass(page);
  const postProof = postSetup ? await postSetup(page) : {};
  await page.waitForTimeout(1000);
  const proof = await collectProof(page);
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`capture:done:${name}`);
  return { name, file, proof: { ...proof, ...preProof, ...postProof } };
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
const consoleIssues = [];
page.on('console', msg => {
  if (['error', 'warning'].includes(msg.type())) consoleIssues.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));

const validationUrl = `${baseUrl}&world=0,0&dayphase=0.4734`;
const frameTopFace = async p => ({
  vantage: await p.evaluate(() => {
    window.__game.lookFrom(18, 64, 18, 0, 50, 0);
    return 'top-face-wide';
  })
});

const desktopWide = await capture(
  page,
  'desktop-wide-grass',
  validationUrl,
  { width: 1440, height: 900 },
  frameTopFace
);

const desktopClose = await capture(
  page,
  'desktop-close-hair-grass',
  validationUrl,
  { width: 1440, height: 900 },
  frameTopFace,
  async p => p.evaluate(grassProbeScript)
);

const mobileClose = await capture(
  page,
  'mobile-close-hair-grass',
  validationUrl,
  { width: 390, height: 844 },
  frameTopFace,
  async p => p.evaluate(grassProbeScript)
);

await browser.close();

const relevantConsoleIssues = consoleIssues.filter(issue => ![
  'GL Driver Message',
  'using deprecated parameters for the initialization function',
  'Firebase anonymous sign-in failed'
].some(fragment => issue.includes(fragment)));

console.log(JSON.stringify({
  url: validationUrl,
  desktopWide,
  desktopClose,
  mobileClose,
  consoleIssues,
  relevantConsoleIssues
}, null, 2));

if (
  desktopWide.proof.frameworkOverlay ||
  desktopClose.proof.frameworkOverlay ||
  mobileClose.proof.frameworkOverlay ||
  desktopClose.proof.grassCount <= 0 ||
  mobileClose.proof.grassCount <= 0 ||
  relevantConsoleIssues.length > 0
) {
  process.exitCode = 1;
}
