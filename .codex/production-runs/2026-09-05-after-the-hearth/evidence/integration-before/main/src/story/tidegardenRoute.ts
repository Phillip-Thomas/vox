import { createPlanetIdentity, planetWorldId } from '../game/starSystem.ts';
import {
  hasMilestone,
  markMilestone,
  type ActorProgressionState
} from '../game/systems/progressionSystem.ts';
import { storyChapterAtLeast, type StoryChapter } from './storyState.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';

/** The sole persistent capability that expands the authored Story system. */
export const TIDEGARDEN_ROUTE_MILESTONE = 'story:route:tidegarden:online';

export const STORY_PRIMARY_WORLD_ID = planetWorldId({
  system: STORY_COORDINATE,
  slot: 0
});

export const TIDEGARDEN_WORLD_ID = planetWorldId({
  system: STORY_COORDINATE,
  slot: 1
});

export interface StorySystemPopulationPolicy {
  forceSingleBody: boolean;
  bodyCount: 1 | 2;
  travelEnabled: boolean;
}

export function isTidegardenRouteOnline(): boolean {
  return hasMilestone(TIDEGARDEN_ROUTE_MILESTONE);
}

/**
 * Packet 2 commits this in the same transaction as the `route_online` ship
 * repair stage. Keeping the capability behind one function prevents UI,
 * rendering, and travel code from inventing parallel unlock flags.
 */
export function commitTidegardenRouteOnline(): void {
  markMilestone(TIDEGARDEN_ROUTE_MILESTONE);
}

export function storySystemPopulationPolicy(
  routeOnline: boolean
): StorySystemPopulationPolicy {
  return routeOnline
    ? { forceSingleBody: false, bodyCount: 2, travelEnabled: true }
    : { forceSingleBody: true, bodyCount: 1, travelEnabled: false };
}

/**
 * Story reloads may resume on the sibling only after the route capability has
 * persisted. Unknown bodies and p2 always collapse to the origin Story body.
 */
export function resolveStoryResumeWorldId(
  savedWorldId: string | null | undefined,
  routeOnline: boolean
): string {
  return routeOnline && savedWorldId === TIDEGARDEN_WORLD_ID
    ? TIDEGARDEN_WORLD_ID
    : STORY_PRIMARY_WORLD_ID;
}

/**
 * Late-story ownership is stronger than the last saved surface. A reload or
 * direct rehearsal at/after landfall must open on Tidegarden even when the
 * previous save still names the origin world.
 *
 * The ownership test is a CHAPTER-ORDER comparison, never an enumeration of
 * chapter names. The enumeration this replaced (`ch9` or `complete`) silently
 * excluded ch10 — the station chapter opens on Tidegarden's second hearth, so
 * booting it on the origin world drew the sibling planet's own shell at the
 * camera, let the ground under her feet resolve as a lockable system body, and
 * ran both surface beats against the wrong terrain seed. Every chapter added
 * after ch9 inherits the right answer from the ordering instead of waiting to
 * be listed here.
 *
 * The one exception below is physical, not ordinal: a ship already in flight is
 * owned by the world it left.
 */
export function resolveStoryBootWorldId(
  _savedWorldId: string | null | undefined,
  routeOnline: boolean,
  point: { readonly chapter: string; readonly beat: string | null }
): string {
  // A crossing that is under way belongs to the world it LAUNCHED FROM, in
  // whatever chapter it happens to live. Ch8's launch and crossing are excluded
  // by the ordering below; ch10's transit is not, because chapter 10 flies back
  // to the origin in `ch10-ask` (the relay is there and nowhere else) and lifts
  // off from the wreck. Naming it here keeps the physical rule ahead of the
  // ordinal one instead of letting a chapter number claim a ship in flight.
  const crossingFromOrigin = point.beat === 'ch10-transit';
  const tidegardenOwned = !crossingFromOrigin
    && (point.beat === 'ch8-landfall'
      || storyChapterAtLeast(point.chapter as StoryChapter, 'ch9'));
  // Opening the route exposes the sibling body; it does not move an unfinished
  // Story there. Ch7 reconstruction/boarding and Ch8 launch/crossing are still
  // physically owned by the origin, even when a previous free-play save or a
  // co-op party handoff last named Tidegarden.
  return tidegardenOwned && routeOnline
    ? TIDEGARDEN_WORLD_ID
    : STORY_PRIMARY_WORLD_ID;
}

/**
 * The world each crossing beat is flying TO. Live routing differs from boot
 * routing at exactly these physical seams: system-flight ownership has already
 * transferred to the destination while the director still reports the crossing
 * beat, and that committed world must survive until the destination scene
 * proves ready.
 *
 * BOTH DIRECTIONS BELONG HERE. Only ch8's outbound leg was listed, so chapter
 * 10's return crossing fell through to the boot resolver — which answers
 * Tidegarden for `ch10-ask` — and the app swapped the world back and re-seated
 * the player at the Tidegarden launch pose every time the scene re-resolved.
 * The ship relaunched, crossed, was reclaimed, and relaunched again, eighteen
 * times over, and `activePlanetId` could never leave the sibling: the boot
 * answer was overwriting the crossing that was already under way.
 */
const CROSSING_DESTINATION_WORLD_ID: Readonly<Record<string, string>> = {
  'ch8-crossing': TIDEGARDEN_WORLD_ID,
  'ch10-ask': STORY_PRIMARY_WORLD_ID
};

/**
 * Reloads still use `resolveStoryBootWorldId` and therefore restart an
 * unfinished crossing from the world it launched from, instead of trusting
 * partial runtime state. This resolver only protects a crossing the runtime and
 * the system flight ALREADY AGREE on.
 */
export function resolveStoryRuntimeWorldId(
  currentWorldId: string,
  routeOnline: boolean,
  point: { readonly chapter: string; readonly beat: string | null },
  activePlanetId: string | null
): string {
  const destination = point.beat === null
    ? undefined
    : CROSSING_DESTINATION_WORLD_ID[point.beat];
  const committedCrossing = routeOnline
    && destination !== undefined
    && currentWorldId === destination
    && activePlanetId === destination;
  return committedCrossing
    ? destination
    : resolveStoryBootWorldId(currentWorldId, routeOnline, point);
}

/** Pure snapshot helper for server/parity tests and future migrations. */
export function progressionHasTidegardenRoute(
  progression: Pick<ActorProgressionState, 'milestones'> | null | undefined
): boolean {
  return progression?.milestones.includes(TIDEGARDEN_ROUTE_MILESTONE) ?? false;
}

export function tidegardenIdentity() {
  return createPlanetIdentity({ system: STORY_COORDINATE, slot: 1 });
}
