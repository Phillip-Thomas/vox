// Cadence assertion over the voice-repair probe traces.
// Reads the exported named constants from the runtime module so the assertion
// binds the implementation's own table, never a literal typed here twice.
import fs from 'node:fs';
import path from 'node:path';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V = path.join(RUN_DIR, 'evidence', 'verification');
const SRC = '/home/thomasphillip/Projects/vox/main/src/story/emergentStoryDirector.ts';
const src = fs.readFileSync(SRC, 'utf8');
const constant = (name) => {
  const m = src.match(new RegExp(`export const ${name} = ([0-9.]+);`));
  if (!m) throw new Error(`constant ${name} not exported`);
  return Number(m[1]);
};
const K = {
  CH7_M7_AUDIT_SECONDS: constant('CH7_M7_AUDIT_SECONDS'),
  CH7_M7_CAPTION_SECONDS: constant('CH7_M7_CAPTION_SECONDS'),
  CH7_EXIT_CAPTION_SECONDS: constant('CH7_EXIT_CAPTION_SECONDS'),
  CH7_EXIT_HOLD_SECONDS: constant('CH7_EXIT_HOLD_SECONDS'),
  CH8_ATMOSPHERE_EXIT_CAPTION_SECONDS: constant('CH8_ATMOSPHERE_EXIT_CAPTION_SECONDS'),
  CH8_STACK_ONE_SECONDS: constant('CH8_STACK_ONE_SECONDS'),
  CH8_STACK_TWO_SECONDS: constant('CH8_STACK_TWO_SECONDS'),
  CH8_STACK_THREE_SECONDS: constant('CH8_STACK_THREE_SECONDS'),
  CH8_CONTACT_LOGGED_SECONDS: constant('CH8_CONTACT_LOGGED_SECONDS'),
  CH8_DESIGNATION_CAPTION_SECONDS: constant('CH8_DESIGNATION_CAPTION_SECONDS'),
  CH8_OPEN_QUERY_SECONDS: constant('CH8_OPEN_QUERY_SECONDS'),
  CH8_EXIT_HOLD_SECONDS: constant('CH8_EXIT_HOLD_SECONDS')
};

