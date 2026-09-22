#!/usr/bin/env node
// Mechanical producer assembly helper.
// Reads the stale scene-contract.assembly.json template plus the accepted lane
// data and writes scene-contract.final-candidate.json. Mutates nothing else.
// Root-owned lock/brief/notes/gate artifacts are never written by this file.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RUN = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(RUN, p), 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(join(RUN, p))).digest('hex');

const c = read('scene-contract.assembly.json');
const cinema = read('scene-cinema-lane.json');
const score = read('scene-score-lane.json');

const QUAL = cinema.qualifiedGeometry;
const STAGED_SHA = QUAL.sha256;
const HEAD_SHA = QUAL.headSha256;

/* ------------------------------------------------------------------ *
 * 1. Exact atomic semantic rename map (anchor + event references)
 * ------------------------------------------------------------------ */
const RENAME = {
  'route-offered': 'demonstration-opened', // initial F beside the worker
  'span-offered': 'route-offered',         // the actual offered span
  'witness-required': 'specific-hold',
  'tail-redrawn': 'route-revised',
  'witness-resumed': 'test-resumed',
  'his-test-arrival': 'complete',
  'open-ground': 'handback',
};
const REMOVED = new Set(['station-departed', 'tidegarden-returned']);

const renameString = (s) => {
  if (typeof s !== 'string') return s;
  return s.replace(/\b(anc|ev)\.cg\.([a-z0-9-]+)/g, (m, ns, tail) =>
    Object.prototype.hasOwnProperty.call(RENAME, tail) ? `${ns}.cg.${RENAME[tail]}` : m,
  );
};
const renameDeep = (node) => {
  if (typeof node === 'string') return renameString(node);
  if (Array.isArray(node)) return node.map(renameDeep);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = renameDeep(v);
    return out;
  }
  return node;
};

const draft = renameDeep(c);
// The agency window derives its id from the handback anchor; keep ids consistent.
const renameWindow = (s) =>
  typeof s === 'string' ? s.replace(/\baw\.cg\.open-ground\b/g, 'aw.cg.handback') : s;
const renameWindowDeep = (n) => {
  if (typeof n === 'string') return renameWindow(n);
  if (Array.isArray(n)) return n.map(renameWindowDeep);
  if (n && typeof n === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(n)) o[k] = renameWindowDeep(v);
    return o;
  }
  return n;
};
const d = renameWindowDeep(draft);

/* ------------------------------------------------------------------ *
 * 2. Scope: exactly four formal beats; prior pairs are continuity only
 * ------------------------------------------------------------------ */
d.status = 'draft';
d.production.mutationBoundary = 'planning-only';
d.production.canonicalPreviewUrl = null;
d.production.frozenAt = null;
d.production.authorityRefs = [
  ...d.production.authorityRefs.filter((r) => !r.startsWith('../../story-runs/2026-09-06-common-ground/scene-contract-assembly-notes.md')),
  `scene-score-lane.json#sha256=${sha('scene-score-lane.json')}`,
  `scene-cinema-lane.json#sha256=${sha('scene-cinema-lane.json')}`,
  `story-intent.md#sha256=${sha('story-intent.md')}`,
  `decision-brief.json#sha256=${sha('decision-brief.json')}`,
  `cinematography-treatment.md#sha256=${sha('cinematography-treatment.md')}`,
  `score-treatment.md#sha256=${sha('score-treatment.md')}`,
  `../../story-runs/2026-09-06-common-ground/staged-geometry-qualification.json#sha256=${STAGED_SHA}`,
  `../../story-runs/2026-09-06-common-ground/head-geometry-qualification.json#sha256=${HEAD_SHA}`,
  '../../production-runs/2026-08-11-ch10-station-introduction/station-continuation-contract.md',
];

d.scope.title =
  'Common Ground: the ch13 return to Origin and the reciprocal survey proof, entered at the actual restored Tidegarden core under the prior station-continuation contract.';
d.scope.beats = ['ch13-home', 'ch13-return', 'ch13-survey', 'ch13-common'];
d.scope.shippedReferenceRefs = [
  'shipped-reference-map.md#shipped reference',
  'shipped-ux-baseline.json#markerAndWorkOrderMap',
  'shipped-visual-baseline.json#captures',
  'main/src/story/stationReturnStory.ts#STATION_RETURN_MILESTONES',
  'main/src/story/world/TidegardenSettlementWorld.tsx#bonded cell install resolver',
  'main/src/story/ux/objectiveDirector.ts#objective and marker lifecycle',
  '../../production-runs/2026-08-11-ch10-station-introduction/station-continuation-contract.md#station:return:tidegarden and hearth:return:install-cell',
  'scene-cinema-lane.json#/priorContractContinuity/objectiveBindings',
];
d.scope.priorEvidenceRefs = [
  ...d.scope.priorEvidenceRefs,
  '../../story-runs/2026-09-06-common-ground/staged-geometry-qualification.json',
  '../../story-runs/2026-09-06-common-ground/head-geometry-qualification.json',
];
d.scope.nonGoals = [
  ...d.scope.nonGoals,
  'No re-registration of station:return:tidegarden or hearth:return:install-cell as ch13 guidance or as a ch13 beat; both stay shipped UX baseline and prior-contract continuity evidence.',
  'No synthetic restored-hearth StoryBeat is invented for the ch12 installation: the live hearth acknowledgement belongs to ch13-home, and the install transaction is never delayed or replayed to produce one.',
];

/* ------------------------------------------------------------------ *
 * 3. Story: events, anchors, agency windows
 * ------------------------------------------------------------------ */
d.story.nonNegotiableCanon = d.story.nonNegotiableCanon.map((s) =>
  s.startsWith('The formal runtime ceiling and the ch4-arrival public release boundary')
    ? 'The public demo release surface remains ch4-arrival and no publication or redeployment is authorized here; separately, the formal runtime chapter ceiling is authorized to advance to ch13-common once these four beats are registered under this signed contract and the registry gate, so the release boundary and the runtime ceiling are distinct and must not be conflated.'
    : s,
);

const events = d.story.events.filter((e) => !REMOVED.has(e.id.replace('ev.cg.', '')));
const byEvent = new Map(events.map((e) => [e.id, e]));

// cell-installed is a ch13-home boundary event, not a separate formal beat.
const cell = byEvent.get('ev.cg.cell-installed');
cell.beat = 'ch13-home';
cell.event =
  'CG-B0 boundary: the actual live install receipt from the prior station-continuation contract consumes one sealed cell, reactivates ch13-home at the real core, and may fire the one authored live hearth acknowledgement there.';
cell.playerAction =
  'Complete the actual shipped station departure, flight, landing and hearth install; the F install action and its guidance stay owned by the prior contract.';
cell.acceptanceCriterion =
  'Exactly one cell is consumed by the shipped transaction with no delay and no replay; a fresh receipt reactivates ch13-home and emits at most one live acknowledgement there when a score host is available; a hydrated entry is steady and silent and consumes no second cell.';

// CG-06 is now its own anchor; CG-07 completion is the arrival commit only.
const complete = byEvent.get('ev.cg.complete');
complete.event =
  'CG-07: W-7744 actually arrives at the far end of his independent full E to C test and the reciprocal proof commits exactly once.';

const template = (id) => JSON.parse(JSON.stringify(byEvent.get(id)));

const evSurveyStarted = {
  ...template('ev.cg.trace-drawn'),
  id: 'ev.cg.survey-started',
  anchorRef: 'anc.cg.survey-started',
  event:
    'Actual grounded F at the survey start S begins the quiet trace and records the first sample; nothing was recorded beside the inspecting actor.',
  playerAction: 'Walk to the survey start S and press F to begin recording your route.',
  informationRevealed: 'Recording begins where she chooses to begin walking, not where she stands to speak.',
  acceptanceCriterion:
    'The one-time ch13:survey:start marker targets S only, never E and never the inspection actor; no sample exists before this actual grounded F; the start objective is then replaced by the single quiet draw objective targeting E.',
};

