import { commandRejected, type CommandAccepted, type CommandResult } from './commands.ts';
import type { JsonObject } from './multiplayerClient.ts';
import { applyRejectedCommandRollback } from './multiplayerReconciliation.ts';
import {
  getMultiplayerSessionSnapshot,
  sendMultiplayerAuthoritativeCommand,
  sendMultiplayerPredictedEvents,
  type MultiplayerSessionStatus
} from './multiplayerSession.ts';
import { getLocalActorId } from './playerActors.ts';

export type MultiplayerCommandLane = 'offline' | 'online' | 'blocked';

export interface MultiplayerCommandIntent {
  commandType?: string;
  payload?: JsonObject | ((result: CommandAccepted) => JsonObject | null);
  predict?: boolean;
}

export interface GameplayCommandDispatchOptions {
  multiplayer?: MultiplayerCommandIntent | false;
}

export interface GameplayCommandTransport {
  lane(): MultiplayerCommandLane;
  sendCommand(result: CommandAccepted, commandType: string, payload: JsonObject): boolean;
  sendPrediction(result: CommandAccepted): number;
  rollback(result: CommandAccepted): void;
}

let blockedCommandCounter = 0;

export function dispatchGameplayCommand(
  runLocalCommand: () => CommandResult,
  options: GameplayCommandDispatchOptions = {}
): CommandResult {
  return dispatchGameplayCommandWithTransport(runLocalCommand, options, liveMultiplayerCommandTransport);
}

export function dispatchGameplayCommandWithTransport(
  runLocalCommand: () => CommandResult,
  options: GameplayCommandDispatchOptions,
  transport: GameplayCommandTransport
): CommandResult {
  const lane = transport.lane();
  if (lane === 'blocked') {
    blockedCommandCounter++;
    return commandRejected(
      { commandId: `multiplayer_blocked_${blockedCommandCounter.toString(36)}` },
      'stale',
      'Co-op command blocked until the state server connection is ready.'
    );
  }

  const result = runLocalCommand();
  if (!result.ok || lane !== 'online' || options.multiplayer === false) return result;

  const intent = resolveMultiplayerCommandIntent(result, options.multiplayer ?? {});
  if (!intent) return result;

  if (options.multiplayer?.predict) transport.sendPrediction(result);
  if (transport.sendCommand(result, intent.commandType, intent.payload)) return result;

  transport.rollback(result);
  return commandRejected(result, 'stale', 'Co-op command could not reach the state server.');
}

export function resolveMultiplayerCommandIntent(
  result: CommandAccepted,
  intent: MultiplayerCommandIntent
): { commandType: string; payload: JsonObject } | null {
  const firstEvent = result.events[0];
  const commandType = intent.commandType ?? firstEvent?.type;
  if (!commandType) return null;

  const payload = typeof intent.payload === 'function'
    ? intent.payload(result)
    : intent.payload ?? toJsonObject(firstEvent?.payload);
  if (!payload) return null;
  return { commandType, payload };
}

export function resolveMultiplayerCommandLane(): MultiplayerCommandLane {
  const session = getMultiplayerSessionSnapshot();
  if (session.status === 'connected' && session.worldId) return 'online';
  if (session.roomId || isCoopSessionInFlight(session.status)) return 'blocked';
  return 'offline';
}

const liveMultiplayerCommandTransport: GameplayCommandTransport = {
  lane: resolveMultiplayerCommandLane,
  sendCommand: (result, commandType, payload) => sendMultiplayerAuthoritativeCommand(result, commandType, payload),
  sendPrediction: result => sendMultiplayerPredictedEvents(result),
  rollback: result => {
    applyRejectedCommandRollback(result.rollback, {
      actorId: result.events[0]?.actorId ?? getMultiplayerSessionSnapshot().playerId ?? getLocalActorId(),
      rejectCode: 'stale'
    });
  }
};

function isCoopSessionInFlight(status: MultiplayerSessionStatus): boolean {
  return status === 'ready'
    || status === 'signing_in'
    || status === 'connecting'
    || status === 'authenticating'
    || status === 'creating'
    || status === 'joining'
    || status === 'reconnecting';
}

function toJsonObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}
