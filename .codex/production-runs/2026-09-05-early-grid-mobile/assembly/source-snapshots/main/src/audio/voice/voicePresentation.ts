import type { StoryBeat } from '../../story/storyState.ts';
import { peekAudioContext } from '../audioCore.ts';
import { getAudioSettingsSnapshot } from '../audioSettings.ts';
import { getMusicPrimitives } from '../musicPrimitives.ts';
import { resolveEraGates } from '../generative/worldSignals.ts';
import { isVoiceSilent, resolveVoiceRung, type VoiceSilenceContext, type VoiceSurfaceId } from './voiceGrammar.ts';
import { utter, resetVoiceBus } from './voiceBus.ts';

interface VoiceContext extends VoiceSilenceContext { stage?: Parameters<typeof resolveEraGates>[1]; quality?: 'full' | 'lean'; carrierSemitone?: number }
let context: VoiceContext = {};
const lines = new Map<string, { visible: number; text: string; acknowledged: boolean }>();
let lastGlyphAtMs = -Infinity;
let captionEvents = 0;
const slotFreeAt = [0, 0];

export function setVoicePresentationContext(next: VoiceContext): void {
  if (context.beat !== next.beat) { lines.clear(); resetVoiceBus(); slotFreeAt.fill(0); }
  else if (!isVoiceSilent(context) && isVoiceSilent(next)) suspendVoicePresentation();
  context = next;
}
/** Stop pending grains while preserving which visible characters were read. */
export function suspendVoicePresentation(): void { resetVoiceBus(); slotFreeAt.fill(0); lastGlyphAtMs = -Infinity; }
export function voiceTypewriterGapMs(nowMs: number): number { return Math.max(0, Math.min(120, lastGlyphAtMs + 22 - nowMs)); }
export function getVoicePresentationDiagnostics(): { captionEvents: number; trackedLines: number; beat: StoryBeat | null } { return { captionEvents, trackedLines: lines.size, beat: context.beat ?? null }; }

/** The visible line is its own caption. Each newly painted character is voiced once. */
export function voiceVisibleText(lineId: string, text: string, visibleCharacters: number, surfaceId: VoiceSurfaceId, options: { slot?: number; speakerId?: string; carrierSemitone?: number } = {}): boolean {
  const key = `${surfaceId}:${lineId}`;
  const current = lines.get(key);
  const previous = current?.text === text ? current.visible : 0;
  const visible = Math.max(0, Math.min(text.length, Math.floor(visibleCharacters)));
  if (visible <= previous) return false;
  const state = { visible, text, acknowledged: current?.text === text ? current.acknowledged : false };
  lines.set(key, state);
  while (lines.size > 128) lines.delete(lines.keys().next().value!);
  // A late unlock never replays already-read text. No context is constructed here.
  const settings = getAudioSettingsSnapshot();
  if (!peekAudioContext() || settings.muted || settings.sfxVolume === 0 || (typeof document !== 'undefined' && document.hidden)) return false;
  const audio = peekAudioContext()!;
  const slot = context.quality === 'lean' ? 0 : Math.max(0, Math.min(1, options.slot ?? 0));
  const wholeLine = previous === 0 && visible === text.length;
  const startTime = wholeLine ? Math.max(audio.currentTime, slotFreeAt[slot]) : audio.currentTime;
  const result = utter(text, { surfaceId, register: 'institutional', rung: resolveVoiceRung(resolveEraGates(getMusicPrimitives().era, context.stage ?? 'alive')),
    silence: context, quality: context.quality, slot: options.slot, speakerId: options.speakerId,
    startTime, carrierSemitone: options.carrierSemitone ?? context.carrierSemitone, characterRange: [previous, visible] });
  if (result.spoken && result.grainsScheduled > 0) {
    lastGlyphAtMs = typeof performance === 'undefined' ? 0 : performance.now();
    slotFreeAt[slot] = startTime + (result.plan?.durationSeconds ?? 0);
    if (!state.acknowledged) { state.acknowledged = true; captionEvents++; }
    return true;
  }
  return false;
}

export function resetVoicePresentation(): void { lines.clear(); captionEvents = 0; lastGlyphAtMs = -Infinity; slotFreeAt.fill(0); resetVoiceBus(); }