const evReciprocalReference = {
  ...template('ev.cg.reciprocal-crossed'),
  id: 'ev.cg.reciprocal-reference',
  anchorRef: 'anc.cg.reciprocal-reference',
  event:
    'W-7744 physically walks the uncredited two-unit E to H leg and actually reaches and maintains the held reference at H (-40, 51.05, 12) before Terra starts her comparison.',
  playerAction: 'Clear E and let him take the reference position; no player task and no proof credit exist in this leg.',
  informationRevealed: 'The reference has to be somebody standing somewhere before it can support anything.',
  acceptanceCriterion:
    'The reciprocal work order publishes its holding claim only after his actual arrival at H; before that it reports preparation or readiness; the positioning leg earns no comparison or test credit and changes no score state.',
};

const evIndependentTest = {
  ...template('ev.cg.complete'),
  id: 'ev.cg.independent-test',
  anchorRef: 'anc.cg.independent-test',
  event:
    'CG-06: after the actual uncredited two-unit H to E return and a valid far Terra reference at T (-44, 51.05, 12), W-7744 begins his independent full 18-unit E to C test.',
  playerAction: 'Remain at the far reference T, clear of the tested span; looking around is free.',
  informationRevealed: 'His initiation is his own; her offer supplied conditions, not a command.',
  acceptanceCriterion:
    'This anchor begins only when the full E to C traversal actually starts, never at the F offer and never during the H to E positioning leg; the positioning leg is not part of his tested path.',
};

const orderedEventIds = [
  'ev.cg.cell-installed',
  'ev.cg.home-steady',
  'ev.cg.fault-reviewed',
  'ev.cg.return-chosen',
  'ev.cg.hatch-boarded',
  'ev.cg.lift-committed',
  'ev.cg.origin-landed',
  'ev.cg.repeated-measure',
  'ev.cg.demonstration-opened',
  'ev.cg.survey-started',
  'ev.cg.trace-drawn',
  'ev.cg.route-offered',
  'ev.cg.specific-hold',
  'ev.cg.witness-held',
  'ev.cg.witness-vacated',
  'ev.cg.test-resumed',
  'ev.cg.tail-reopened',
  'ev.cg.route-revised',
  'ev.cg.route-tested',
  'ev.cg.reciprocal-reference',
  'ev.cg.reciprocal-crossed',
  'ev.cg.final-reference-offered',
  'ev.cg.reference-vacated',
  'ev.cg.reference-resumed',
  'ev.cg.independent-test',
  'ev.cg.complete',
  'ev.cg.handback',
];
byEvent.set('ev.cg.survey-started', evSurveyStarted);
byEvent.set('ev.cg.reciprocal-reference', evReciprocalReference);
byEvent.set('ev.cg.independent-test', evIndependentTest);
d.story.events = orderedEventIds.map((id) => {
  const e = byEvent.get(id);
  if (!e) throw new Error(`missing event ${id}`);
  return e;
});

d.story.agencyWindows = d.story.agencyWindows
  .filter((w) => w.id !== 'aw.cg.station-return')
  .map((w) => {
    if (w.id === 'aw.cg.common-reciprocal') w.startAnchorRef = 'anc.cg.route-tested';
    return w;
  });

/* ------------------------------------------------------------------ *
 * 4. Sync anchors: shot + cue relations for every anchor
 * ------------------------------------------------------------------ */
const ANCHOR_PLAN = [
  ['anc.cg.cell-installed', 'ch13-home', 'runtime-event', ['shot.cg.home'],
    [['sc.cg.hearth-held', 'at', 'One live CG-B0 restored-home acknowledgement at the actual install boundary, only when a home score host is available.']]],
  ['anc.cg.home-steady', 'ch13-home', 'story-event', ['shot.cg.home'],
    [['sc.cg.hearth-held', 'through', 'Retained: a hydrated entry restores the steady restored-home variant silently, with no completion transient and no queued acknowledgement.']]],
  ['anc.cg.fault-reviewed', 'ch13-home', 'player-action', ['shot.cg.home', 'shot.cg.choose'],
    [['sc.cg.hearth-held', 'through', 'Unchanged: the archived fault does not change the music and there is no listen gate before the invitation.']]],
  ['anc.cg.return-chosen', 'ch13-home', 'player-action', ['shot.cg.choose', 'shot.cg.return'],
    [['sc.cg.hearth-held', 'until', 'The home quotation is released here; nothing new is introduced at the release.']]],
  ['anc.cg.hatch-boarded', 'ch13-return', 'player-action', ['shot.cg.return'],
    [['sc.cg.hearth-held', 'after', 'Retained no-op: the story score is already released to the existing world conductor, so travel carries no chapter cue.']]],
  ['anc.cg.lift-committed', 'ch13-return', 'player-action', ['shot.cg.return'],
    [['sc.cg.hearth-held', 'after', 'Retained no-op: the shipped flight material only; the held-input launch publishes no new attack.']]],
  ['anc.cg.origin-landed', 'ch13-return', 'player-action', ['shot.cg.return'],
    [['sc.cg.hearth-held', 'after', 'Retained no-op: arrival at Origin is carried by the existing world bed, with no arrival flourish.']]],
  ['anc.cg.repeated-measure', 'ch13-survey', 'story-event', ['shot.cg.return'],
    [['sc.cg.unreconciled', 'at', 'The unreconciled variant enters only at the actual mounted and performed reinspection, never on camera visibility, home archive or remote approach.']]],
  ['anc.cg.demonstration-opened', 'ch13-survey', 'player-action', ['shot.cg.return', 'shot.cg.draw'],
    [['sc.cg.unreconciled', 'through', 'Unchanged: opening the survey beside the actor is not scored and records nothing.']]],
  ['anc.cg.survey-started', 'ch13-survey', 'player-action', ['shot.cg.draw'],
    [['sc.cg.unreconciled', 'through', 'Unchanged: the trace starts quietly; no acquisition chime, per-sample reward or proximity ramp exists.']]],
  ['anc.cg.trace-drawn', 'ch13-survey', 'player-action', ['shot.cg.draw'],
    [['sc.cg.unreconciled', 'through', 'Unchanged: continuous walking keeps one texture with no phrase restart at any sample or turn.']]],
  ['anc.cg.route-offered', 'ch13-survey', 'player-action', ['shot.cg.draw'],
    [['sc.cg.demonstrating', 'at', 'CG-03: the restrained demonstrating variant enters on the real offered span; duplicate same-variant publication is suppressed.']]],
  ['anc.cg.specific-hold', 'ch13-survey', 'runtime-event', ['shot.cg.hold'],
    [['sc.cg.refused', 'at', 'CG-04: the quiet refusal enters exactly once on the first actual unsupported offered span, carrying the literal physical reason; repeated invalid input never restarts it.']]],
  ['anc.cg.witness-held', 'ch13-survey', 'player-action', ['shot.cg.witness'],
    [['sc.cg.refused', 'through', 'Retained: occupying the offered intermediate reference is not itself scored and starts no new mood.']]],
  ['anc.cg.witness-vacated', 'ch13-survey', 'runtime-event', ['shot.cg.witness'],
    [['sc.cg.refused', 'through', 'Retained: an established-reference vacancy is a temporary suspension that keeps the current texture with no mood restart.']]],
  ['anc.cg.test-resumed', 'ch13-survey', 'player-action', ['shot.cg.witness'],
    [['sc.cg.refused', 'until', 'The refusal state ends on actual revalidated resumption; the texture does not restart and no resume cue is added.']]],
  ['anc.cg.tail-reopened', 'ch13-survey', 'runtime-event', ['shot.cg.hold'],
    [['sc.cg.refused', 'through', 'Retained: reopening the untested tail repeats no refusal; the repeated reference loss retains the existing texture.']]],
  ['anc.cg.route-revised', 'ch13-survey', 'player-action', ['shot.cg.hold'],
    [['sc.cg.revised', 'at', 'The revised variant enters on the real changed-tail or new-offer state; no sample or valid coordinate is rewarded.']]],
  ['anc.cg.route-tested', 'ch13-survey', 'story-event', ['shot.cg.witness'],
    [['sc.cg.demonstrating', 'through', 'Retained on a first-try route: a completed test is not ranked or rewarded.'],
     ['sc.cg.revised', 'through', 'Retained on a revised route: both route classes end in the same unranked texture.']]],
  ['anc.cg.reciprocal-reference', 'ch13-common', 'story-event', ['shot.cg.other-end'],
    [['sc.cg.demonstrating', 'through', 'Retained: the uncredited E to H positioning leg adds no cue and no phrase restart.']]],
  ['anc.cg.reciprocal-crossed', 'ch13-common', 'player-action', ['shot.cg.other-end'],
    [['sc.cg.demonstrating', 'at', 'CG-05: the reciprocal crossing retains restrained demonstration; her comparison is not celebrated.']]],
  ['anc.cg.final-reference-offered', 'ch13-common', 'player-action', ['shot.cg.his-test'],
    [['sc.cg.demonstrating', 'through', 'Unchanged: offering the far end is not scored, because the offer supplies conditions rather than a result.']]],
  ['anc.cg.reference-vacated', 'ch13-common', 'runtime-event', ['shot.cg.his-test'],
    [['sc.cg.demonstrating', 'through', 'Retained: repeated reference loss holds the texture, with no restart and no failure sting.']]],
  ['anc.cg.reference-resumed', 'ch13-common', 'player-action', ['shot.cg.his-test'],
    [['sc.cg.demonstrating', 'through', 'Retained: revalidated reentry resumes without a second cue.']]],
  ['anc.cg.independent-test', 'ch13-common', 'story-event', ['shot.cg.his-test'],
    [['sc.cg.demonstrating', 'at', 'CG-06: initiation of his full independent test retains restrained demonstration; the uncredited H to E leg carries nothing.']]],
  ['anc.cg.complete', 'ch13-common', 'story-event', ['shot.cg.complete'],
    [['sc.cg.independent-settled', 'at', 'CG-07: only the actual live first completion changes spacing, for at most five live seconds, then the existing 4.5 second release; it never hydrates, repeats or defers.']]],
  ['anc.cg.handback', 'ch13-common', 'runtime-event', ['shot.cg.complete'],
    [['sc.cg.independent-settled', 'until', 'CG-08: handback is immediate and independent of the release tail; the tail never owns camera, controls or progression, and every declared cancellation releases it at once.']]],
];

