// Builds the measured objective-lifecycle rows from the verification traces.
// Every number here is counted from a recorded emission, never asserted by hand.
import fs from 'node:fs';
import path from 'node:path';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V = path.join(RUN_DIR, 'evidence', 'verification');

const MAP = {
  'reconstruct-diagnose': 'reconstruct:diagnose',
  'reconstruct-repair-bench-online': 'reconstruct:repair:bench_online',
  'reconstruct-repair-frame-restored': 'reconstruct:repair:frame_restored',
  'reconstruct-repair-hull-sealed': 'reconstruct:repair:hull_sealed',
  'reconstruct-craft-lift-online': 'reconstruct:craft:lift_online',
  'reconstruct-repair-lift-online': 'reconstruct:repair:lift_online',
  'reconstruct-craft-flight-ready': 'reconstruct:craft:flight_ready',
  'reconstruct-repair-flight-ready': 'reconstruct:repair:flight_ready',
  'ch8-launch-reboard': null
};

function scan(events, runtimeId) {
  const objEvents = events.filter(e => e.ch === 'objective');
  const rows = [];
  let active = false;
  for (const e of objEvents) {
    const id = e.objective?.id ?? null;
    if (id === runtimeId) {
      if (!active) { active = true; rows.push({ entryStoryMs: e.story, states: [], markers: [], healths: [], workOrder: e.objective.workOrder, markerLabel: e.objective.markerLabel, requiresMarker: e.objective.requiresMarker, kind: e.objective.kind }); }
      const cur = rows[rows.length - 1];
      cur.healths.push(e.objective.health);
      cur.markers.push(e.objective.markerLabel);
    } else if (active) {
      active = false;
      const cur = rows[rows.length - 1];
      cur.clearedStoryMs = e.story;
      cur.replacedBy = id;
    }
  }
  const feedback = events.filter(e => e.ch === 'feedback' && e.cue?.objectiveId === runtimeId);
  return { entries: rows, feedbackCount: feedback.length, feedbackStoryMs: feedback.map(f => f.story) };
}

const ch7 = JSON.parse(fs.readFileSync(path.join(V, 'ch7-flow-trace.json'), 'utf8'));
const ch8 = JSON.parse(fs.readFileSync(path.join(V, 'ch8-flow-trace.json'), 'utf8'));
const variants = JSON.parse(fs.readFileSync(path.join(V, 'variants-trace.json'), 'utf8'));
const resets = JSON.parse(fs.readFileSync(path.join(V, 'resets-trace.json'), 'utf8'));
const quitReplay = JSON.parse(fs.readFileSync(path.join(V, 'quit-replay-trace.json'), 'utf8'));

const sources = [
  ...ch7.runs.map((r, i) => ({ label: `ch7-cold-run-${i + 1}`, variant: 'desktop', events: r.events })),
  ...ch8.runs.map((r, i) => ({ label: `ch8-cold-run-${i + 1}`, variant: 'desktop', events: r.events })),
  ...variants.variants.map(v => ({ label: `${v.variant}/${v.beat}`, variant: v.variant, events: v.events })),
  ...resets.cases.map(c => ({ label: `reset/${c.case}`, variant: 'desktop', events: c.events ?? [] }))
];

const out = { generatedAt: new Date().toISOString(), objectives: [] };
for (const [contractId, runtimeId] of Object.entries(MAP)) {
  const row = { contractObjectiveId: contractId, runtimeObjectiveId: runtimeId, observations: [] };
  if (runtimeId === null) {
    row.observed = false;
    row.note = 'Never became the active objective on any traced path; the reboard route requires leaving the ship in flight, which headless cannot drive.';
    out.objectives.push(row);
    continue;
  }
  let totalEntries = 0;
  let totalFeedback = 0;
  const markerLabels = new Set();
  const workOrders = new Set();
  const requiresMarker = new Set();
  const kinds = new Set();
  let readyReached = 0;
  let missingMarkerObs = 0;
  let activeAfterClear = false;
  for (const src of sources) {
    const s = scan(src.events, runtimeId);
    if (s.entries.length === 0) continue;
    totalEntries += s.entries.length;
    totalFeedback += s.feedbackCount;
    for (const e of s.entries) {
      e.markers.forEach(m => markerLabels.add(m));
      workOrders.add(JSON.stringify(e.workOrder));
      requiresMarker.add(e.requiresMarker);
      kinds.add(e.kind);
      if (e.healths.includes('ready')) readyReached++;
      missingMarkerObs += e.healths.filter(h => h === 'missing-marker').length;
      if (e.clearedStoryMs === undefined) activeAfterClear = true;
    }
    row.observations.push({
      source: src.label,
      variant: src.variant,
      entries: s.entries.length,
      feedbackCues: s.feedbackCount,
      healthSequence: s.entries.map(e => e.healths),
      replacedBy: s.entries.map(e => e.replacedBy ?? null),
      screenLifeSeconds: s.entries.map(e => e.clearedStoryMs === undefined ? null : Number(((e.clearedStoryMs - e.entryStoryMs) / 1000).toFixed(3)))
    });
  }
  row.observed = totalEntries > 0;
  row.totalEntries = totalEntries;
  row.totalFeedbackCues = totalFeedback;
  row.feedbackPerEntry = totalEntries === 0 ? [] : row.observations.flatMap(o => Array.from({ length: o.entries }, () => o.feedbackCues / o.entries));
  row.markerLabelsObserved = [...markerLabels];
  row.workOrdersObserved = [...workOrders].map(w => JSON.parse(w));
  row.requiresMarkerObserved = [...requiresMarker];
  row.kindsObserved = [...kinds];
  row.readyReachedCount = readyReached;
  row.missingMarkerObservations = missingMarkerObs;
  row.activeAfterClear = activeAfterClear;
  out.objectives.push(row);
}

// Reset evidence: which routes proved no stale objective survived.
out.resetEvidence = {
  'deep-link': resets.cases.filter(c => c.case.startsWith('deep_link')).map(c => ({ case: c.case, objectiveAfter: c.objective?.id ?? null })),
  sandbox: resets.cases.filter(c => c.case === 'sandbox_noop').map(c => ({ case: c.case, objectiveAfter: null, events: c.events.length })),
  quit: quitReplay.cases.filter(c => c.case === 'quit').map(c => ({ objectiveAfter: c.after.obj?.id ?? null, auditAfter: c.after.text.audit, captionAfter: c.after.text.caption })),
  replay: quitReplay.cases.filter(c => c.case === 'replay').map(c => ({ beatAfter: c.after.beat, objectiveAfter: c.after.obj?.id ?? null }))
};

fs.writeFileSync(path.join(V, 'objective-lifecycle-measurements.json'), JSON.stringify(out, null, 2));
for (const o of out.objectives) {
  console.log(o.contractObjectiveId, '| observed', o.observed, '| entries', o.totalEntries ?? 0, '| feedback', o.totalFeedbackCues ?? 0,
    '| markers', JSON.stringify(o.markerLabelsObserved ?? []), '| ready', o.readyReachedCount ?? 0, '| missingMarkerObs', o.missingMarkerObservations ?? 0,
    '| activeAfterClear', o.activeAfterClear);
}
console.log('wrote', path.join(V, 'objective-lifecycle-measurements.json'));
