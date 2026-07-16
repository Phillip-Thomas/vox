import { commandAccepted, type CommandContext } from './commands.ts';
import { createDomainEvent } from './events.ts';
import type { JsonObject } from './multiplayerClient.ts';
import { resolveMultiplayerCommandLane } from './commandDispatchAdapter.ts';
import { sendMultiplayerAuthoritativeCommand } from './multiplayerSession.ts';

export type StoryAuthorityDispatchLane = 'offline' | 'pending' | 'blocked';

export interface StoryAuthorityCommand {
  commandId: string;
  commandType: string;
  payload: JsonObject;
}

/**
 * Story objects have richer local transactions than ordinary economy commands.
 * In co-op we therefore do not mutate first and attempt a large rollback: the
 * server owns the commit, inventory/progression arrive in its delta, and the
 * shared physical fact arrives through the world-event stream. Offline keeps
 * the existing synchronous transaction unchanged.
 */
export function dispatchStoryAuthorityCommand(
  context: CommandContext,
  command: StoryAuthorityCommand
): StoryAuthorityDispatchLane {
  const lane = resolveMultiplayerCommandLane();
  if (lane !== 'online') return lane;

  const event = createDomainEvent({
    eventId: `${command.commandId}:intent`,
    worldId: context.world.worldId,
    actorId: context.actorId,
    timeMs: context.now(),
    type: command.commandType,
    payload: command.payload
  });
  const intent = commandAccepted({ commandId: command.commandId }, [event]);
  return sendMultiplayerAuthoritativeCommand(
    intent,
    command.commandType,
    command.payload
  ) ? 'pending' : 'blocked';
}
