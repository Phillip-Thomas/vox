import { attendObservation, getObservation } from '../game/systems/observationLedger.ts';
import * as THREE from 'three';
import { getLocalActorId } from '../game/playerActors.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { commonGroundPlayerPose } from './commonGroundDirector.ts';
import { CG_POSES, distanceBetween, readCommonGroundLive } from './commonGroundState.ts';
import { hifiWreckHandle } from './world/hifiWreck.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { advanceToBeat, completeStory, getStoryStateSnapshot, reactivateStoryAtBeat } from './storyState.ts';
import { registerStoryInteraction } from './storyInteractions.ts';
import { activateGuidedStoryObjective, clearGuidedStoryObjective, type GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { showCaption } from './storyText.ts';
import { UM, unfinishedMapState, canAttendMapPlace, type MapQuestion } from './unfinishedMapState.ts';
import { mapScoreAnchor, tickMapScore, stopMapScore, mapScoreSnapshot } from './unfinishedMapScore.ts';

export type MapPlace = 'survey' | 'scar';
export const UM_ANCHORS = ['anc.um.record-opened', 'anc.um.scar-observed', 'anc.um.question-retained',
  'anc.um.return-selected', 'anc.um.return-recorded', 'anc.um.handback'] as const;
const listeners = new Set<() => void>();
let revision = 0;
let panelOpen = false;
let blocked = true;
let identity = '';
let feedback = '';
let expanded: MapPlace = 'survey';
let reviewDestination: MapPlace | null = null;
const anchors: { id: string; at: number; actorId: string; worldId: string }[] = [];
export const subscribeUnfinishedMap = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const unfinishedMapVersion = () => revision;
export const unfinishedMapPanelOpen = () => panelOpen;
export const getUnfinishedMapState = () => unfinishedMapState(id => hasMilestone(id));
const emit = () => { revision++; listeners.forEach(cb => cb()); };
export function setUnfinishedMapBlocked(value: boolean): void { blocked = value; if (value) stopMapScore(); }
function foreground(): boolean {
  return !blocked && getAppStateSnapshot().phase === 'playing'
    && typeof document !== 'undefined' && !document.hidden && document.hasFocus();
}
function origin(): boolean { return getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID; }
function physicalContext() {
  const flight = getSpaceFlightSnapshot();
  const cg = readCommonGroundLive(STORY_PRIMARY_WORLD_ID);
  return {
    foreground: foreground(), origin: origin(), onFoot: flight.phase === 'surface' && flight.controlMode !== 'flight',
    actorMatches: cg?.actorId === getLocalActorId() && cg.worldId === STORY_PRIMARY_WORLD_ID,
    priorComplete: hasMilestone('story:ch13-complete'),
    reciprocalProof: !!cg?.common.committed && cg.common.comparisonProved && hasMilestone('story:ch13-reciprocal-crossed')
  };
}
export function unfinishedMapTarget(place: MapPlace): THREE.Vector3 | null {
  if (!origin()) return null;
  // The retained passage's far reference and the live diagnosis handle are the
  // existing sites. No terrain replacement, actor movement or camera request.
  if (place === 'survey') return new THREE.Vector3(CG_POSES.T.x, CG_POSES.T.y, CG_POSES.T.z);
  return hifiWreckHandle.diagnosisTarget?.clone() ?? null;
}
export function canVisitMapPlace(place: MapPlace): boolean {
  const target = unfinishedMapTarget(place);
  return canAttendMapPlace({ ...physicalContext(), targetAvailable: !!target,
    distance: target ? distanceBetween(commonGroundPlayerPose(), target) : Infinity }, place === 'survey' ? 2 : 4.2)
    && (place !== 'scar' || (hifiWreckHandle.converted && getShipRepairStage() === 'flight_ready'));
}
function canEditRecord(): boolean {
  const f = physicalContext();
  return f.foreground && f.origin && f.onFoot && f.actorMatches && f.priorComplete && f.reciprocalProof;
}
function noteAnchor(id: typeof UM_ANCHORS[number]): void {
  anchors.push({ id, at: performance.now(), actorId: getLocalActorId(), worldId: STORY_PRIMARY_WORLD_ID });
  if (anchors.length > 24) anchors.shift();
  mapScoreAnchor(id);
}
function refuse(message: string): false { feedback = message; showCaption(message); emit(); return false; }
export function openUnfinishedMap(): void {
  if (!getUnfinishedMapState().opened || !foreground()) return;
  panelOpen = true; emit();
}
export function closeUnfinishedMap(): void { panelOpen = false; emit(); }
export function expandMapEntry(place: MapPlace): void { expanded = place; emit(); }
function followBeat(): void {
  const state = getUnfinishedMapState();
  if (state.beat && state.beat !== 'done') {
    if (!getStoryStateSnapshot().active) reactivateStoryAtBeat(state.beat);
    else if (getStoryStateSnapshot().beat !== state.beat) advanceToBeat(state.beat);
  }
  emit();
}
export function beginUnfinishedMap(): boolean {
  const story = getStoryStateSnapshot();
  if (getUnfinishedMapState().opened || story.active || !canVisitMapPlace('survey'))
    return refuse('begin at the retained common passage, after its test has finished.');
  const survey = readCommonGroundLive(STORY_PRIMARY_WORLD_ID)?.survey.accepted;
  if (!survey?.routeClass) return refuse('the retained survey is not available yet. revisit its reference when the world is ready.');
  attendObservation('unfinished_map_passage', { id: 'ch14:passage', worldId: STORY_PRIMARY_WORLD_ID,
    sourceKey: 'retained-common-passage', data: { routeClass: survey.routeClass, lengthUnits: survey.lengthUnits,
      testedPrefixCount: survey.testedPrefixCount, samples: survey.samples.map(point => ({ ...point })) }
  }, { id: 'ch14:record-start' }, getLocalActorId());
  markMilestone(UM.opened);
  // An earned field record becomes a resumable journey. A diagnostic entry URL
  // must not replay its predecessor and erase this save on browser reload.
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.get('story') === 'ch13-survey' && url.searchParams.get('movie') !== '1') {
      url.searchParams.delete('story');
      window.history.replaceState(window.history.state, '', url);
    }
  }
  followBeat();
  panelOpen = true; expanded = 'survey';
  feedback = 'i want to know what else a record leaves out.';
  showCaption(feedback); noteAnchor('anc.um.record-opened'); emit(); return true;
}
export function indexMapSurvey(): boolean {
  const state = getUnfinishedMapState();
  if (!canEditRecord()) return refuse('return to Origin on foot and resume play to use this record. your entries are retained.');
  if (!state.opened || state.indexed) return false;
  markMilestone(UM.indexed); feedback = 'walk to the repaired hull. observe its scar when you arrive.';
  panelOpen = false; followBeat(); return true;
}
export function observeMapScar(): boolean {
  const state = getUnfinishedMapState();
  if (!state.indexed || state.scar) return false;
  if (!canVisitMapPlace('scar')) return refuse('come within reach of the repaired hull’s scar, on foot. the visit is still pending.');
  markMilestone(UM.scar); followBeat();
  panelOpen = true; expanded = 'scar'; feedback = 'the repair works. the scar remains.';
  showCaption(feedback); noteAnchor('anc.um.scar-observed'); emit(); return true;
}
export function retainMapQuestion(question: MapQuestion): boolean {
  const state = getUnfinishedMapState();
  if (!canEditRecord()) return refuse('return to Origin on foot and resume play to retain this question. your entries are safe.');
  if (!state.scar || state.retained || !panelOpen) return false;
  if (question !== 'survived' && question !== 'changed') return false;
  markMilestone(UM[question]); markMilestone(UM.retained);
  expanded = question === 'survived' ? 'scar' : 'survey';
  feedback = 'i can keep the question with the thing.';
  showCaption(feedback); followBeat(); noteAnchor('anc.um.question-retained'); emit(); return true;
}
export function selectMapReturn(place: MapPlace = 'survey'): boolean {
  const state = getUnfinishedMapState();
  if (!canEditRecord()) return refuse('return to Origin on foot to follow this entry. your record remains available.');
  if (!state.retained || !panelOpen) return false;
  if (!state.complete && place !== 'survey') return false;
  expanded = place;
  if (!state.selected) { markMilestone(UM.selected); noteAnchor('anc.um.return-selected'); }
  if (state.complete) reviewDestination = place;
  feedback = place === 'survey' ? 'destination: retained common passage. close the record and walk back.' : 'destination: repaired hull. close the record to walk there.';
  emit(); return true;
}
export function recordMapReturn(): boolean {
  const state = getUnfinishedMapState();
  if (!state.selected || state.returned) return false;
  if (!canVisitMapPlace('survey')) return refuse('return to the retained passage on foot, then press F. your entries are safe.');
  markMilestone(UM.returned); markMilestone(UM.complete);
  panelOpen = false; reviewDestination = null;
  clearGuidedStoryObjective('satisfied'); getFeedRuntime().marker.visible = false;
  completeStory(); // Keep the existing free-play handback; no completion modal.
  noteAnchor('anc.um.return-recorded'); noteAnchor('anc.um.handback');
  feedback = 'return visit recorded. the question remains open.'; showCaption(feedback); emit(); return true;
}
export function unfinishedMapObjective(): GuidedStoryObjective {
  const state = getUnfinishedMapState();
  const worldMissing = !origin();
  const place = state.complete ? reviewDestination : !state.scar ? 'scar' : state.selected ? 'survey' : null;
  const requiresMarker = !worldMissing && place !== null;
  return {
    id: `objective:ch14:${state.beat ?? 'invitation'}:${state.selected ? 'selected' : 'pending'}:${worldMissing ? 'away' : 'origin'}:${place ?? 'record'}`,
    kind: place ? 'travel' : 'interact', markerLabel: place === 'scar' ? 'repaired hull · surviving scar' : 'retained common passage',
    requiresMarker,
    workOrder: state.complete ? ['field record · visited places', place === 'scar' ? 'walk to the repaired hull.' : 'walk to the retained common passage.']
      : worldMissing ? ['the unfinished map', 'your entries are retained. return to Origin to continue.']
      : !state.indexed ? ['the unfinished map', 'read the passage entry. choose “Visit the repaired hull” in your record.']
      : !state.scar ? ['the unfinished map', 'walk to the repaired hull. [F] observe the surviving scar.']
      : !state.retained ? ['the unfinished map', 'open your field record. choose a question, then retain both entries.']
      : !state.selected ? ['the unfinished map', 'select the common passage entry. choose “Return to this place”.']
      : ['the unfinished map', 'walk back to the retained common passage. [F] record the return visit.']
  };
}
export function unfinishedMapMarker(): (import('./beats/worldHandles.ts').MarkerPose & { label: string }) | null {
  const state = getUnfinishedMapState();
  const place = state.complete ? reviewDestination : !state.indexed ? null : !state.scar ? 'scar' : state.selected ? 'survey' : null;
  const position = place ? unfinishedMapTarget(place) : null;
  return position ? { position, label: place === 'scar' ? 'repaired hull · surviving scar' : 'retained common passage' } : null;
}
let installed = false;
export function tickUnfinishedMap(): void {
  const nextIdentity = `${getLocalActorId()}:${getStoryStateSnapshot().runId}`;
  if (identity !== nextIdentity) {
    identity = nextIdentity; panelOpen = false; feedback = ''; reviewDestination = null; anchors.length = 0; stopMapScore(); emit();
  }
  tickMapScore(foreground() && origin());
  if (!installed) {
    installed = true;
    registerStoryInteraction(() => {
      if (!foreground() || panelOpen) return null;
      const state = getUnfinishedMapState();
      const action = !state.opened && !getStoryStateSnapshot().active && canVisitMapPlace('survey')
        ? { id: 'story-ch14-record' as const, verb: 'Begin a field record', perform: beginUnfinishedMap }
        : state.indexed && !state.scar && canVisitMapPlace('scar')
        ? { id: 'story-ch14-scar' as const, verb: 'Observe the surviving scar', perform: observeMapScar }
        : state.selected && !state.returned && canVisitMapPlace('survey')
        ? { id: 'story-ch14-return' as const, verb: 'Record the return visit', perform: recordMapReturn } : null;
      return action;
    }, { owner: 'ch14-unfinished-map', interactionClass: 'required', priority: 530 });
  }
  const state = getUnfinishedMapState();
  if (state.complete && reviewDestination && !panelOpen && canVisitMapPlace(reviewDestination)) {
    reviewDestination = null; clearGuidedStoryObjective('satisfied'); getFeedRuntime().marker.visible = false; emit();
  }
  if (state.opened && !state.complete && getStoryStateSnapshot().chapter === 'ch14' && foreground()) {
    activateGuidedStoryObjective(unfinishedMapObjective());
  }
}
export function getUnfinishedMapSnapshot() {
  const state = getUnfinishedMapState();
  const survey = getObservation('unfinished_map_passage', getLocalActorId())?.evidenceHistory.find(entry => entry.id === 'ch14:passage')?.data;
  return { chapter: 'ch14', ...state, ready: canEditRecord(), panelOpen, paused: blocked || !foreground(), feedback, expanded,
    actorId: getLocalActorId(), worldId: getSystemFlightSnapshot().activePlanetId,
    destination: state.complete ? reviewDestination : state.selected ? 'survey' : null,
    reach: { survey: canVisitMapPlace('survey'), scar: canVisitMapPlace('scar') },
    targets: { survey: unfinishedMapTarget('survey')?.toArray() ?? null, scar: unfinishedMapTarget('scar')?.toArray() ?? null },
    survey: { routeClass: typeof survey?.routeClass === 'string' ? survey.routeClass : null,
      lengthUnits: typeof survey?.lengthUnits === 'number' ? survey.lengthUnits : null,
      testedPrefixCount: typeof survey?.testedPrefixCount === 'number' ? survey.testedPrefixCount : null },
    anchors: anchors.map(event => ({ ...event })), score: mapScoreSnapshot() };
}
