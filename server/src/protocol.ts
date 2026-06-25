export const PROTOCOL_VERSION = 1;

export type JsonObject = Record<string, unknown>;

export interface PlayerIdentity {
  playerId: string;
  displayName?: string;
}

export interface ClientAuthMessage {
  type: 'auth';
  protocolVersion: number;
  token: string;
}

export interface ClientCreateRoomMessage {
  type: 'create_room';
  startWorldId?: string;
}

export interface ClientJoinRoomMessage {
  type: 'join_room';
  inviteCode: string;
  resume?: ClientWorldCursor;
}

export interface ClientCommandMessage {
  type: 'command';
  commandId: string;
  commandType: string;
  worldId: string;
  payload: JsonObject;
}

export interface ClientPredictWorldEventMessage {
  type: 'predict_world_event';
  commandId: string;
  worldId: string;
  event: JsonObject;
  rollback?: JsonObject;
}

export interface ClientRequestWorldEventsMessage {
  type: 'request_world_events';
  worldId: string;
  sinceSeq: number;
}

export interface ClientSubscribeWorldMessage {
  type: 'subscribe_world';
  worldId: string;
  lastAppliedSeq: number;
}

export interface ClientAckWorldEventsMessage {
  type: 'ack_world_events';
  worldId: string;
  appliedSeq: number;
}

export interface ClientWorldCursor {
  worldId: string;
  lastAppliedSeq: number;
}

export interface ClientPoseMessage {
  type: 'pose_update';
  worldId: string;
  seq: number;
  pose: JsonObject;
}

export interface ClientTeleportMarkerMessage {
  type: 'teleport_marker';
  worldId: string;
  marker: JsonObject;
}

export interface ClientPingMessage {
  type: 'ping';
  nonce: string;
  clientTimeMs?: number;
}

export type ClientMessage =
  | ClientAuthMessage
  | ClientCreateRoomMessage
  | ClientJoinRoomMessage
  | ClientRequestWorldEventsMessage
  | ClientSubscribeWorldMessage
  | ClientAckWorldEventsMessage
  | ClientCommandMessage
  | ClientPredictWorldEventMessage
  | ClientPoseMessage
  | ClientTeleportMarkerMessage
  | ClientPingMessage;

export type ServerMessage =
  | { type: 'hello'; protocolVersion: number; serverTimeMs: number }
  | { type: 'auth_ok'; player: PlayerIdentity; serverTimeMs: number }
  | { type: 'room_created'; roomId: string; inviteCode: string; ownerPlayerId: string }
  | { type: 'room_joined'; roomId: string; inviteCode: string; playerId: string; worldId: string }
  | { type: 'world_snapshot'; roomId: string; worldId: string; seq: number; snapshot: JsonObject }
  | { type: 'snapshot_chunk'; roomId: string; worldId: string; seq: number; index: number; total: number; chunk: JsonObject }
  | { type: 'world_event'; roomId: string; worldId: string; seq: number; event: unknown }
  | { type: 'predicted_world_event'; roomId: string; worldId: string; commandId: string; event: unknown }
  | { type: 'command_accepted'; commandId: string; worldId: string; seq: number; events: unknown[]; deltas?: unknown }
  | { type: 'command_rejected'; commandId: string; code: string; reason: string }
  | { type: 'prediction_rollback'; commandId: string; rollback: unknown }
  | { type: 'pose_update'; playerId: string; worldId: string; seq: number; pose: JsonObject }
  | { type: 'teleport_marker'; playerId: string; worldId: string; marker: JsonObject }
  | { type: 'pong'; nonce: string; serverTimeMs: number; clientTimeMs?: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'disconnect'; code: string; reason: string };

export function parseClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isClientMessage(parsed) ? parsed : null;
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isObject(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'auth':
      return value.protocolVersion === PROTOCOL_VERSION && typeof value.token === 'string';
    case 'create_room':
      return optionalString(value.startWorldId);
    case 'join_room':
      return typeof value.inviteCode === 'string'
        && value.inviteCode.length > 0
        && optionalWorldCursor(value.resume);
    case 'request_world_events':
      return typeof value.worldId === 'string'
        && Number.isInteger(value.sinceSeq)
        && typeof value.sinceSeq === 'number'
        && value.sinceSeq >= 0;
    case 'subscribe_world':
      return typeof value.worldId === 'string'
        && Number.isInteger(value.lastAppliedSeq)
        && typeof value.lastAppliedSeq === 'number'
        && value.lastAppliedSeq >= 0;
    case 'ack_world_events':
      return typeof value.worldId === 'string'
        && Number.isInteger(value.appliedSeq)
        && typeof value.appliedSeq === 'number'
        && value.appliedSeq >= 0;
    case 'command':
      return typeof value.commandId === 'string'
        && typeof value.commandType === 'string'
        && typeof value.worldId === 'string'
        && isObject(value.payload);
    case 'predict_world_event':
      return typeof value.commandId === 'string'
        && typeof value.worldId === 'string'
        && isObject(value.event)
        && (value.rollback === undefined || isObject(value.rollback));
    case 'pose_update':
      return typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && isObject(value.pose);
    case 'teleport_marker':
      return typeof value.worldId === 'string' && isObject(value.marker);
    case 'ping':
      return typeof value.nonce === 'string' && optionalNumber(value.clientTimeMs);
    default:
      return false;
  }
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function optionalWorldCursor(value: unknown): boolean {
  if (value === undefined) return true;
  return isObject(value)
    && typeof value.worldId === 'string'
    && Number.isInteger(value.lastAppliedSeq)
    && typeof value.lastAppliedSeq === 'number'
    && value.lastAppliedSeq >= 0;
}
