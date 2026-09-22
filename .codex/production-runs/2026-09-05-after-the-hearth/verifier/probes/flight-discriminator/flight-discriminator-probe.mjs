/**
 * ch13-return FLIGHT DISCRIMINATOR — bounded, read-only, single short capture.
 *
 * QUESTION (only this): during the ch13-return crossing, what does the LIVE
 * systemFlight pose / activePlanetId / approach-assist clamp actually do across
 * one ~38 s cycle? The earned-1 (240 s) and earned-2 (420.993 s) lanes recorded
 * only a DOM marker distance, which oscillated 2730 -> 50 -> 2000+ -> 50 and
 * could not separate the source auditor's candidates (A) unready-approach shell
 * park, (B) cone/preparation flapping, and (C) handoff failure.
 *
 * WHAT IT DOES NOT DO
 *   - no source, contract, build, defect, or capture-tree edits;
 *   - no teleports, nudges, progression grants, forced landing, camera override;
 *   - no new game code injected: every field below is read from bridges the
 *     SHIPPED build already publishes on `window`
 *     (`__paravoxiaJourneyProbe.snapshot()`, `__paravoxiaShipProbe.getFeedback()`,
 *     `__autopilot`, `__storyBeat`, `__paravoxiaBoundaryState`) plus the DOM;
 *   - it never runs to a landing, never attempts Continue, never claims chapter
 *     acceptance, and a budget expiry here is a PROBE STOP, not a game failure.
 *
 * The approach-assist store (`getSystemTravelAssistTarget`) and the autopilot
 * flight directive are NOT published on `window` in this build; they are
 * recorded as UNAVAILABLE rather than inferred. `getFeedback().approachLimited`
 * is the shipped observable of the same clamp and IS read.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
import { createOwnedSessionGuard } from '../lib/ownedSession.mjs';

const RUN = '/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth';
const CAP = path.join(RUN, 'verifier/captures/flight-discriminator');
const LOG = path.join(RUN, 'logs/flight-discriminator');
const PREVIEW_URL = 'http://127.0.0.1:38803/';
const ENTRY = `${PREVIEW_URL}?story=ch13-return&journeyprobe=1&debug=1&movie=1`;
const SAMPLE_MS = 250;
const CAPTURE_MS = Number(process.env.FD_CAPTURE_MS ?? 90_000);
const READY_TIMEOUT_MS = 120_000;

fs.mkdirSync(CAP, { recursive: true });
fs.mkdirSync(LOG, { recursive: true });
const telPath = path.join(LOG, 'telemetry.jsonl');
const logPath = path.join(LOG, 'probe.log');
const tel = fs.createWriteStream(telPath, { flags: 'a' });
const lg = fs.createWriteStream(logPath, { flags: 'a' });
const nowIso = () => new Date().toISOString();
const say = (m) => { const l = `[${nowIso()}] ${m}`; console.log(l); lg.write(l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One combined passive read. Runs in the page; mutates nothing. */
function pageFlightSample() {
  const w = window;
  const out = { perfMs: Math.round(performance.now()), unavailable: [] };
  out.beat = w.__storyBeat ?? null;
  out.visibility = document.visibilityState;
  out.focus = document.hasFocus();

  const hud = document.querySelector('[data-story-guidance-hud]');
  out.objectiveId = hud?.getAttribute('data-objective-id') ?? null;
  out.markerLabel = hud?.getAttribute('data-objective-marker-label') ?? null;
  out.objectiveHealth = hud?.getAttribute('data-objective-health') ?? null;

  const body = document.body ? document.body.innerText : '';
  const md = body.match(/·\s*([\d.]+)\s*m\b/);
  const fm = body.match(/Flight:\s*([^\n]+)/);
  const sm = body.match(/Ship:\s*([^\n]+)/);
  const cm = body.match(/Coordinate:\s*([^\n]+)/);
  const se = body.match(/Seed:\s*([^\n]+)/);
  out.hud = {
    markerDistanceM: md ? Number(md[1]) : null,
    flightMode: fm ? fm[1].trim() : null,
    shipState: sm ? sm[1].trim() : null,
    coordinate: cm ? cm[1].trim() : null,
    seed: se ? se[1].trim() : null,
  };

  try {
    const snap = w.__paravoxiaJourneyProbe?.snapshot?.();
    if (!snap) { out.unavailable.push('__paravoxiaJourneyProbe.snapshot'); }
    else {
      const sf = snap.state?.systemFlight ?? null;
      if (!sf) out.unavailable.push('state.systemFlight');
      else {
        const p = sf.pose?.position ?? null;
        const v = sf.pose?.velocity ?? null;
        const d = p ? Math.hypot(p[0], p[1], p[2]) : null; // Origin (slot 0) centre is [0,0,0]
        let radial = null; // +ve = closing on Origin centre
        if (p && v && d && d > 1e-6) {
          radial = -((v[0] * p[0] + v[1] * p[1] + v[2] * p[2]) / d);
        }
        out.systemFlight = {
          systemId: sf.systemId ?? null,
          locationMode: sf.locationMode ?? null,
          activePlanetId: sf.activePlanetId ?? null,
          lastActivePlanetId: sf.lastActivePlanetId ?? null,
          activationEpoch: sf.activationEpoch ?? null,
          layoutVersion: sf.layoutVersion ?? null,
          position: p ? p.map((n) => Math.round(n * 100) / 100) : null,
          velocity: v ? v.map((n) => Math.round(n * 100) / 100) : null,
          quaternion: sf.pose?.quaternion ? sf.pose.quaternion.map((n) => Math.round(n * 1e4) / 1e4) : null,
          renderOrigin: sf.renderOrigin ? sf.renderOrigin.map((n) => Math.round(n * 100) / 100) : null,
          speed: v ? Math.round(Math.hypot(v[0], v[1], v[2]) * 100) / 100 : null,
          originCentreDistance: d === null ? null : Math.round(d * 100) / 100,
          radialClosingSpeed: radial === null ? null : Math.round(radial * 100) / 100,
          target: sf.target ?? null,
        };
      }
      const spf = snap.state?.spaceFlight ?? null;
      if (!spf) out.unavailable.push('state.spaceFlight');
      else out.spaceFlight = {
        phase: spf.phase ?? null, controlMode: spf.controlMode ?? null,
        target: spf.target ?? null, destination: spf.destination ?? null,
        warpActive: spf.warp?.active ?? spf.warpActive ?? null,
      };
      const ms = snap.state?.localActor?.milestones ?? null;
      out.milestonesCh13 = Array.isArray(ms) ? ms.filter((m) => String(m).includes('ch13')) : null;
      out.milestoneCount = Array.isArray(ms) ? ms.length : null;
      out.originLandedMilestone = Array.isArray(ms) ? ms.includes('story:ch13-origin-landed') : null;
      out.av = snap.state?.signedSceneAv ? Object.keys(snap.state.signedSceneAv).length : null;
    }
  } catch (e) { out.journeyProbeError = String(e).slice(0, 160); }

  try {
    const sp = w.__paravoxiaShipProbe;
    if (!sp || typeof sp.getFeedback !== 'function') out.unavailable.push('__paravoxiaShipProbe.getFeedback');
    else {
      const f = sp.getFeedback();
      out.shipFeedback = {
        active: f.active, phase: f.phase,
        throttle: Math.round(f.throttle * 1000) / 1000,
        boost: Math.round(f.boost * 1000) / 1000,
        speed: Math.round(f.speed * 100) / 100,
        speedRatio: Math.round(f.speedRatio * 1000) / 1000,
        acceleration: Math.round(f.acceleration * 100) / 100,
        forwardSpeed: Math.round(f.forwardSpeed * 100) / 100,
        approachLimited: f.approachLimited,
        reducedMotion: f.reducedMotion,
        fov: Math.round(f.fov * 10) / 10,
      };
    }
  } catch (e) { out.shipProbeError = String(e).slice(0, 160); }

  try {
    const ap = w.__autopilot;
    if (!ap) out.unavailable.push('__autopilot');
    else out.autopilot = {
      beat: ap.beat ?? null, clock: ap.clock ?? null,
      routeAction: ap.routeAction ?? null, routeOutcome: ap.routeOutcome ?? null,
      controls: ap.controls ? { ...ap.controls } : null,
      stillTime: ap.stillTime ?? null, nudges: ap.nudges ?? null,
      teleportNudgesTotal: ap.teleportNudgesTotal ?? null,
      backstops: ap.backstops ?? null, stuck: ap.stuck ?? null,
      pos: ap.pos ?? null,
    };
  } catch (e) { out.autopilotError = String(e).slice(0, 160); }

  try {
    const cg = w.__paravoxiaCommonGround;
    const s = typeof cg === 'function' ? cg() : cg?.snapshot?.() ?? cg;
    if (!s) out.unavailable.push('__paravoxiaCommonGround');
    else out.cg = { anchors: s.anchors ?? null, plan: s.plan ?? s.railPlan ?? null };
  } catch { out.unavailable.push('__paravoxiaCommonGround'); }

  try { const b = w.__paravoxiaBoundaryState; out.boundary = b ? { durable: b.durable ?? null, beat: b.beat ?? null } : null; }
  catch { out.boundary = null; }

  // NOT published on window in this build — recorded, never inferred.
  out.unavailable.push('systemTravelAssist.getSystemTravelAssistTarget (ready flag)');
  out.unavailable.push('autopilot getAutopilotFlightDirective (targetWorldId/bearing)');
  out.unavailable.push('SystemTravelDriver targetReady / aim-cone state');
  return out;
}

