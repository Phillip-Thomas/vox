import playwright from '../../../main/node_modules/playwright-core/index.js';
import { spawn } from 'node:child_process';
import {
  appendFile,
  mkdir,
  writeFile
} from 'node:fs/promises';
import {
  closeSync,
  existsSync,
  openSync,
  readdirSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = playwright;

const maxSeconds = Number(process.argv[2] ?? 600);
const stallSeconds = Number(process.env.STALL_SECONDS ?? 180);
const port = Number(process.env.PROBE_PORT ?? 5219);
const runLabel = process.env.RUN_LABEL ?? 'emergent-cold-run-2026-07-14';
const requestedProfile = (process.env.PROFILE ?? '').trim().toUpperCase() || null;
const startBeat = (process.env.START_BEAT ?? 'ch4-audit').trim();
const stopAt = (process.env.STOP_AT ?? 'DONE').trim().toUpperCase();
const sourceFingerprintRequired = process.env.REQUIRE_SOURCE_FINGERPRINT === '1';
const requestedSourceFingerprint = (process.env.SOURCE_FINGERPRINT ?? '').trim().toLowerCase();
const sourceFingerprint = /^[a-f0-9]{64}$/.test(requestedSourceFingerprint)
  ? requestedSourceFingerprint
  : null;
const viewport = {
  width: Math.max(160, Number(process.env.VIEWPORT_WIDTH ?? 640)),
  height: Math.max(90, Number(process.env.VIEWPORT_HEIGHT ?? 360))
};
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const mainRoot = path.join(repoRoot, 'main');
const outputDir = path.join(repoRoot, 'captures', runLabel);
const timelinePath = path.join(outputDir, 'timeline.jsonl');
const consolePath = path.join(outputDir, 'browser-console.log');
const serverPath = path.join(outputDir, 'vite-no-hmr.log');
const summaryPath = path.join(outputDir, 'summary.json');
const screenshotPath = path.join(outputDir, 'final.png');
const tracePath = path.join(outputDir, 'playwright-trace.zip');
const storyUrl = `http://127.0.0.1:${port}/?story=${encodeURIComponent(startBeat)}&movie=1${requestedProfile ? `&profile=${requestedProfile}` : ''}`;

await mkdir(outputDir, { recursive: true });
await writeFile(timelinePath, '');
await writeFile(consolePath, '');
await writeFile(serverPath, '');

async function serverUp() {
  try {
    return (await fetch(`http://127.0.0.1:${port}/`)).ok;
  } catch {
    return false;
  }
}

if (await serverUp()) {
  throw new Error(`Probe port ${port} is already occupied; refusing to reuse a mutable server.`);
}

const serverFd = openSync(serverPath, 'a');
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: mainRoot,
    env: { ...process.env, PROBE_NO_HMR: '1' },
    stdio: ['ignore', serverFd, serverFd]
  }
);

let browser = null;
let context = null;
let page = null;
let traceStarted = false;
let finalSummary = null;

const runtimeErrors = [];
const consoleTail = [];
const beatTransitions = [];
const authorityTransitions = [];
let screenshotCaptured = false;
let traceCaptured = false;
let startWall = 0;
let lastProgressWall = 0;
let lastProgressSignature = '';
let lastSample = null;
let firstBootAt = null;
let reloaded = false;
let stalled = false;
let capped = false;
let maxTeleportNudges = 0;
let maxDryCrossFaceWaterContactFrames = 0;
let requiredSignedAnchorIds = [];
const observedSignedAnchorIds = new Set();

