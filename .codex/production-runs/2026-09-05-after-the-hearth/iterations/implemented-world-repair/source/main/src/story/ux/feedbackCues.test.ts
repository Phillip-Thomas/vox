import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playSfx } from '../../audio/sfxEngine.ts';
import { peekAudioContext } from '../../audio/audioCore.ts';
import { voiceTypewriterGapMs } from '../../audio/voice/voicePresentation.ts';
import { cancelPendingStoryUxFeedback, emitStoryUxFeedbackCue, subscribeStoryUxFeedback, earlyFeedbackTrace } from './feedbackCues.ts';
import { activateGuidedStoryObjective, acknowledgeGuidedStoryCompletion, beginGuidedObjectiveRestore, clearGuidedStoryObjective, resetGuidedObjectiveFeedbackForTests } from './objectiveDirector.ts';
vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));
vi.mock('../../audio/audioCore.ts', () => ({ peekAudioContext: vi.fn(() => ({ state: 'running', currentTime: 10 })) }));
vi.mock('../../audio/voice/voicePresentation.ts', () => ({ voiceTypewriterGapMs: vi.fn(() => 0) }));
const id = 'ch1:fixed:recover-first-debris';
const successor = 'ch1:fixed:calibrate-extractor';
const objective = (id: string) => ({ id, kind: 'interact' as const, markerLabel: 'DEBRIS', workOrder: ['WALK OVER THE DEBRIS.'], requiresMarker: false });
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }); resetGuidedObjectiveFeedbackForTests(); earlyFeedbackTrace.length = 0; vi.clearAllMocks(); });
afterEach(() => { cancelPendingStoryUxFeedback(); resetGuidedObjectiveFeedbackForTests(); vi.useRealTimers(); });
describe('early receipt audio arbitration', () => {
  it('delivers semantics immediately and one ordinary unscheduled sound at 120 ms', () => {
    const seen: string[] = []; const stop = subscribeStoryUxFeedback(cue => seen.push(cue.type));
    emitStoryUxFeedbackCue({ type: 'objective-complete', objectiveId: id }, { receiptId: 'native-1', expectedSuccessor: successor, valid: () => true });
    expect(seen).toEqual(['objective-complete']); expect(playSfx).not.toHaveBeenCalled();
    vi.advanceTimersByTime(119); expect(playSfx).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete'); stop();
  });
  it('retains the expected successor and coalesces its audible entry', () => {
    activateGuidedStoryObjective(objective(id)); vi.mocked(playSfx).mockClear();
    acknowledgeGuidedStoryCompletion(id, true, { receiptId: 'native-2', expectedSuccessor: successor });
    activateGuidedStoryObjective(objective(successor)); vi.advanceTimersByTime(120);
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
  });
  it('retains only matched terminal-null quota completion through repeated satisfied clear', () => {
    const quota = 'ch1:raster:extract-fiber-quota'; activateGuidedStoryObjective(objective(quota)); vi.mocked(playSfx).mockClear();
    acknowledgeGuidedStoryCompletion(quota, true, { receiptId: 'native-3', expectedSuccessor: null });
    clearGuidedStoryObjective('satisfied'); clearGuidedStoryObjective('satisfied'); vi.advanceTimersByTime(120);
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
  });
  it.each(['replacement', 'pause', 'restore'] as const)('cancels %s without any late callback', mode => {
    activateGuidedStoryObjective(objective(id)); acknowledgeGuidedStoryCompletion(id, true, { receiptId: 'native-4', expectedSuccessor: successor });
    if (mode === 'replacement') activateGuidedStoryObjective(objective('unrelated'));
    else if (mode === 'restore') beginGuidedObjectiveRestore('resume');
    else cancelPendingStoryUxFeedback('pause');
    vi.mocked(playSfx).mockClear(); vi.advanceTimersByTime(500); expect(playSfx).not.toHaveBeenCalled();
  });
  it('expires instead of scheduling across a voice gap beyond 240 ms', () => {
    vi.mocked(voiceTypewriterGapMs).mockReturnValueOnce(200);
    emitStoryUxFeedbackCue({ type: 'objective-complete', objectiveId: id }, { receiptId: 'native-5', expectedSuccessor: successor, valid: () => true });
    vi.advanceTimersByTime(500); expect(playSfx).not.toHaveBeenCalled(); expect(earlyFeedbackTrace[earlyFeedbackTrace.length - 1]?.outcome).toBe('expired');
  });
  it('drops locked audio without unlock backlog', () => {
    vi.mocked(peekAudioContext).mockReturnValueOnce(null);
    emitStoryUxFeedbackCue({ type: 'objective-complete', objectiveId: id }, { receiptId: 'native-6', expectedSuccessor: successor, valid: () => true });
    vi.advanceTimersByTime(500); expect(playSfx).not.toHaveBeenCalled(); expect(earlyFeedbackTrace[earlyFeedbackTrace.length - 1]?.outcome).toBe('audio-unavailable');
  });
  it('Continue is silent but a first real completion remains audible', () => {
    beginGuidedObjectiveRestore('resume'); activateGuidedStoryObjective(objective(id)); expect(playSfx).not.toHaveBeenCalled();
    expect(acknowledgeGuidedStoryCompletion(id)).toBe(false);
    expect(acknowledgeGuidedStoryCompletion(id, true, { receiptId: 'earned', expectedSuccessor: successor })).toBe(true);
    activateGuidedStoryObjective(objective(successor)); vi.advanceTimersByTime(120); expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
  });
});
