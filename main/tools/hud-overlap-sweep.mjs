// --- The HUD overlap invariant -------------------------------------------------------
//
// Sweeps every registered HUD surface across beats x breakpoints x input modes
// and FAILS when two of them are visible in the same place at the same time.
//
// Why a browser and not a unit test: only three of ~45 surfaces expose their
// geometry as a pure function. The rest are inline style objects using literal
// px, viewport percentages (`top: 13.5%`, `bottom: 18%`), `min()`/`vw`, or
// `calc(... env(safe-area-inset-*) ...)`, and almost none declare a height —
// captions, ledgers, the work order and the audit band are all content-sized.
// A solver-only check would be guessing at exactly the values that collide.
// This measures the truth the player sees.
//
// The sweep also fails on any positioned, visible element carrying no
// `data-hud-surface`, because a surface the registry cannot see is a surface
// this invariant silently stops protecting. See src/ui/hudSurfaces.ts.
//
// Usage:
//   npm run story:hud:sweep                     # default beats/profiles
//   PARAVOXIA_HUD_SWEEP_CASES=ch3-gather,ch5-maw npm run story:hud:sweep
//   PARAVOXIA_HUD_SWEEP_ALL=1 npm run story:hud:sweep   # every beat in the order

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const graphicsProfile = process.env.PARAVOXIA_HUD_SWEEP_GRAPHICS_PROFILE ?? 'POTATO';
const outputDir = path.resolve(process.env.PARAVOXIA_HUD_SWEEP_OUTPUT ?? 'captures/hud-sweep');

/**
 * The default lane is every beat that actually mounts controls or captions.
 * Cutscene-frozen beats still run: a veiled HUD must also be a clear one.
 */
const DEFAULT_CASES = [
  'ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso',
  'ch1-anomaly', 'ch2-approach',
  'ch3-gather', 'ch3-thirst', 'ch3-forage', 'ch3-signal',
  'ch4-vigil', 'ch4-audit', 'ch4-comply', 'ch4-defy',
  'ch5-maw', 'ch6-dive', 'ch7-reconstruct', 'ch7-board',
  'ch8-launch', 'ch8-crossing', 'ch8-landfall',
  'ch9-settle', 'ch9-hearth',
  'ch10-cold', 'ch10-ask', 'ch10-transit'
];

const ALL_CASES = [
  'descent', 'ch1-fixed', 'ch1-track', 'ch1-raster', 'ch1-depth', 'ch1-nav',
  'ch1-iso', 'ch1-lift', 'ch1-anomaly', 'a1-ramp', 'ch2-color', 'ch2-approach',
  'a2-awakening', 'ch3-gather', 'ch3-dusk', 'ch3-await-rest', 'a3-dawn',
  'ch3-thirst', 'ch3-forage', 'ch3-signal', 'ch4-vigil', 'ch4-arrival',
  'ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale', 'ch5-maw', 'ch6-dive',
  'ch7-reconstruct', 'ch7-board', 'ch8-launch', 'ch8-crossing', 'ch8-landfall',
  'ch9-settle', 'ch9-hearth', 'ch10-cold', 'ch10-ask', 'ch10-transit'
];

const cases = process.env.PARAVOXIA_HUD_SWEEP_CASES
  ? process.env.PARAVOXIA_HUD_SWEEP_CASES.split(',').map(v => v.trim()).filter(Boolean)
  : (process.env.PARAVOXIA_HUD_SWEEP_ALL === '1' ? ALL_CASES : DEFAULT_CASES);

/**
 * Breakpoints chosen at real code branches, not round numbers:
 *  - 320  : narrowest phone; the sprint cluster keeps its tall stack here
 *  - 390  : the reference phone the owner reports against
 *  - 820  : STORY_HUD_NARROW_WIDTH_PX, the narrowTouch boundary
 *  - 1024x768 : landscape touch, where a notch inset and an 11vh letterbox
 *               bar squeeze the vertical lanes hardest
 *  - 1440 : desktop, where the caption lane has three placement modes
 */
