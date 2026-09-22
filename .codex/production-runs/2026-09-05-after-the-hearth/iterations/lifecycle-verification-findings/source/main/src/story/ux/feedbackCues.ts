import { playSfx } from '../../audio/sfxEngine.ts';
import { peekAudioContext } from '../../audio/audioCore.ts';
import { voiceTypewriterGapMs } from '../../audio/voice/voicePresentation.ts';

export type StoryUxFeedbackCue =
  | {
    type: 'objective-enter';
    objectiveId: string;
    action: 'travel' | 'interact' | 'craft' | 'build' | 'wait';
  }
  | { type: 'objective-progress' | 'objective-complete' | 'objective-fail' | 'marker-acquired'; objectiveId: string };

type StoryUxFeedbackListener = (cue: StoryUxFeedbackCue) => void;
const listeners = new Set<StoryUxFeedbackListener>();

export const EARLY_RECEIPT_ACK_MIN_MS = 120;
export const EARLY_RECEIPT_ACK_MAX_MS = 240;
export interface StoryUxPresentationContext {
  receiptId: string;
  expectedSuccessor: string | null;
  valid?: () => boolean;
}
interface PendingReceipt { cue: StoryUxFeedbackCue; context: StoryUxPresentationContext; at: number; timer: ReturnType<typeof setTimeout> }
let pending: PendingReceipt | null = null;
export const earlyFeedbackTrace: { objectiveId: string; receiptId?: string; at: number; outcome: string }[] = [];
const nowMs = () => typeof performance === 'undefined' ? Date.now() : performance.now();
function trace(cue: StoryUxFeedbackCue, outcome: string, context?: StoryUxPresentationContext): void {
  earlyFeedbackTrace.push({ objectiveId: cue.objectiveId, receiptId: context?.receiptId, at: nowMs(), outcome });
  if (earlyFeedbackTrace.length > 128) earlyFeedbackTrace.shift();
}
export function cancelPendingStoryUxFeedback(reason = 'canceled'): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  trace(pending.cue, reason, pending.context);
  pending = null;
}
/** Semantic delivery is immediate; early audio stays an unscheduled cancellable intent. */
export function emitStoryUxFeedbackCue(cue: StoryUxFeedbackCue, context?: StoryUxPresentationContext): void {
  for (const listener of listeners) listener(cue);
  const events = {
    'objective-enter': 'objectiveEnter', 'objective-progress': 'objectiveProgress',
    'objective-complete': 'objectiveComplete', 'objective-fail': 'objectiveFail', 'marker-acquired': 'markerAcquired'
  } as const;
  const early = /^ch1:(fixed|track|raster):/.test(cue.objectiveId);
  if (early && (cue.type === 'objective-progress' || cue.objectiveId === 'ch1:fixed:cross-camera-cell'
    || cue.objectiveId === 'ch1:track:tracking-transfer'
    || (cue.type === 'objective-enter' && context))) {
    trace(cue, 'coalesced-with-native', context);
    return;
  }
  if (early && cue.type === 'objective-complete') {
    if (!context) { trace(cue, 'unconfirmed-receipt'); return; }
    cancelPendingStoryUxFeedback('superseded');
    const audio = peekAudioContext();
    if (!audio || audio.state !== 'running') { trace(cue, 'audio-unavailable', context); return; }
    const at = nowMs();
    const attempt = () => {
      if (!pending || pending.context !== context) return;
      const elapsed = nowMs() - at;
      if (!context.valid?.() || (typeof document !== 'undefined' && document.hidden)) { cancelPendingStoryUxFeedback(); return; }
      if (elapsed > EARLY_RECEIPT_ACK_MAX_MS) { cancelPendingStoryUxFeedback('expired'); return; }
      const audioNow = peekAudioContext();
      if (!audioNow || audioNow.state !== 'running') { cancelPendingStoryUxFeedback('audio-unavailable'); return; }
      const gap = voiceTypewriterGapMs(nowMs());
      if (gap > 0) {
        if (elapsed + gap > EARLY_RECEIPT_ACK_MAX_MS) { cancelPendingStoryUxFeedback('expired'); return; }
        pending.timer = setTimeout(attempt, Math.max(1, gap));
        return;
      }
      pending = null;
      playSfx('objectiveComplete');
      trace(cue, 'played', context);
    };
    pending = { cue, context, at, timer: setTimeout(attempt, EARLY_RECEIPT_ACK_MIN_MS) };
    return;
  }
  const audio = peekAudioContext();
  const gapMs = voiceTypewriterGapMs(nowMs());
  if (audio && gapMs > 0) playSfx(events[cue.type], { atAudioTime: audio.currentTime + gapMs / 1000 });
  else playSfx(events[cue.type]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => cancelPendingStoryUxFeedback('focus-loss'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPendingStoryUxFeedback('hidden'); });
}
export function subscribeStoryUxFeedback(listener: StoryUxFeedbackListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
