import type { DomainEvent } from './events.ts';
import type { SimulationRng } from './rng.ts';
import type { WorldIdentity } from './worldIdentity.ts';

export type CommandRejectCode =
  | 'unknown_command'
  | 'invalid_actor'
  | 'invalid_world'
  | 'validation_failed'
  | 'conflict'
  | 'rate_limited'
  | 'stale'
  | 'replay'
  | 'internal_error';

export interface CommandEnvelope<TType extends string = string, TPayload = unknown> {
  commandId: string;
  type: TType;
  actorId: string;
  worldId: string;
  payload: TPayload;
  clientTimeMs?: number;
}

export interface CommandContext {
  actorId: string;
  world: WorldIdentity;
  rng: SimulationRng;
  now: () => number;
  state?: Record<string, unknown>;
  emit?: (event: DomainEvent) => void;
}

export interface CommandAccepted {
  ok: true;
  commandId: string;
  events: DomainEvent[];
  deltas?: unknown;
  rollback?: unknown;
}

export interface CommandRejected {
  ok: false;
  commandId: string;
  code: CommandRejectCode;
  reason: string;
}

export type CommandResult = CommandAccepted | CommandRejected;
export type CommandHandler<TPayload = unknown> = (
  command: CommandEnvelope<string, TPayload>,
  context: CommandContext
) => CommandResult;

export function commandAccepted(
  command: Pick<CommandEnvelope, 'commandId'>,
  events: DomainEvent[] = [],
  extras: Pick<CommandAccepted, 'deltas' | 'rollback'> = {}
): CommandAccepted {
  return {
    ok: true,
    commandId: command.commandId,
    events,
    ...extras
  };
}

export function commandRejected(
  command: Pick<CommandEnvelope, 'commandId'>,
  code: CommandRejectCode,
  reason: string
): CommandRejected {
  return {
    ok: false,
    commandId: command.commandId,
    code,
    reason
  };
}

export class CommandDispatcher {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly resultCache = new Map<string, CommandResult>();

  register<TPayload>(type: string, handler: CommandHandler<TPayload>): () => void {
    this.handlers.set(type, handler as CommandHandler);
    return () => {
      if (this.handlers.get(type) === handler) this.handlers.delete(type);
    };
  }

  dispatch(command: CommandEnvelope, context: CommandContext): CommandResult {
    const cached = this.resultCache.get(command.commandId);
    if (cached) return cached;

    if (command.actorId !== context.actorId) {
      return this.cache(command.commandId, commandRejected(command, 'invalid_actor', 'Command actor does not match context actor.'));
    }
    if (command.worldId !== context.world.worldId) {
      return this.cache(command.commandId, commandRejected(command, 'invalid_world', 'Command world does not match context world.'));
    }

    const handler = this.handlers.get(command.type);
    if (!handler) {
      return this.cache(command.commandId, commandRejected(command, 'unknown_command', `No handler registered for ${command.type}.`));
    }

    const result = handler(command, context);
    if (result.ok) {
      for (const event of result.events) context.emit?.(event);
    }
    return this.cache(command.commandId, result);
  }

  clearCache(): void {
    this.resultCache.clear();
  }

  private cache(commandId: string, result: CommandResult): CommandResult {
    this.resultCache.set(commandId, result);
    return result;
  }
}

const defaultDispatcher = new CommandDispatcher();

export function registerCommandHandler<TPayload>(type: string, handler: CommandHandler<TPayload>): () => void {
  return defaultDispatcher.register(type, handler);
}

export function dispatchCommand(command: CommandEnvelope, context: CommandContext): CommandResult {
  return defaultDispatcher.dispatch(command, context);
}
