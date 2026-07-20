import { createPlanetIdentity, planetWorldId } from '../game/starSystem.ts';
import {
  hasMilestone,
  markMilestone,
  type ActorProgressionState
} from '../game/systems/progressionSystem.ts';
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
 */
export function resolveStoryBootWorldId(
  _savedWorldId: string | null | undefined,
  routeOnline: boolean,
  point: { readonly chapter: string; readonly beat: string | null }
): string {
  const tidegardenOwned = point.beat === 'ch8-landfall'
    || point.chapter === 'ch9'
    || point.chapter === 'complete';
  // Opening the route exposes the sibling body; it does not move an unfinished
  // Story there. Ch7 reconstruction/boarding and Ch8 launch/crossing are still
  // physically owned by the origin, even when a previous free-play save or a
  // co-op party handoff last named Tidegarden.
  return tidegardenOwned && routeOnline
    ? TIDEGARDEN_WORLD_ID
    : STORY_PRIMARY_WORLD_ID;
}

/**
 * Live Story routing differs from boot routing at exactly one physical seam:
 * the Chapter 8 midpoint has already transferred system-flight ownership to
 * Tidegarden, but the director remains on `ch8-crossing` until the destination
 * scene proves ready. Preserve that committed world during the readiness gap.
 * Reloads still use `resolveStoryBootWorldId` and therefore restart an
 * unfinished crossing from the origin instead of trusting partial runtime state.
 */
export function resolveStoryRuntimeWorldId(
  currentWorldId: string,
  routeOnline: boolean,
  point: { readonly chapter: string; readonly beat: string | null },
  activePlanetId: string | null
): string {
  const committedTidegardenCrossing = routeOnline
    && point.beat === 'ch8-crossing'
    && currentWorldId === TIDEGARDEN_WORLD_ID
    && activePlanetId === TIDEGARDEN_WORLD_ID;
  return committedTidegardenCrossing
    ? TIDEGARDEN_WORLD_ID
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
