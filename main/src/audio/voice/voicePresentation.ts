import type { StoryBeat } from '../../story/storyState.ts';
import { peekAudioContext } from '../audioCore.ts';
import { getAudioSettingsSnapshot } from '../audioSettings.ts';
import { getMusicPrimitives } from '../musicPrimitives.ts';
import { resolveEraGates } from '../generative/worldSignals.ts';
import { isVoiceSilent, resolveVoiceRung, type VoiceSilenceContext, type VoiceSurfaceId } from './voiceGrammar.ts';
import { utter, resetVoiceBus, getVoiceBusDiagnostics, retireOwnedUtterance, type VoiceUtteranceOwnership } from './voiceBus.ts';

interface VoiceContext extends VoiceSilenceContext { stage?: Parameters<typeof resolveEraGates>[1]; quality?: 'full' | 'lean'; carrierSemitone?: number }
let context: VoiceContext = {};
const lines = new Map<string, { visible: number; text: string; acknowledged: boolean }>();
let lastGlyphAtMs = -Infinity;
let captionEvents = 0;
const slotFreeAt = [0, 0];
let presentationFocused = true;
export function setVoicePresentationFocused(focused: boolean): void {
  if (presentationFocused && !focused) suspendVoicePresentation('focus-loss');
  presentationFocused = focused;
}
interface VoicePresentationEvent {
  kind: 'submit' | 'cancel' | 'consume' | 'retire'; lineId: string | null; surfaceId: string | null;
  atPerfMs: number; contextTime: number | null; scheduledAt: number | null;
  slot: number | null; characters: readonly [number, number] | null;
  grains: number; reason: string | null; ownership?: VoiceUtteranceOwnership; automationWrites?: number; publicationId?: number;
}
const presentationTrace: VoicePresentationEvent[] = [];
const publicationIds = new WeakMap<object, number>();
let publicationSequence = 0;
function traceVoice(event: Omit<VoicePresentationEvent, 'atPerfMs' | 'contextTime'>): void {
  let publicationId: number | undefined;
  if (event.ownership) {
    publicationId = publicationIds.get(event.ownership.publication);
    if (publicationId === undefined) { publicationId = ++publicationSequence; publicationIds.set(event.ownership.publication, publicationId); }
  }
  presentationTrace.push({ ...event, publicationId, atPerfMs: typeof performance === 'undefined' ? Date.now() : performance.now(), contextTime: peekAudioContext()?.currentTime ?? null });
  if (presentationTrace.length > 256) presentationTrace.shift();
}

export function setVoicePresentationContext(next: VoiceContext): void {
  if (context.beat !== next.beat) { lines.clear(); suspendVoicePresentation('beat-change'); }
  else if (!isVoiceSilent(context) && isVoiceSilent(next)) suspendVoicePresentation('silent-context');
  context = next;
}
/** Stop pending grains while preserving which visible characters were read. */
export function suspendVoicePresentation(reason = 'suspend'): void {
  traceVoice({ kind: 'cancel', lineId: null, surfaceId: null, scheduledAt: null, slot: null, characters: null, grains: 0, reason });
  resetVoiceBus(); slotFreeAt.fill(0); lastGlyphAtMs = -Infinity;
}
export function voiceTypewriterGapMs(nowMs: number): number { return Math.max(0, Math.min(120, lastGlyphAtMs + 22 - nowMs)); }
export function getVoicePresentationDiagnostics() {
  return { captionEvents, trackedLines: lines.size, beat: context.beat as StoryBeat | null ?? null,
    trace: presentationTrace, bus: getVoiceBusDiagnostics(),
    note: 'Submission/source scheduling times; actual paint and acoustic onsets require captured runtime evidence.' };
}

const earlyObjectiveIds = new Set(['ch1:fixed:recover-first-debris', 'ch1:fixed:calibrate-extractor', 'ch1:raster:recover-quota', 'ch1:raster:extract-fiber-quota']);
interface OwnedLineState { owner: VoiceUtteranceOwnership; submitted: boolean; retired: boolean }
let ownedLines = new WeakMap<object, Map<string, OwnedLineState>>();
function ownedKey(owner: VoiceUtteranceOwnership): string { return `${owner.runVersion}:${owner.surfaceId}:${owner.lineId}:${owner.text}`; }
function validEarlyOwner(owner: VoiceUtteranceOwnership, lineId = owner.lineId, text = owner.text, surfaceId: string = owner.surfaceId): boolean {
  return surfaceId === 'feed' && owner.surfaceId === surfaceId && owner.lineId === lineId && owner.text === text
    && earlyObjectiveIds.has(lineId.replace(/^order:/, '').replace(/:0$/, ''))
    && (text === 'WALK OVER THE DEBRIS TO RECOVER IT.' || text === 'HOLD [E] TO HARVEST BIOFIBER.');
}
function rememberOwnedLine(owner: VoiceUtteranceOwnership): OwnedLineState | null {
  let publications = ownedLines.get(owner.publication);
  if (!publications) { publications = new Map(); ownedLines.set(owner.publication, publications); }
  const key = ownedKey(owner);
  if (publications.has(key)) return null;
  const state = { owner, submitted: false, retired: false };
  publications.set(key, state);
  return state;
}
/** Consumes a publication, without claiming painted characters or touching audio counters. */
export function consumeVoiceLineSilently(owner: VoiceUtteranceOwnership, reason = 'ineligible-first-presentation'): void {
  if (!validEarlyOwner(owner) || !rememberOwnedLine(owner)) return;
  traceVoice({ kind: 'consume', lineId: owner.lineId, surfaceId: owner.surfaceId, ownership: owner,
    scheduledAt: null, slot: null, characters: null, grains: 0, reason });
}
/** Stale text, run, restore or publication tokens cannot retire a successor. */
export function retireVisibleVoiceLine(owner: VoiceUtteranceOwnership): void {
  const state = ownedLines.get(owner.publication)?.get(ownedKey(owner));
  if (!state || state.owner !== owner || !state.submitted || state.retired) return;
  state.retired = true;
  const result = retireOwnedUtterance(owner);
  traceVoice({ kind: 'retire', lineId: owner.lineId, surfaceId: owner.surfaceId, ownership: owner,
    scheduledAt: null, slot: null, characters: null, grains: result.grains,
    automationWrites: result.automationWrites, reason: 'owned-visible-eligibility-lost' });
}

