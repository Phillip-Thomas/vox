// Deterministic fauna specimen atlas.
//
// Default coverage is the full six-species x two-phase x three-quality x
// three-light x three-view matrix. Use --compact for a six-shot renderer smoke.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_ROOT = resolve(ROOT, 'captures/fauna-atlas');
const DEFAULT_BASE = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const WINDOWS_FALLBACK_EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const ALL_SPECIES = ['grazer', 'woolly', 'runner', 'hopper', 'dragonfly', 'fish'];
const ALL_PROFILES = ['HIGH', 'MEDIUM', 'LOW'];
const ALL_LIGHTS = ['front', 'back', 'night'];
const ALL_PHASES = [0.12, 0.62];
const ALL_VIEWS = ['threequarter', 'side', 'top'];

function arg(name, fallback) {
  const hit = process.argv.find(value => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return fallback;
}

function csvArg(name, fallback) {
  return String(arg(name, fallback.join(',')))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function validateSelection(name, values, allowed) {
  if (values.length === 0) throw new Error(`${name} selection cannot be empty.`);
  const invalid = values.filter(value => !allowed.includes(value));
  if (invalid.length > 0) {
    throw new Error(`Invalid ${name}: ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  return values;
}

function commandPath(command) {
  try {
    return execFileSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function cachedPlaywrightChromium() {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return null;
  const installs = readdirSync(cache)
    .filter(name => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const install of installs) {
    for (const relative of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const candidate = join(cache, install, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function resolveChromiumExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const system = commandPath('chromium') ?? commandPath('chromium-browser') ?? commandPath('google-chrome');
  if (system) return system;
  const cached = cachedPlaywrightChromium();
  if (cached) return cached;
  if (existsSync(WINDOWS_FALLBACK_EXE)) return WINDOWS_FALLBACK_EXE;
  return undefined;
}

async function serverHealthy(baseUrl) {
  try {
    const target = new URL('voxel-test.html', baseUrl);
    const response = await fetch(target, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(baseUrl) {
  if (await serverHealthy(baseUrl)) return { owned: false, process: null };
  if (arg('no-start', false)) {
    throw new Error(`No fauna harness at ${new URL('voxel-test.html', baseUrl)}.`);
  }
  const url = new URL(baseUrl);
  const port = url.port || '5173';
  const host = url.hostname || '127.0.0.1';
  const process = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', port], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...globalThis.process.env, BROWSER: 'none' }
  });
  process.stdout.on('data', chunk => globalThis.process.stdout.write(`[vite] ${chunk}`));
  process.stderr.on('data', chunk => globalThis.process.stderr.write(`[vite] ${chunk}`));
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await serverHealthy(baseUrl)) return { owned: true, process };
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  process.kill('SIGTERM');
  throw new Error(`Timed out waiting for Vite at ${baseUrl}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function phaseSlug(phase) {
  return phase.toFixed(2).replace('.', '_');
}

function relativeToRoot(path) {
  return path.replace(`${ROOT}/`, '');
}

const compact = Boolean(arg('compact', false));
const species = validateSelection('species', csvArg('species', ALL_SPECIES), ALL_SPECIES);
const profiles = validateSelection(
  'profiles',
  csvArg('profiles', compact ? ['HIGH'] : ALL_PROFILES).map(value => value.toUpperCase()),
  ALL_PROFILES
);
const lights = validateSelection('lights', csvArg('lights', compact ? ['front'] : ALL_LIGHTS), ALL_LIGHTS);
const views = validateSelection('views', csvArg('views', compact ? ['threequarter'] : ALL_VIEWS), ALL_VIEWS);
const phases = csvArg('phases', compact ? [ALL_PHASES[0]] : ALL_PHASES).map(value => Number(value));
if (phases.length === 0 || phases.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
  throw new Error('Phases must be comma-separated values in the 0..1 range.');
}

const baseUrl = String(arg('url', DEFAULT_BASE));
const seed = Math.trunc(Number(arg('seed', 12345))) || 12345;
const settleMs = Math.max(200, Math.trunc(Number(arg('settle', compact ? 500 : 850))) || 850);
const headed = Boolean(arg('headed', false));
const executablePath = resolveChromiumExecutable();
const label = String(arg('label', compact ? 'compact' : 'full'));
const runDir = resolve(OUT_ROOT, `${timestamp()}-${label}`);
const screenshotRoot = resolve(runDir, 'screenshots');
mkdirSync(screenshotRoot, { recursive: true });

const cases = profiles.flatMap(profile =>
  lights.flatMap(light =>
    species.flatMap(kind =>
      phases.flatMap(phase => views.map(view => ({ profile, light, species: kind, phase, view })))
    )
  )
);

const server = await ensureServer(baseUrl);
const browser = await chromium.launch({
  executablePath,
  headless: !headed,
  args: headed
    ? ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=gl']
    : ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const browserErrors = [];
let activeCase = 'startup';
page.on('pageerror', error => browserErrors.push({ caseId: activeCase, type: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() === 'error') {
    browserErrors.push({ caseId: activeCase, type: 'console', message: message.text() });
  }
});

const manifest = {
  label,
  compact,
  createdAt: new Date().toISOString(),
  baseUrl,
  seed,
  species,
  phases,
  profiles,
  lights,
  views,
  caseCount: cases.length,
  settleMs,
  browser: {
    executablePath: executablePath ?? 'playwright-default',
    headless: !headed
  }
};
writeFileSync(resolve(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const results = [];
try {
  for (const [index, atlasCase] of cases.entries()) {
    const caseId = `${String(index + 1).padStart(3, '0')}-${atlasCase.profile}-${atlasCase.light}-${atlasCase.view}-${atlasCase.species}-p${phaseSlug(atlasCase.phase)}`;
    activeCase = caseId;
    const errorStart = browserErrors.length;
    const url = new URL('voxel-test.html', baseUrl);
    url.searchParams.set('effects', 'fauna');
    url.searchParams.set('species', atlasCase.species);
    url.searchParams.set('phase', atlasCase.phase.toFixed(4));
    url.searchParams.set('freeze', '1');
    url.searchParams.set('light', atlasCase.light);
    url.searchParams.set('view', atlasCase.view);
    url.searchParams.set('profile', atlasCase.profile);
    url.searchParams.set('seed', String(seed));
    const screenshotDir = resolve(screenshotRoot, atlasCase.profile, atlasCase.light, atlasCase.view);
    const screenshot = resolve(screenshotDir, `${atlasCase.species}-p${phaseSlug(atlasCase.phase)}.png`);
    mkdirSync(screenshotDir, { recursive: true });
    const issues = [];
    let diagnostics = null;

    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        expected => {
          const summary = window.__voxelTest?.summary?.();
          if (!summary?.materials?.includes(`fauna:${expected}`)) return false;
          let found = false;
          window.__voxelTestScene?.traverse(object => {
            if (object.name === `fauna-specimen-${expected}`) found = true;
          });
          return found;
        },
        atlasCase.species,
        { timeout: 15000 }
      );
      await page.waitForTimeout(settleMs);
      diagnostics = await page.evaluate(expected => {
        const countComponents = (attribute, component) => {
          const counts = {};
          if (!attribute) return counts;
          for (let index = 0; index < attribute.count; index++) {
            const offset = index * attribute.itemSize + component;
            const key = String(Math.round(attribute.array[offset]));
            counts[key] = (counts[key] ?? 0) + 1;
          }
          return counts;
        };
        const specimens = [];
        const sceneCounts = {
          objects: 0,
          meshes: 0,
          specimenObjects: 0,
          semanticObjects: 0,
          semanticAttributeObjects: 0,
          renderedInstances: 0,
          triangles: 0
        };
        window.__voxelTestScene?.traverse(object => {
          sceneCounts.objects += 1;
          if (object.isMesh) sceneCounts.meshes += 1;
          if (!object.name?.startsWith('fauna-specimen-')) return;
          sceneCounts.specimenObjects += 1;
          const geometry = object.geometry;
          const position = geometry?.getAttribute('position');
          const surface = geometry?.getAttribute('aFaunaSurface');
          const instances = object.isInstancedMesh ? object.count : 1;
          const triangles = Math.floor((geometry?.index?.count ?? position?.count ?? 0) / 3) * instances;
          const attributeSlots = Object.values(geometry?.attributes ?? {}).reduce(
            (sum, attribute) => sum + Math.ceil(attribute.itemSize / 4),
            object.isInstancedMesh ? 4 : 0
          );
          if (object.userData?.faunaSpecimen) sceneCounts.semanticObjects += 1;
          if (surface) sceneCounts.semanticAttributeObjects += 1;
          sceneCounts.renderedInstances += instances;
          sceneCounts.triangles += triangles;
          specimens.push({
            name: object.name,
            species: object.name.slice('fauna-specimen-'.length),
            schemaVersion: object.userData?.faunaSpecimen?.schemaVersion ?? null,
            instances,
            vertices: position?.count ?? 0,
            triangles,
            attributeSlots,
            attributes: Object.keys(geometry?.attributes ?? {}).sort(),
            semanticVertices: surface?.count ?? 0,
            semantics: {
              regions: countComponents(surface, 0),
              joints: countComponents(surface, 1),
              materialSlots: countComponents(surface, 3)
            }
          });
        });
        const canvas = document.querySelector('canvas');
        const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
        return {
          expected,
          summary: window.__voxelTest?.summary?.() ?? null,
          sceneCounts,
          specimens,
          renderer: gl ? {
            version: gl.getParameter(gl.VERSION),
            shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            renderer: gl.getParameter(gl.RENDERER)
          } : null
        };
      }, atlasCase.species);
      await page.screenshot({ path: screenshot });
      await page.waitForTimeout(80);
    } catch (error) {
      issues.push(`capture_failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const expectedMaterial = `fauna:${atlasCase.species}`;
    const expectedSpecimens = diagnostics?.specimens?.filter(specimen => specimen.species === atlasCase.species) ?? [];
    if (!diagnostics?.summary?.materials?.includes(expectedMaterial)) issues.push(`missing_summary_species: ${expectedMaterial}`);
    if (expectedSpecimens.length !== 1) issues.push(`missing_scene_species: expected one ${atlasCase.species}, found ${expectedSpecimens.length}`);
    if ((diagnostics?.sceneCounts?.specimenObjects ?? 0) !== 1) issues.push(`unexpected_specimen_count: ${diagnostics?.sceneCounts?.specimenObjects ?? 0}`);
    if ((expectedSpecimens[0]?.triangles ?? 0) <= 0) issues.push('empty_geometry');
    if ((expectedSpecimens[0]?.schemaVersion ?? 0) <= 0) issues.push('missing_schema_version');
    if ((expectedSpecimens[0]?.semanticVertices ?? 0) <= 0) issues.push('missing_semantic_vertices');
    if (!expectedSpecimens[0]?.attributes?.includes('aFaunaSurface')) issues.push('missing_semantic_surface_attribute');
    if (!expectedSpecimens[0]?.attributes?.includes('aFaunaJointPivot')) issues.push('missing_joint_pivot_attribute');
    if ((expectedSpecimens[0]?.attributeSlots ?? Infinity) > (diagnostics?.renderer?.maxVertexAttributes ?? 0)) {
      issues.push(`vertex_attribute_overflow: ${expectedSpecimens[0]?.attributeSlots}/${diagnostics?.renderer?.maxVertexAttributes ?? 0}`);
    }
    const caseBrowserErrors = browserErrors.slice(errorStart);
    if (caseBrowserErrors.length > 0) issues.push(`browser_errors: ${caseBrowserErrors.length}`);

    results.push({
      caseId,
      ...atlasCase,
      url: url.href,
      screenshot: relativeToRoot(screenshot),
      diagnostics,
      browserErrors: caseBrowserErrors,
      issues
    });
    const triangleCount = diagnostics?.sceneCounts?.triangles ?? 0;
    const semanticCount = diagnostics?.sceneCounts?.semanticObjects ?? 0;
    const maxAttributes = diagnostics?.renderer?.maxVertexAttributes ?? 0;
    console.log(
      `${caseId} tris=${triangleCount} semantic=${semanticCount} maxAttribs=${maxAttributes} ${issues.length ? `FAIL ${issues.join('; ')}` : 'ok'}`
    );
  }
} finally {
  await browser.close();
  if (server.owned && server.process) server.process.kill('SIGTERM');
}

const observedSpecies = new Set(
  results.flatMap(result => result.diagnostics?.specimens?.map(specimen => specimen.species) ?? [])
);
const missingSpecies = species.filter(kind => !observedSpecies.has(kind));
const failedCases = results.filter(result => result.issues.length > 0);
const rendererAttributeLimits = results
  .map(result => result.diagnostics?.renderer?.maxVertexAttributes)
  .filter(value => Number.isFinite(value));
const summary = {
  ...manifest,
  completedAt: new Date().toISOString(),
  screenshotCount: results.filter(result => existsSync(resolve(ROOT, result.screenshot))).length,
  observedSpecies: [...observedSpecies].sort(),
  missingSpecies,
  browserErrors,
  failureCount: failedCases.length + missingSpecies.length,
  failures: [
    ...failedCases.map(result => ({ caseId: result.caseId, issues: result.issues })),
    ...missingSpecies.map(kind => ({ caseId: 'coverage', issues: [`missing_species: ${kind}`] }))
  ],
  aggregate: {
    maxTriangles: Math.max(0, ...results.map(result => result.diagnostics?.sceneCounts?.triangles ?? 0)),
    maxVertexAttributeSlots: Math.max(0, ...results.flatMap(result => result.diagnostics?.specimens?.map(specimen => specimen.attributeSlots) ?? [])),
    minMaxVertexAttributes: rendererAttributeLimits.length > 0 ? Math.min(...rendererAttributeLimits) : 0
  }
};

writeFileSync(resolve(runDir, 'results.json'), JSON.stringify(results, null, 2));
writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`fauna atlas -> ${relativeToRoot(runDir)}`);
console.log(`summary -> ${relativeToRoot(resolve(runDir, 'summary.json'))}`);
if (summary.failureCount > 0 || browserErrors.length > 0) process.exitCode = 1;