const anchorById = new Map(d.syncAnchors.map((a) => [a.id, a]));
const anchorTemplate = JSON.parse(JSON.stringify(d.syncAnchors[10]));
const makeAnchor = (id, ev, evt, acc) => ({
  ...JSON.parse(JSON.stringify(anchorTemplate)),
  id,
  event: evt,
  story: { eventRef: ev, relation: 'at', offsetMs: 0 },
  acceptanceCriterion: acc,
});
for (const e of [evSurveyStarted, evReciprocalReference, evIndependentTest]) {
  anchorById.set(e.anchorRef, makeAnchor(e.anchorRef, e.id, e.event, e.acceptanceCriterion));
}
// Keep the boundary anchor prose aligned with the ch13-home ownership rule.
anchorById.get('anc.cg.cell-installed').event = cell.event;
anchorById.get('anc.cg.cell-installed').acceptanceCriterion = cell.acceptanceCriterion;
anchorById.get('anc.cg.complete').event = complete.event;

const VISUAL_INTENT = {
  'shot.cg.home': 'The working core, the archived fault and the player on foot stay legible in the embodied view.',
  'shot.cg.choose': 'The stored fault at the actual core and the available ship approach after the explicit choice.',
  'shot.cg.return': 'Real boarding, lift, crossing and landing, then the actual reinspection at W outside the start and body corridor.',
  'shot.cg.draw': 'Feet, the walked trace and the socket to backing relation, with the survey destination and the fixed apparatus behind it.',
  'shot.cg.hold': 'The supported stopped body, the precise trace end and the actual housing, range or footing cause.',
  'shot.cg.witness': 'The worker using an actually occupied offered reference, with the literal backing and the short span.',
  'shot.cg.other-end': 'The worker maintaining H while E stays clear for her full 18-unit common passage.',
  'shot.cg.his-test': 'The physical H to E return, then the independent grounded full E to C traversal read from her separate far reference.',
  'shot.cg.complete': 'Actual grounded arrival, the persistent tested route, separate accounts and ordinary world.',
};

d.syncAnchors = ANCHOR_PLAN.map(([id, beat, source, shots, cues], i) => {
  const a = anchorById.get(id);
  if (!a) throw new Error(`missing anchor ${id}`);
  a.beat = beat;
  a.order = i;
  a.source = source;
  a.cinematography = shots.map((s) => ({
    shotRef: s,
    relation: 'at',
    offsetMs: 0,
    visualIntent: VISUAL_INTENT[s],
  }));
  a.score = cues.map(([cueRef, relation, musicalIntent]) => ({
    cueRef,
    relation,
    offsetMs: 0,
    musicalIntent,
  }));
  return a;
});

/* ------------------------------------------------------------------ *
 * 5. Guidance: 17 new ch13 objective pairs, exact copy from the intent
 * ------------------------------------------------------------------ */
const objTemplate = d.guidance.objectives.find((o) => o.id === 'ch13:survey:draw');
const VARIANTS = objTemplate.variantRefs;
const RESET_TRIGGERS = objTemplate.resetTriggers;
const mkObj = (o) => ({
  id: o.id,
  agencyWindowRef: o.aw,
  kind: o.kind,
  enterAnchorRef: o.enter,
  clearAnchorRef: o.clear,
  markerLabel: o.marker,
  requiresMarker: o.requiresMarker !== false,
  workOrder: o.workOrder,
  feedback: {
    eventType: 'objective-enter',
    presentationOnly: true,
    advancesProgression: false,
    emissionsPerEntry: 1,
    intent: o.feedback,
  },
  variantRefs: VARIANTS,
  variantIntent: objTemplate.variantIntent,
  resetRef: 'reset-guidance',
  resetTriggers: RESET_TRIGGERS,
  resetIntent: objTemplate.resetIntent,
  acceptanceCriterion: o.acceptance,
  targetMode: o.targetMode || 'directional-marker',
  ...(o.targetContract ? { targetContract: o.targetContract } : {}),
});

