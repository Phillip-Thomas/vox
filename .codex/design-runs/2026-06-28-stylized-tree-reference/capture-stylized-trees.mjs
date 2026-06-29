import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'screenshots');
const baseUrl = 'http://127.0.0.1:5173/';

fs.mkdirSync(screenshotDir, { recursive: true });

function sha(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function relevantIssues(issues) {
  return issues.filter(issue => ![
    'GL Driver Message',
    'using deprecated parameters for the initialization function',
    'Firebase anonymous sign-in failed',
    'The AudioContext was not allowed to start'
  ].some(fragment => issue.includes(fragment)));
}

function speciesLooksActive(sample) {
  return sample &&
    typeof sample.branchJointAngle === 'number' &&
    typeof sample.whorlCount === 'number' &&
    typeof sample.gnarl === 'number' &&
    typeof sample.branchStiffness === 'number' &&
    typeof sample.foliageSpacing === 'number' &&
    typeof sample.trunkFlare === 'number';
}

async function captureHarness(page, name, url, viewport, minTrees) {
  console.log(`capture:start:${name}`);
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForFunction(() => window.__treeTest && window.__treeTest.summary().length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1800);

  const proof = await page.evaluate(() => {
    const summary = window.__treeTest.summary();
    const materialKeys = [...new Set(summary.flatMap(tree => tree.meshes.map(mesh => mesh.materialKey)))].sort();
    const leafVertices = summary.map(tree => ({
      key: tree.key,
      silhouette: tree.silhouette,
      vertices: tree.meshes.find(mesh => /tree-leaf/.test(mesh.materialKey))?.vertices ?? 0
    }));
    return {
      title: document.title,
      url: location.href,
      frameworkOverlay: Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay')),
      treeCount: summary.length,
      silhouettes: [...new Set(summary.map(tree => tree.silhouette))].sort(),
      materialKeys,
      leafVertices,
      windSamples: summary.slice(0, 6).map(tree => ({
        key: tree.key,
        silhouette: tree.silhouette,
        wind: tree.wind,
        canopyDensity: tree.canopyDensity,
        leafScale: tree.leafScale
      })),
      speciesSamples: summary.slice(0, 6).map(tree => ({
        key: tree.key,
        silhouette: tree.silhouette,
        species: tree.species
      }))
    };
  });

  const file = path.join(screenshotDir, `${name}.png`);
  const first = await page.screenshot({ path: file, fullPage: false });
  await page.waitForTimeout(900);
  const second = await page.screenshot({ fullPage: false });
  proof.motionChanged = sha(first) !== sha(second);
  proof.path = file;
  proof.pass = !proof.frameworkOverlay &&
    proof.treeCount >= minTrees &&
    proof.materialKeys.includes('tree-leaf-v5') &&
    proof.materialKeys.includes('tree-bark-v5') &&
    proof.leafVertices.every(item => item.vertices > 0) &&
    proof.speciesSamples.every(item => speciesLooksActive(item.species)) &&
    proof.motionChanged;
  console.log(`capture:done:${name}`);
  return { name, file, proof };
}

async function waitForBridge(page) {
  await page.waitForFunction(() => window.__game && typeof window.__game.ready === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window.__game.ready());
}

async function waitForTrees(page) {
  await page.waitForFunction(() => {
    let leafCount = 0;
    window.__game.scene.traverse(object => {
      if (leafCount > 0 || !object.isInstancedMesh) return;
      let key = '';
      try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
      if (/tree-leaf/.test(key)) leafCount = object.count ?? 0;
    });
    return leafCount > 0;
  }, null, { timeout: 60000 });
}

function treeProbeScript() {
  const meshes = [];
  window.__game.scene.traverse(object => {
    if (!object.isInstancedMesh) return;
    let key = '';
    try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
    if (!/tree-(bark|leaf|blossom|impostor)/.test(key)) return;
    const u = object.material?.userData?.shader?.uniforms ?? {};
    const vec2 = value => value ? { x: value.x, y: value.y } : null;
    meshes.push({
      key,
      count: object.count ?? 0,
      vertices: object.geometry?.attributes?.position?.count ?? 0,
      hasTuftShade: Boolean(object.geometry?.attributes?.aTuftShade),
      wind: {
        dir: vec2(u.uWindDir?.value),
        strength: u.uWindStrength?.value ?? null,
        gustStrength: u.uWindGustStrength?.value ?? null,
        gustScale: u.uWindGustScale?.value ?? null,
        gustSpeed: u.uWindGustSpeed?.value ?? null,
        turbulence: u.uWindTurbulence?.value ?? null,
        veer: u.uWindVeer?.value ?? null,
        offset: vec2(u.uWindOffset?.value)
      },
      canopyCenterY: u.uCanopyCenterY?.value ?? null
    });
  });
  return {
    meshes,
    metrics: window.__game.metrics(),
    frameworkOverlay: Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay')),
    url: location.href,
    title: document.title
  };
}

async function captureWorld(page, name, url, viewport, viewName) {
  console.log(`capture:start:${name}`);
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForBridge(page);
  await page.evaluate(name => window.__game.view(name), viewName);
  await waitForTrees(page);
  await page.waitForTimeout(1400);
  const proof = await page.evaluate(treeProbeScript);
  const file = path.join(screenshotDir, `${name}.png`);
  const first = await page.screenshot({ path: file, fullPage: false });
  await page.waitForTimeout(900);
  const second = await page.screenshot({ fullPage: false });
  proof.motionChanged = sha(first) !== sha(second);
  proof.path = file;
  proof.pass = !proof.frameworkOverlay &&
    proof.meshes.some(mesh => mesh.key === 'tree-leaf-v5' && mesh.count > 0 && mesh.vertices > 0 && mesh.hasTuftShade) &&
    proof.meshes.some(mesh => mesh.key === 'tree-bark-v5' && mesh.count > 0 && mesh.vertices > 0) &&
    proof.meshes.some(mesh => mesh.wind.gustStrength != null && mesh.wind.gustScale != null) &&
    proof.meshes.some(mesh => mesh.canopyCenterY != null) &&
    proof.motionChanged;
  console.log(`capture:done:${name}`);
  return { name, file, proof };
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
const consoleIssues = [];
const failedResponses = [];
page.on('console', msg => {
  if (['error', 'warning'].includes(msg.type())) consoleIssues.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));
page.on('response', response => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() });
  }
});

