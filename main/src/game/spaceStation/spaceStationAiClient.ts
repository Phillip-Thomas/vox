import {
  authoredReply,
  buildFactBlock,
  buildSystemPrompt,
  buildVendorFacts,
  fixtureReply,
  validateReply,
  type ConversationTurn,
  type VendorReply
} from './spaceStationConversation.ts';
import {
  ensureAnonymousPlayerSession,
  getMultiplayerStateServerUrl
} from '../multiplayerAuth.ts';
import type { Vendor } from './spaceStationVendors.ts';

/**
 * Which source answers the player.
 *
 * `fixture` is the default deliberately. It needs no key, no network and no server,
 * it is deterministic so `verify` and movie-mode replay stay green, and it means the
 * feature is playable the moment someone opens the sandbox. `live` is opt-in.
 */
export type AiMode = 'off' | 'fixture' | 'live';

const RAW_MODE = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('ai')
  : null;

export function aiMode(): AiMode {
  if (RAW_MODE === 'live') return 'live';
  if (RAW_MODE === 'off') return 'off';
  return 'fixture';
}

/**
 * Where the proxy lives, and how we authenticate to it.
 *
 * Both come from the multiplayer session helpers rather than being re-derived
 * here. The state-server URL already has one reader (`VITE_PARAVOXIA_STATE_SERVER_URL`
 * — note the `_URL` suffix), and the session helper already handles the local-dev
 * path where `VITE_PARAVOXIA_LOCAL_AUTH=1` pairs with the server's
 * `PARAVOXIA_AUTH_DISABLED` to issue a hashed local id instead of a Firebase token.
 * Rolling a second copy of either is how the two drift apart.
 */
function endpoint(): string | null {
  const base = getMultiplayerStateServerUrl();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/v1/npc/converse`;
}

export interface ConversationCost {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  fallbacks: number;
}

const cost: ConversationCost = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  fallbacks: 0
};

/** Read by the sandbox HUD. Spend has to be visible while it is still small. */
export function conversationCost(): ConversationCost {
  return { ...cost };
}

/** Stable per-tab id so a dev server sees one identity across a play session. */
function sandboxIdentity(): string {
  const key = 'paravoxia.spaceStationSandboxId';
  try {
    const existing = globalThis.sessionStorage?.getItem(key);
    if (existing) return existing;
    const created = Math.random().toString(36).slice(2, 10);
    globalThis.sessionStorage?.setItem(key, created);
    return created;
  } catch {
    return 'anonymous';
  }
}

/**
 * Per-session ceiling. Reached, every later exchange falls back to authored
 * dialogue rather than continuing to spend.
 */
const MAX_LIVE_CALLS_PER_SESSION = 60;

/**
 * Ask a vendor something.
 *
 * Never throws and never returns nothing: every failure path — mode off, no key,
 * network error, timeout, refusal, malformed output, budget exhausted — lands on
 * authored dialogue. The feature degrades to a working game, not a broken one.
 */
export async function askVendor(
  vendor: Vendor,
  turns: ConversationTurn[],
  playerText: string
): Promise<VendorReply> {
  const mode = aiMode();
  if (mode === 'off') return authoredReply(vendor, playerText);
  if (mode === 'fixture') return fixtureReply(vendor, playerText);

  if (cost.calls >= MAX_LIVE_CALLS_PER_SESSION) {
    cost.fallbacks++;
    return authoredReply(vendor, playerText);
  }

  const url = endpoint();
  if (!url) {
    // No state server configured — there is nothing to call, so do not pretend.
    cost.fallbacks++;
    return authoredReply(vendor, playerText);
  }

  const facts = buildVendorFacts(vendor);
  try {
    cost.calls++;
    // The proxy sits behind the same bearer auth as every other /v1 route. An
    // unauthenticated model proxy is an open relay billed to whoever owns the key.
    //
    // The sandbox is not co-op, so the multiplayer session helper returns null when
    // co-op is off. In that case fall back to a sandbox identity, which only
    // authenticates against a server started with PARAVOXIA_AUTH_DISABLED — a real
    // server rejects it with 401 and the caller lands on authored dialogue. The
    // bypass therefore only functions where the operator has explicitly allowed it.
    const session = await ensureAnonymousPlayerSession();
    const bearer = session?.idToken ?? `spaceStation-sandbox-${sandboxIdentity()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`
      },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(facts),
        factBlock: buildFactBlock(facts),
        turns: [...turns, { speaker: 'player', text: playerText }].map(turn => ({
          speaker: turn.speaker,
          text: turn.text
        }))
      })
    });

    if (!response.ok) {
      cost.fallbacks++;
      return authoredReply(vendor, playerText);
    }

    const payload = await response.json();
    if (payload?.usage) {
      cost.inputTokens += payload.usage.input ?? 0;
      cost.outputTokens += payload.usage.output ?? 0;
      cost.cacheReadTokens += payload.usage.cacheRead ?? 0;
    }

    // Validated client-side as well as server-side. The server checks the request
    // shape; this checks the prose bar, which is the thing that actually reaches
    // a player's eyes.
    const validated = payload?.ok ? validateReply(payload.reply) : null;
    if (!validated) {
      cost.fallbacks++;
      return authoredReply(vendor, playerText);
    }
    return { ...validated, provider: typeof payload.provider === 'string' ? payload.provider : 'model' };
  } catch {
    cost.fallbacks++;
    return authoredReply(vendor, playerText);
  }
}
