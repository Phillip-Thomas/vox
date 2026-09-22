import { beforeEach, describe, expect, it, vi } from 'vitest';
const fakes = vi.hoisted(() => ({ audio: null as null | { currentTime: number; state?: string }, muted: false, utter: vi.fn(), reset: vi.fn(), retire: vi.fn() }));
vi.mock('../audioCore.ts', () => ({ peekAudioContext: () => fakes.audio }));
vi.mock('../audioSettings.ts', () => ({ getAudioSettingsSnapshot: () => ({ muted: fakes.muted, sfxVolume: 1 }) }));
vi.mock('../musicPrimitives.ts', () => ({ getMusicPrimitives: () => ({ era: 1 }) }));
vi.mock('./voiceBus.ts', () => ({ utter: fakes.utter, resetVoiceBus: fakes.reset, retireOwnedUtterance: fakes.retire, getVoiceBusDiagnostics: () => ({ slots: [] }) }));
import { getVoicePresentationDiagnostics, consumeVoiceLineSilently, retireVisibleVoiceLine, resetVoicePresentation, setVoicePresentationContext, setVoicePresentationFocused, suspendVoicePresentation, voiceVisibleText } from './voicePresentation.ts';

beforeEach(() => {
  resetVoicePresentation(); fakes.audio = { currentTime: 3, state: 'running' }; fakes.muted = false;
  setVoicePresentationFocused(true);
  fakes.utter.mockReset().mockReturnValue({ spoken: true, grainsScheduled: 3, plan: { durationSeconds: 0.02 } });
  fakes.retire.mockReset().mockReturnValue({ grains: 2, automationWrites: 3 });
  fakes.reset.mockClear(); setVoicePresentationContext({ beat: 'ch3-signal' });
});

describe('visible text narration', () => {
  it('cancels on focus loss and consumes text shown unfocused without replay on focus return', () => {
    voiceVisibleText('focus', 'REGULATION', 1, 'audit-band');
    setVoicePresentationFocused(false);
    voiceVisibleText('focus', 'REGULATION', 5, 'audit-band');
    setVoicePresentationFocused(true);
    voiceVisibleText('focus', 'REGULATION', 5, 'audit-band');
    expect(fakes.utter).toHaveBeenCalledOnce();
    voiceVisibleText('focus', 'REGULATION', 6, 'audit-band');
    expect(fakes.utter.mock.calls[1][1].characterRange).toEqual([5, 6]);
    expect(getVoicePresentationDiagnostics().trace.some(event => event.kind === 'cancel' && event.reason === 'focus-loss')).toBe(true);
  });
  it('cancels pending voice when the existing story pause starts', () => {
    voiceVisibleText('pause', 'REGULATION', 1, 'audit-band');
    fakes.reset.mockClear();
    setVoicePresentationContext({ beat: 'ch3-signal', paused: true });
    expect(fakes.reset).toHaveBeenCalledOnce();
    setVoicePresentationContext({ beat: 'ch3-signal', paused: false });
    voiceVisibleText('pause', 'REGULATION', 1, 'audit-band');
    expect(fakes.utter).toHaveBeenCalledOnce();
  });
  it('voices newly painted characters once and emits one caption receipt for the line', () => {
    voiceVisibleText('1', 'REGULATION', 1, 'audit-band');
    voiceVisibleText('1', 'REGULATION', 1, 'audit-band');
    voiceVisibleText('1', 'REGULATION', 2, 'audit-band');
    expect(fakes.utter.mock.calls.map(call => call[1].characterRange)).toEqual([[0, 1], [1, 2]]);
    expect(getVoicePresentationDiagnostics().captionEvents).toBe(1);
  });
  it('does not replay visible characters after a late audio unlock or mute', () => {
    fakes.audio = null;
    voiceVisibleText('1', 'REGULATION', 3, 'audit-band');
    fakes.audio = { currentTime: 4 };
    fakes.muted = true;
    voiceVisibleText('1', 'REGULATION', 5, 'audit-band');
    fakes.muted = false;
    voiceVisibleText('1', 'REGULATION', 6, 'audit-band');
    expect(fakes.utter).toHaveBeenCalledOnce();
    expect(fakes.utter.mock.calls[0][1].characterRange).toEqual([5, 6]);
  });
  it('stops pending grains on an oxygen or seam silence edge without restarting read text', () => {
    voiceVisibleText('1', 'REGULATION', 10, 'audit-band');
    fakes.reset.mockClear();
    setVoicePresentationContext({ beat: 'ch3-signal', underOxygen: true });
    expect(fakes.reset).toHaveBeenCalledOnce();
    setVoicePresentationContext({ beat: 'ch3-signal', underOxygen: false });
    voiceVisibleText('1', 'REGULATION', 10, 'audit-band');
    expect(fakes.utter).toHaveBeenCalledOnce();
  });
  it('preserves the relay answer slot and current first-glyph time', () => {
    voiceVisibleText('ask', 'REQUEST', 1, 'ch10-relay', { slot: 0 });
    voiceVisibleText('answer', 'APPROVED', 1, 'ch10-relay', { slot: 1 });
    expect(fakes.utter.mock.calls.map(call => [call[1].slot, call[1].startTime])).toEqual([[0, 3], [1, 3]]);
    suspendVoicePresentation();
    voiceVisibleText('answer', 'APPROVED', 1, 'ch10-relay', { slot: 1 });
    expect(fakes.utter).toHaveBeenCalledTimes(2);
  });
});