function browserExecutable() {
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const versions = readdirSync(cache)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
    for (const version of versions.reverse()) {
      const candidate = path.join(cache, version, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return '/snap/bin/chromium';
}

function logBrowser(line) {
  consoleTail.push(line);
  if (consoleTail.length > 120) consoleTail.shift();
  void appendFile(consolePath, `${line}\n`);
}

async function readSample() {
  return page.evaluate(async () => {
    const authority = typeof window.__coldProbeReadAuthority === 'function'
      ? window.__coldProbeReadAuthority()
      : null;
    return {
      capturedAt: new Date().toISOString(),
      beat: window.__storyBeat ?? null,
      autopilot: window.__autopilot ?? null,
      app: window.__paravoxiaAppState ?? null,
      bootAt: window.__probeBootAt ?? null,
      raf: window.__probeRaf ?? null,
      contextLosses: window.__probeContextLosses ?? null,
      visibility: document.visibilityState,
      authority
    };
  });
}

function authoritySignature(sample) {
  if (!sample?.authority) return '';
  const a = sample.authority;
  return JSON.stringify({
    beat: a.story?.beat,
    milestones: a.milestones,
    shipStage: a.ship?.repairStage,
    flight: a.flight,
    system: a.system ? {
      locationMode: a.system.locationMode,
      activePlanetId: a.system.activePlanetId,
      target: a.system.target,
      activationEpoch: a.system.activationEpoch
    } : null,
    campfireCount: a.world?.campfireCount,
    habitat: a.habitat,
    siteChoice: a.siteChoice,
    signedAnchor: a.signedAv?.anchorId,
    signedActivated: a.signedAv?.activationHistoryAnchorIds
      ?? a.signedAv?.activatedAnchorIds
  });
}

function quantizedTuple(value, step) {
  if (!Array.isArray(value)) return null;
  return value.map(component => Number.isFinite(component)
    ? Math.round(component / step) * step
    : null);
}

try {
  for (let i = 0; i < 120 && !(await serverUp()); i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!(await serverUp())) throw new Error('Isolated no-HMR Vite server did not start.');

  browser = await chromium.launch({
    executablePath: browserExecutable(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-gpu-vsync'
    ]
  });

  // Transform-cache warm-up only. This context is discarded, so no story,
  // inventory, or persistence state can leak into the measured cold context.
  const warmContext = await browser.newContext({ viewport });
  const warmPage = await warmContext.newPage();
  await warmPage.goto(
    storyUrl,
    { waitUntil: 'domcontentloaded', timeout: 45_000 }
  ).catch(() => {});
  await warmPage.waitForFunction(() => window.__storyBeat !== undefined, undefined, { timeout: 90_000 }).catch(() => {});
  await warmContext.close();

  context = await browser.newContext({ viewport });
  await context.tracing.start({ screenshots: false, snapshots: false, sources: false });
  traceStarted = true;
  page = await context.newPage();
  page.on('console', async message => {
    const location = message.location();
    const source = location.url
      ? ` (${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0})`
      : '';
    const details = (await Promise.all(message.args().map(async handle => {
      try {
        return await handle.evaluate(value => {
          if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
          return typeof value === 'string' ? value : null;
        });
      } catch {
        return null;
      }
    }))).filter(Boolean);
    const detailSuffix = details.length > 1 ? ` args=${JSON.stringify(details)}` : '';
    const line = `[${new Date().toISOString()}] [console:${message.type()}] ${message.text()}${source}${detailSuffix}`;
    logBrowser(line);
    if (message.type() === 'error') runtimeErrors.push(line);
  });
  page.on('pageerror', error => {
    const line = `[${new Date().toISOString()}] [pageerror] ${error.message}`;
    runtimeErrors.push(line);
    logBrowser(line);
  });
  page.on('crash', () => {
    const line = `[${new Date().toISOString()}] [crash] page crashed`;
    runtimeErrors.push(line);
    logBrowser(line);
  });
  page.on('requestfailed', request => {
    const line = `[${new Date().toISOString()}] [requestfailed] ${request.url()} ${request.failure()?.errorText ?? ''}`;
    logBrowser(line);
  });
  await page.addInitScript(() => {
    window.__probeBootAt = Date.now();
    window.__probeRaf = 0;
    window.__probeContextLosses = 0;
    const nativeConsoleError = console.error.bind(console);
    console.error = (...args) => {
      const message = args.map(value => String(value)).join(' ');
      if (message.includes('Maximum update depth exceeded')) {
        nativeConsoleError(...args, new Error('probe-console-error-stack'));
        return;
      }
      nativeConsoleError(...args);
    };
    const beat = () => {
      window.__probeRaf += 1;
      requestAnimationFrame(beat);
    };
    requestAnimationFrame(beat);
    window.addEventListener('webglcontextlost', () => {
      window.__probeContextLosses += 1;
    }, true);
  });

  startWall = Date.now();
  lastProgressWall = startWall;
  await page.goto(
    storyUrl,
    { waitUntil: 'domcontentloaded', timeout: 45_000 }
  );
  await page.waitForFunction(() => window.__storyBeat !== undefined, undefined, { timeout: 120_000 });

  // Read-only authority bridge. It imports the same live module instances used
  // by the app and exposes snapshots only; no command or mark API is retained.
  await page.evaluate(async ({ startBeat, stopAt }) => {
    const [
      story,
      progression,
      audit,
      dive,
      uniqueItems,
      shipRestoration,
      habitatSystem,
      settlement,
      spaceFlight,
      systemFlight,
      actors,
      route,
      campfires,
      worldClock,
      graphicsSettings,
      playerSubmersion,
      survivalVitals,
      signedAv
    ] = await Promise.all([
      import('/src/story/storyState.ts'),
      import('/src/game/systems/progressionSystem.ts'),
      import('/src/story/emergentAudit.ts'),
      import('/src/story/emergentDive.ts'),
      import('/src/story/emergentUniqueItems.ts'),
      import('/src/game/systems/shipRestoration.ts'),
      import('/src/game/systems/habitatSystem.ts'),
      import('/src/story/tidegardenSettlement.ts'),
      import('/src/state/spaceFlight.ts'),
      import('/src/state/systemFlight.ts'),
      import('/src/game/playerActors.ts'),
      import('/src/story/tidegardenRoute.ts'),
      import('/src/game/systems/campfires.ts'),
      import('/src/game/worldClock.ts'),
      import('/src/config/graphicsSettings.ts'),
      import('/src/state/playerSubmersion.ts'),
      import('/src/game/systems/survivalVitals.ts'),
      import('/src/story/signedSceneAvRuntime.ts')
    ]);
    const milestoneIds = {
      ...audit.EMERGENT_AUDIT_MILESTONES,
      fieldPackDropped: audit.FIELD_PACK_DROPPED_MILESTONE,
      mawRepaired: 'maw_repaired',
      ...dive.AUTHORED_DIVE_MILESTONES,
      ...uniqueItems.EMERGENT_UNIQUE_ITEM_MILESTONES,
      ...Object.fromEntries(Object.entries(story.STORY_MILESTONES).filter(([key]) => (
        key === 'a4Handback'
        || /^ch[5-9]/.test(key)
        || key === 'complete'
      ))),
      ...Object.fromEntries(Object.entries(settlement.TIDEGARDEN_SETTLEMENT_MILESTONES).map(([key, value]) => [`settlement_${key}`, value]))
    };
    window.__coldProbeReadAuthority = () => {
      const actorId = actors.getLocalActorId();
      const habitat = habitatSystem.getHabitatWorldState(route.TIDEGARDEN_WORLD_ID);
      const ship = shipRestoration.getShipRestorationSnapshot();
      const flight = spaceFlight.getSpaceFlightSnapshot();
      const system = systemFlight.getSystemFlightSnapshot();
      const actorMilestones = progression.getMilestones(actorId);
      return {
        actorId,
        story: story.getStoryStateSnapshot(),
        milestones: Object.fromEntries(
          Object.entries(milestoneIds).map(([key, id]) => [key, progression.hasMilestone(id, actorId)])
        ),
        siteChoice: actorMilestones.find(id => id.startsWith(
          settlement.TIDEGARDEN_SETTLEMENT_MILESTONES.siteChoicePrefix
        )) ?? null,
        signedAv: signedAv.getSignedSceneAvDebugSnapshot(),
        ship: {
          repairStage: ship.repairStage,
          locationMode: ship.locationMode,
          currentWorldId: ship.currentWorldId,
          repairHistoryLength: ship.repairHistory.length
        },
        flight: {
          phase: flight.phase,
          controlMode: flight.controlMode,
          target: flight.target ?? null,
          destination: flight.destination ?? null
        },
        system: {
          locationMode: system.locationMode,
          activePlanetId: system.activePlanetId,
          target: system.target,
          activationEpoch: system.activationEpoch,
          pose: system.pose
        },
        world: {
          campfireCount: campfires.getCampfires().length,
          dayPhase: worldClock.getCurrentDayPhase()
        },
        graphicsTier: graphicsSettings.getQualityProfile(),
        diveState: {
          ...playerSubmersion.getPlayerSubmersion(actorId),
          oxygen: survivalVitals.getVitals(actorId).oxygen
        },
        habitat: habitat ? {
          coreOnline: true,
          shelterCertified: Boolean(habitat.shelterCertification),
          safeRest: Boolean(habitat.safeRest),
          coreCell: habitat.core.cell
        } : null
      };
    };
    const startBeatIndex = story.STORY_BEAT_ORDER.indexOf(startBeat);
    const terminalBeat = stopAt === 'KEEL_BANK'
      ? 'ch6-dive'
      : stopAt === 'CH8_LAUNCH'
        ? 'ch7-board'
        : 'ch9-hearth';
    const terminalBeatIndex = story.STORY_BEAT_ORDER.indexOf(terminalBeat);
    window.__coldProbeRequiredSignedAnchorIds = signedAv.getSignedSceneAvContract().anchors
      .filter(anchor => {
        const beatIndex = story.STORY_BEAT_ORDER.indexOf(anchor.beat);
        return !anchor.event.endsWith(':optional')
          && beatIndex >= Math.max(0, startBeatIndex)
          && beatIndex <= terminalBeatIndex;
      })
      .map(anchor => anchor.id);
  }, { startBeat, stopAt });
  requiredSignedAnchorIds = await page.evaluate(() => (
    Array.isArray(window.__coldProbeRequiredSignedAnchorIds)
      ? [...window.__coldProbeRequiredSignedAnchorIds]
      : []
  ));

  let lastBeat = undefined;
  let lastAuthoritySignature = '';
  while ((Date.now() - startWall) / 1000 < maxSeconds) {
    let sample;
    try {
      sample = await readSample();
    } catch (error) {
      runtimeErrors.push(`[probe-read] ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
    sample.wallSeconds = Number(((Date.now() - startWall) / 1000).toFixed(2));
    lastSample = sample;
    maxTeleportNudges = Math.max(
      maxTeleportNudges,
      Number(sample.autopilot?.teleportNudgesTotal ?? 0)
    );
    maxDryCrossFaceWaterContactFrames = Math.max(
      maxDryCrossFaceWaterContactFrames,
      Number(sample.autopilot?.dryCrossFaceWaterContactFramesTotal ?? 0)
    );
    const signedActivationHistory = sample.authority?.signedAv?.activationHistoryAnchorIds
      ?? sample.authority?.signedAv?.activatedAnchorIds
      ?? [];
    for (const anchorId of signedActivationHistory) {
      observedSignedAnchorIds.add(anchorId);
    }
    const activeAnchorId = sample.authority?.signedAv?.anchorId;
    if (activeAnchorId) observedSignedAnchorIds.add(activeAnchorId);
    await appendFile(timelinePath, `${JSON.stringify(sample)}\n`);

    if (firstBootAt === null) firstBootAt = sample.bootAt;
    else if (sample.bootAt !== firstBootAt) {
      reloaded = true;
      runtimeErrors.push(`[probe] page boot marker changed ${firstBootAt} -> ${sample.bootAt}`);
      break;
    }

    if (sample.beat !== lastBeat) {
      const transition = { wallSeconds: sample.wallSeconds, from: lastBeat ?? null, to: sample.beat };
      beatTransitions.push(transition);
      process.stdout.write(`[${sample.wallSeconds.toFixed(1)}s] ${transition.from ?? '(boot)'} -> ${sample.beat}\n`);
      lastBeat = sample.beat;
    }
    const nextAuthority = authoritySignature(sample);
    if (nextAuthority !== lastAuthoritySignature) {
      authorityTransitions.push({ wallSeconds: sample.wallSeconds, authority: sample.authority });
      lastAuthoritySignature = nextAuthority;
    }

    // Narrative-stall watchdog: do not count RAF or the monotonic movie clock.
    // Only durable authority changes, a half-metre player displacement, a
    // meaningful system-ship displacement, or the authored real-night wait can
    // prove progress.
    const progressSignature = JSON.stringify({
      beat: sample.beat,
      goal: quantizedTuple(sample.autopilot?.goal, 0.5),
      playerPos: quantizedTuple(sample.autopilot?.pos, 0.5),
      systemPos: quantizedTuple(sample.authority?.system?.pose?.position, 5),
      authority: nextAuthority,
      oxygenWait: sample.beat === 'ch6-dive'
        && (sample.authority?.diveState?.submergence ?? 0) > 0.5
        ? Math.round((sample.authority?.diveState?.oxygen ?? 100) / 2) * 2
        : null,
      nightWait: sample.beat === 'ch9-hearth'
        ? Math.round((sample.authority?.world?.dayPhase ?? 0) / 0.02) * 0.02
        : null
    });
    if (progressSignature !== lastProgressSignature) {
      lastProgressSignature = progressSignature;
      lastProgressWall = Date.now();
    }

    const safeRest = Boolean(sample.authority?.milestones?.settlement_safeRestCompleted);
    const handoff = Boolean(sample.authority?.milestones?.settlement_twoWorldHandoff);
    const keelBanked = Boolean(sample.authority?.milestones?.keelMemoryBanked);
    const ch6Complete = Boolean(sample.authority?.milestones?.ch6Dive);
    const ch7Boarded = Boolean(sample.authority?.milestones?.ch7Boarded);
    if ((stopAt === 'KEEL_BANK' && keelBanked && ch6Complete)
      || (stopAt === 'CH8_LAUNCH' && ch7Boarded && sample.beat === 'ch8-launch')
      || (stopAt === 'DONE' && sample.beat === 'done' && safeRest && handoff)) break;
    if ((Date.now() - lastProgressWall) / 1000 >= stallSeconds) {
      stalled = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  capped = !stalled
    && lastSample?.beat !== 'done'
    && (Date.now() - startWall) / 1000 >= maxSeconds;

  try {
    await page.screenshot({ path: screenshotPath, timeout: 30_000 });
    screenshotCaptured = true;
  } catch (error) {
    logBrowser(`[probe] final screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const lastAuthority = lastSample?.authority ?? null;
  const safeRestCompleted = Boolean(lastAuthority?.milestones?.settlement_safeRestCompleted);
  const twoWorldHandoff = Boolean(lastAuthority?.milestones?.settlement_twoWorldHandoff);
  const reachedDone = lastSample?.beat === 'done';
  const missingRequiredSignedAnchorIds = requiredSignedAnchorIds.filter(
    anchorId => !observedSignedAnchorIds.has(anchorId)
  );
  const contextLosses = Number(lastSample?.contextLosses ?? 0);
  const targetReached = stopAt === 'KEEL_BANK'
    ? Boolean(lastAuthority?.milestones?.keelMemoryBanked && lastAuthority?.milestones?.ch6Dive)
    : stopAt === 'CH8_LAUNCH'
      ? Boolean(lastAuthority?.milestones?.ch7Boarded && lastSample?.beat === 'ch8-launch')
    : reachedDone && safeRestCompleted && twoWorldHandoff;
  finalSummary = {
    generatedAt: new Date().toISOString(),
    startUrl: storyUrl,
    sourceFingerprint,
    sourceFingerprintRequired,
    graphicsTier: lastAuthority?.graphicsTier ?? requestedProfile ?? 'UNKNOWN',
    startPolicy: {
      freshBrowserContext: true,
      segmentEntry: startBeat,
      prerequisiteSeedPerformedByExistingStoryEntry: true,
      postLoadMilestoneOrRescueCalls: 0,
      hmrDisabled: true
    },
    limits: { maxSeconds, stallSeconds, viewport },
    elapsedSeconds: Number(((Date.now() - startWall) / 1000).toFixed(2)),
    lastAuthoritativeBeat: lastAuthority?.story?.beat ?? lastSample?.beat ?? null,
    reachedDone,
    stopAt,
    targetReached,
    safeRestCompleted,
    twoWorldHandoff,
    stalled,
    capped,
    reloaded,
    contextLosses,
    teleportNudges: maxTeleportNudges,
    rescueFree: maxTeleportNudges === 0,
    dryCrossFaceWaterContactFrames: maxDryCrossFaceWaterContactFrames,
    dryCrossFaceWaterContactFree: maxDryCrossFaceWaterContactFrames === 0,
    signedAvCoverage: {
      required: requiredSignedAnchorIds.length,
      observedRequired: requiredSignedAnchorIds.length - missingRequiredSignedAnchorIds.length,
      missingRequiredAnchorIds: missingRequiredSignedAnchorIds
    },
    runtimeErrors,
    consoleTail,
    beatTransitions,
    authorityTransitions,
    finalSample: lastSample,
    artifacts: {
      summary: summaryPath,
      timeline: timelinePath,
      console: consolePath,
      server: serverPath,
      screenshot: screenshotCaptured ? screenshotPath : null,
      trace: tracePath
    },
    verdict: targetReached
      && !reloaded
      && contextLosses === 0
      && runtimeErrors.length === 0
      && maxTeleportNudges === 0
      && maxDryCrossFaceWaterContactFrames === 0
      && missingRequiredSignedAnchorIds.length === 0
      && (!sourceFingerprintRequired || sourceFingerprint !== null)
      ? (stopAt === 'DONE' ? 'PASS' : 'PASS-TARGET')
      : stalled
        ? 'FAIL-STALL'
        : capped
          ? 'INCOMPLETE-CAP'
          : 'FAIL-INCOMPLETE'
  };
} catch (error) {
  runtimeErrors.push(`[probe-fatal] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  finalSummary = {
    generatedAt: new Date().toISOString(),
    sourceFingerprint,
    sourceFingerprintRequired,
    elapsedSeconds: startWall ? Number(((Date.now() - startWall) / 1000).toFixed(2)) : 0,
    lastAuthoritativeBeat: lastSample?.authority?.story?.beat ?? lastSample?.beat ?? null,
    reachedDone: false,
    safeRestCompleted: Boolean(lastSample?.authority?.milestones?.settlement_safeRestCompleted),
    twoWorldHandoff: Boolean(lastSample?.authority?.milestones?.settlement_twoWorldHandoff),
    stalled,
    capped,
    reloaded,
    runtimeErrors,
    beatTransitions,
    authorityTransitions,
    finalSample: lastSample,
    artifacts: { summary: summaryPath, timeline: timelinePath, console: consolePath, server: serverPath, screenshot: null, trace: tracePath },
    verdict: 'FAIL-PROBE'
  };
} finally {
  if (traceStarted && context) {
    try {
      await context.tracing.stop({ path: tracePath });
      traceCaptured = true;
    } catch (error) {
      runtimeErrors.push(`[probe-trace] ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  vite.kill('SIGTERM');
  closeSync(serverFd);
  if (finalSummary) {
    finalSummary.artifacts.trace = traceCaptured ? tracePath : null;
    finalSummary.runtimeErrors = runtimeErrors;
    await writeFile(summaryPath, `${JSON.stringify(finalSummary, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(finalSummary, null, 2)}\n`);
  }
}

process.exitCode = finalSummary?.verdict === 'PASS' || finalSummary?.verdict === 'PASS-TARGET' ? 0 : 2;
