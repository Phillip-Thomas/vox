import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGameCanvas,
  getAppStateSnapshot,
  isSceneReadyForWorld,
  markFramePainted,
  markTerrainPopulated,
  resetSceneReady,
  setGameCanvas
} from './appState.ts';

describe('app scene readiness', () => {
  beforeEach(() => resetSceneReady());
  afterEach(() => {
    setGameCanvas(null);
    vi.unstubAllGlobals();
  });

  it('requires eight painted frames after destination terrain is populated', () => {
    for (let frame = 0; frame < 12; frame++) markFramePainted();
    markTerrainPopulated('origin');
    expect(getAppStateSnapshot().sceneReady).toBe(false);

    for (let frame = 0; frame < 7; frame++) markFramePainted();
    expect(getAppStateSnapshot().sceneReady).toBe(false);

    markFramePainted();
    expect(getAppStateSnapshot().sceneReady).toBe(true);
    expect(isSceneReadyForWorld('origin')).toBe(true);
    expect(isSceneReadyForWorld('tidegarden')).toBe(false);
  });

  it('replaces a detached renderer canvas before pointer-lock callers use it', () => {
    class TestCanvas {}
    const documentStub = {
      querySelector: vi.fn()
    };
    const stale = { isConnected: false, ownerDocument: documentStub };
    const live = Object.assign(new TestCanvas(), { isConnected: true, ownerDocument: documentStub });
    documentStub.querySelector.mockReturnValue(live);
    vi.stubGlobal('HTMLCanvasElement', TestCanvas);
    vi.stubGlobal('document', documentStub);

    setGameCanvas(stale as unknown as HTMLCanvasElement);

    expect(getGameCanvas()).toBe(live);
    expect(documentStub.querySelector).toHaveBeenCalledWith('canvas');
  });
});
