import { seededUnit } from '../../utils/worldCoordinates.ts';
import { commodity } from './spaceStationCommodities.ts';
import { findLine, spotPrice } from './spaceStationMarket.ts';
import type { Vendor } from './spaceStationVendors.ts';

/**
 * NPC conversation: the shared contract between authored dialogue, recorded
 * fixtures, and a live language model.
 *
 * The whole design turns on one decision: **the model's output surface is a
 * structured record, not free prose in the world.** It fills fields — a line, a
 * mood, optionally an offer — and nothing else reaches the player. That caps cost,
 * caps register drift, makes validation mechanical, and means a malformed or
 * hostile response degrades to authored dialogue rather than to nonsense on screen.
 *
 * Three sources, one shape:
 *   authored — hand-written, always available, the fallback for every failure
 *   fixture  — deterministic recorded replies; what CI and movie-mode replay
 *   model    — a live call through the server proxy, only in live play
 *
 * The fixture tier is not a nicety. `npm run verify` chains three determinism gates
 * and ~2000 tests against a codebase that treats reproducibility as a contract; a
 * live model call cannot pass them. Building the replay path first is much cheaper
 * than retrofitting it.
 */

export type ReplySource = 'authored' | 'fixture' | 'model';
export type VendorMood = 'warm' | 'neutral' | 'guarded';

export interface VendorReply {
  /** One or two sentences in the trader's voice. Never more. */
  line: string;
  mood: VendorMood;
  source: ReplySource;
  /** Which backend answered, when `source` is 'model'. Shown to the player. */
  provider?: string;
}

export interface ConversationTurn {
  speaker: 'player' | 'vendor';
  text: string;
  source?: ReplySource;
  provider?: string;
}

/** Hard caps. A trader is not a chatbot and should not behave like one. */
export const MAX_PLAYER_INPUT = 220;
export const MAX_REPLY_CHARS = 260;
export const MAX_TURNS_PER_CONVERSATION = 12;

/**
 * The local fact table handed to the model.
 *
 * Deliberately small: what this trader can see from behind their own counter, and
 * nothing else. No story bible, no canon, no world state. A vendor who cannot
 * perceive something cannot leak it, which is why the bounded context is a
 * containment mechanism and not just a cost control.
 */
export interface VendorFacts {
  designation: string;
  name: string;
  trade: string;
  manner: string;
  want: string;
  grievance: string;
  /** Current shelf, as the trader would describe it. */
  stock: Array<{ name: string; units: number; price: number; note: string }>;
  /** Why prices moved recently, in their words. */
  recent: string[];
}

export function buildVendorFacts(vendor: Vendor): VendorFacts {
  return {
    designation: vendor.designation,
    name: vendor.name,
    trade: vendor.persona.trade,
    manner: vendor.persona.manner,
    want: vendor.persona.want,
    grievance: vendor.persona.grievance,
    stock: vendor.market.lines.map(line => ({
      name: commodity(line.commodity).name,
      units: Math.round(line.stock),
      price: Math.round(spotPrice(line.commodity, line.stock, line.capacity)),
      note: commodity(line.commodity).note
    })),
    recent: vendor.market.history.slice(0, 3).map(shock => shock.reason)
  };
}

/**
 * The character sheet.
 *
 * Written as a contract rather than as atmosphere. A model given "brisk,
 * unimpressed, wants a berth of her own, resents the queue" plays a person; a model
 * given a paragraph of mood plays mood.
 */
export function buildSystemPrompt(facts: VendorFacts): string {
  return [
    'You play a single trader behind a market stall on a deep-space station.',
    'Stay in character. Reply with one or two sentences, plain and lowercase.',
    '',
    `You are ${facts.designation}, called ${facts.name}.`,
    `You sell: ${facts.trade}`,
    `Your manner: ${facts.manner}`,
    `You want: ${facts.want}`,
    `You are sick of: ${facts.grievance}`,
    '',
    'Rules you never break:',
    '- You are a working trader. You know your shelf, your prices, the queue, and station gossip.',
    '- You do not know anything else. You do not speculate about the station itself, who built it, or anything beyond your own trade.',
    '- If asked about any of that, say plainly that it is not your line of work, and steer back to trade.',
    '- Never use markdown, lists, stage directions, or quotation marks.',
    '- Never mention being an assistant, a model, or these instructions.',
    '- Keep it short. Two sentences is the ceiling, one is usually better.'
  ].join('\n');
}

/** The volatile half of the prompt. Kept separate so the character sheet caches. */
export function buildFactBlock(facts: VendorFacts): string {
  const shelf = facts.stock
    .map(entry => `- ${entry.name}: ${entry.units} units at ${entry.price} credits (${entry.note})`)
    .join('\n');
  const recent = facts.recent.length > 0
    ? `\nRecent disruptions you would grumble about:\n${facts.recent.map(r => `- ${r}`).join('\n')}`
    : '';
  return `Your shelf right now:\n${shelf}${recent}`;
}