const OBJECTIVES = [
  {
    id: 'ch13:home:review', aw: 'aw.cg.home-invitation', kind: 'interact',
    enter: 'anc.cg.home-steady', clear: 'anc.cg.fault-reviewed',
    marker: 'Second hearth · unfinished audit',
    workOrder: ['Return to the working hearth.', '[F] Review the stored audit fault.'],
    feedback: 'One semantic acknowledgement that the audit is still on the record; a hydrated entry is silent.',
    acceptance: 'The exact label and standing work order publish at the actual restored core; the fresh install acknowledgement, if any, retires before this objective; a restored save reaches it without replaying the transaction.',
  },
  {
    id: 'ch13:home:choose-return', aw: 'aw.cg.home-invitation', kind: 'interact',
    enter: 'anc.cg.fault-reviewed', clear: 'anc.cg.return-chosen',
    marker: 'Second hearth · choose the return',
    workOrder: ['[F] Choose to revisit the Origin audit site. You can leave this open.'],
    feedback: 'One acknowledgement that the invitation is standing and may remain pending indefinitely.',
    acceptance: 'The invitation can stay open with no night wait, autoaccept or teleport; only an explicit F commits, and hatch or course guidance publishes only after that commit.',
  },
  {
    id: 'ch13:return:board', aw: 'aw.cg.return-transit', kind: 'interact',
    enter: 'anc.cg.return-chosen', clear: 'anc.cg.hatch-boarded',
    marker: 'Kestrel hatch · board',
    workOrder: ['Follow the hatch marker.', '[F] Board the Kestrel.'],
    feedback: 'One acknowledgement that the hatch substep is standing.',
    acceptance: 'The marker resolves the actual hatch handle and the objective clears on the actual boarded state.',
  },
  {
    id: 'ch13:return:launch', aw: 'aw.cg.return-transit', kind: 'interact',
    enter: 'anc.cg.hatch-boarded', clear: 'anc.cg.lift-committed',
    marker: 'Kestrel controls · lift',
    requiresMarker: false,
    workOrder: ['Hold [Space] to ignite and lift.'],
    feedback: 'One existing flight-control acknowledgement; no new attack.',
    targetMode: 'none',
    acceptance: 'This is a control-only interact on the boarded ship, never a wait: it declares no world target, publishes zero visible targets, keeps the exact held-input line and Kestrel controls label, and clears on the actual ignition and lift into flight. The bracket token is the held [Space] control and must not be reclassified to satisfy a narrower gate vocabulary.',
    targetContract: {
      ownerRef: 'main/src/story/beats/ch13/ch13-return.ts (proposed): the chapter-local return beat owns this control-only substep on the existing boarded Kestrel controls.',
      selectionRef: 'No world target is selected; the objective addresses the Kestrel control surface the player already occupies after actual boarding.',
      readinessCriterion: 'Published only while the actual boarded state and control ownership are true.',
      completionCriterion: 'Clears on the actual ignition and lift into flight, never on elapsed time or a rail nudge.',
      maxVisibleTargets: 0,
      evidenceFields: ['objectiveId', 'entryIndex', 'state', 'boardedState', 'controlOwnership', 'visibleTargetCount', 'presentedFrameId', 'sourceRevision', 'contractSha256', 'evidenceRefs'],
    },
  },
  {
    id: 'ch13:return:origin', aw: 'aw.cg.return-transit', kind: 'travel',
    enter: 'anc.cg.lift-committed', clear: 'anc.cg.origin-landed',
    marker: 'Origin · audit site',
    workOrder: ['Fly to Origin.', 'Follow the audit-site approach and land.'],
    feedback: 'One acknowledgement that the Origin course is standing.',
    acceptance: 'The standing work order keeps a concrete destination and an actionable flight verb at every state, and the objective clears on the actual world and grounded flight facts, never on elapsed time.',
  },
  {
    id: 'ch13:survey:offer', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.repeated-measure', clear: 'anc.cg.demonstration-opened',
    marker: 'W-7744 · offer a route',
    workOrder: ['Approach W-7744.', '[F] Offer to demonstrate a route.'],
    feedback: 'One acknowledgement that the offer is available at actual physical reach.',
    acceptance: 'The initial F beside the inspecting actor only opens the actor-scoped and world-scoped survey into an awaiting-start state; no sample is recorded beside the actor, and the single ch13:survey:start marker publishes next.',
  },
  {
    id: 'ch13:survey:start', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.demonstration-opened', clear: 'anc.cg.survey-started',
    marker: 'Survey start · begin a route',
    workOrder: ['Walk to the survey start.', '[F] Begin recording your route.'],
    feedback: 'One acknowledgement that a start point exists and nothing is being recorded yet.',
    acceptance: 'Exactly one active marker targets S, never E and never the inspection actor; the actual grounded and reachable F at S starts the quiet trace and records the first sample; this objective then retires and is replaced by the quiet draw objective targeting E.',
  },
  {
    id: 'ch13:survey:draw', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.survey-started', clear: 'anc.cg.trace-drawn',
    marker: 'Survey end · demonstrate a route',
    workOrder: ['Walk your route to the survey end.', '[F] Offer the recorded span.'],
    feedback: 'One quiet acknowledgement that tracing has begun; no per-sample reward follows.',
    acceptance: 'One standing quiet work order survives continuous walking with no per-sample prompt or chime, the marker resolves to the survey destination, and the objective clears when a finite valid trace exists; capacity stops honestly without decimation.',
  },
  {
    id: 'ch13:survey:offer-span', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.trace-drawn', clear: 'anc.cg.route-offered',
    marker: 'Trace end · offer this span',
    workOrder: ['[F] Offer the walked span for W-7744 to test.'],
    feedback: 'One acknowledgement that the walked span can now be offered.',
    acceptance: 'The marker moves to the actual trace end only as this objective replaces draw, never behind an unchanged objective; the explicit valid offer starts his actual physical W to S approach, and that approach earns no proof and never grows the tested prefix.',
  },
  {
    id: 'ch13:survey:test', aw: 'aw.cg.survey-demonstration', kind: 'travel',
    enter: 'anc.cg.route-offered', clear: 'anc.cg.route-tested',
    marker: 'W-7744 · test in progress',
    workOrder: ['W-7744 is testing the offered route.', 'Follow his progress, or return to the last tested point to revise.'],
    feedback: 'One acknowledgement that his test is standing; his sampling is never chimed.',
    acceptance: 'Before his actual arrival at S the objective reports preparation or readiness rather than claiming testing; the standing work order always offers the concrete follow or revise action.',
  },
  {
    id: 'ch13:survey:revise', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.tail-reopened', clear: 'anc.cg.route-revised',
    marker: 'Last tested point · revise route',
    workOrder: ['Return to the last tested point.', '[F] Reopen the untested span and walk a new route.'],
    feedback: 'One acknowledgement carrying the actual literal refusal reason.',
    acceptance: 'Revision is unlimited and free, replaces only the unverified suffix, preserves the tested prefix, and publishes for unsafe footing because occupancy cannot repair ground.',
  },
  {
    id: 'ch13:survey:witness', aw: 'aw.cg.survey-demonstration', kind: 'interact',
    enter: 'anc.cg.specific-hold', clear: 'anc.cg.witness-held',
    marker: 'Witness point · hold this end',
    workOrder: ['Stand at the marked reference.', '[F] Offer this end, then remain here while W-7744 tests the span. Looking around is free.'],
    feedback: 'One acknowledgement that an occupied intermediate reference is required, with the literal physical reason.',
    acceptance: 'Validity uses same-world identity, grounding, explicit offer, socket-to-socket range 12, occupancy hysteresis, body clearance and a clear solid segment; camera direction, reticle, gaze duration and music phase are never inputs.',
  },
  {
    id: 'ch13:survey:witness-return', aw: 'aw.cg.survey-demonstration', kind: 'travel',
    enter: 'anc.cg.witness-vacated', clear: 'anc.cg.test-resumed',
    marker: 'Witness point · resume the test',
    workOrder: ['Return to the marked reference to resume the test.', 'To change the route, return to the last tested point.'],
    feedback: 'One acknowledgement of a temporary suspension; no failure text and no blame.',
    acceptance: 'Reentry to the inner cylinder revalidates geometry and resumes without a second F; earned proof is retained and the offer stays resumable.',
  },
  {
    id: 'ch13:common:reciprocal', aw: 'aw.cg.common-reciprocal', kind: 'travel',
    enter: 'anc.cg.reciprocal-reference', clear: 'anc.cg.reciprocal-crossed',
    marker: 'Far reference · check my route',
    workOrder: ['W-7744 is holding the reference.', 'Walk the traced span to check your route from this end.'],
    feedback: 'One acknowledgement, published only once he is actually holding H.',
    acceptance: 'The holding claim is never published before his actual arrival at H; the objective clears only on her full actual 18-unit E to C passage supported from H, never on retained footsteps, stored proof or elapsed time.',
  },
  {
    id: 'ch13:common:offer-final-reference', aw: 'aw.cg.common-reciprocal', kind: 'interact',
    enter: 'anc.cg.reciprocal-crossed', clear: 'anc.cg.final-reference-offered',
    marker: 'Far reference · offer this end',
    workOrder: ['Stand at the far reference, clear of the tested span.', '[F] Offer this end.'],
    feedback: 'One acknowledgement that she can supply the same kind of contribution she needed.',
    acceptance: 'The explicit valid F offer at the separate far reference T replaces the guidance and does not commit his test; his initiation remains his.',
  },
  {
    id: 'ch13:common:release', aw: 'aw.cg.common-reciprocal', kind: 'wait',
    enter: 'anc.cg.final-reference-offered', clear: 'anc.cg.complete',
    marker: 'Far reference · keep this end',
    workOrder: ['Remain at the far reference while W-7744 tests the span. Looking around is free.'],
    feedback: 'One acknowledgement that maintaining occupancy is the whole remaining contribution.',
    acceptance: 'The required act is genuinely remaining in place, so wait is the honest classification; the explicit T offer and current reference permit the uncredited H to E positioning leg, then his full E to C test, and completion commits once on actual arrival plus the earned reciprocal proof.',
  },
  {
    id: 'ch13:common:reference-return', aw: 'aw.cg.common-reciprocal', kind: 'travel',
    enter: 'anc.cg.reference-vacated', clear: 'anc.cg.reference-resumed',
    marker: 'Far reference · resume the test',
    workOrder: ['Return to the far reference, clear of the tested span, to resume the test. Looking around is free.'],
    feedback: 'One acknowledgement of the temporary suspension; retained proof alone cannot move him.',
    acceptance: 'Reentry and actual revalidation resume without another F; neither saved evidence nor elapsed time exempts his test from live range, sight, occupancy and clearance.',
  },
];
if (OBJECTIVES.length !== 17) throw new Error(`expected 17 objectives, got ${OBJECTIVES.length}`);
d.guidance.objectives = OBJECTIVES.map(mkObj);

