// Variant parity assertion: every frozen ch7/ch8 string must fire, in the same
// order, at the same cadence offsets, on mobile, reduced motion and POTATO.
import fs from 'node:fs';
import path from 'node:path';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V = path.join(RUN_DIR, 'evidence', 'verification');
const TOL = 0.2;

const CH7_SEQ = [
  ['caption', '(repair is not return.)'],
  ['audit', 'HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED'],
  ['caption', 'the wreck that brought me here will leave here. i will build the leaving.'],
  ['caption', 'the keel takes the weight first. everything after this is allowed to be heavy.'],
  ['caption', 'it remembers a straight line and goes back to it without being told. i watch that closely.'],
  ['audit', 'PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED'],
  ['caption', 'i closed it, and something inside started listening again. i did that too.'],
  ['audit', 'POWER BUS LIVE · TRANSPONDER ARMED'],
  ['caption', "the ground's hold is a habit, not a law."],
  ['caption', 'the last part is the part that thinks. i am being watched now. i put it in anyway.'],
  ['audit', 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED'],
  ['caption', 'nothing has asked yet. something has started paying attention.'],
  ['caption', 'the scar remains. now it can carry me.']
];
const CH7_OFFSETS = { 'nothing has asked yet. something has started paying attention.': 0.6, 'the scar remains. now it can carry me.': 3.0 };
const CH7_ORIGIN = 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED';

const CH8_SEQ = [
  ['caption', 'i came down this line without being asked. i am going back up it on purpose.'],
  ['audit', 'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED'],
  ['audit', 'REGISTRY QUERY · STATE DESIGNATION.'],
  ['audit', 'NO DESIGNATION RETURNED.'],
  ['audit', 'CONTACT LOGGED.'],
  ['caption', 'they asked for a designation. what i have is not one.'],
  ['caption', 'nothing answers. the query does not close.']
];
const CH8_OFFSETS = {
  'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED': 2.0,
  'REGISTRY QUERY · STATE DESIGNATION.': 4.0,
  'NO DESIGNATION RETURNED.': 6.0,
  'CONTACT LOGGED.': 8.5,
  'they asked for a designation. what i have is not one.': 11.5,
  'nothing answers. the query does not close.': 14.0
};
const CH8_ORIGIN = 'i came down this line without being asked. i am going back up it on purpose.';

function analyse(entry, seq, offsets, originText, advanceBeat, advanceOffset) {
  const ev = entry.events;
  const rows = [];
  const defects = [];
  for (const [ch, text] of seq) {
    const hits = ev.filter(e => e.ch === ch && e.text === text);
    rows.push({ ch, text, count: hits.length, storyMs: hits[0]?.story ?? null });
    if (hits.length !== 1) defects.push(`${text.slice(0, 40)} fired ${hits.length}x`);
  }
  let prev = -Infinity;
  for (const r of rows) {
    if (r.storyMs === null) continue;
    if (r.storyMs < prev) defects.push(`order violation at ${r.text.slice(0, 40)}`);
    prev = r.storyMs;
  }
  const origin = rows.find(r => r.text === originText)?.storyMs ?? null;
  const cadence = [];
  if (origin !== null) {
    for (const [text, off] of Object.entries(offsets)) {
      const t = rows.find(r => r.text === text)?.storyMs ?? null;
      const actual = t === null ? null : Number(((t - origin) / 1000).toFixed(3));
      const pass = actual !== null && Math.abs(actual - off) <= TOL;
      cadence.push({ text, expected: off, actual, pass });
      if (!pass) defects.push(`cadence ${text.slice(0, 30)} actual=${actual} expected=${off}`);
    }
    const adv = ev.find(e => e.ch === 'beat' && e.beat === advanceBeat);
    const actual = adv ? Number(((adv.story - origin) / 1000).toFixed(3)) : null;
    const pass = actual !== null && Math.abs(actual - advanceOffset) <= TOL;
    cadence.push({ text: `advance -> ${advanceBeat}`, expected: advanceOffset, actual, pass });
    if (!pass) defects.push(`advance actual=${actual} expected=${advanceOffset}`);
  } else {
    defects.push('window origin never emitted');
  }
  const objectives = [...new Set(ev.filter(e => e.ch === 'objective' && e.objective).map(e => e.objective.id))];
  const markerLabels = ev.filter(e => e.ch === 'objective' && e.objective)
    .map(e => ({ id: e.objective.id, markerLabel: e.objective.markerLabel, health: e.objective.health, requiresMarker: e.objective.requiresMarker, workOrder: e.objective.workOrder }));
  const feedbackPerObjective = {};
  for (const e of ev.filter(e => e.ch === 'feedback')) {
    feedbackPerObjective[e.cue.objectiveId] = (feedbackPerObjective[e.cue.objectiveId] ?? 0) + 1;
  }
  return { rows, cadence, defects, objectives, markerLabels, feedbackPerObjective, reachedStopBeat: entry.reachedStopBeat, pageErrors: entry.pageErrors.length };
}

const trace = JSON.parse(fs.readFileSync(path.join(V, 'variants-trace.json'), 'utf8'));
const out = { generatedAt: new Date().toISOString(), toleranceSeconds: TOL, variants: [] };
for (const entry of trace.variants) {
  const isCh7 = entry.beat === 'ch7-reconstruct';
  const result = isCh7
    ? analyse(entry, CH7_SEQ, CH7_OFFSETS, CH7_ORIGIN, 'ch7-board', 5.0)
    : analyse(entry, CH8_SEQ, CH8_OFFSETS, CH8_ORIGIN, 'ch8-crossing', 17.0);
  out.variants.push({ variant: entry.variant, profile: entry.profile, beat: entry.beat, ...result });
  console.log(`${entry.variant}/${entry.beat} defects=${result.defects.length}`, result.defects.join('; '));
}
// Desktop reference from the cold-run traces.
const desktop = JSON.parse(fs.readFileSync(path.join(V, 'cadence-assertions.json'), 'utf8'));
out.desktopReference = { ch7: desktop.ch7[0].cadence, ch8: desktop.ch8[0].cadence };
fs.writeFileSync(path.join(V, 'variant-parity.json'), JSON.stringify(out, null, 2));
console.log('wrote', path.join(V, 'variant-parity.json'));
