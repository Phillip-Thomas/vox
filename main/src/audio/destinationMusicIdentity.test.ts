import { describe, expect, it } from 'vitest';
import {
  TIDEGARDEN_PROFILE_ID,
  TIDEGARDEN_PROFILE_VERSION,
  TIDEGARDEN_SEED
} from '../game/PlanetProfile.ts';
import { parsePlanetWorldId } from '../game/starSystem.ts';
import { TIDEGARDEN_WORLD_ID } from '../story/tidegardenRoute.ts';
import { resolveSystemBodyMusicIdentity } from './destinationMusicIdentity.ts';

describe('canonical destination music identity', () => {
  it('routes the complete Tidegarden p1 identity bundle instead of the shared coordinate', () => {
    const address = parsePlanetWorldId(TIDEGARDEN_WORLD_ID);
    if (!address) throw new Error('Tidegarden must have a canonical address.');
    expect(resolveSystemBodyMusicIdentity({
      kind: 'system_body',
      address,
      worldId: TIDEGARDEN_WORLD_ID
    })).toEqual({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED,
      profileId: TIDEGARDEN_PROFILE_ID,
      profileVersion: TIDEGARDEN_PROFILE_VERSION,
      profileHash: 'pf1-eeef3b78',
      archetype: 'verdant'
    });
  });
});