const silhouettes = await captureHarness(
  page,
  'stylized-tree-silhouettes',
  `${baseUrl}tree-test.html?mode=silhouettes`,
  { width: 1440, height: 900 },
  6
);

const variety = await captureHarness(
  page,
  'stylized-tree-variety',
  `${baseUrl}tree-test.html?count=24&cols=6`,
  { width: 1440, height: 900 },
  24
);

const mobileWeeping = await captureHarness(
  page,
  'stylized-tree-weeping-mobile',
  `${baseUrl}tree-test.html?only=weeping`,
  { width: 390, height: 844 },
  1
);

const worldUrl = `${baseUrl}?agent=1&world=-92,-79&dayphase=0.4734&profile=HIGH`;
const worldTree = await captureWorld(
  page,
  'stylized-tree-world',
  worldUrl,
  { width: 1440, height: 900 },
  'tree'
);

await browser.close();

const result = {
  canonicalPreview: `${baseUrl}tree-test.html`,
  gamePreview: worldUrl,
  screenshots: { silhouettes, variety, mobileWeeping, worldTree },
  consoleIssues,
  failedResponses,
  relevantConsoleIssues: relevantIssues(consoleIssues).filter(issue => {
    if (!issue.includes('Failed to load resource')) return true;
    return failedResponses.some(item => !/\/favicon\.ico$/.test(item.url));
  })
};

console.log(JSON.stringify(result, null, 2));

if (
  !silhouettes.proof.pass ||
  !variety.proof.pass ||
  !mobileWeeping.proof.pass ||
  !worldTree.proof.pass ||
  result.relevantConsoleIssues.length > 0
) {
  process.exitCode = 1;
}
