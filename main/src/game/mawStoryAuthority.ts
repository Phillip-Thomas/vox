import type { CommandContext } from './commands.ts';
import { ECONOMY_CATALOG } from './data/generatedEconomyCatalog.ts';
import {
  dispatchStoryAuthorityCommand,
  type StoryAuthorityCommand,
  type StoryAuthorityDispatchLane
} from './storyAuthorityDispatch.ts';
import { resolveMultiplayerCommandLane } from './commandDispatchAdapter.ts';
import { isMultiplayerAuthoritativeCommandUnsettled } from './multiplayerSession.ts';

export type AuthoritativeMawFirstDirectionChoice = 'lowered-and-listened' | 'harmless-test';

export const MAW_STORY_AUTHORITY_COMMAND_TYPES = Object.freeze({
  firstDirection: 'maw_first_direction_resolved',
  pondObservationBegin: 'maw_pond_observation_begun',
  pondResonance: 'maw_pond_resonance_observed'
} as const);

const POND_COMPLETION_GRACE_MS = 100;
const POND_RETRY_COOLDOWN_MS = 1_000;

interface PondAuthorityRuntime {
  observationBeginCommandId: string;
  beginSentAtMs: number;
  completionSentAtMs: number | null;
  completionTimer: ReturnType<typeof setTimeout> | null;
}

const pondAuthorityRuntimes = new Map<string, PondAuthorityRuntime>();

export function mawFirstDirectionAuthorityCommand(
  commandIdInput: string,
  choice: AuthoritativeMawFirstDirectionChoice
): StoryAuthorityCommand | null {
  const commandId = commandIdInput.trim();
  if (!commandId) return null;
  return {
    commandId,
    commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.firstDirection,
    payload: { choice }
  };
}

export function mawPondObservationBeginAuthorityCommand(
  commandIdInput: string
): StoryAuthorityCommand | null {
  const commandId = commandIdInput.trim();
  if (!commandId) return null;
  return {
    commandId,
    commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.pondObservationBegin,
    payload: {}
  };
}

export function mawPondResonanceAuthorityCommand(
  commandIdInput: string,
  observationBeginCommandIdInput: string
): StoryAuthorityCommand | null {
  const commandId = commandIdInput.trim();
  const observationBeginCommandId = observationBeginCommandIdInput.trim();
  if (!commandId || !observationBeginCommandId) return null;
  return {
    commandId,
    commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.pondResonance,
    payload: { observationBeginCommandId }
  };
}

export function dispatchMawFirstDirectionAuthority(
  context: CommandContext,
  commandId: string,
  choice: AuthoritativeMawFirstDirectionChoice
): StoryAuthorityDispatchLane {
  if (isMultiplayerAuthoritativeCommandUnsettled(commandId, context.world.worldId)) {
    return 'pending';
  }
  const command = mawFirstDirectionAuthorityCommand(commandId, choice);
  return command ? dispatchStoryAuthorityCommand(context, command) : 'blocked';
}

export function dispatchMawPondObservationBeginAuthority(
  context: CommandContext,
  commandId: string
): StoryAuthorityDispatchLane {
  const command = mawPondObservationBeginAuthorityCommand(commandId);
  return command ? dispatchStoryAuthorityCommand(context, command) : 'blocked';
}

export function dispatchMawPondResonanceAuthority(
  context: CommandContext,
  commandId: string,
  observationBeginCommandId: string
): StoryAuthorityDispatchLane {
  const command = mawPondResonanceAuthorityCommand(commandId, observationBeginCommandId);
  return command ? dispatchStoryAuthorityCommand(context, command) : 'blocked';
}

function pondAuthorityRuntimeKey(context: CommandContext, commandId: string): string {
  return `${context.actorId}\u0000${context.world.worldId}\u0000${commandId}`;
}

/** Auto-started by the physical pond scene once dry-shore proximity and mounted
 * response meshes are true. A stable runtime prevents per-frame WS duplicates. */
