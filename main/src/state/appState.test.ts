import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAppStateSnapshot,
  markFramePainted,
  markTerrainPopulated,
  resetSceneReady
} from './appState.ts';

describe('app scene readiness', () => {
  beforeEach(() => resetSceneReady());

  it('requires eight painted frames after destination terrain is populated', () => {
    for (let frame = 0; frame < 12; frame++) markFramePainted();
    markTerrainPopulated();
    expect(getAppStateSnapshot().sceneReady).toBe(false);

    for (let frame = 0; frame < 7; frame++) markFramePainted();
    expect(getAppStateSnapshot().sceneReady).toBe(false);

    markFramePainted();
    expect(getAppStateSnapshot().sceneReady).toBe(true);
  });
});
