// Long-running procedural atlas harness.
//
// Runs the real app under ?agent=1, captures deterministic camera vantages, and
// saves screenshots + metrics + profile JSON so procedural systems can be judged
// together instead of in subsystem isolation.

import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SEEDS_FILE = resolve(ROOT, 'src/utils/proceduralAtlasSeeds.json');
const OUT_ROOT = resolve(ROOT, 'captures/procedural-atlas');
const DEFAULT_BASE = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const WINDOWS_FALLBACK_EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

const ARCHETYPES = ['verdant', 'arid', 'frozen', 'volcanic', 'oceanic', 'crystal', 'metallic', 'fungal', 'anomaly'];
const ALL_STAGES = ['bare', 'color', 'material', 'alive', 'paradox'];
const ALL_QUALITIES = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO'];
const EFFECT_VIEWS = new Set([
  'surfaceEffects',
  'material',
  'hazard',
  'mineral',
  'sandDust',
  'dirtLife',
  'pollen',
  'frost',
  'lavaHeat',
  'ash',
  'crystalGlints',
  'metallicFlecks',
  'fungalSpores'
]);

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return def;
}

function commandPath(command) {
  try {
    return execFileSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function resolveChromiumExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (existsSync('/snap/bin/chromium')) return '/snap/bin/chromium';
  const chromiumPath = commandPath('chromium') ?? commandPath('chromium-browser') ?? commandPath('google-chrome');
  if (chromiumPath) return chromiumPath;
  if (existsSync(WINDOWS_FALLBACK_EXE)) return WINDOWS_FALLBACK_EXE;
  return undefined;
}

async function serverHealthy(baseUrl) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(baseUrl) {
  if (await serverHealthy(baseUrl)) {
    return { owned: false, process: null, baseUrl };
  }
  if (arg('no-start', false)) {
    throw new Error(`No healthy dev server at ${baseUrl}. Start Vite or omit --no-start.`);
  }
  const url = new URL(baseUrl);
  const port = url.port || '5173';
  const host = url.hostname || '127.0.0.1';
  const proc = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', port], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' }
  });
  proc.stdout.on('data', chunk => process.stdout.write(`[vite] ${chunk}`));
  proc.stderr.on('data', chunk => process.stderr.write(`[vite] ${chunk}`));
  for (let i = 0; i < 80; i++) {
    if (await serverHealthy(baseUrl)) return { owned: true, process: proc, baseUrl };
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  proc.kill('SIGTERM');
  throw new Error(`Timed out waiting for Vite at ${baseUrl}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function aggregateViewMetrics(viewResults) {
  if (!viewResults.length) return null;
  const first = viewResults[0].metrics;
  const layerCounts = {};
  const materialProgramKeys = new Set();
  const aggregate = {
    ...first,
    fps: first.fps > 0 ? first.fps : 0,
    p50: first.p50 ?? 0,
    p95: first.p95 ?? 0,
    drawCalls: first.drawCalls ?? 0,
    triangles: first.triangles ?? 0,
    materialCount: first.materialCount ?? 0,
    programCount: first.programCount ?? 0,
    estimatedDrawCalls: first.estimatedDrawCalls ?? 0,
    estimatedTriangles: first.estimatedTriangles ?? 0
  };
  for (const { metrics } of viewResults) {
    if (metrics.fps > 0) aggregate.fps = aggregate.fps > 0 ? Math.min(aggregate.fps, metrics.fps) : metrics.fps;
    aggregate.p50 = Math.max(aggregate.p50 ?? 0, metrics.p50 ?? 0);
    aggregate.p95 = Math.max(aggregate.p95 ?? 0, metrics.p95 ?? 0);
    aggregate.drawCalls = Math.max(aggregate.drawCalls ?? 0, metrics.drawCalls ?? 0);
    aggregate.triangles = Math.max(aggregate.triangles ?? 0, metrics.triangles ?? 0);
    aggregate.materialCount = Math.max(aggregate.materialCount ?? 0, metrics.materialCount ?? 0);
    aggregate.programCount = Math.max(aggregate.programCount ?? 0, metrics.programCount ?? 0);
    aggregate.estimatedDrawCalls = Math.max(aggregate.estimatedDrawCalls ?? 0, metrics.estimatedDrawCalls ?? 0);
    aggregate.estimatedTriangles = Math.max(aggregate.estimatedTriangles ?? 0, metrics.estimatedTriangles ?? 0);
    for (const [key, value] of Object.entries(metrics.layerCounts ?? {})) {
      layerCounts[key] = Math.max(layerCounts[key] ?? 0, value ?? 0);
    }
    for (const key of metrics.materialProgramKeys ?? []) materialProgramKeys.add(key);
  }
  aggregate.layerCounts = layerCounts;
  aggregate.materialProgramKeys = [...materialProgramKeys].sort();
  return aggregate;
}

function casesForMode(mode, fixtures) {
  if (mode === 'smoke') {
    return [
      { archetype: 'verdant', ...fixtures.verdant[0], quality: 'HIGH', stage: 'alive', views: ['overhead', 'tree', 'coast', 'material'] },
      { archetype: 'arid', ...fixtures.arid[0], quality: 'HIGH', stage: 'alive', views: ['overhead', 'tree', 'coast', 'sandDust'] },
      { archetype: 'fungal', ...fixtures.fungal[0], quality: 'HIGH', stage: 'alive', views: ['overhead', 'tree', 'coast', 'fungalSpores'] }
    ];
  }
  if (mode === 'baseline') {
    return ARCHETYPES.flatMap(archetype =>
      fixtures[archetype].slice(0, 2).flatMap(seed =>
        ['HIGH', 'MEDIUM'].map(quality => ({
          archetype,
          ...seed,
          quality,
          stage: 'alive',
          views: ['overhead', 'horizon', 'coast', 'tree', 'underCanopy', 'material']
        }))
      )
    );
  }
  if (mode === 'showcase') {
    return [
      { archetype: 'verdant', ...fixtures.verdant[0], quality: 'HIGH', stage: 'alive', views: ['tree', 'pollen', 'dirtLife', 'material'] },
      { archetype: 'arid', ...fixtures.arid[0], quality: 'HIGH', stage: 'alive', views: ['sandDust', 'material', 'horizon'] },
      { archetype: 'frozen', ...fixtures.frozen[0], quality: 'HIGH', stage: 'alive', views: ['frost', 'material', 'horizon'] },
      { archetype: 'volcanic', ...fixtures.volcanic[0], quality: 'HIGH', stage: 'alive', views: ['hazard', 'lavaHeat', 'ash', 'material'] },
      { archetype: 'oceanic', ...fixtures.oceanic[0], quality: 'HIGH', stage: 'alive', views: ['coast', 'pollen', 'material'] },
      { archetype: 'crystal', ...fixtures.crystal[0], quality: 'HIGH', stage: 'alive', views: ['mineral', 'crystalGlints', 'material'] },
      { archetype: 'metallic', ...fixtures.metallic[0], quality: 'HIGH', stage: 'alive', views: ['mineral', 'metallicFlecks', 'material'] },
      { archetype: 'fungal', ...fixtures.fungal[0], quality: 'HIGH', stage: 'alive', views: ['fungalSpores', 'tree', 'material'] },
      { archetype: 'anomaly', ...fixtures.anomaly[0], quality: 'HIGH', stage: 'alive', views: ['surfaceEffects', 'material', 'horizon'] }
    ];
  }
  if (mode === 'reality') {
    return ARCHETYPES.flatMap(archetype =>
      fixtures[archetype].slice(0, 1).flatMap(seed =>
        ALL_STAGES.map(stage => ({
          archetype,
          ...seed,
          quality: 'HIGH',
          stage,
          views: ['overhead', 'horizon', 'material']
        }))
      )
    );
  }
  if (mode === 'perf') {
    return ['verdant', 'volcanic', 'fungal', 'anomaly'].flatMap(archetype =>
      ALL_QUALITIES.map(quality => ({
        archetype,
        ...fixtures[archetype][0],
        quality,
        stage: 'alive',
        views: ['overhead', 'tree', 'material']
      }))
    );
  }
  if (mode === 'full' || mode === 'overnight') {
    return ARCHETYPES.flatMap(archetype =>
      fixtures[archetype].slice(0, mode === 'overnight' ? 3 : 2).flatMap(seed =>
        ['HIGH', 'MEDIUM'].flatMap(quality =>
          ALL_STAGES.map(stage => ({
            archetype,
            ...seed,
            quality,
            stage,
            views: mode === 'overnight' ? ['overhead', 'material'] : ['overhead', 'horizon', 'coast', 'tree', 'underCanopy', 'material']
          }))
        )
      )
    );
  }
  throw new Error(`Unknown atlas mode "${mode}"`);
}

function defectMarkdown(defects) {
  if (!defects.length) return '# Procedural Atlas Defects\n\nNo machine defects detected.\n';
  const rows = defects.map(defect =>
    `| ${defect.severity} | ${defect.code} | ${defect.caseId} | ${defect.message.replace(/\|/g, '/')} |`
  );
  return [
    '# Procedural Atlas Defects',
    '',
    '| Severity | Code | Case | Message |',
    '| --- | --- | --- | --- |',
    ...rows,
    ''
  ].join('\n');
}

function detectCaseDefects(entry) {
  const defects = [];
  const metrics = entry.metrics;
  const budget = {
    ULTRA: { p95: 28, fps: 45, drawCalls: 560, triangles: 9200000, programs: 54 },
    HIGH: { p95: 24, fps: 50, drawCalls: 440, triangles: 4200000, programs: 46 },
    MEDIUM: { p95: 28, fps: 45, drawCalls: 320, triangles: 1500000, programs: 34 },
    LOW: { p95: 24, fps: 50, drawCalls: 220, triangles: 1000000, programs: 36 },
    POTATO: { p95: 20, fps: 55, drawCalls: 140, triangles: 800000, programs: 20 }
  }[entry.quality];
  const add = (code, severity, message) => defects.push({ code, severity, message, caseId: entry.caseId });
  if (metrics.fps > 0 && metrics.fps < budget.fps) add('low_fps', 'medium', `${metrics.fps} fps below ${budget.fps}`);
  if (metrics.p95 > budget.p95) add('slow_p95', metrics.p95 > budget.p95 * 1.35 ? 'high' : 'medium', `${metrics.p95}ms p95 above ${budget.p95}ms`);
  if (metrics.drawCalls > budget.drawCalls) add('too_many_draw_calls', 'medium', `${metrics.drawCalls} draw calls above ${budget.drawCalls}`);
  if (metrics.triangles > budget.triangles) add('too_many_triangles', 'medium', `${metrics.triangles} tris above ${budget.triangles}`);
  if ((metrics.programCount ?? 0) > budget.programs) add('shader_explosion', 'high', `${metrics.programCount} programs above ${budget.programs}`);
  const layers = metrics.layerCounts ?? {};
  const expectsOrganic =
    entry.profiles?.artDirection?.ecology?.richness > 0.35 &&
    entry.profiles?.artDirection?.ecology?.materialEligibility?.trees?.length > 0;
  if (entry.quality !== 'POTATO' && expectsOrganic && ((layers.grass ?? 0) + (layers.trees ?? 0) + (layers.flora ?? 0) + (layers.fauna ?? 0)) <= 0) {
    add('empty_ecology', 'high', 'expected organic layers but layer counts are empty');
  }
  for (const view of entry.views ?? []) {
    if (entry.quality !== 'POTATO' && EFFECT_VIEWS.has(view.view) && String(view.resolved).includes('no-effect')) {
      add('missing_effect_vantage', 'medium', `${view.view} resolved to ${view.resolved}`);
    }
  }
  return defects;
}

const mode = String(arg('mode', 'smoke'));
const label = String(arg('label', mode));
const baseUrl = String(arg('url', DEFAULT_BASE));
const headed = arg('headed', false);
const headlessArg = arg('headless', undefined);
const headless = headlessArg === undefined ? !headed : String(headlessArg) !== 'false';
const settleMs = Math.max(900, Number.parseInt(String(arg('settle', '1300')), 10) || 1300);
const warmMs = Math.max(250, Number.parseInt(String(arg('warm', '500')), 10) || 500);
const executablePath = resolveChromiumExecutable();
const fixtures = JSON.parse(readFileSync(SEEDS_FILE, 'utf8'));
const cases = casesForMode(mode, fixtures);
const runDir = resolve(OUT_ROOT, `${timestamp()}-${label}`);
const screenshotsDir = resolve(runDir, 'screenshots');
const profilesDir = resolve(runDir, 'profiles');
mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(profilesDir, { recursive: true });

const server = await ensureServer(baseUrl);
const browser = await chromium.launch({
  executablePath,
  headless,
  args: headless
    ? ['--ignore-gpu-blocklist', '--enable-gpu']
    : ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

const manifest = {
  label,
  mode,
  createdAt: new Date().toISOString(),
  baseUrl,
  server: { owned: server.owned },
  browser: {
    executablePath: executablePath ?? 'playwright-default',
    headless,
    mode: headless ? 'headless' : 'headed'
  },
  settleMs,
  warmMs,
  styleReference: {
    primary: 'trees',
    secondary: 'grass',
    note: 'Atlas critique should use the current tree quality and stylized canopy vibe as the standard for other procedural layers.'
  },
  caseCount: cases.length
};
writeFileSync(resolve(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const results = [];
const allDefects = [];
try {
  for (const [index, atlasCase] of cases.entries()) {
    const caseId = `${String(index + 1).padStart(3, '0')}-${atlasCase.archetype}-${atlasCase.x}_${atlasCase.y}-${atlasCase.stage}-${atlasCase.quality}`;
    const params = new URLSearchParams();
    params.set('agent', '1');
    params.set('atlas', '1');
    params.set('world', `${atlasCase.x},${atlasCase.y}`);
    params.set('profile', atlasCase.quality);
    params.set('voxelStage', atlasCase.stage);
    params.set('dayphase', String(atlasCase.day ?? 0.25));
    const url = `${baseUrl}?${params.toString()}`;
    console.log(`case ${caseId} -> ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    await page.evaluate(() => window.__game.ready());
    const profiles = await page.evaluate(() => window.__game.profiles());
    writeFileSync(resolve(profilesDir, `${caseId}.json`), JSON.stringify(profiles, null, 2));

    const viewResults = [];
    for (const view of atlasCase.views) {
      const resolved = await page.evaluate(v => window.__game.view(v), view);
      await page.waitForTimeout(warmMs);
      await page.evaluate(() => window.__game.resetMetrics());
      await page.waitForTimeout(settleMs);
      const outDir = resolve(screenshotsDir, atlasCase.archetype, `${atlasCase.x}_${atlasCase.y}`, atlasCase.stage, atlasCase.quality);
      mkdirSync(outDir, { recursive: true });
      const screenshot = resolve(outDir, `${view}.png`);
      await page.screenshot({ path: screenshot });
      const metrics = await page.evaluate(() => window.__game.metrics());
      console.log(`  ${view.padEnd(12)} ${String(resolved).padEnd(24)} fps=${metrics.fps} p95=${metrics.p95} draws=${metrics.drawCalls} tris=${metrics.triangles}`);
      viewResults.push({ view, resolved, screenshot: screenshot.replace(`${ROOT}/`, ''), metrics });
    }
    const metrics = aggregateViewMetrics(viewResults) ?? await page.evaluate(() => window.__game.metrics());
    const entry = { ...atlasCase, caseId, url, profiles, metrics, views: viewResults };
    results.push(entry);
    allDefects.push(...detectCaseDefects(entry));
  }
} finally {
  await browser.close();
  if (server.owned && server.process) server.process.kill('SIGTERM');
}