const PROFILES = [
  { id: 'phone-narrow', viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' },
  { id: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' },
  { id: 'phone-reduced', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' },
  { id: 'tablet-narrow', viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' },
  { id: 'landscape-touch', viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' },
  { id: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, reducedMotion: 'no-preference' }
];

const requested = new Set((process.env.PARAVOXIA_HUD_SWEEP_PROFILES ?? PROFILES.map(p => p.id).join(','))
  .split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
const profiles = PROFILES.filter(p => requested.has(p.id));
if (profiles.length === 0) throw new Error('No valid HUD sweep profile selected.');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-unsafe-swiftshader'
  ]
});

/** Collected in the page: every registered surface's measured rect. */
const COLLECT = () => {
  const EXEMPT = ['modal', 'fullbleed'];
  const visible = node => {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number.parseFloat(style.opacity || '1') <= 0.01) return false;
    // A veiled cinematic marks its subtree inert; treat it as absent.
    if (node.closest('[inert]')) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0.5 && rect.height > 0.5
      && rect.right > 0 && rect.bottom > 0
      && rect.left < window.innerWidth && rect.top < window.innerHeight;
  };
  const rectOf = node => {
    const r = node.getBoundingClientRect();
    return {
      left: Math.round(r.left), top: Math.round(r.top),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      width: Math.round(r.width), height: Math.round(r.height)
    };
  };
  const surfaces = [];
  for (const node of document.querySelectorAll('[data-hud-surface]')) {
    if (!visible(node)) continue;
    const layer = node.getAttribute('data-hud-layer') ?? 'informational';
    if (EXEMPT.includes(layer)) continue;
    surfaces.push({ id: node.getAttribute('data-hud-surface'), layer, rect: rectOf(node) });
  }
  // Unregistered positioned chrome: anything fixed/absolute with text that is
  // not inside a registered surface and not a canvas/effect layer.
  const unregistered = [];
  for (const node of document.querySelectorAll('div,section,aside,button')) {
    if (node.closest('[data-hud-surface]')) continue;
    if (node.closest('[data-hud-layer="fullbleed"]')) continue;
    if (node.closest('[data-hud-layer="modal"]')) continue;
    // Dev-only chrome (?debug=1 mounts these; players never see them).
    if (node.closest('[data-testid="story-debug-panel"]')) continue;
    if (node.closest('[data-paravoxia-debug]')) continue;
    // The ?debug=1 vantage dock ("DBG …"/"CM") is dev chrome, not a HUD surface.
    if (/^(DBG|B?CM)\b/.test((node.textContent ?? '').trim())) continue;
    const style = window.getComputedStyle(node);
    if (style.position !== 'fixed' && style.position !== 'absolute') continue;
    if (!visible(node)) continue;
    const r = node.getBoundingClientRect();
    // Full-bleed containers carry no legible content of their own.
    if (r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2) continue;
    const text = (node.textContent ?? '').trim();
    if (!text) continue;
    // Only report the outermost such node.
    if (unregistered.some(entry => node.closest(entry.selector))) continue;
    unregistered.push({
      selector: node.tagName.toLowerCase()
        + (node.getAttribute('data-testid') ? `[data-testid="${node.getAttribute('data-testid')}"]` : ''),
      text: text.slice(0, 60),
      rect: rectOf(node)
    });
  }
  return { surfaces, unregistered: unregistered.slice(0, 12) };
};

function intersects(a, b) {
  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  // A couple of pixels of touching border is not a legibility failure.
  return overlapX > 2 && overlapY > 2
    ? { x: overlapX, y: overlapY }
    : null;
}

// Mirrors ALLOWED_HUD_SURFACE_OVERLAPS in src/ui/hudSurfaces.ts.
const ALLOWED = [
  ['vitals-meter', 'inventory-panel'],
  ['map-overlay-chrome', 'free-marker']
];
const allowed = (a, b) => ALLOWED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const findings = [];
const report = [];

try {
  for (const profile of profiles) {
    for (const beat of cases) {
      const context = await browser.newContext({
        viewport: profile.viewport,
        hasTouch: profile.hasTouch,
        isMobile: profile.isMobile,
        reducedMotion: profile.reducedMotion
      });
      const page = await context.newPage();
      const url = new URL(baseUrl);
      url.searchParams.set('story', beat);
      url.searchParams.set('debug', '1');
      url.searchParams.set('profile', graphicsProfile);

      let entry = { beat, profile: profile.id, surfaces: [], unregistered: [], failure: null };
      try {
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForFunction(
          () => window.__paravoxiaAppState?.phase === 'playing',
          undefined,
          { timeout: 90_000 }
        );
        // Let the rAF-driven surfaces settle into their measured lanes.
        await page.waitForTimeout(1_500);
        const collected = await page.evaluate(COLLECT);
        entry = { ...entry, ...collected };

        for (let i = 0; i < collected.surfaces.length; i++) {
          for (let j = i + 1; j < collected.surfaces.length; j++) {
            const a = collected.surfaces[i];
            const b = collected.surfaces[j];
            if (a.id === b.id) continue;
            if (allowed(a.id, b.id)) continue;
            const overlap = intersects(a.rect, b.rect);
            if (!overlap) continue;
            findings.push({
              beat, profile: profile.id, a: a.id, b: b.id,
              layers: `${a.layer}/${b.layer}`, overlap,
              rects: { [a.id]: a.rect, [b.id]: b.rect }
            });
          }
        }
        if (collected.unregistered.length > 0) {
          findings.push({
            beat, profile: profile.id, kind: 'unregistered',
            surfaces: collected.unregistered
          });
        }
        if (findings.some(f => f.beat === beat && f.profile === profile.id)) {
          await page.screenshot({
            path: path.join(outputDir, `${profile.id}__${beat}.png`)
          });
        }
      } catch (error) {
        entry.failure = String(error?.message ?? error);
      }
      report.push(entry);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const overlaps = findings.filter(f => f.kind !== 'unregistered');
const unregistered = findings.filter(f => f.kind === 'unregistered');
const failures = report.filter(entry => entry.failure);

await writeFile(
  path.join(outputDir, 'hud-overlap-sweep.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    cases, profiles: profiles.map(p => p.id),
    overlaps, unregistered, failures, report
  }, null, 2)
);

for (const f of overlaps) {
  console.error(
    `OVERLAP  ${f.profile.padEnd(15)} ${f.beat.padEnd(16)} ${f.a} x ${f.b}`
    + `  (${f.layers})  ${f.overlap.x}x${f.overlap.y}px`
  );
}
for (const f of unregistered) {
  for (const s of f.surfaces) {
    console.error(`UNREGISTERED  ${f.profile.padEnd(15)} ${f.beat.padEnd(16)} ${s.selector} "${s.text}"`);
  }
}
for (const f of failures) {
  console.error(`LOAD-FAILED  ${f.profile.padEnd(15)} ${f.beat.padEnd(16)} ${f.failure}`);
}

console.log(
  `\nHUD sweep: ${cases.length} beats x ${profiles.length} profiles`
  + ` — ${overlaps.length} overlap(s), ${unregistered.length} unregistered, ${failures.length} load failure(s).`
  + `\nReport: ${path.join(outputDir, 'hud-overlap-sweep.json')}`
);

if (overlaps.length > 0 || failures.length > 0) process.exit(1);