export function dispatchMawPondObservationBeginOnceAuthority(
  context: CommandContext,
  commandIdInput: string
): StoryAuthorityDispatchLane {
  const commandId = commandIdInput.trim();
  if (!commandId) return 'blocked';
  const lane = resolveMultiplayerCommandLane();
  if (lane !== 'online') return lane;
  const runtimeKey = pondAuthorityRuntimeKey(context, commandId);
  if (pondAuthorityRuntimes.has(runtimeKey)) return 'pending';

  const observationBeginCommandId = `${commandId}:observation-begun`;
  const beginLane = dispatchMawPondObservationBeginAuthority(context, observationBeginCommandId);
  if (beginLane === 'pending') {
    pondAuthorityRuntimes.set(runtimeKey, {
      observationBeginCommandId,
      beginSentAtMs: Date.now(),
      completionSentAtMs: null,
      completionTimer: null
    });
  }
  return beginLane;
}

/**
 * One physical Attend input starts the server-stamped observation and schedules
 * its completion intent. The server, not this timer, decides whether enough
 * time and a fresh authenticated pose exist. Stable ids make every retry safe.
 */
export function dispatchMawPondResonanceTransactionAuthority(
  context: CommandContext,
  commandIdInput: string
): StoryAuthorityDispatchLane {
  const commandId = commandIdInput.trim();
  if (!commandId) return 'blocked';
  const lane = resolveMultiplayerCommandLane();
  if (lane !== 'online') return lane;
  const runtimeKey = pondAuthorityRuntimeKey(context, commandId);
  let runtime = pondAuthorityRuntimes.get(runtimeKey);
  if (!runtime) {
    const beginLane = dispatchMawPondObservationBeginOnceAuthority(context, commandId);
    if (beginLane !== 'pending') return beginLane;
    runtime = pondAuthorityRuntimes.get(runtimeKey);
    if (!runtime) return 'blocked';
  }

  const now = Date.now();
  if (runtime.completionSentAtMs !== null) {
    if (isMultiplayerAuthoritativeCommandUnsettled(commandId, context.world.worldId)
      || now - runtime.completionSentAtMs < POND_RETRY_COOLDOWN_MS) return 'pending';
    // The prior completion settled without the replicated milestone. Re-prime
    // the stable begin receipt (idempotent if it was accepted) before retrying.
    const retryBegin = dispatchMawPondObservationBeginAuthority(
      context,
      runtime.observationBeginCommandId
    );
    if (retryBegin !== 'pending') return retryBegin;
    runtime.beginSentAtMs = now;
    runtime.completionSentAtMs = null;
  }

  const minimumMs = ECONOMY_CATALOG.storyTransactions.mawRepair.pondObservationSeconds * 1000;
  const remainingMs = Math.max(
    0,
    runtime.beginSentAtMs + minimumMs + POND_COMPLETION_GRACE_MS - now
  );
  if (remainingMs > 0) {
    if (!runtime.completionTimer) {
      runtime.completionTimer = setTimeout(() => {
        runtime!.completionTimer = null;
        const completionLane = dispatchMawPondResonanceAuthority(
          context,
          commandId,
          runtime!.observationBeginCommandId
        );
        if (completionLane === 'pending') runtime!.completionSentAtMs = Date.now();
      }, remainingMs);
    }
    return 'pending';
  }

  const completionLane = dispatchMawPondResonanceAuthority(
    context,
    commandId,
    runtime.observationBeginCommandId
  );
  if (completionLane === 'pending') runtime.completionSentAtMs = now;
  return completionLane;
}

export function resetMawPondAuthorityTransactions(): void {
  for (const runtime of pondAuthorityRuntimes.values()) {
    if (runtime.completionTimer) clearTimeout(runtime.completionTimer);
  }
  pondAuthorityRuntimes.clear();
}