const guard = createOwnedSessionGuard({ log: say, label: 'flight-discriminator' });
const report = {
  schema: 'paravoxia.verifier.flightDiscriminator.v1',
  probe: 'flight-discriminator-probe.mjs',
  role: 'flight-discriminator',
  question: 'What does live ch13-return systemFlight/approach-assist telemetry do across one ~38s cycle?',
  isAcceptance: false, isChapterVerification: false, isDefectFinding: false,
  startedAt: nowIso(),
  preview: { url: PREVIEW_URL, ownedBy: 'root-production-preview', startedByThisProbe: false },
  entryUrl: ENTRY,
  fixtures: [
    { what: 'story deep link ?story=ch13-return', effect: 'seeds ch13-return entry milestones; does NOT seed story:ch13-origin-landed', label: 'prerequisite-fixture' },
    { what: 'movie=1 rail', effect: 'shipped ch13 rail drives the same virtual controls a player presses; scripted input, NEVER a zero-rescue movie claim', label: 'scripted-input-journey' },
    { what: 'journeyprobe=1&debug=1', effect: 'enables the shipped read-only journey bridge and the debug HUD readout; identical to the earned-1/earned-2 lanes', label: 'read-only-telemetry-fixture' },
  ],
  samples: 0, telemetryPath: telPath, frames: [],
};