const summary = {
  ...manifest,
  completedAt: new Date().toISOString(),
  consoleErrors,
  results: results.map(entry => ({
    caseId: entry.caseId,
    archetype: entry.archetype,
    seed: entry.seed,
    coordinate: { x: entry.x, y: entry.y },
    quality: entry.quality,
    stage: entry.stage,
    paletteFamily: entry.profiles?.artDirection?.paletteFamily,
    styleReference: entry.profiles?.styleReference,
    metrics: entry.metrics,
    defects: detectCaseDefects(entry)
  })),
  defectCounts: allDefects.reduce((acc, defect) => {
    acc[defect.code] = (acc[defect.code] ?? 0) + 1;
    return acc;
  }, {}),
  screenshotCount: results.reduce((sum, entry) => sum + entry.views.length, 0)
};

writeFileSync(resolve(runDir, 'metrics.json'), JSON.stringify(results, null, 2));
writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(resolve(runDir, 'defects.md'), defectMarkdown(allDefects));
console.log(`atlas -> ${runDir.replace(`${ROOT}/`, '')}`);
console.log(`summary -> ${resolve(runDir, 'summary.json').replace(`${ROOT}/`, '')}`);
if (consoleErrors.length > 0) {
  console.warn(`console/page errors: ${consoleErrors.length}`);
  process.exitCode = 1;
}
