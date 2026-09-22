import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { RailRuntime } from '../../autopilot.ts';
import { addItem, resetInventory } from '../../../game/systems/inventorySystem.ts';
import { tick } from './rail-ch9-settle.ts';
import { tick as tickHearth } from './rail-ch9-hearth.ts';

describe('settlement rail physical arrival', () => {
  beforeEach(() => resetInventory());
  it.each([1.9, 0.56, 0.45])('keeps walking until the chosen voxel is reached (%s m)', distance => {
    // Sufficient carried material isolates physical arrival from harvesting.
    addItem('wood', 38, 'local');
    const player = new THREE.Vector3(-distance, 50.79, -2);
    const chosenApproach = new THREE.Vector3(0, 51.85, -2);
    const install = vi.fn();
    const walk = vi.fn(() => distance);
    const ctx = {
      getLocalActorId: () => 'local',
      getEmergentMovieSettlementBinding: () => ({ commandContext: { actorId: 'local', world: { worldId: 'tidegarden' } } }),
      getHabitatWorldState: () => null,
      TIDEGARDEN_WORLD_ID: 'tidegarden', TIDEGARDEN_SETTLEMENT_MILESTONES: { relationshipAttended: 'attended' },
      hasMilestone: () => true,
      getTidegardenChosenHabitatSite: () => ({ cell: [0, 25, -1] }),
      habitatGoal: new THREE.Vector3(0, 51.85, 0),
      resolveTidegardenSettlementTarget: () => chosenApproach,
      getPlayerWorldPosition: () => player,
      prepareEmergentMovieHabitatCore: () => true,
      emergentMovieConstructionWoodNeeded: () => 38,
      controls: { delete: true }, beatClock: 0,
      walkToward: walk, installEmergentMovieHabitatCore: install
    } as unknown as RailRuntime;
    tick(ctx);
    expect(ctx.habitatGoal).toEqual(chosenApproach);
    expect(walk).toHaveBeenCalledWith(chosenApproach, 0.45, 0.4);
    expect(ctx.controls.delete).toBe(false);
    expect(install).toHaveBeenCalledTimes(distance <= 0.55 ? 1 : 0);
    if (distance <= 0.55) expect(install).toHaveBeenCalledWith(player, 'local');
  });
});

describe('shelter subject gaze', () => {
  it.each(['settle', 'hearth'] as const)('uses the low-subject gaze for%s at the real annex approach', beat => {
    const player = new THREE.Vector3(2, 50.2, -2);
    const view = { position: player.clone(), target: new THREE.Vector3(0, 49.73, -2) };
    const holdAt = vi.fn(), walkToward = vi.fn(() => 0), rest = vi.fn();
    const ctx = {
      getLocalActorId: () => 'local', getPlayerWorldPosition: () => player,
      getEmergentMovieSettlementBinding: () => ({ commandContext: { actorId: 'local', world: { worldId: 'tidegarden' } } }),
      getHabitatWorldState: () => ({ core: { position: [0, 50.2, -2] }, shelterCertification: {} }),
      TIDEGARDEN_WORLD_ID: 'tidegarden', TIDEGARDEN_SETTLEMENT_MILESTONES: { relationshipAttended: 'attended' },
      hasMilestone: () => true, emergentMovieShelterView: () => view,
      emergentMovieConstructionWoodNeeded: () => 0, controls: { delete: false }, beatClock: 47,
      walkToward, holdAt, buildAndCertifyEmergentMovieShelter: () => true,
      getCurrentDayPhase: () => 0.21, completeEmergentMovieSafeRest: rest
    } as unknown as RailRuntime;
    (beat === 'settle' ? tick : tickHearth)(ctx);
    expect(walkToward).toHaveBeenCalledWith(view.position, 0.35, 0, view.target, 3);
    expect(holdAt).toHaveBeenCalledWith(view.target, 0, 'interact');
    if (beat === 'hearth') expect(rest).toHaveBeenCalledWith(player, 0.21, 'local');
  });
});
