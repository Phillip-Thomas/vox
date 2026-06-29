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
const label = process.env.TREE_CAPTURE_LABEL || 'baseline';
const speciesList = ['round', 'conical', 'umbrella', 'weeping', 'wispy', 'frond'];

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

async function captureSpecies(page, species) {
  const url = `${baseUrl}tree-test.html?only=${species}`;
  const name = `${label}-${species}`;
  console.log(`capture:start:${name}`);
  await page.setViewportSize({ width: 860, height: 860 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForFunction(
    () => window.__treeTest && window.__treeTest.summary().length === 1,
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1800);

  const proof = await page.evaluate(() => {
    const tree = window.__treeTest.summary()[0];
    const materialKeys = [...new Set(tree.meshes.map(mesh => mesh.materialKey))].sort();
    const leaf = tree.meshes.find(mesh => /tree-leaf/.test(mesh.materialKey));
    return {
      title: document.title,
      url: location.href,
      frameworkOverlay: Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay')),
      tree,
      materialKeys,
      leafVertices: leaf?.vertices ?? 0
    };
  });

  const file = path.join(screenshotDir, `${name}.png`);
  const first = await page.screenshot({ path: file, fullPage: false });
  await page.waitForTimeout(900);
  const second = await page.screenshot({ fullPage: false });
  proof.motionChanged = sha(first) !== sha(second);
  proof.path = file;
  proof.pass = !proof.frameworkOverlay &&
    proof.materialKeys.includes('tree-leaf-v5') &&
    proof.materialKeys.includes('tree-bark-v5') &&
    proof.leafVertices > 0 &&
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

async function captureVariety(page) {
  const name = `${label}-variety`;
  console.log(`capture:start:${name}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}tree-test.html?count=24&cols=6`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__treeTest && window.__treeTest.summary().length === 24, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
  const proof = await page.evaluate(() => ({
    summary: window.__treeTest.summary(),
    frameworkOverlay: Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay'))
  }));
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  proof.path = file;
  proof.pass = !proof.frameworkOverlay && proof.summary.every(tree => tree.meshes.some(mesh => /tree-leaf-v5/.test(mesh.materialKey)));
  console.log(`capture:done:${name}`);
  return { name, file, proof };
}

async function captureWorld(page) {
  const name = `${label}-world`;
  const url = `${baseUrl}?agent=1&world=-92,-79&dayphase=0.4734&profile=HIGH`;
  console.log(`capture:start:${name}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForBridge(page);
  await page.evaluate(() => window.__game.view('tree'));
  await waitForTrees(page);
  await page.waitForTimeout(1600);
  const proof = await page.evaluate(() => {
    const meshes = [];
    window.__game.scene.traverse(object => {
      if (!object.isInstancedMesh) return;
      let key = '';
      try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
      if (!/tree-(bark|leaf|blossom|impostor)/.test(key)) return;
      meshes.push({
        key,
        count: object.count ?? 0,
        vertices: object.geometry?.attributes?.position?.count ?? 0,
        hasTuftShade: Boolean(object.geometry?.attributes?.aTuftShade)
      });
    });
    return {
      meshes,
      frameworkOverlay: Boolean(document.querySelector('vite-error-overlay, .vite-error-overlay')),
      url: location.href,
      title: document.title
    };
  });
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  proof.path = file;
  proof.pass = !proof.frameworkOverlay &&
    proof.meshes.some(mesh => mesh.key === 'tree-leaf-v5' && mesh.count > 0 && mesh.vertices > 0 && mesh.hasTuftShade);
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
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const species = [];
for (const item of speciesList) {
  species.push(await captureSpecies(page, item));
}
const variety = await captureVariety(page);
const world = await captureWorld(page);

await browser.close();

const result = {
  label,
  canonicalPreview: `${baseUrl}tree-test.html`,
  species,
  variety,
  world,
  consoleIssues,
  failedResponses,
  relevantConsoleIssues: relevantIssues(consoleIssues).filter(issue => {
    if (!issue.includes('Failed to load resource')) return true;
    return failedResponses.some(item => !/\/favicon\.ico$/.test(item.url));
  })
};

console.log(JSON.stringify(result, null, 2));

if (
  species.some(item => !item.proof.pass) ||
  !variety.proof.pass ||
  !world.proof.pass ||
  result.relevantConsoleIssues.length > 0
) {
  process.exitCode = 1;
}
