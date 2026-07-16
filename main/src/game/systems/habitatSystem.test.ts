import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyHabitatWorldSnapshot,
  commitHabitatCorePlacement,
  commitHabitatSafeRest,
  commitHabitatShelterCertification,
  getHabitatWorldSnapshot,
  resetHabitats
} from './habitatSystem.ts';

const WORLD_ID = '-1,-1:p1';
const CORE = {
  actorId: 'terra',
  worldId: WORLD_ID,
  shelterId: `habitat:${WORLD_ID}:0,24,0`,
  cell: [0, 24, 0] as [number, number, number],
  supportCell: [0, 23, 0] as [number, number, number],
  position: [0, 48.25, 0] as [number, number, number],
  up: [0, 1, 0] as [number, number, number],
  eventId: 'habitat:activate'
};

beforeEach(resetHabitats);

describe('per-world Habitat Core state', () => {
  it('commits one core, then ordered shelter and safe-rest evidence', () => {
    expect(commitHabitatCorePlacement(CORE)).toBe(true);
    expect(commitHabitatCorePlacement({ ...CORE, eventId: 'duplicate' })).toBe(false);

    expect(commitHabitatSafeRest(WORLD_ID, {
      shelterId: CORE.shelterId,
      dayPhase: 0.75,
      eventId: 'rest:too-early'
    })).toBe(false);
    expect(commitHabitatShelterCertification(WORLD_ID, {
      shelterId: CORE.shelterId,
      cell: CORE.cell,
      insulation: 0.5,
      interiorCellCount: 2,
      eventId: 'shelter:certified'
    })).toBe(true);
    expect(commitHabitatSafeRest(WORLD_ID, {
      shelterId: CORE.shelterId,
      dayPhase: 0.75,
      eventId: 'rest:safe'
    })).toBe(true);

    expect(getHabitatWorldSnapshot(WORLD_ID)).toMatchObject({
      core: { eventId: 'habitat:activate' },
      shelterCertification: { eventId: 'shelter:certified' },
      safeRest: { eventId: 'rest:safe' }
    });
  });

  it('hydrates valid snapshots defensively and rejects cross-world state', () => {
    commitHabitatCorePlacement(CORE);
    const snapshot = getHabitatWorldSnapshot(WORLD_ID)!;
    applyHabitatWorldSnapshot(WORLD_ID, snapshot);
    snapshot.core.position[0] = 999;
    expect(getHabitatWorldSnapshot(WORLD_ID)?.core.position[0]).toBe(0);

    applyHabitatWorldSnapshot(WORLD_ID, { ...snapshot, worldId: '0,0' });
    expect(getHabitatWorldSnapshot(WORLD_ID)).toBeNull();
  });
});