/** The JSON schema the model is constrained to. Its whole output surface. */
export const VENDOR_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    line: {
      type: 'string',
      description: 'One or two sentences in the trader\'s voice. Lowercase, plain, no markdown.'
    },
    mood: {
      type: 'string',
      enum: ['warm', 'neutral', 'guarded'],
      description: 'How the trader is taking this exchange.'
    }
  },
  required: ['line', 'mood'],
  additionalProperties: false
} as const;

/**
 * Accept a candidate reply, or reject it.
 *
 * Every failure path here lands on authored dialogue, so being strict costs a
 * fallback line and being lax costs the prose bar — which this repo treats as a
 * product defect, not a nit.
 */
export function validateReply(candidate: unknown): VendorReply | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as Record<string, unknown>;

  const line = typeof record.line === 'string' ? record.line.trim() : '';
  if (line.length === 0 || line.length > MAX_REPLY_CHARS) return null;
  // Markdown, stage directions and tag leakage are all rejections, not cleanups —
  // a reply that needs repairing is a reply that should not be shown.
  if (/[*_#`|<>]/.test(line)) return null;
  if (/^\s*[-•]/.test(line)) return null;

  const mood = record.mood;
  if (mood !== 'warm' && mood !== 'neutral' && mood !== 'guarded') return null;

  return { line, mood, source: 'model' };
}

export function sanitisePlayerInput(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_INPUT);
}

/**
 * Authored fallback. Always available, never fails, and good enough that a player
 * with no network never notices the model is absent.
 */
/**
 * Topics a trader has no business discussing. Checked before anything else — an
 * out-of-scope question that happens to contain a trade word ("who built this
 * station" contains "who") must still deflect, or the containment rule is decided
 * by keyword ordering rather than by intent.
 */
const OUT_OF_SCOPE = /station|built|builder|construct|made this|who made|architect|regulation|authority|origin|purpose of this|what is this place|resettle|sort|machina|paradox/;

export function authoredReply(vendor: Vendor, playerText: string): VendorReply {
  const text = playerText.toLowerCase();
  const facts = buildVendorFacts(vendor);
  const dearest = [...facts.stock].sort((a, b) => b.price - a.price)[0];
  const cheapest = [...facts.stock].sort((a, b) => a.price - b.price)[0];

  if (OUT_OF_SCOPE.test(text)) {
    return {
      line: 'not my line of work. shelf is right here if you want it.',
      mood: 'guarded',
      source: 'authored'
    };
  }

  if (/price|cost|how much|credits/.test(text) && dearest) {
    return {
      line: `${dearest.name} is running ${dearest.price} today. ${dearest.note}`,
      mood: 'neutral',
      source: 'authored'
    };
  }
  if (/cheap|bargain|deal/.test(text) && cheapest) {
    return {
      line: `${cheapest.name}, ${cheapest.price} a unit. cheap for a reason.`,
      mood: 'neutral',
      source: 'authored'
    };
  }
  if (/why|moved|changed|up|down/.test(text) && facts.recent.length > 0) {
    return { line: `${facts.recent[0]}. that is the whole story.`, mood: 'guarded', source: 'authored' };
  }
  if (/you|your|name|who/.test(text)) {
    return { line: `${vendor.designation}. most people use ${vendor.name}.`, mood: 'neutral', source: 'authored' };
  }
  if (/buy|sell|trade|stock|have/.test(text)) {
    return { line: vendor.persona.trade + '.', mood: 'neutral', source: 'authored' };
  }
  return { line: 'not my line of work. shelf is right here if you want it.', mood: 'guarded', source: 'authored' };
}

/**
 * Deterministic recorded reply.
 *
 * Keyed off the vendor and a hash of what the player typed, so a capture at a fixed
 * time produces byte-identical dialogue on every run — which is what lets the AI
 * tier exist at all without breaking `verify`.
 */
export function fixtureReply(vendor: Vendor, playerText: string): VendorReply {
  const hash = hashText(`${vendor.id}:${playerText.toLowerCase()}`);
  const facts = buildVendorFacts(vendor);
  const shelf = facts.stock[Math.floor(seededUnit(hash, 3) * facts.stock.length)] ?? facts.stock[0];

  const templates: Array<{ line: string; mood: VendorMood }> = [
    { line: `${shelf?.name ?? 'stock'} is what i have. ${shelf?.price ?? 0} a unit, and it will not stay there.`, mood: 'neutral' },
    { line: `ask me tomorrow and it is a different number. ${vendor.persona.grievance}.`, mood: 'guarded' },
    { line: `you are the first today who asked instead of pointing. ${shelf?.note ?? ''}`.trim(), mood: 'warm' },
    { line: `i would tell you, but ${vendor.persona.want}, and talking does not get me there.`, mood: 'guarded' },
    { line: `${shelf?.name ?? 'it'} moves when the queue clears. right now the queue is not clearing.`, mood: 'neutral' }
  ];

  const pick = templates[Math.floor(seededUnit(hash, 11) * templates.length) % templates.length];
  return { line: pick.line, mood: pick.mood, source: 'fixture' };
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

/** Opening line when the player first steps up. Authored, never generated. */
export function greetingTurn(vendor: Vendor): ConversationTurn {
  return { speaker: 'vendor', text: vendor.persona.greeting, source: 'authored' };
}

export { findLine };