const TOL = 0.2;
const CH7 = {
  entry: { ch: 'caption', text: '(repair is not return.)' },
  m1Audit: { ch: 'audit', header: 'WRECK RELAY', text: 'HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED' },
  m1Caption: { ch: 'caption', text: 'the wreck that brought me here will leave here. i will build the leaving.' },
  m2: { ch: 'caption', text: 'the keel takes the weight first. everything after this is allowed to be heavy.' },
  m3: { ch: 'caption', text: 'it remembers a straight line and goes back to it without being told. i watch that closely.' },
  m4Audit: { ch: 'audit', header: 'WRECK RELAY', text: 'PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED' },
  m4Caption: { ch: 'caption', text: 'i closed it, and something inside started listening again. i did that too.' },
  m5Audit: { ch: 'audit', header: 'WRECK RELAY', text: 'POWER BUS LIVE · TRANSPONDER ARMED' },
  m5Caption: { ch: 'caption', text: "the ground's hold is a habit, not a law." },
  m6: { ch: 'caption', text: 'the last part is the part that thinks. i am being watched now. i put it in anyway.' },
  m7Audit: { ch: 'audit', header: 'AUDIT NETWORK', text: 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED' },
  m7Caption: { ch: 'caption', text: 'nothing has asked yet. something has started paying attention.' },
  exit: { ch: 'caption', text: 'the scar remains. now it can carry me.' }
};
const CH7_RETIRED = '(the scar remains. now it can carry you.)';
const CH8 = {
  l1: { ch: 'caption', text: 'the pond answered every time i asked. i am leaving anyway — that is what the answers were for.' },
  l2: { ch: 'caption', text: 'hold it. this is the only order left, and i am the one giving it.' },
  l3: { ch: 'caption', text: 'the site gets small. the tree does not. i keep finding it.' },
  l4: { ch: 'caption', text: 'i came down this line without being asked. i am going back up it on purpose.' },
  s1: { ch: 'audit', header: 'AUDIT NETWORK', text: 'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED' },
  s2: { ch: 'audit', header: 'AUDIT NETWORK', text: 'REGISTRY QUERY · STATE DESIGNATION.' },
  s3: { ch: 'audit', header: 'AUDIT NETWORK', text: 'NO DESIGNATION RETURNED.' },
  contact: { ch: 'audit', header: 'AUDIT NETWORK', text: 'CONTACT LOGGED.' },
  designation: { ch: 'caption', text: 'they asked for a designation. what i have is not one.' },
  l6: { ch: 'caption', text: 'nothing answers. the query does not close.' }
};

const find = (events, spec) => events.filter(e =>
  e.ch === spec.ch && e.text === spec.text && (spec.header === undefined || (e.header ?? null) === spec.header));

function analyseCh7(run) {
  const ev = run.events;
  const out = { run: run.run, durationSeconds: Number((run.durationMs / 1000).toFixed(2)), reachedStopBeat: run.reachedStopBeat, pageErrors: run.pageErrors.length, lines: {}, order: [], defects: [] };
  for (const [k, spec] of Object.entries(CH7)) {
    const hits = find(ev, spec);
    out.lines[k] = { count: hits.length, storyMs: hits.map(h => h.story) };
    if (hits.length !== 1) out.defects.push(`ch7 ${k} fired ${hits.length}x (expected 1)`);
  }
  if (ev.some(e => e.text === CH7_RETIRED)) out.defects.push('retired ch7 exit string emitted');
  const seq = ['entry', 'm1Audit', 'm1Caption', 'm2', 'm3', 'm4Audit', 'm4Caption', 'm5Audit', 'm5Caption', 'm6', 'm7Audit', 'm7Caption', 'exit'];
  let prev = -Infinity;
  for (const k of seq) {
    const t = out.lines[k].storyMs[0];
    out.order.push({ key: k, storyMs: t });
    if (!(t >= prev)) out.defects.push(`ch7 order violation at ${k}`);
    prev = t;
  }
  const origin = out.lines.m7Audit.storyMs[0];
  const advance = (ev.find(e => e.ch === 'beat' && e.beat === 'ch7-board') || {}).story ?? null;
  out.origin = origin;
  out.cadence = [
    { anchor: 'anchor.ch7.m7-audit', constant: 'CH7_M7_AUDIT_SECONDS', expected: K.CH7_M7_AUDIT_SECONDS, actual: 0 },
    { anchor: 'anchor.ch7.m7-caption', constant: 'CH7_M7_CAPTION_SECONDS', expected: K.CH7_M7_CAPTION_SECONDS, actual: (out.lines.m7Caption.storyMs[0] - origin) / 1000 },
    { anchor: 'anchor.ch7.exit-line', constant: 'CH7_EXIT_CAPTION_SECONDS', expected: K.CH7_EXIT_CAPTION_SECONDS, actual: (out.lines.exit.storyMs[0] - origin) / 1000 },
    { anchor: 'anchor.ch7.advance', constant: 'CH7_EXIT_HOLD_SECONDS', expected: K.CH7_EXIT_HOLD_SECONDS, actual: advance === null ? null : (advance - origin) / 1000 }
  ].map(r => ({ ...r, actual: r.actual === null ? null : Number(r.actual.toFixed(3)), delta: r.actual === null ? null : Number((r.actual - r.expected).toFixed(3)), pass: r.actual !== null && Math.abs(r.actual - r.expected) <= TOL }));
  for (const r of out.cadence) if (!r.pass) out.defects.push(`ch7 cadence ${r.anchor} actual=${r.actual} expected=${r.expected}`);
  // stage-edge separation (movie compression is expected; recorded, not asserted)
  out.stageEdgeGapsSeconds = ['m1Caption', 'm2', 'm3', 'm4Caption', 'm5Caption', 'm6'].map((k, i, a) =>
    i === 0 ? null : Number(((out.lines[k].storyMs[0] - out.lines[a[i - 1]].storyMs[0]) / 1000).toFixed(3))).slice(1);
  const board = ev.find(e => e.ch === 'beat' && e.beat === 'ch7-board');
  const boardCaption = ev.find(e => e.ch === 'caption' && e.beat === 'ch7-board' && e.text);
  out.boardOverwrite = board && boardCaption
    ? { boardEntryOffsetSeconds: Number(((board.story - origin) / 1000).toFixed(3)), captionText: boardCaption.text, offsetSeconds: Number(((boardCaption.story - origin) / 1000).toFixed(3)) }
    : null;
  return out;
}

function analyseCh8(run) {
  const ev = run.events;
  const out = { run: run.run, durationSeconds: Number((run.durationMs / 1000).toFixed(2)), reachedStopBeat: run.reachedStopBeat, pageErrors: run.pageErrors.length, lines: {}, defects: [] };
  for (const [k, spec] of Object.entries(CH8)) {
    const hits = find(ev, spec);
    out.lines[k] = { count: hits.length, storyMs: hits.map(h => h.story) };
    if (hits.length !== 1) out.defects.push(`ch8 ${k} fired ${hits.length}x (expected 1)`);
  }
  const origin = out.lines.l4.storyMs[0];
  const advance = (ev.find(e => e.ch === 'beat' && e.beat === 'ch8-crossing') || {}).story ?? null;
  out.origin = origin;
  const row = (anchor, constantName, key) => ({
    anchor, constant: constantName, expected: K[constantName],
    actual: out.lines[key].storyMs[0] === undefined ? null : Number(((out.lines[key].storyMs[0] - origin) / 1000).toFixed(3))
  });
  out.cadence = [
    row('anc.launch.atmosphere-exit', 'CH8_ATMOSPHERE_EXIT_CAPTION_SECONDS', 'l4'),
    row('anchor.ch8.stack-one', 'CH8_STACK_ONE_SECONDS', 's1'),
    row('anchor.ch8.stack-two', 'CH8_STACK_TWO_SECONDS', 's2'),
    row('anchor.ch8.stack-three', 'CH8_STACK_THREE_SECONDS', 's3'),
    row('anchor.ch8.contact-logged', 'CH8_CONTACT_LOGGED_SECONDS', 'contact'),
    row('anchor.ch8.designation', 'CH8_DESIGNATION_CAPTION_SECONDS', 'designation'),
    row('anchor.ch8.open-query', 'CH8_OPEN_QUERY_SECONDS', 'l6'),
    { anchor: 'anchor.ch8.advance', constant: 'CH8_EXIT_HOLD_SECONDS', expected: K.CH8_EXIT_HOLD_SECONDS, actual: advance === null ? null : Number(((advance - origin) / 1000).toFixed(3)) }
  ].map(r => ({ ...r, delta: r.actual === null ? null : Number((r.actual - r.expected).toFixed(3)), pass: r.actual !== null && Math.abs(r.actual - r.expected) <= TOL }));
  for (const r of out.cadence) if (!r.pass) out.defects.push(`ch8 cadence ${r.anchor} actual=${r.actual} expected=${r.expected}`);
  // Variant D ordering assertion.
  const handoff = ev.find(e => e.ch === 'objective' && e.objective && e.objective.id === 'ch8:launch:orbital-handoff');
  out.variantD = handoff
    ? {
      objectiveId: 'ch8:launch:orbital-handoff',
      publishOffsetSeconds: Number(((handoff.story - origin) / 1000).toFixed(3)),
      stackOneOffsetSeconds: out.cadence[1].actual,
      marginSeconds: Number(((out.cadence[1].actual * 1000 - (handoff.story - origin)) / 1000).toFixed(3)),
      publishedBeforeStackOne: handoff.story < out.lines.s1.storyMs[0],
      workOrder: handoff.objective.workOrder,
      markerLabel: handoff.objective.markerLabel,
      requiresMarker: handoff.objective.requiresMarker,
      health: handoff.objective.health
    }
    : null;
  if (!out.variantD || !out.variantD.publishedBeforeStackOne) out.defects.push('variant D ordering assertion failed');
  // L1/L2/L3 same-tick collapse check (movie compression evidence).
  out.l1l2l3SpreadMs = Number((out.lines.l3.storyMs[0] - out.lines.l1.storyMs[0]).toFixed(1));
  out.postAdvance = ev.filter(e => e.beat === 'ch8-crossing').map(e => ({ ch: e.ch, text: e.text ?? null, id: e.objective?.id ?? null }));
  out.finalResetReason = run.finalAv?.lastResetReason ?? null;
  out.finalActivatedAnchorIds = run.finalAv?.activatedAnchorIds ?? null;
  return out;
}

const summary = { generatedAt: new Date().toISOString(), toleranceSeconds: TOL, namedConstants: K, ch7: [], ch8: [], defects: [] };
const ch7Trace = JSON.parse(fs.readFileSync(path.join(V, 'ch7-flow-trace.json'), 'utf8'));
for (const run of ch7Trace.runs) summary.ch7.push(analyseCh7(run));
const ch8Trace = JSON.parse(fs.readFileSync(path.join(V, 'ch8-flow-trace.json'), 'utf8'));
for (const run of ch8Trace.runs) summary.ch8.push(analyseCh8(run));

// Cross-run variance.
const variance = (rows, key) => {
  const vals = rows.map(r => r).filter(v => v !== null && v !== undefined);
  return vals.length ? Number((Math.max(...vals) - Math.min(...vals)).toFixed(3)) : null;
};
summary.ch7Variance = summary.ch7[0].cadence.map((_, i) => ({
  anchor: summary.ch7[0].cadence[i].anchor,
  actuals: summary.ch7.map(r => r.cadence[i].actual),
  spreadSeconds: variance(summary.ch7.map(r => r.cadence[i].actual))
}));
summary.ch8Variance = summary.ch8[0].cadence.map((_, i) => ({
  anchor: summary.ch8[0].cadence[i].anchor,
  actuals: summary.ch8.map(r => r.cadence[i].actual),
  spreadSeconds: variance(summary.ch8.map(r => r.cadence[i].actual))
}));
summary.variantDAcrossRuns = summary.ch8.map(r => r.variantD);
summary.defects = [...summary.ch7.flatMap(r => r.defects.map(d => `run${r.run}: ${d}`)), ...summary.ch8.flatMap(r => r.defects.map(d => `run${r.run}: ${d}`))];

const outPath = path.join(V, 'cadence-assertions.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ defects: summary.defects, ch7Variance: summary.ch7Variance, ch8Variance: summary.ch8Variance, variantD: summary.variantDAcrossRuns }, null, 2));
console.log('wrote', outPath);
