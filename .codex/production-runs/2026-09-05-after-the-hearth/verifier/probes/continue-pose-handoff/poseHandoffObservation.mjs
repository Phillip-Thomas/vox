// Passive, non-pausing CDP observation of the Continue pose handoff.
//
// SCOPE (measured only; anything not listed stays UNMEASURED, never aliased):
//   A) EfficientScene render/controller mount:
//        commandContext.world.worldId, commandContext.world.actorId,
//        validatedPersistedParked, landedShipPos, initialPlayerPosition,
//        landedPlayerEgress, landedPlayerSpawn
//   B) EfficientPlayer first body.setTranslation target + its caller/callsite
//   C) resolveShipPlayerEgressPosition(terrain,size,shipPos,face?) optional
//      face argument AND the actually derived face WHEN the running bundle
//      exposes it. If not exposed it is recorded as {measured:false}.
//
// MECHANISM: CDP Debugger.setBreakpointByUrl with an `condition` that is a
// SAFE IIFE ALWAYS EVALUATING FALSE. It records into a bounded own buffer and
// swallows its own errors, so the target NEVER pauses and the game is never
// monkeypatched (no setter, no AudioParam, no wrapper on game functions).
// Requested vs actual (relocated) breakpoint positions are both reported.

const MAX_EVENTS = 400; // bounded own buffer; drops are counted, not silent

export const POSE_HANDOFF_BUFFER = '__pvxPoseHandoff';

/** Installed in page scope. Bounded, error-swallowing, drop-counting. */
function bufferBootstrapSource(bufferName, maxEvents) {
  return `(() => { try {
    if (globalThis[${JSON.stringify(bufferName)}]) return 'already';
    const b = { events: [], drops: 0, errors: 0, max: ${maxEvents}, seq: 0,
      installedAtMs: (performance && performance.now) ? performance.now() : null,
      installedAtEpochMs: Date.now() };
    b.push = function (site, fields) {
      try {
        if (b.events.length >= b.max) { b.drops++; return false; }
        b.events.push({ seq: b.seq++, site,
          monotonicMs: (performance && performance.now) ? performance.now() : null,
          epochMs: Date.now(), fields });
        return true;
      } catch (e) { try { b.errors++; } catch (_) {} return false; }
    };
    globalThis[${JSON.stringify(bufferName)}] = b;
    return 'installed';
  } catch (e) { return 'bootstrap-error:' + String(e && e.message || e); } })()`;
}

/**
 * Build an ALWAYS-FALSE breakpoint condition. Any throw inside is caught and
 * counted, and the expression still ends in `false`, so the debugger cannot
 * pause on it under any input.
 */
export function alwaysFalseLogpointCondition(site, fieldExprs, bufferName = POSE_HANDOFF_BUFFER) {
  const entries = Object.entries(fieldExprs)
    .map(([k, expr]) => `${JSON.stringify(k)}: (() => { try { return ${expr}; } catch (e) { return { unmeasured: true, reason: String(e && e.message || e) }; } })()`)
    .join(', ');
  return `(() => { try { const b = globalThis[${JSON.stringify(bufferName)}];`
    + ` if (b) b.push(${JSON.stringify(site)}, { ${entries} }); } catch (e) {`
    + ` try { globalThis[${JSON.stringify(bufferName)}].errors++; } catch (_) {} } return false; })()`;
}

/** Snapshot a THREE-ish vector or plain array without assuming a shape. */
export const VEC = (expr) =>
  `(() => { const v = ${expr}; if (v == null) return null;`
  + ` if (Array.isArray(v)) return v.slice(0, 4);`
  + ` if (typeof v.x === 'number') return [v.x, v.y, v.z]; return { unmeasured: true, kind: typeof v }; })()`;

/**
 * Resolve 0-based executable CDP positions on the EXACT current bundle.
 * Returns requested vs actual location so relocation is never hidden.
 */
export async function resolveExecutablePositions(cdp, { urlRegex, points }) {
  const resolved = [];
  for (const p of points) {
    const requested = { lineNumber: p.lineNumber, columnNumber: p.columnNumber ?? 0 };
    let actual = null; let error = null; let breakpointId = null;
    try {
      const res = await cdp.send('Debugger.setBreakpointByUrl', {
        urlRegex,
        lineNumber: requested.lineNumber,
        columnNumber: requested.columnNumber,
        condition: p.condition,
      });
      breakpointId = res.breakpointId ?? null;
      actual = (res.locations ?? []).map((l) => ({
        scriptId: l.scriptId, lineNumber: l.lineNumber, columnNumber: l.columnNumber,
      }));
    } catch (e) { error = String(e && e.message ? e.message : e); }
    resolved.push({
      site: p.site, requested, actual, breakpointId, error,
      hit: Array.isArray(actual) && actual.length > 0,
      relocated: Array.isArray(actual) && actual.length > 0
        && (actual[0].lineNumber !== requested.lineNumber
          || actual[0].columnNumber !== requested.columnNumber),
    });
  }
  return resolved;
}