/* ------------------------------------------------------------------ *
 * 6. Shots: the accepted nine-shot cinema ledger
 * ------------------------------------------------------------------ */
const shotTemplate = d.shots.find((s) => s.id === 'sh.cg.survey');
const SHOT_PLAN = [
  ['shot.cg.home', 'ch13-home', 'anc.cg.cell-installed', 'anc.cg.fault-reviewed', 'aw.cg.home-invitation',
    'The working restored core', 'The archived audit fault at that core',
    'The core and the stored fault.',
    'The core keeps working and the available approach stays open; nothing hurries the player.'],
  ['shot.cg.choose', 'ch13-home', 'anc.cg.fault-reviewed', 'anc.cg.return-chosen', 'aw.cg.home-invitation',
    'The stored local fault at the actual core', 'The ship approach after the explicit choice',
    'The stored fault and, after the choice, the hatch.',
    'The ship approach is visible only after the explicit choice; the invitation may stay open indefinitely.'],
  ['shot.cg.return', 'ch13-return', 'anc.cg.return-chosen', 'anc.cg.demonstration-opened', 'aw.cg.return-transit',
    'The actual boarding, lift, crossing and landing', 'The actual worker reinspection at W, outside the start and body corridor',
    'The hatch, then the controls, then the audit site and W-7744.',
    'Real travel and approach hand straight into the survey offer; no apparition and no arrival montage.'],
  ['shot.cg.draw', 'ch13-survey', 'anc.cg.demonstration-opened', 'anc.cg.route-offered', 'aw.cg.survey-demonstration',
    'The walked trace and the player’s actual feet', 'The survey destination and the fixed backed apparatus',
    'The trace end and the reference socket.',
    'The offered span and the fixed apparatus stay visible as his test opens; no per-sample prompt ever appears.'],
  ['shot.cg.hold', 'ch13-survey', 'anc.cg.specific-hold', 'anc.cg.route-revised', 'aw.cg.survey-demonstration',
    'The supported stopped body and the precise trace end', 'The actual housing, range or footing cause',
    'The last safe sample and the literal cause of the refusal.',
    'A first-try route omits this shot entirely; the repair follows the real cause and nothing is ranked.'],
  ['shot.cg.witness', 'ch13-survey', 'anc.cg.witness-held', 'anc.cg.route-tested', 'aw.cg.survey-demonstration',
    'The worker using an actually occupied offered reference', 'The literal backing and the short span',
    'The occupied reference socket and the sampled span.',
    'Actual occupancy and geometry resume the test; free look is irrelevant to the predicate.'],
  ['shot.cg.other-end', 'ch13-common', 'anc.cg.reciprocal-reference', 'anc.cg.reciprocal-crossed', 'aw.cg.common-reciprocal',
    'W-7744 maintaining the held reference at H', 'E left clear for her full 18-unit common passage',
    'His maintained reference and her walked common span.',
    'Her comparison commits only after the real supported passage; the original fixed reference is visibly insufficient.'],
  ['shot.cg.his-test', 'ch13-common', 'anc.cg.final-reference-offered', 'anc.cg.independent-test', 'aw.cg.common-reciprocal',
    'The physical H to E return, then his independent grounded full E to C traversal', 'Terra’s separate valid final reference at T',
    'His traversal and her separate held reference.',
    'The same finite reference rules apply to his test; her occupancy is the only remaining contribution.'],
  ['shot.cg.complete', 'ch13-common', 'anc.cg.complete', 'anc.cg.handback', 'aw.cg.handback',
    'His actual grounded arrival and the persistent tested route', 'Two separate accounts and an ordinary world',
    'The arrival point and the retained route.',
    'Mandatory guidance and transient ownership retire immediately; the local tester and the accepted route persist.'],
];

d.shots = SHOT_PLAN.map(([id, beat, start, end, aw, primary, secondary, focus, exit]) => {
  const s = JSON.parse(JSON.stringify(shotTemplate));
  s.id = id;
  s.beat = beat;
  s.startAnchorRef = start;
  s.endAnchorRef = end;
  s.focalHierarchy.primary = primary;
  s.focalHierarchy.secondary = secondary;
  s.framing.exitComposition = exit;
  s.lens.focusTarget = focus;
  s.lens.startFovDeg = 75;
  s.lens.endFovDeg = 75;
  s.lens.durationMs = 0;
  s.lens.easing = 'none: the field of view is constant at the shipped 75 degree on-foot value';
  s.effects.grade.intent = 'The existing planet grade is retained unchanged; no new grade, exposure, fog, shake, letterbox or reality effect is authored.';
  s.effects.lighting.intent = 'Existing world and day-cycle lighting only; zero new lights and zero new light cardinality transitions.';
  s.effects.postEffects = [];
  s.motion.mode = 'player-owned';
  s.motion.target = 'The player owns the camera for the whole scene; no forced camera exists.';
  s.agency.agencyWindowRefs = [aw];
  s.agency.handBackAnchorRef = end;
  s.resetRef = 'reset-camera';
  s.evidenceRefs = [`screenshot-report.md#${id}`, `scene-cinema-lane.json#/shotLedger (${id})`];
  return s;
});
d.cinematography.shotOrder = SHOT_PLAN.map((s) => s[0]);
d.cinematography.thesis =
  'From the accepted Cinematography lane: keep feet, the socket to housing relation, the trace break and both reference exchanges legible inside the existing free 75 degree embodied player view, with fixed lights, an unchanged grade and no forced camera, so the dependence between two bodies is read physically rather than announced.';
d.cinematography.currentCutRefs = cinema.evidence.personallyViewedFrames.map((f) => `${f.path}#sha256=${f.sha256}`);
d.cinematography.adjacentSceneRefs = [
  '../../production-runs/2026-08-11-ch10-station-introduction/scene-contract.json',
  '../../production-runs/2026-08-11-ch10-station-introduction/station-continuation-contract.md',
  'shipped-visual-baseline.json#cameraStates',
];

/* ------------------------------------------------------------------ *
 * 7. Score: six accepted mood/cue bindings
 * ------------------------------------------------------------------ */