let session = null;
try {
  say(`entry ${ENTRY}`);
  session = guard.adopt(await openParavoxia({
    url: ENTRY, preview: { url: PREVIEW_URL, stop() {} }, build: false, log: say,
  }));
  report.renderer = session.renderer;
  report.headed = session.headed;
  say(`renderer=${session.renderer} headed=${session.headed}`);
  if (/swiftshader|llvmpipe|software/i.test(String(session.renderer))) {
    throw new Error(`SOFTWARE-RENDERER-REFUSED: ${session.renderer}`);
  }

  const t_open = Date.now();
  await waitReady(session.page, { timeoutMs: READY_TIMEOUT_MS });
  const boot = await readState(session.page);
  report.bootQualification = {
    at: nowIso(), msFromOpen: Date.now() - t_open,
    beat: boot?.beat ?? null, lane: boot?.lane ?? null, urlStory: boot?.urlStory ?? null,
    objectiveId: boot?.objectiveId ?? null, markerLabel: boot?.markerLabel ?? null,
    system: boot?.system ?? null, spaceFlight: boot?.spaceFlight ?? null,
    journeyBridge: !!(await session.page.evaluate(() => !!window.__paravoxiaJourneyProbe)),
    shipBridge: !!(await session.page.evaluate(() => !!window.__paravoxiaShipProbe)),
  };
  say(`boot: beat=${boot?.beat} lane=${boot?.lane} system=${JSON.stringify(boot?.system)}`);

  const shot = async (name, note) => {
    const f = path.join(CAP, name);
    await session.page.screenshot({ path: f }).catch((e) => say(`screenshot ${name} failed: ${e}`));
    report.frames.push({ file: f, at: nowIso(), note });
    say(`frame ${name} :: ${note}`);
    return f;
  };

  const t0 = Date.now();
  await shot('000-boot.png', 'first frame after world ready, before sampling');

  let prev = null;
  const events = [];
  const mark = (kind, s, detail) => {
    events.push({ kind, atMs: Date.now() - t0, at: nowIso(), detail });
    say(`EVENT ${kind} @${Date.now() - t0}ms ${detail}`);
  };
  let shotBudget = 10;
  while (Date.now() - t0 < CAPTURE_MS) {
    const s = await session.page.evaluate(pageFlightSample).catch((e) => ({ evalError: String(e).slice(0, 160) }));
    s.atMs = Date.now() - t0;
    s.at = nowIso();
    tel.write(JSON.stringify(s) + '\n');
    report.samples++;

    if (prev && !s.evalError && !prev.evalError) {
      const p = prev, c = s;
      const chg = [];
      if (p.spaceFlight?.phase !== c.spaceFlight?.phase) chg.push(['phase', `${p.spaceFlight?.phase} -> ${c.spaceFlight?.phase}`]);
      if (p.spaceFlight?.controlMode !== c.spaceFlight?.controlMode) chg.push(['controlMode', `${p.spaceFlight?.controlMode} -> ${c.spaceFlight?.controlMode}`]);
      if (p.systemFlight?.activePlanetId !== c.systemFlight?.activePlanetId) chg.push(['activePlanetId', `${p.systemFlight?.activePlanetId} -> ${c.systemFlight?.activePlanetId}`]);
      if (p.systemFlight?.locationMode !== c.systemFlight?.locationMode) chg.push(['locationMode', `${p.systemFlight?.locationMode} -> ${c.systemFlight?.locationMode}`]);
      if (p.systemFlight?.activationEpoch !== c.systemFlight?.activationEpoch) chg.push(['activationEpoch', `${p.systemFlight?.activationEpoch} -> ${c.systemFlight?.activationEpoch}`]);
      if (JSON.stringify(p.systemFlight?.target ?? null) !== JSON.stringify(c.systemFlight?.target ?? null)) chg.push(['systemTarget', `${JSON.stringify(p.systemFlight?.target)} -> ${JSON.stringify(c.systemFlight?.target)}`]);
      if (p.shipFeedback?.approachLimited !== c.shipFeedback?.approachLimited) chg.push(['approachLimited', `${p.shipFeedback?.approachLimited} -> ${c.shipFeedback?.approachLimited}`]);
      if (p.objectiveId !== c.objectiveId) chg.push(['objectiveId', `${p.objectiveId} -> ${c.objectiveId}`]);
      if (p.beat !== c.beat) chg.push(['beat', `${p.beat} -> ${c.beat}`]);
      for (const [k, d] of chg) {
        mark(k, c, `${d} | d=${c.systemFlight?.originCentreDistance} closing=${c.systemFlight?.radialClosingSpeed} spd=${c.systemFlight?.speed} markerM=${c.hud?.markerDistanceM}`);
        if (shotBudget > 0 && (k === 'phase' || k === 'activePlanetId' || k === 'objectiveId' || k === 'systemTarget')) {
          shotBudget--;
          await shot(`${String(report.samples).padStart(4, '0')}-${k}.png`, `${d} at d=${c.systemFlight?.originCentreDistance}`);
        }
      }
    }
    prev = s;
    if (s.originLandedMilestone) { mark('origin-landed', s, 'story:ch13-origin-landed latched'); break; }
    await sleep(SAMPLE_MS);
  }
  report.captureMs = Date.now() - t0;
  await shot('999-final.png', 'last frame at the end of the bounded window');
  report.events = events;
  report.stopReason = report.captureMs >= CAPTURE_MS
    ? 'BOUNDED-WINDOW-ELAPSED (probe stop, NOT a game failure)'
    : 'origin-landed-milestone-latched';
  report.finishedAt = nowIso();
  say(`done: ${report.samples} samples over ${report.captureMs}ms, ${events.length} transitions`);
} catch (e) {
  report.error = { name: e?.name, message: String(e?.message ?? e).slice(0, 400) };
  report.finishedAt = nowIso();
  say(`FAILED: ${e?.stack ?? e}`);
  process.exitCode = 1;
} finally {
  const c = await guard.stopOnce('probe-end');
  report.cleanup = c;
  fs.writeFileSync(path.join(CAP, 'run.json'), JSON.stringify(report, null, 2));
  tel.end(); lg.end();
  say(`cleanup: ${JSON.stringify(c)}`);
}
