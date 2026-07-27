import OpenAI from 'openai';
import type { NpcProvider, ProviderRequest, ProviderResult } from './providerTypes.js';

/**
 * OpenAI-backed NPC replies.
 *
 * Uses Chat Completions with a strict `json_schema` response format, so the model
 * is constrained to the same two-field record every other provider must produce.
 * Strict mode means the shape is guaranteed rather than merely requested — the
 * downstream validator then enforces the prose bar, which no schema can.
 *
 * The model id is an environment variable on purpose. Model names churn faster
 * than this file will be revisited, and picking one at build time is how a service
 * ends up pinned to something deprecated.
 */

/**
 * Matches the default the sibling TerraForm runtime already runs
 * (`apps/preview-api/server.mjs`), so both services in this workspace speak to the
 * same model unless one is deliberately overridden. Override with OPENAI_MODEL.
 */
const DEFAULT_MODEL = 'gpt-4.1-mini';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI();
  return client;
}

export const openaiProvider: NpcProvider = {
  id: 'openai',

  available(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  async reply(request: ProviderRequest): Promise<ProviderResult> {
    const openai = getClient();
    if (!openai) return { ok: false, reason: 'upstream-error' };

    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

    try {
      const completion = await openai.chat.completions.create(
        {
          model,
          // A market trader's one-line answer does not need headroom. Capping
          // here is the cheapest possible guard against a runaway reply.
          max_tokens: 200,
          messages: [
            { role: 'system', content: request.systemPrompt },
            // The volatile shelf goes after the system prompt so the stable half
            // stays identical across every exchange with this trader.
            { role: 'user', content: request.factBlock },
            ...request.turns.map(turn => ({
              role: turn.speaker === 'player' ? ('user' as const) : ('assistant' as const),
              content: turn.text
            }))
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'vendor_reply',
              strict: true,
              schema: request.schema
            }
          }
        },
        { timeout: request.timeoutMs }
      );

      const choice = completion.choices[0];

      // A content filter stop is the provider declining, not a transport failure —
      // worth distinguishing so the two are separable in logs.
      if (choice?.finish_reason === 'content_filter') {
        return { ok: false, reason: 'refused' };
      }

      const text = choice?.message?.content;
      if (typeof text !== 'string' || text.length === 0) {
        return { ok: false, reason: 'upstream-error' };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, reason: 'malformed' };
      }

      return {
        ok: true,
        reply: parsed,
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
          cacheRead: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0
        }
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429 || (error.status ?? 0) >= 500) {
          return { ok: false, reason: 'upstream-error' };
        }
        return { ok: false, reason: 'upstream-error' };
      }
      if (error instanceof Error && /timeout|aborted/i.test(error.message)) {
        return { ok: false, reason: 'timeout' };
      }
      return { ok: false, reason: 'upstream-error' };
    }
  }
};