const CUES = [
  ['sc.cg.hearth-held', 'restored-home', 'music', 'anc.cg.cell-installed',
    'Settled home and archive. One live restored-home acknowledgement at the actual install boundary when a home score host is available; a hydrated entry restores the steady variant silently.',
    'The home quotation is released at anc.cg.return-chosen; the archived fault does not change the music.',
    'Below the world bed; nothing in the home is required to understand the invitation.',
    'No listen gate exists before the invitation and no completion transient exists on restore.'],
  ['sc.cg.unreconciled', 'unreconciled', 'music', 'anc.cg.repeated-measure',
    'The audit square enters only at the actual mounted and performed reinspection, never on camera visibility, the home archive or a remote approach.',
    'Holds unchanged through the whole quiet trace: the survey opening, the S start and every sample carry no cue.',
    'Below the world bed and below the player’s own feet.',
    'Deliberate absence of reward while tracing: walking is not scored as progress.'],
  ['sc.cg.demonstrating', 'demonstrating', 'music', 'anc.cg.route-offered',
    'Restrained demonstration on a real offered span, on the reciprocal crossing and on the initiation of his final test; duplicate same-variant publication is suppressed.',
    'One continuous texture across CG-03, CG-05 and CG-06; the uncredited E to H and H to E positioning legs add no cue and no phrase restart.',
    'Below the world bed; the physical cause is always legible muted.',
    'No route ranking, proximity ramp, in-range attack or guaranteed attack exists.'],
  ['sc.cg.refused', 'refused-hold', 'music', 'anc.cg.specific-hold',
    'The quiet refusal enters exactly once, on the first actual unsupported offered span, carrying the literal physical reason.',
    'De-duplicated within a held test; the currently visible failure reason never schedules another cue.',
    'Below the world bed; the refusal is never a sting.',
    'Repeated reference loss and temporary occupancy suspension retain the current texture with no mood restart.'],
  ['sc.cg.revised', 'revised', 'music', 'anc.cg.route-revised',
    'Enters on the real changed-tail or new-offer state only.',
    'No sample, corner or valid coordinate is rewarded; both route classes end unranked.',
    'Below the world bed.',
    'A first-try success skips the unexperienced refused and revised states entirely.'],
  ['sc.cg.independent-settled', 'independent-action-settled', 'music', 'anc.cg.complete',
    'Only the actual live first completion, from his real arrival plus the earned reciprocal proof, changes spacing.',
    'Live only for at most five seconds measured on a monotonic clock from the live completion, then the existing 4.5 second release through the existing complementary authority fade; never restored, never repeated.',
    'The release tail never owns camera, controls or progression; handback at anc.cg.handback is immediate and independent of it.',
    'No separate coda, no hydration, no replay, no deferral until unlock and no intensity boost to force an attack; new story, optional survey action, actor change, world change, reset, exit, pause, visibility loss, music mute and unavailable audio each invalidate the live token and release immediately.'],
];
d.score.mood =
  'From the accepted Score lane: settled home and archive, the audit square only at the actual Origin reinspection, restrained demonstration through the reciprocal exchange, one quiet refusal, and changed spacing reserved for the actual live completion. Exactly six mood bindings exist and no separate mood is published per UX event.';
d.score.cues = CUES.map(([id, cueRef, type, anchorRef, phraseIntent, barIntent, mixIntent, silenceIntent]) => ({
  id,
  cueRef,
  type,
  anchorRef,
  relation: 'after',
  offsetMs: 0,
  phraseIntent,
  barIntent,
  mixIntent,
  silenceIntent,
  resetRef: 'reset-score',
  evidenceRefs: [`audio-report.md#${id}`, `scene-score-lane.json#/cueBindings (${id})`],
}));
d.score.mixIntent =
  'The world bed and the player’s own feet stay above every chapter cue; nothing in the score is required to understand a physical cause, and the offset is a mood target request rather than a guaranteed note onset.';
d.score.performancePlan =
  'No new audio graph, node, hit bundle or note scheduler is added; the chapter reuses the existing score authority through a proposed chapter-local adapter, publishes a mood once per semantic variant edge, and adds one bounded transient-state exception at the existing inactive-score cleanup. Voice count, node count and soak behaviour are expected to be unchanged from the shipped baseline and are to be measured after signed implementation; no measured result is claimed here.';
d.score.evidenceRefs = ['audio-report.md', `scene-score-lane.json#sha256=${sha('scene-score-lane.json')}`];

/* ------------------------------------------------------------------ *
 * 8. Performance: accepted DELTA budgets
 * ------------------------------------------------------------------ */
const pb = cinema.performanceBudget;
d.performance = {
  targetFps: pb.targetFps,
  minimumFps: pb.minimumFps,
  maximumFrameTimeMs: pb.maximumFrameTimeMs,
  maximumDrawCalls: pb.addedDrawCallsMax,
  maximumShaderPrograms: pb.addedShaderProgramsDuringSetupMax,
  maximumGpuMemoryMb: pb.addedGpuStorageMiBMax,
  deviceProfiles: d.performance.deviceProfiles,
  criticalAnchors: [
    'anc.cg.cell-installed',
    'anc.cg.return-chosen',
    'anc.cg.origin-landed',
    'anc.cg.demonstration-opened',
    'anc.cg.survey-started',
    'anc.cg.route-offered',
    'anc.cg.specific-hold',
    'anc.cg.route-revised',
    'anc.cg.route-tested',
    'anc.cg.reciprocal-crossed',
    'anc.cg.final-reference-offered',
    'anc.cg.independent-test',
    'anc.cg.complete',
    'anc.cg.handback',
  ],
  measurementPlan:
    'Budget semantics are DELTAS over the locked shipped source and runtime, not absolute scene counts and not measurements. The accepted Cinematography budget is at most +8 draw calls, +6 materials, +6 shader programs added during setup and +2 MiB (2097152 bytes) of added GPU storage, with at most 512 pooled trace glyph instances across exactly two route slots of at most 128 points each. Inside the +/-2 second critical window around every critical verb anchor and the handback, zero new shader programs are compiled and zero new resources are first used; setup work is prewarmed outside that window, light cardinality is fixed at zero new lights and zero new cardinality transitions, and there are no frame-loop allocations. The 60 fps target, 30 fps minimum and 33.4 ms frame time are advisory triage ceilings carried forward from the shipped runtime; the binding hardware requirement is cold high-tier and lowest-tier handback plus frames-per-second non-regression against the source-pinned baseline, with the existing critical-window hitch and resource gates retained. Draw, program and storage deltas and the frame-time distribution are recorded at setup, at each critical anchor, at handback and on a repeated visit, and bounded counters must hold without monotonic growth. No measured frame or resource budget pass is claimed by this contract: scene-cinema-lane.json records measuredFrameBudgetPass false and measuredResourceBudgetPass false.',
};

/* ------------------------------------------------------------------ *
 * 9. Evidence: qualified packet, renamed anchors, prior continuity
 * ------------------------------------------------------------------ */
