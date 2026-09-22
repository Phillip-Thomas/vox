import { afterEach, describe, expect, it, vi } from 'vitest';
import { playSfx } from '../../audio/sfxEngine.ts';
import { getStoryText, clearStoryText } from '../storyText.ts';
import { subscribeStoryUxFeedback } from './feedbackCues.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  observeGuidedStoryMarker,
  subscribeGuidedStoryObjective,
  beginGuidedObjectiveRestore,
  resetGuidedObjectiveFeedbackForTests,
  acknowledgeGuidedStoryProgress
} from './objectiveDirector.ts';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

afterEach(() => {
  resetGuidedObjectiveFeedbackForTests();
  clearStoryText();
  vi.clearAllMocks();
});

describe('guided story objective contract', () => {
  it('publishes a resolved initial marker atomically and acknowledges it once', () => {
    const health: string[] = [];
    const unsubscribe = subscribeGuidedStoryObjective(() => health.push(getGuidedStoryObjectiveHealth()));
    activateGuidedStoryObjective({ id: 'atomic', kind: 'travel', markerLabel: 'WATER', workOrder: ['FOLLOW WATER'] }, 'WATER');
    observeGuidedStoryMarker('WATER');
    unsubscribe();
    expect(health).toEqual(['ready']);
    expect(vi.mocked(playSfx).mock.calls.map(call => call[0])).toEqual(['objectiveEnter', 'markerAcquired']);
  });
  it('publishes one actionable objective and detects a missing required marker', () => {
    expect(activateGuidedStoryObjective({
      id: 'settle:scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    })).toBe(true);
    expect(getStoryText().workorder).toEqual([
      'FOLLOW THE LIVING WATERLINE MARKER.',
      'READ THE SIGNAL FIELD.'
    ]);
    expect(getGuidedStoryObjectiveHealth()).toBe('missing-marker');

    observeGuidedStoryMarker('LIVING WATERLINE · SCAN');
    expect(getGuidedStoryObjectiveHealth()).toBe('ready');
    expect(activateGuidedStoryObjective({
      id: 'settle:scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    })).toBe(false);
  });

  it('rejects a supposedly guided objective with no player action', () => {
    expect(() => activateGuidedStoryObjective({
      id: 'broken',
      kind: 'wait',
      markerLabel: 'BROKEN',
      workOrder: []
    })).toThrow('actionable work-order');
  });

  it('emits one presentation-only entry cue per objective id', () => {
    const cues: string[] = [];
    const unsubscribe = subscribeStoryUxFeedback(cue => cues.push(cue.objectiveId));
    const objective = {
      id: 'dive:recover-keel-memory',
      kind: 'interact' as const,
      markerLabel: 'KEEL MEMORY',
      workOrder: ['[F] RECOVER THE KEEL MEMORY.']
    };

    expect(activateGuidedStoryObjective(objective)).toBe(true);
    expect(activateGuidedStoryObjective(objective)).toBe(false);
    unsubscribe();

    expect(cues).toEqual(['dive:recover-keel-memory']);
    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('objectiveEnter');
  });
});

describe('objective feedback never claims unearned completion', () => {
  const objective = { id: 'test:recover', kind: 'interact' as const, markerLabel: 'Recover', workOrder: ['RECOVER THE CELL'], requiresMarker: true };
  it.each(['seed', 'resume', 'transition'] as const)('%s reconstructs silently until actual progress', reason => {
    beginGuidedObjectiveRestore(reason);
    activateGuidedStoryObjective(objective);
    observeGuidedStoryMarker('Recover');
    expect(playSfx).not.toHaveBeenCalled();
    activateGuidedStoryObjective({ ...objective, id: 'test:next' }, 'Recover');
    expect(playSfx).toHaveBeenCalledWith('objectiveEnter');
    expect(playSfx).toHaveBeenCalledWith('markerAcquired');
  });
  it.each(['transition', 'resume', 'reset'] as const)('%s clears silently', (reason) => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    clearGuidedStoryObjective(reason);
    expect(playSfx).not.toHaveBeenCalled();
  });
  it('sounds completion once only for a satisfied objective', () => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    clearGuidedStoryObjective('satisfied'); clearGuidedStoryObjective('satisfied');
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
  });
  it('acknowledges each progress edge and marker acquisition only once', () => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    acknowledgeGuidedStoryProgress('receipt'); acknowledgeGuidedStoryProgress('receipt');
    observeGuidedStoryMarker('Recover'); observeGuidedStoryMarker(null); observeGuidedStoryMarker('Recover');
    expect(playSfx).toHaveBeenCalledTimes(2);
    expect(playSfx).toHaveBeenCalledWith('objectiveProgress');
    expect(playSfx).toHaveBeenCalledWith('markerAcquired');
  });
});

import * as THREE from 'three';
import { SIDE_RIG, setSideLens, clearSideLens, setLensRig, setSideCoverageViewport, sampleFixedScreenCoverage, getFixedScreenCoverage, applyActiveRigTransform, noteFixedScreenCoveragePresented, resolveFixedScreenCoverageGeometry } from '../sideLens.ts';
const lens = { origin: new THREE.Vector3(), travelAxis: new THREE.Vector3(1, 0, 0), depthAxis: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
const viewport = (width: number, height: number) => ({ width, height, aspect: width / height, fov: 75, touch: width < 900, safe: { left: 0, right: 0, top: 0, bottom: 0 }, reservations: [] });
describe('shared fixed coverage objective authority', () => {
  it('has one movement event, shared renderer anchor, then a presented destination frame', () => {
    setSideLens(lens); setLensRig({ ...SIDE_RIG, followQuant: 1 }); setSideCoverageViewport(viewport(390, 844));
    const player = new THREE.Vector3();
    expect(sampleFixedScreenCoverage(player, 1)?.valid).toBe(false);
    expect(sampleFixedScreenCoverage(player, 2)?.valid).toBe(true);
    const width = resolveFixedScreenCoverageGeometry(viewport(390, 844), SIDE_RIG).cellWidth;
    player.x = width / 2 + 0.01;
    const crossed = sampleFixedScreenCoverage(player, 3)!;
    expect(crossed.transfer).toMatchObject({ reason: 'player-traversal', fromCell: 0, toCell: 1 });
    expect(sampleFixedScreenCoverage(player, 3)).toBe(crossed);
    expect(crossed.presentedTransferSequence).toBe(0);
    const camera = new THREE.PerspectiveCamera(75, 390 / 844); const parent = new THREE.Group(); parent.position.copy(player); parent.add(camera); parent.updateMatrixWorld(true);
    applyActiveRigTransform(camera, lens, 0.016);
    expect(crossed.presentedTransferSequence).toBe(0);
    noteFixedScreenCoveragePresented();
    expect(camera.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(crossed.anchorCenter);
    const next = sampleFixedScreenCoverage(player, 4)!;
    expect(next.transfer).toBeNull(); expect(next.presentedTransferSequence).toBe(1); clearSideLens();
  });
  it('requires stable geometry and never turns resize or pause into a receipt', () => {
    setSideLens(lens); setLensRig({ ...SIDE_RIG, followQuant: 1 }); setSideCoverageViewport(viewport(1280, 720));
    const player = new THREE.Vector3(); sampleFixedScreenCoverage(player, 1); sampleFixedScreenCoverage(player, 2);
    const epoch = getFixedScreenCoverage()!.geometryEpoch;
    setSideCoverageViewport(viewport(390, 844));
    expect(sampleFixedScreenCoverage(player, 3)?.valid).toBe(false);
    const rebased = sampleFixedScreenCoverage(player, 4)!;
    expect(rebased.geometryEpoch).toBeGreaterThan(epoch); expect(rebased.transferSequence).toBe(0); expect(rebased.transfer).toBeNull();
    sampleFixedScreenCoverage(player, 5, false); sampleFixedScreenCoverage(player, 6, true);
    expect(getFixedScreenCoverage()?.transferSequence).toBe(0); clearSideLens();
  });
  it('uses same-camera view offset only when short touch landscape needs clearance', () => {
    const short = viewport(844, 390);
    const measured = { ...short, reservations: [{ left: 18, right: 200, top: 250, bottom: 370 }] };
    const geometry = resolveFixedScreenCoverageGeometry(measured, SIDE_RIG);
    expect(geometry.offsetY).toBeGreaterThan(0); expect(geometry.valid).toBe(true);
    expect(resolveFixedScreenCoverageGeometry(viewport(390, 844), SIDE_RIG).offsetY).toBe(0);
    expect(resolveFixedScreenCoverageGeometry(viewport(1280, 720), SIDE_RIG).cellWidth).toBeGreaterThan(30);
  });
});
