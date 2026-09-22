import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGameCanvas,
  getAppStateSnapshot,
  isSceneReadyForWorld,
  markFramePainted,
  markTerrainPopulated,
  resetSceneReady,
  requestGamePointerLock,
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

  it('handles a canvas request rejected after a renderer swap without an unhandled rejection', async () => {
    const documentStub = { pointerLockElement: null };
    const canvas = { isConnected: true, ownerDocument: documentStub,
      requestPointerLock: vi.fn().mockRejectedValue(new DOMException('Document detached', 'WrongDocumentError')) };
    vi.stubGlobal('document', documentStub);
    setGameCanvas(canvas as unknown as HTMLCanvasElement);
    await expect(requestGamePointerLock()).resolves.toBe(false);
    expect(canvas.requestPointerLock).toHaveBeenCalledOnce();
  });

  it('reports the actual lock outcome for successful and synchronous legacy requests', async () => {
    const documentStub: { pointerLockElement: unknown } = { pointerLockElement: null };
    const canvas = { isConnected: true, ownerDocument: documentStub,
      requestPointerLock: vi.fn(() => { documentStub.pointerLockElement = canvas; }) };
    vi.stubGlobal('document', documentStub);
    setGameCanvas(canvas as unknown as HTMLCanvasElement);
    await expect(requestGamePointerLock()).resolves.toBe(true);
    canvas.requestPointerLock.mockImplementation(() => { throw new DOMException('Denied', 'NotAllowedError'); });
    await expect(requestGamePointerLock()).resolves.toBe(false);
  });
});