/** Install the buffer (page + on every new document) and enable the debugger. */
export async function installPoseHandoffObserver(page, cdp, { urlRegex, points }) {
  const src = bufferBootstrapSource(POSE_HANDOFF_BUFFER, MAX_EVENTS);
  const installReport = { bufferName: POSE_HANDOFF_BUFFER, maxEvents: MAX_EVENTS };
  try {
    await page.addInitScript({ content: `void ${src};` });
    installReport.initScript = 'added';
  } catch (e) { installReport.initScript = `error:${String(e?.message ?? e)}`; }
  try { installReport.inPage = await page.evaluate(src); }
  catch (e) { installReport.inPage = `error:${String(e?.message ?? e)}`; }
  try { await cdp.send('Debugger.enable'); installReport.debugger = 'enabled'; }
  catch (e) { installReport.debugger = `error:${String(e?.message ?? e)}`; }
  // Belt and braces: even if something did request a pause, never stop.
  try { await cdp.send('Debugger.setBreakpointsActive', { active: true }); } catch (_) {}
  installReport.positions = await resolveExecutablePositions(cdp, { urlRegex, points });
  installReport.resolvedCount = installReport.positions.filter((p) => p.hit).length;
  installReport.unresolved = installReport.positions.filter((p) => !p.hit).map((p) => p.site);
  return installReport;
}

/** Harvest the bounded buffer. Safe to call from `finally`; idempotent-friendly. */
export async function harvestPoseHandoff(page, reason) {
  try {
    const raw = await page.evaluate((name) => {
      const b = globalThis[name];
      if (!b) return { present: false };
      return { present: true, events: b.events, drops: b.drops, errors: b.errors,
        max: b.max, seq: b.seq, installedAtMs: b.installedAtMs,
        installedAtEpochMs: b.installedAtEpochMs };
    }, POSE_HANDOFF_BUFFER);
    return { reason, harvestError: null, ...raw,
      eventCount: raw.present ? raw.events.length : 0,
      bounded: raw.present ? raw.drops > 0 : null };
  } catch (e) {
    return { reason, present: null, harvestError: String(e?.message ?? e), eventCount: 0 };
  }
}

/** Split harvested events around the Continue click monotonic timestamp. */
export function splitAroundContinue(harvest, clickMonotonicMs) {
  const events = harvest && Array.isArray(harvest.events) ? harvest.events : [];
  if (clickMonotonicMs == null) {
    return { measured: false, reason: 'no click monotonic reference', before: [], after: [] };
  }
  const before = events.filter((e) => e.monotonicMs != null && e.monotonicMs < clickMonotonicMs);
  const after = events.filter((e) => e.monotonicMs != null && e.monotonicMs >= clickMonotonicMs);
  return {
    measured: true, clickMonotonicMs,
    before, after,
    orderBySeq: events.map((e) => ({ seq: e.seq, site: e.site, monotonicMs: e.monotonicMs })),
    firstSetTranslationAfterClick:
      after.find((e) => e.site === 'EfficientPlayer.body.setTranslation') ?? null,
  };
}

/** The in-scope observation points. Field set is EXACTLY the commissioned one. */
export const POSE_HANDOFF_SITES = {
  efficientSceneMount: (fq) => alwaysFalseLogpointCondition('EfficientScene.landedPlayerSpawn', {
    worldId: `${fq}.commandContext?.world?.worldId ?? {unmeasured:true}`,
    actorId: `${fq}.commandContext?.world?.actorId ?? {unmeasured:true}`,
    validatedPersistedParked: `${fq}.validatedPersistedParked ?? {unmeasured:true}`,
    landedShipPos: VEC(`${fq}.landedShipPos ?? null`),
    initialPlayerPosition: VEC(`${fq}.initialPlayerPosition ?? null`),
    landedPlayerEgress: VEC(`${fq}.landedPlayerEgress ?? null`),
    landedPlayerSpawn: VEC(`${fq}.landedPlayerSpawn ?? null`),
  }),
  playerSetTranslation: (targetExpr, callerExpr) =>
    alwaysFalseLogpointCondition('EfficientPlayer.body.setTranslation', {
      target: VEC(targetExpr),
      caller: callerExpr,
    }),
  egressResolve: (faceArgExpr, derivedFaceExpr) =>
    alwaysFalseLogpointCondition('resolveShipPlayerEgressPosition', {
      faceArgument: `${faceArgExpr} === undefined ? {absent:true} : ${faceArgExpr}`,
      derivedFace: derivedFaceExpr
        ? derivedFaceExpr
        : `({ unmeasured: true, reason: 'derived face not exposed at this position' })`,
    }),
};
