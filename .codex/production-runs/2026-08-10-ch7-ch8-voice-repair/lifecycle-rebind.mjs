// Defect ux-04 repair: rebuild the objective-lifecycle rows from the CLOSING
// pass's own traces and re-bind both mandatory lifecycle artifacts to the
// frozen draft-v5 contract and its hash.
//
// Every number below is counted from a recorded emission in
// evidence/verification-final/, never asserted by hand. The prior artifacts
// were bound to draft-v2 / aa7ea1ac… while the frozen contract is draft-v5 /
// 36a7cb4f…; that binding is superseded here rather than edited in place.
import fs from 'node:fs';
import path from 'node:path';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V = path.join(RUN_DIR, 'evidence', 'verification-final');
const CONTRACT_VERSION = 'draft-v5';
const CONTRACT_SHA = '36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb';

const load = (f) => {
  const p = path.join(V, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

/** Every trace file in the closing pass that carries an objective channel. */
const SOURCES = [];
const push = (label, variant, events, route) => {
  if (Array.isArray(events) && events.length) SOURCES.push({ label, variant, route, events });
};
for (const [file, variant, route] of [
  ['ch7queue-desktop.json', 'desktop', 'ch7 movie'],
  ['ch7manual.json', 'desktop', 'ch7 paced manual-shape'],
  ['ch7mobile-mobile-portrait.json', 'mobile-portrait', 'ch7 movie'],
  ['ch7mobile-mobile-landscape.json', 'mobile-landscape', 'ch7 movie'],
  ['routeB-desktop.json', 'desktop', 'ch8 chained movie'],
  ['routeC-desktop.json', 'desktop', 'ch8 deep-link movie'],
  ['routeC-potato.json', 'quality-potato', 'ch8 deep-link movie'],
  ['routeC-mobile.json', 'mobile', 'ch8 deep-link movie'],
  ['routeC-reduced-motion.json', 'reduced-motion', 'ch8 deep-link movie'],
  ['dive.json', 'desktop', 'ch8 dive-and-climb']
]) {
  const j = load(file);
  if (!j) continue;
  (j.runs ?? []).forEach((r, i) => push(`${file.replace('.json', '')}/run${i + 1}`, variant, r.events, route));
}
{
  const j = load(path.join('routeA-ordered', 'routeA-ordered.json'));
  (j?.runs ?? []).forEach((r, i) => push(`routeA-ordered/run${i + 1}`, 'desktop', r.events, 'ch8 canonical ordered-ignition'));
}
{
  const j = load('replay-remeasure.json');
  (j?.cases ?? []).forEach(c => push(`replay/${c.case}`, 'desktop', c.events, 'reset matrix'));
}

function scan(events, runtimeId) {
  const objEvents = events.filter(e => e.ch === 'objective');
  const rows = [];
  let active = false;
  for (const e of objEvents) {
    const id = e.objective?.id ?? null;
    if (id === runtimeId) {
      if (!active) {
        active = true;
        rows.push({ entryStoryMs: e.story, healths: [], markers: [],
          workOrder: e.objective.workOrder, markerLabel: e.objective.markerLabel,
          requiresMarker: e.objective.requiresMarker, kind: e.objective.kind });
      }
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
  return { entries: rows, feedbackCues: feedback, feedbackCount: feedback.length };
}

// Runtime objective IDs actually reachable on the traced routes.
const observedIds = new Set();
for (const s of SOURCES) {
  for (const e of s.events) if (e.ch === 'objective' && e.objective?.id) observedIds.add(e.objective.id);
}

const out = {
  schema: 'paravoxia.objectiveLifecycleMeasurements.v2',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  contractVersion: CONTRACT_VERSION,
  contractSha256: CONTRACT_SHA,
  generatedAt: new Date().toISOString(),
  generatedBy: 'lifecycle-rebind.mjs over evidence/verification-final (closing verification pass, iteration 6)',
  supersedes: {
    file: 'evidence/verification/objective-lifecycle-measurements.json',
    reason: 'defect ux-04 — the prior rows were bound to draft-v2 / aa7ea1ac…; these are re-measured against draft-v5 / 36a7cb4f… from the closing pass traces'
  },
  markerHealthDefinition: 'acceptance criterion [35]: no missing-marker frame while the objective is ACTIVE AND ACQUIRED. The 2.96-3.14 s entry acquisition transient on reconstruct:diagnose is a recorded, accepted measured exception.',
  traceSources: SOURCES.map(s => ({ label: s.label, variant: s.variant, route: s.route, eventCount: s.events.length })),
  objectives: []
};

for (const runtimeId of [...observedIds].sort()) {
  const row = { runtimeObjectiveId: runtimeId, observations: [] };
  let totalEntries = 0, totalFeedback = 0, readyReached = 0, missingMarkerObs = 0;
  let activeAtTraceEnd = 0;
  const markerLabels = new Set(), workOrders = new Set(), kinds = new Set(), requiresMarker = new Set();
  const feedbackPerEntry = [];
  for (const src of SOURCES) {
    const s = scan(src.events, runtimeId);
    if (s.entries.length === 0) continue;
    totalEntries += s.entries.length;
    totalFeedback += s.feedbackCount;
    feedbackPerEntry.push(s.entries.length === 0 ? 0 : s.feedbackCount / s.entries.length);
    for (const e of s.entries) {
      e.markers.forEach(m => markerLabels.add(m));
      workOrders.add(JSON.stringify(e.workOrder));
      kinds.add(e.kind);
      requiresMarker.add(e.requiresMarker);
      if (e.healths.includes('ready')) readyReached++;
      missingMarkerObs += e.healths.filter(h => h === 'missing-marker').length;
      if (e.clearedStoryMs === undefined) activeAtTraceEnd++;
    }
    row.observations.push({
      source: src.label, variant: src.variant, route: src.route,
      entries: s.entries.length,
      feedbackCues: s.feedbackCount,
      healthSequence: s.entries.map(e => e.healths),
      replacedBy: s.entries.map(e => e.replacedBy ?? null),
      screenLifeSeconds: s.entries.map(e => e.clearedStoryMs === undefined
        ? null : Number(((e.clearedStoryMs - e.entryStoryMs) / 1000).toFixed(3)))
    });
  }
  row.totalEntries = totalEntries;
  row.totalFeedbackCues = totalFeedback;
  row.feedbackCuesPerEntry = Number((totalEntries === 0 ? 0 : totalFeedback / totalEntries).toFixed(3));
  row.oneShotEntryFeedback = totalFeedback <= totalEntries;
  row.markerLabelsObserved = [...markerLabels];
  row.markerLabelSingular = markerLabels.size <= 1;
  row.workOrdersObserved = [...workOrders].map(w => JSON.parse(w));
  row.workOrderCarriesVerbOrInput = [...workOrders].map(w => JSON.parse(w))
    .every(lines => lines.some(l => /\[[A-Z]\]|\b(FOLLOW|RETURN|AIM|TRACE|HOLD|PRESS|OPEN|ENTER|LEAVE|CLIMB|LAUNCH|CRAFT|RECOVER|CALIBRATE|SEAL|INSTALL|RESTORE|BOARD)\b/.test(l)));
  row.kindsObserved = [...kinds];
  row.requiresMarkerObserved = [...requiresMarker];
  row.readyReachedCount = readyReached;
  row.missingMarkerObservations = missingMarkerObs;
  row.activeAtTraceEndCount = activeAtTraceEnd;
  out.objectives.push(row);
}

fs.writeFileSync(path.join(V, 'objective-lifecycle-measurements.json'), `${JSON.stringify(out, null, 2)}\n`);
for (const o of out.objectives) {
  console.log(o.runtimeObjectiveId, '| entries', o.totalEntries, '| feedback', o.totalFeedbackCues,
    '| markers', JSON.stringify(o.markerLabelsObserved), '| ready', o.readyReachedCount,
    '| missingMarkerObs', o.missingMarkerObservations, '| oneShot', o.oneShotEntryFeedback,
    '| verbInWorkOrder', o.workOrderCarriesVerbOrInput);
}
console.log('wrote', path.join(V, 'objective-lifecycle-measurements.json'));
