// Aggregates every draft-v3 ladder route trace into one assertion sheet:
// formula conformance, C3 margin, drop behaviour, cross-run variance, exit
// window regression, variant-D ordering, and variant parity against the
// desktop deep-link movie reference.
import fs from 'node:fs';
import path from 'node:path';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V3 = path.join(RUN_DIR, 'evidence', 'verification-v3');
const read = (n) => JSON.parse(fs.readFileSync(path.join(V3, n), 'utf8'));

const L3_REVEAL = 1.972;
const stats = (xs) => {
  const v = xs.filter(x => typeof x === 'number');
  if (!v.length) return null;
  return { n: v.length, min: Math.min(...v), max: Math.max(...v),
    spread: Number((Math.max(...v) - Math.min(...v)).toFixed(3)),
    mean: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)) };
};

const routeFiles = {
  'routeA.space-only': 'routeA-space.json',
  'routeA.space-then-w': 'routeA-space-then-w.json',
  'routeA.space-late-ignite': 'routeA-space-late-ignite.json',
  'routeB.chained-movie': 'routeB-desktop.json',
  'routeC.deeplink-movie': 'routeC-desktop.json',
  'routeD.potato': 'routeC-potato.json',
  'routeD.mobile-portrait': 'routeC-mobile-portrait.json',
  'routeD.reduced-motion': 'routeC-reduced-motion.json'
};

const out = {
  schema: 'paravoxia.pacedLadderAnalysis.v1',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  contractVersion: 'draft-v3',
  contractSha256: '1e36818230e7f48649c040b0e6574cad51c67dd5ba405fa00661307f0e0b4737',
  compiledAt: new Date().toISOString(),
  constants: { CH8_L1_MIN_SLOT_SECONDS: 4.5, CH8_L2_MIN_SLOT_SECONDS: 3.0, l3RevealSeconds: L3_REVEAL },
  routes: {}
};

for (const [id, file] of Object.entries(routeFiles)) {
  if (!fs.existsSync(path.join(V3, file))) continue;
  const d = read(file);
  const valid = d.runs.filter(r => r.ladder && r.ladder.tL1 !== null);
  const rows = valid.map(r => {
    const a = r.ladder;
    const margin = (a.tL3 !== null && a.tDeepSpace !== null)
      ? Number((a.tDeepSpace - (a.tL3 + L3_REVEAL)).toFixed(3)) : null;
    return {
      run: r.run,
      tL1: a.tL1, tL2: a.tL2, tL3: a.tL3, tL4: a.tL4,
      tPhaseEdge: a.tPhaseEdge, tDeepSpace: a.tDeepSpace,
      l2Cause: r.assertions.l2Formula.cause ?? null,
      l2FormulaDelta: r.assertions.l2Formula.deltaSeconds ?? null,
      l3FormulaDelta: r.assertions.l3Formula.deltaSeconds ?? null,
      l3Rendered: a.tL3 !== null,
      c3MarginSeconds: margin,
      onceOnly: r.assertions.onceOnly.counts,
      order: r.assertions.order.observed,
      exitWindowPass: r.exitWindow ? r.exitWindow.pass : null,
      variantDMarginSeconds: r.variantDOrdering ? (r.variantDOrdering.marginSeconds ?? null) : null,
      variantDPass: r.variantDOrdering ? r.variantDOrdering.pass : null,
      pageErrors: r.pageErrors.length
    };
  });
  out.routes[id] = {
    source: `evidence/verification-v3/${file}`,
    url: d.runs[0] ? d.runs[0].url : null,
    shape: d.shape ?? null,
    igniteAtEntryOffsetSeconds: d.igniteAtEntryOffsetSeconds ?? null,
    coldRuns: d.runs.length,
    validRuns: valid.length,
    rows,
    variance: {
      tL1: stats(rows.map(r => r.tL1)),
      tL2: stats(rows.map(r => r.tL2)),
      tL3: stats(rows.map(r => r.tL3)),
      tPhaseEdge: stats(rows.map(r => r.tPhaseEdge)),
      tDeepSpace: stats(rows.map(r => r.tDeepSpace)),
      c3Margin: stats(rows.map(r => r.c3MarginSeconds)),
      variantDMargin: stats(rows.map(r => r.variantDMarginSeconds))
    },
    l3RenderedEveryRun: rows.every(r => r.l3Rendered),
    l3DroppedEveryRun: rows.every(r => !r.l3Rendered),
    exitWindowPassEveryRun: rows.every(r => r.exitWindowPass === true || r.exitWindowPass === null),
    l2CauseSet: [...new Set(rows.map(r => r.l2Cause))],
    formulaMaxDeltaSeconds: Math.max(...rows.flatMap(r => [Math.abs(r.l2FormulaDelta ?? 0), Math.abs(r.l3FormulaDelta ?? 0)]))
  };
}

