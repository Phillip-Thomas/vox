/**
 * The NPC inference provider contract.
 *
 * The handler owns request validation, the response schema, cost accounting and
 * the fallback decision. A provider owns exactly one thing: turn a character
 * sheet plus a short conversation into a JSON object matching the schema. That
 * split is why swapping Anthropic for OpenAI — or for anything else — is a file,
 * not a rewrite, and why a provider can never widen what reaches the player.
 */

export interface ProviderTurn {
  speaker: 'player' | 'vendor';
  text: string;
}

export interface ProviderRequest {
  /** Stable character sheet. Providers that support caching should cache this. */
  systemPrompt: string;
  /** Volatile shelf and recent events. Never cached — it changes every exchange. */
  factBlock: string;
  turns: ProviderTurn[];
  /** JSON schema the reply must satisfy. The provider's entire output surface. */
  schema: Record<string, unknown>;
  /** Abort budget in milliseconds. A player is standing at a counter waiting. */
  timeoutMs: number;
}

export type ProviderFailure =
  /** Provider declined on policy grounds. */
  | 'refused'
  /** Network, rate limit, 5xx, or anything else the provider reported. */
  | 'upstream-error'
  | 'timeout'
  /** Returned something that was not parseable JSON. */
  | 'malformed';

export interface ProviderResult {
  ok: boolean;
  /** Parsed object when ok. Still validated again downstream. */
  reply?: unknown;
  reason?: ProviderFailure;
  usage?: { input: number; output: number; cacheRead: number };
}

export interface NpcProvider {
  /** Stable id, surfaced in logs and in the sandbox HUD. */
  readonly id: string;
  /** False when the provider has no credentials or is otherwise unusable. */
  available(): boolean;
  reply(request: ProviderRequest): Promise<ProviderResult>;
}