function earlyOwner(publication = {}, runVersion = 1, restoreVersion = 0) {
  return { surfaceId: 'feed' as const, lineId: 'order:ch1:fixed:recover-first-debris:0', text: 'WALK OVER THE DEBRIS TO RECOVER IT.', publication, runVersion, restoreVersion };
}
function sayOrder(owner = earlyOwner(), slot = 0) {
  return voiceVisibleText(owner.lineId, owner.text, owner.text.length, 'feed', { earlyWorkOrder: owner, slot });
}
describe('first presented early work-order ownership', () => {
  it('consumes a bearing-first/hidden publication without audio, glyph or caption receipt and never retries its reveal', () => {
    const owner = earlyOwner();
    consumeVoiceLineSilently(owner, 'bearing-first');
    expect(sayOrder(owner)).toBe(false);
    expect(fakes.utter).not.toHaveBeenCalled();
    expect(fakes.retire).not.toHaveBeenCalled();
    expect(getVoicePresentationDiagnostics().captionEvents).toBe(0);
    expect(getVoicePresentationDiagnostics().trace.filter(event => event.ownership === owner).map(event => event.kind)).toEqual(['consume']);
  });
  it('submits the first eligible canonical at current time using the actual era rung, then retires only its exact token', () => {
    const owner = earlyOwner();
    expect(sayOrder(owner)).toBe(true);
    expect(fakes.utter.mock.calls[0][1]).toMatchObject({ startTime: 3, rung: 'alive', ownership: owner });
    retireVisibleVoiceLine({ ...owner });
    retireVisibleVoiceLine({ ...owner, restoreVersion: 1 });
    expect(fakes.retire).not.toHaveBeenCalled();
    retireVisibleVoiceLine(owner); retireVisibleVoiceLine(owner);
    expect(fakes.retire).toHaveBeenCalledExactlyOnceWith(owner);
    expect(sayOrder(owner)).toBe(false);
    expect(fakes.reset).not.toHaveBeenCalled();
    expect(getVoicePresentationDiagnostics().captionEvents).toBe(1);
  });
  it('consumes a busy first publication without queueing or releasing the existing slot reservation', () => {
    voiceVisibleText('peer', 'OTHER OWNER', 11, 'audit-band');
    const owner = earlyOwner();
    expect(sayOrder(owner)).toBe(false);
    expect(fakes.utter).toHaveBeenCalledOnce();
    fakes.audio!.currentTime = 10;
    expect(sayOrder(owner)).toBe(false);
    expect(sayOrder(earlyOwner())).toBe(true);
    expect(fakes.utter.mock.calls[1][1].startTime).toBe(10);
  });
  it('does not replay a consumed identity after restore, focus, mute/unlock or a same-ID target change', () => {
    const owner = earlyOwner(); fakes.muted = true;
    expect(sayOrder(owner)).toBe(false); fakes.muted = false;
    setVoicePresentationFocused(false); setVoicePresentationFocused(true);
    expect(sayOrder({ ...owner, restoreVersion: 1 })).toBe(false);
    expect(sayOrder({ ...owner })).toBe(false);
    expect(fakes.utter).not.toHaveBeenCalled();
    expect(sayOrder(earlyOwner(owner.publication, 2, 1))).toBe(true);
  });
  it.each(['suspended', 'closed'])('consumes unavailable %s audio without attempting utter or replay', state => {
    const owner = earlyOwner(); fakes.audio!.state = state;
    expect(sayOrder(owner)).toBe(false); fakes.audio!.state = 'running';
    expect(sayOrder(owner)).toBe(false); expect(fakes.utter).not.toHaveBeenCalled();
  });
  it('keeps independent slots and forces lean work orders onto the busy shared slot', () => {
    voiceVisibleText('peer', 'OTHER OWNER', 11, 'audit-band', { slot: 0 });
    expect(sayOrder(earlyOwner(), 1)).toBe(true);
    setVoicePresentationContext({ beat: 'ch3-signal', quality: 'lean' });
    expect(sayOrder(earlyOwner(), 1)).toBe(false);
    expect(fakes.utter.mock.calls.map(call => call[1].slot)).toEqual([0, 1]);
  });
  it('refuses bearing text or another surface under the early ownership exception', () => {
    const owner = earlyOwner();
    expect(voiceVisibleText(owner.lineId, 'WALK [D] TO DEBRIS.', 19, 'feed', { earlyWorkOrder: owner })).toBe(false);
    expect(voiceVisibleText(owner.lineId, owner.text, owner.text.length, 'audit-band', { earlyWorkOrder: owner })).toBe(false);
    expect(fakes.utter).not.toHaveBeenCalled();
  });
});
