import { openaiProvider } from './npc/openaiProvider.js';
import type { NpcProvider, ProviderTurn } from './npc/providerTypes.js';

/**
 * NPC conversation proxy.
 *
 * The client never talks to a model provider. API keys are server-side environment
 * variables and must never be `VITE_*` — those are public by definition and would
 * ship the key to every player.
 *
 * The endpoint is deliberately narrow: it accepts a character sheet, a bounded fact
 * table and a short conversation, and returns a structured record. It does not
 * accept a free-form system prompt from an arbitrary caller, because an endpoint
 * that forwards whatever prompt it is handed is a general-purpose model proxy
 * wearing a game's clothes.
 *
 * Provider selection is config, not code. `NPC_PROVIDER` names one explicitly;
 * otherwise the first available provider wins.
 */

const MAX_TURNS = 12;
const MAX_PROMPT_CHARS = 4_000;
const MAX_TURN_CHARS = 400;
/** Longest a player waits at a counter before we give up and let them fall back. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Registered providers, in preference order when none is named. */
const PROVIDERS: NpcProvider[] = [openaiProvider];

/** The two-field record every provider is constrained to. */
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    line: { type: 'string' },
    mood: { type: 'string', enum: ['warm', 'neutral', 'guarded'] }
  },
  required: ['line', 'mood'],
  additionalProperties: false
} as const;

export interface NpcConverseRequest {
  systemPrompt: string;
  factBlock: string;
  turns: ProviderTurn[];
}

export interface NpcConverseResult {
  ok: boolean;
  reply?: unknown;
  reason?: 'disabled' | 'invalid-request' | 'refused' | 'upstream-error' | 'timeout' | 'malformed';
  /** Which provider answered. Surfaced so "is this real inference" is checkable. */
  provider?: string;
  usage?: { input: number; output: number; cacheRead: number };
}

export function selectProvider(): NpcProvider | null {
  const named = process.env.NPC_PROVIDER;
  if (named) {
    const match = PROVIDERS.find(provider => provider.id === named);
    return match?.available() ? match : null;
  }
  return PROVIDERS.find(provider => provider.available()) ?? null;
}

export function npcConversationEnabled(): boolean {
  return selectProvider() !== null;
}

export function validRequest(body: unknown): body is NpcConverseRequest {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  if (typeof record.systemPrompt !== 'string' || record.systemPrompt.length > MAX_PROMPT_CHARS) {
    return false;
  }
  if (typeof record.factBlock !== 'string' || record.factBlock.length > MAX_PROMPT_CHARS) {
    return false;
  }
  if (!Array.isArray(record.turns) || record.turns.length === 0 || record.turns.length > MAX_TURNS) {
    return false;
  }
  return record.turns.every(turn => {
    if (typeof turn !== 'object' || turn === null) return false;
    const entry = turn as Record<string, unknown>;
    return (
      (entry.speaker === 'player' || entry.speaker === 'vendor') &&
      typeof entry.text === 'string' &&
      entry.text.length > 0 &&
      entry.text.length <= MAX_TURN_CHARS
    );
  });
}

export async function handleNpcConverse(body: unknown): Promise<NpcConverseResult> {
  const provider = selectProvider();
  if (!provider) return { ok: false, reason: 'disabled' };
  if (!validRequest(body)) return { ok: false, reason: 'invalid-request', provider: provider.id };

  const result = await provider.reply({
    systemPrompt: body.systemPrompt,
    factBlock: body.factBlock,
    turns: body.turns,
    schema: REPLY_SCHEMA as unknown as Record<string, unknown>,
    timeoutMs: REQUEST_TIMEOUT_MS
  });

  return { ...result, provider: provider.id };
}