// Variant parity against the desktop deep-link movie.
const ref = out.routes['routeC.deeplink-movie'];
out.variantParity = {};
for (const id of ['routeD.potato', 'routeD.mobile-portrait', 'routeD.reduced-motion']) {
  const v = out.routes[id];
  if (!v || !ref) continue;
  const refStrings = ref.rows.map(r => r.order.join('>'));
  const vStrings = v.rows.map(r => r.order.join('>'));
  out.variantParity[id] = {
    sameStringSetAndOrder: [...new Set(vStrings)].join('|') === [...new Set(refStrings)].join('|'),
    observedOrder: [...new Set(vStrings)],
    referenceOrder: [...new Set(refStrings)],
    sameDropBehaviour: v.l3DroppedEveryRun === ref.l3DroppedEveryRun,
    l3DroppedEveryRun: v.l3DroppedEveryRun,
    l2CauseSet: v.l2CauseSet,
    exitWindowPassEveryRun: v.exitWindowPassEveryRun,
    l1MinusReferenceSeconds: Number((v.variance.tL1.mean - ref.variance.tL1.mean).toFixed(3)),
    l2OffsetFromL1Seconds: {
      variant: Number((v.variance.tL2.mean - v.variance.tL1.mean).toFixed(3)),
      reference: Number((ref.variance.tL2.mean - ref.variance.tL1.mean).toFixed(3))
    }
  };
}

// Exit-window rows pooled across every movie route (the tickLaunchVoice
// regression check).
const exitRows = {};
for (const [id, file] of Object.entries(routeFiles)) {
  if (!fs.existsSync(path.join(V3, file))) continue;
  for (const r of read(file).runs) {
    if (!r.exitWindow || !r.exitWindow.rows) continue;
    for (const row of r.exitWindow.rows) {
      exitRows[row.id] ??= { contractOffsetSeconds: row.contractOffsetSeconds, deltas: [], routes: [] };
      exitRows[row.id].deltas.push(row.deltaSeconds);
      exitRows[row.id].routes.push(`${id}#${r.run}`);
    }
  }
}
out.exitWindowPooled = Object.fromEntries(Object.entries(exitRows).map(([id, v]) => [id, {
  contractOffsetSeconds: v.contractOffsetSeconds,
  observations: v.deltas.length,
  deltaSeconds: stats(v.deltas),
  withinTolerance: v.deltas.every(d => d !== null && Math.abs(d) <= 0.2)
}]));

fs.writeFileSync(path.join(V3, 'ladder-analysis.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({
  routes: Object.fromEntries(Object.entries(out.routes).map(([k, v]) => [k, {
    validRuns: v.validRuns, l3Rendered: v.l3RenderedEveryRun, l3Dropped: v.l3DroppedEveryRun,
    c3Margin: v.variance.c3Margin, l2Cause: v.l2CauseSet, maxFormulaDelta: v.formulaMaxDeltaSeconds,
    variantDMargin: v.variance.variantDMargin
  }])),
  variantParity: out.variantParity,
  exitWindowPooled: out.exitWindowPooled
}, null, 2));