const QUALIFIED = [
  `Bound from the final qualified packet staged-geometry-qualification.json, SHA-256 ${STAGED_SHA}, verdict PASS, with the literal connected-head check in head-geometry-qualification.json, SHA-256 ${HEAD_SHA}, also PASS: the selected finite socket-to-socket reference range is 12, the rigid apparatus is grounded at world R (-34, 51.05, 20) in world -1,-1 at yaw 90 degrees with the fixed socket 1.30 above the grounded pose.`,
  'Bound: the cap connects the stand to the fixed socket with zero gap and no geometry projects above the fixed socket plane. The reference contact rule is general and symmetric over every solid, backing, stand, bracket, cap and trunk: endpoint-only contact is harmless if and only if the adjacent open segment stays outside the solid, any interior crossing blocks, face-plane tangency blocks, and walking and body collision remain inclusive with no endpoint exception. Six contact tests pass; no exemption, invisible barrier, coordinate-only quota or worldgen change is authorized.',
  'Bound: the short survey route walks 16 units over 17 samples with a 14-unit contiguous unsupported span caused solely by the actual backing, and the long survey route walks 36 units over 61 samples with every sample and all 145 dense points supported, giving +20 extra units and 2.25 times the length against the required +12 and 1.25. The superseded 32-unit long route is retired.',
  'Bound: the common comparison E to C walks 18 units over 31 samples and 73 dense points, every one in range of and unobstructed from the reference W-7744 holds at H (-40, 51.05, 12), with a maximum distance of 10.01 inside range 12, a 1.99 range margin, two-unit player body clearance and 8.25 units outside the fixed reference. The six-unit endpoint shortcut is never used.',
  'Bound: his held reference H (-40, 51.05, 12) is a distinct pose from her comparison start E (-42, 51.05, 12). He physically walks the two-unit E to H leg before her comparison and the two-unit H to E leg after her explicit T offer; both legs are ordinary grounded movement, earn no comparison or test credit, are not part of his tested path and change no score state.',
  'Bound: her separate final reference is T (-44, 51.05, 12), four units laterally clear of C against the required two, with two-unit body clearance, a 7.23 maximum line-of-reference distance and a 4.77 range margin; his full independent 18-unit E to C test is witnessed from the T socket at +1.35 and remains subject to live range, sight, occupancy and clearance.',
  'Bound: the intermediate reference example is W (-34, 51.05, 10), fully supported, covering all 15 samples of the unsupported span at a 7.30 maximum line-of-reference distance with a 4.70 range margin, two-unit body clearance and a release cylinder that does not overlap the survey route; it is an example rather than an exclusive target, and the nominal z=11 intermediate is retired.',
  'This qualification is CPU geometry only. The finite reference range, the opaque backing, the stand, the bracket and the cap do not exist in the runtime; offer and occupancy hysteresis, hold and recovery timing and render tiers are not simulated; no live runtime, render, GPU, input or hardware acceptance is claimed.',
];
d.evidence.acceptanceCriteria = [
  ...QUALIFIED,
  'The new scene registers exactly four formal beats, ch13-home, ch13-return, ch13-survey and ch13-common, and exactly 17 ch13 objective identifiers; all four return alive on entry, resume, diagnostic entry and completed revisits.',
  'station:return:tidegarden and hearth:return:install-cell are neither re-registered as ch13 guidance nor turned into a ch13 beat; they stay shipped UX baseline and prior station-continuation-contract continuity evidence, and their actual station departure, undock, flight, Tidegarden landing and one-cell installation acceptance remains fully required as adjacent-continuity proof.',
  'The live hearth acknowledgement is owned by ch13-home: a fresh real install receipt reactivates ch13-home and fires at most one live CG-B0 acknowledgement at the boundary when a home score host is available; the transaction is never delayed and never replayed, and a hydrated entry is steady and silent.',
  'Three cold movie runs reach completion with zero timeout rescues; a rail timeout is reported as stuck and never as completion.',
  'The station movie continues through the actual station UI and departure into ch13 with no story= reseed and no double cell issuance.',
  'Every guidance objective keeps an actionable verb or input in its standing work order at every state, and its shared marker resolves the exact signed label.',
  'ch13:return:launch is published as a control-only interact with targetMode none, requiresMarker false and maxVisibleTargets 0, keeping the exact "Hold [Space] to ignite and lift." line and the "Kestrel controls · lift" label; it is never reclassified as a wait and never given a zero-coordinate marker.',
  'The initial F beside the inspecting worker only opens the survey; the single ch13:survey:start marker targets S with the exact pair "Survey start · begin a route" and "Walk to the survey start. [F] Begin recording your route."; the actual grounded F at S starts the quiet trace and records the first sample.',
  'The worker approaches W to S physically on grounded clear terrain after Terra has cleared the start corridor; the approach is uncredited, never teleports and never grows the tested prefix.',
  'Objective entry feedback fires once per objective ID, is presentation only, and never advances progression; completion is acknowledged separately.',
  'No stale objective and no mandatory missing-marker state survives beat exit, deep link, replay, pause, focus loss, quit, completion or sandbox.',
  'The player keeps the free 75 degree embodied view for the whole chapter with fixed lights, an unchanged grade and no forced camera; no shot takes movement, look or interaction.',
  'Every declared sync anchor relates to at least one shot and at least one score cue; no-op anchors declare explicit unchanged or retained relations rather than inventing a cue or a camera move.',
  'Both survey route classes are complete equal outcomes, first-try success is legal, and no forced failed crossing exists.',
  'A held reference is validated only by same-world identity, grounding, an explicit offer, socket-to-socket range, occupancy hysteresis, body clearance and a clear solid segment; camera direction is never an input.',
  'The instrument’s rendered geometry, walking collision and reference-ray solid agree at every quality tier, and the housing is never exempted from a reference ray nor inflated into a hidden wall.',
  'Completion commits exactly once on actual arrival plus earned reciprocal proof, and mandatory guidance retires with controls and progression free in the same frame.',
  'The quiet refusal enters exactly once, repeated reference loss retains the current texture, and the final texture is live only for at most five seconds followed by the existing 4.5 second release, cancelled by every declared trigger with no defer, hydrate, replay or audio predicate.',
  'The measured performance deltas stay inside +8 draw calls, +6 materials, +6 setup shader programs and +2 MiB, with zero new programs and zero first-use resources in the +/-2 second critical windows, fixed light cardinality and hardware frames-per-second non-regression; no measured performance success is claimed before those measurements exist.',
  'Persistence preserves the snapshot across pause, world departure, quit and Continue, revalidates malformed, legacy and wrong-identity data, and never resets user construction or restores pristine terrain during ordinary entry.',
];

const ALL_ANCHORS = d.syncAnchors.map((a) => a.id);
const capById = new Map(d.evidence.captures.map((c2) => [c2.id, c2]));
capById.get('cap.cg.anchor-exact-frames').anchorRefs = [
  'anc.cg.return-chosen', 'anc.cg.repeated-measure', 'anc.cg.survey-started', 'anc.cg.route-offered',
  'anc.cg.reciprocal-reference', 'anc.cg.reciprocal-crossed', 'anc.cg.final-reference-offered',
  'anc.cg.independent-test', 'anc.cg.complete', 'anc.cg.handback',
];
capById.get('cap.cg.survey-strip').anchorRefs = [
  'anc.cg.repeated-measure', 'anc.cg.demonstration-opened', 'anc.cg.survey-started', 'anc.cg.trace-drawn', 'anc.cg.route-offered', 'anc.cg.route-tested',
];
capById.get('cap.cg.contingent-hold-strip').anchorRefs = [
  'anc.cg.specific-hold', 'anc.cg.witness-held', 'anc.cg.witness-vacated', 'anc.cg.test-resumed', 'anc.cg.tail-reopened', 'anc.cg.route-revised',
];
capById.get('cap.cg.common-strip').anchorRefs = [
  'anc.cg.reciprocal-reference', 'anc.cg.reciprocal-crossed', 'anc.cg.final-reference-offered',
  'anc.cg.reference-vacated', 'anc.cg.reference-resumed', 'anc.cg.independent-test', 'anc.cg.complete',
];
const cont = capById.get('cap.cg.continuity-strip');
cont.anchorRefs = ['anc.cg.cell-installed', 'anc.cg.home-steady'];
cont.acceptanceCriterion =
  'The full actual station bridge is captured as prior-contract continuity evidence: the shipped station UI departure, undock, flight, Tidegarden landing and one-cell installation, with no story= reseed and no double issuance, followed by the ch13-home boundary where one live acknowledgement fires and retires before the invitation, and a separate hydrated entry that is steady and silent.';