/** The visible line is its own caption. Each newly painted character is voiced once. */
export function voiceVisibleText(lineId: string, text: string, visibleCharacters: number, surfaceId: VoiceSurfaceId, options: { slot?: number; speakerId?: string; carrierSemitone?: number; earlyWorkOrder?: VoiceUtteranceOwnership } = {}): boolean {
  const owner = options.earlyWorkOrder;
  if (owner) {
    if (!validEarlyOwner(owner, lineId, text, surfaceId)) return false;
    const owned = rememberOwnedLine(owner);
    if (!owned) return false;
    const audio = peekAudioContext(), settings = getAudioSettingsSnapshot();
    const slot = context.quality === 'lean' ? 0 : Math.max(0, Math.min(1, options.slot ?? 0));
    const eligible = visibleCharacters === text.length && !!context.beat && !isVoiceSilent(context)
      && presentationFocused && !!audio && audio.state === 'running' && !settings.muted && settings.sfxVolume > 0
      && !(typeof document !== 'undefined' && document.hidden) && slotFreeAt[slot] <= audio.currentTime;
    if (!eligible || !audio) {
      traceVoice({ kind: 'consume', lineId, surfaceId, ownership: owner, scheduledAt: null, slot,
        characters: null, grains: 0, reason: 'first-presentation-unavailable-or-slot-busy' });
      return false;
    }
    const result = utter(text, { surfaceId, register: 'institutional',
      rung: resolveVoiceRung(resolveEraGates(getMusicPrimitives().era, context.stage ?? 'alive')),
      silence: context, quality: context.quality, slot: options.slot, speakerId: options.speakerId,
      startTime: audio.currentTime, carrierSemitone: options.carrierSemitone ?? context.carrierSemitone,
      characterRange: [0, text.length], ownership: owner });
    owned.submitted = result.spoken && result.grainsScheduled > 0;
    traceVoice({ kind: 'submit', lineId, surfaceId, ownership: owner, scheduledAt: owned.submitted ? audio.currentTime : null,
      slot, characters: [0, text.length], grains: result.grainsScheduled, reason: result.reason });
    if (owned.submitted) {
      lastGlyphAtMs = typeof performance === 'undefined' ? 0 : performance.now();
      slotFreeAt[slot] = audio.currentTime + (result.plan?.durationSeconds ?? 0);
      captionEvents++;
    }
    return owned.submitted;
  }
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
  if (!context.beat || !presentationFocused || !peekAudioContext() || settings.muted || settings.sfxVolume === 0 || (typeof document !== 'undefined' && document.hidden)) {
    traceVoice({ kind: 'submit', lineId, surfaceId, scheduledAt: null, slot: null, characters: [previous, visible], grains: 0, reason: 'inactive-or-unavailable' });
    return false;
  }
  const audio = peekAudioContext()!;
  const slot = context.quality === 'lean' ? 0 : Math.max(0, Math.min(1, options.slot ?? 0));
  const wholeLine = previous === 0 && visible === text.length;
  const startTime = wholeLine ? Math.max(audio.currentTime, slotFreeAt[slot]) : audio.currentTime;
  const result = utter(text, { surfaceId, register: 'institutional', rung: resolveVoiceRung(resolveEraGates(getMusicPrimitives().era, context.stage ?? 'alive')),
    silence: context, quality: context.quality, slot: options.slot, speakerId: options.speakerId,
    startTime, carrierSemitone: options.carrierSemitone ?? context.carrierSemitone, characterRange: [previous, visible] });
  traceVoice({ kind: 'submit', lineId, surfaceId, scheduledAt: result.spoken ? startTime : null, slot, characters: [previous, visible], grains: result.grainsScheduled, reason: result.reason });
  if (result.spoken && result.grainsScheduled > 0) {
    lastGlyphAtMs = typeof performance === 'undefined' ? 0 : performance.now();
    slotFreeAt[slot] = startTime + (result.plan?.durationSeconds ?? 0);
    if (!state.acknowledged) { state.acknowledged = true; captionEvents++; }
    return true;
  }
  return false;
}

export function resetVoicePresentation(): void { ownedLines = new WeakMap(); lines.clear(); captionEvents = 0; suspendVoicePresentation('reset'); }