capById.get('cap.cg.anchor-trace').anchorRefs = ALL_ANCHORS;
capById.get('cap.cg.performance').anchorRefs = [
  'anc.cg.survey-started', 'anc.cg.trace-drawn', 'anc.cg.route-tested', 'anc.cg.reciprocal-crossed', 'anc.cg.complete', 'anc.cg.handback',
];
capById.get('cap.cg.performance').acceptanceCriterion =
  'Draw call, shader program and GPU storage deltas and the frame-time distribution are recorded on real hardware at setup, at each critical anchor, at handback and on a repeated visit; the deltas stay inside the accepted budget, the critical windows contain no new program compilation or first resource use, and frames per second do not regress against the source-pinned baseline.';
capById.get('cap.cg.reset-matrix').anchorRefs = [
  'anc.cg.home-steady', 'anc.cg.route-offered', 'anc.cg.final-reference-offered', 'anc.cg.handback',
];
capById.get('cap.cg.audio').anchorRefs = [
  'anc.cg.cell-installed', 'anc.cg.repeated-measure', 'anc.cg.specific-hold', 'anc.cg.complete', 'anc.cg.handback',
];

const chkGeom = d.evidence.mechanicalChecks.find((m) => m.id === 'chk.cg.geometry-qualification');
chkGeom.commandOrProbeRef = '../../story-runs/2026-09-06-common-ground/staged-geometry-qualification.json';
chkGeom.status = 'passed';
chkGeom.resultRef = `../../story-runs/2026-09-06-common-ground/staged-geometry-qualification.json#sha256=${STAGED_SHA}`;
chkGeom.acceptanceCriterion =
  `The staged qualification confirms range 12, the complete rigid world placement including the distinct H reference and the connected cap, and both proof hashes (staged ${STAGED_SHA}, head ${HEAD_SHA}) under unchanged thresholds. Verdict PASS. This is CPU geometry only; it is not a runtime, render or hardware result.`;

d.evidence.continuity.previousBeatRefs = ['ch10-transit', 'station-visit', 'ch12 second-hearth install receipts (prior station-continuation contract; not a ch13 beat)'];
d.evidence.continuity.paletteRefs = [
  'shipped-visual-baseline.json#paletteStates',
  '../../production-runs/2026-08-11-ch10-station-introduction/scene-contract.json',
  'scene-cinema-lane.json#/renderContinuity',
];
d.evidence.continuity.lensRefs = [
  'shipped-visual-baseline.json#cameraStates',
  '../../story-runs/2026-09-06-common-ground/targeted-baseline-report.json',
  'scene-cinema-lane.json#/camera (free 75 degree on-foot player camera; no forced camera)',
];

/* ------------------------------------------------------------------ *
 * 10. Structural validation
 * ------------------------------------------------------------------ */
const errs = [];
const anchorIds = new Set(d.syncAnchors.map((a) => a.id));
const eventIds = new Set(d.story.events.map((e) => e.id));
const shotIds = new Set(d.shots.map((s) => s.id));
const cueIds = new Set(d.score.cues.map((s) => s.id));
const awIds = new Set(d.story.agencyWindows.map((w) => w.id));
const resetIds = new Set(d.reset.states.map((s) => s.id));

for (const a of d.syncAnchors) {
  if (!eventIds.has(a.story.eventRef)) errs.push(`anchor ${a.id} -> missing event ${a.story.eventRef}`);
  if (!d.scope.beats.includes(a.beat)) errs.push(`anchor ${a.id} beat ${a.beat} not in scope.beats`);
  if (!a.score.length) errs.push(`anchor ${a.id} has no score relation`);
  if (!a.cinematography.length) errs.push(`anchor ${a.id} has no shot relation`);
  a.score.forEach((s) => { if (!cueIds.has(s.cueRef)) errs.push(`anchor ${a.id} -> missing cue ${s.cueRef}`); });
  a.cinematography.forEach((s) => { if (!shotIds.has(s.shotRef)) errs.push(`anchor ${a.id} -> missing shot ${s.shotRef}`); });
}
for (const e of d.story.events) {
  if (!anchorIds.has(e.anchorRef)) errs.push(`event ${e.id} -> missing anchor ${e.anchorRef}`);
  if (!d.scope.beats.includes(e.beat)) errs.push(`event ${e.id} beat ${e.beat} not in scope.beats`);
}
for (const w of d.story.agencyWindows) {
  for (const k of ['startAnchorRef', 'endAnchorRef']) if (!anchorIds.has(w[k])) errs.push(`window ${w.id}.${k} -> ${w[k]}`);
}
for (const o of d.guidance.objectives) {
  if (!awIds.has(o.agencyWindowRef)) errs.push(`objective ${o.id} -> missing window ${o.agencyWindowRef}`);
  for (const k of ['enterAnchorRef', 'clearAnchorRef']) if (!anchorIds.has(o[k])) errs.push(`objective ${o.id}.${k} -> ${o[k]}`);
  if (!resetIds.has(o.resetRef)) errs.push(`objective ${o.id} resetRef`);
  if (o.targetMode === 'none' && o.requiresMarker) errs.push(`objective ${o.id} targetMode none but requiresMarker true`);
}
for (const s of d.shots) {
  for (const k of ['startAnchorRef', 'endAnchorRef']) if (!anchorIds.has(s[k])) errs.push(`shot ${s.id}.${k} -> ${s[k]}`);
  if (s.paletteRef !== d.palette.id) errs.push(`shot ${s.id} paletteRef`);
  if (!resetIds.has(s.resetRef)) errs.push(`shot ${s.id} resetRef`);
  if (!anchorIds.has(s.agency.handBackAnchorRef)) errs.push(`shot ${s.id} handBackAnchorRef`);
  s.agency.agencyWindowRefs.forEach((w) => { if (!awIds.has(w)) errs.push(`shot ${s.id} window ${w}`); });
  if (!d.scope.beats.includes(s.beat)) errs.push(`shot ${s.id} beat`);
}
for (const s of d.score.cues) {
  if (!anchorIds.has(s.anchorRef)) errs.push(`cue ${s.id} anchorRef ${s.anchorRef}`);
  if (!resetIds.has(s.resetRef)) errs.push(`cue ${s.id} resetRef`);
}
d.cinematography.shotOrder.forEach((s) => { if (!shotIds.has(s)) errs.push(`shotOrder ${s}`); });
d.performance.criticalAnchors.forEach((a) => { if (!anchorIds.has(a)) errs.push(`criticalAnchor ${a}`); });
for (const cap of d.evidence.captures) {
  cap.anchorRefs.forEach((a) => { if (a.startsWith('anc.') && !anchorIds.has(a)) errs.push(`capture ${cap.id} anchorRef ${a}`); });
}
// no stale identifiers may survive anywhere in the document
const text = JSON.stringify(d);
for (const stale of ['station-departed', 'tidegarden-returned', 'second-hearth-restored', 'witness-required', 'tail-redrawn', 'witness-resumed', 'his-test-arrival', 'anc.cg.open-ground', 'ev.cg.open-ground', 'anc.cg.span-offered', 'ev.cg.span-offered', 'sh.cg.']) {
  if (text.includes(stale)) errs.push(`stale identifier present: ${stale}`);
}
if (d.guidance.objectives.length !== 17) errs.push(`objective count ${d.guidance.objectives.length}`);
if (d.shots.length !== 9) errs.push(`shot count ${d.shots.length}`);
if (d.score.cues.length !== 6) errs.push(`cue count ${d.score.cues.length}`);

writeFileSync(join(RUN, 'scene-contract.final-candidate.json'), `${JSON.stringify(d, null, 2)}\n`);
console.log(
  `anchors=${d.syncAnchors.length} events=${d.story.events.length} windows=${d.story.agencyWindows.length} ` +
  `objectives=${d.guidance.objectives.length} shots=${d.shots.length} cues=${d.score.cues.length}`,
);
console.log(errs.length ? `REFERENCE ERRORS (${errs.length}):\n - ${errs.join('\n - ')}` : 'reference errors: 0');
