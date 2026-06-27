export const MULTIPLAYER_PROTOCOL_VERSION = 1;

export type JsonObject = Record<string, unknown>;

export interface MultiplayerRoomPlayer {
  playerId: string;
  displayName?: string;
  connected: boolean;
  owner?: boolean;
}

export interface MultiplayerPartyWarpPlayerHandoff {
  playerId: string;
  spawnSlot: number;
  pose?: JsonObject;
}

export interface MultiplayerPartyWarpHandoff {
  fromWorldId: string;
  worldId: string;
  destination: { x: number; y: number };
  actorPlayerId: string;
  players: MultiplayerPartyWarpPlayerHandoff[];
  requestedAtMs: number;
}

export type MultiplayerClientMessage =
  | { type: 'auth'; protocolVersion: number; token: string }
  | { type: 'create_room'; startWorldId?: string }
  | { type: 'join_room'; inviteCode: string; resume?: MultiplayerWorldCursor }
  | { type: 'request_world_events'; worldId: string; sinceSeq: number }
  | { type: 'subscribe_world'; worldId: string; lastAppliedSeq: number }
  | { type: 'ack_world_events'; worldId: string; appliedSeq: number }
  | { type: 'command'; commandId: string; commandType: string; worldId: string; payload: JsonObject }
  | { type: 'predict_world_event'; commandId: string; worldId: string; event: JsonObject; rollback?: JsonObject }
  | { type: 'pose_update'; worldId: string; seq: number; pose: JsonObject }
  | { type: 'teleport_marker'; worldId: string; marker: JsonObject }
  | { type: 'ping'; nonce: string; clientTimeMs?: number };

export interface MultiplayerWorldCursor {
  worldId: string;
  lastAppliedSeq: number;
}

export type MultiplayerServerMessage =
  | { type: 'hello'; protocolVersion: number; serverTimeMs: number }
  | { type: 'auth_ok'; player: { playerId: string; displayName?: string }; serverTimeMs: number }
  | { type: 'room_created'; roomId: string; inviteCode: string; ownerPlayerId: string }
  | { type: 'room_joined'; roomId: string; inviteCode: string; playerId: string; worldId: string }
  | { type: 'room_roster'; roomId: string; players: MultiplayerRoomPlayer[] }
  | { type: 'world_snapshot'; roomId: string; worldId: string; seq: number; snapshot: JsonObject }
  | { type: 'snapshot_chunk'; roomId: string; worldId: string; seq: number; index: number; total: number; chunk: JsonObject }
  | { type: 'party_warp'; roomId: string; worldId: string; seq: number; handoff: MultiplayerPartyWarpHandoff }
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

export type MultiplayerSocketStatus = 'connecting' | 'authenticating' | 'ready' | 'closed' | 'error';

export interface MultiplayerConnection {
  createRoom(startWorldId: string): void;
  joinRoom(inviteCode: string, resume?: MultiplayerWorldCursor): void;
  send(message: MultiplayerClientMessage): void;
  close(): void;
}

export interface MultiplayerConnectionOptions {
  serverUrl: string;
  token: string;
  onStatus?: (status: MultiplayerSocketStatus) => void;
  onMessage?: (message: MultiplayerServerMessage) => void;
  onError?: (message: string) => void;
  WebSocketImpl?: typeof WebSocket;
}

export function toWebSocketUrl(serverUrl: string): string {
  const input = serverUrl.trim();
  if (!input) throw new Error('State server URL is empty.');
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `${isLocalHost(input) ? 'http' : 'https'}://${input}`;
  const url = new URL(withProtocol);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error(`Unsupported state server protocol: ${url.protocol}`);
  }
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/play';
  return url.toString();
}

export function createMultiplayerConnection(options: MultiplayerConnectionOptions): MultiplayerConnection {
  const SocketImpl = options.WebSocketImpl ?? WebSocket;
  const socket = new SocketImpl(toWebSocketUrl(options.serverUrl));
  let authenticated = false;
  const pendingAfterAuth: MultiplayerClientMessage[] = [];

  const sendNow = (message: MultiplayerClientMessage) => {
    socket.send(JSON.stringify(message));
  };

  socket.onopen = () => {
    options.onStatus?.('authenticating');
    sendNow({ type: 'auth', protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, token: options.token });
  };

  socket.onmessage = event => {
    const message = parseServerMessage(event.data);
    if (!message) {
      options.onError?.('Received an invalid multiplayer message.');
      return;
    }
    if (message.type === 'auth_ok') {
      authenticated = true;
      options.onStatus?.('ready');
      for (const queued of pendingAfterAuth.splice(0)) sendNow(queued);
    } else if (message.type === 'error') {
      options.onError?.(message.message);
    }
    options.onMessage?.(message);
  };

  socket.onerror = () => {
    options.onStatus?.('error');
    options.onError?.('Multiplayer socket failed.');
  };

  socket.onclose = () => {
    options.onStatus?.('closed');
  };

  options.onStatus?.('connecting');

  const send = (message: MultiplayerClientMessage) => {
    if (message.type === 'auth' || authenticated) {
      sendNow(message);
      return;
    }
    pendingAfterAuth.push(message);
  };

  return {
    createRoom(startWorldId: string) {
      send({ type: 'create_room', startWorldId });
    },
    joinRoom(inviteCode: string, resume?: MultiplayerWorldCursor) {
      send({ type: 'join_room', inviteCode: inviteCode.trim().toUpperCase(), ...(resume ? { resume } : {}) });
    },
    send,
    close() {
      socket.close(1000, 'client_closed');
    }
  };
}

function parseServerMessage(data: unknown): MultiplayerServerMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data);
    return isMultiplayerServerMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isMultiplayerServerMessage(value: unknown): value is MultiplayerServerMessage {
  if (!isObject(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'hello':
      return value.protocolVersion === MULTIPLAYER_PROTOCOL_VERSION && typeof value.serverTimeMs === 'number';
    case 'auth_ok':
      return isPlayerIdentity(value.player) && typeof value.serverTimeMs === 'number';
    case 'room_created':
      return typeof value.roomId === 'string'
        && typeof value.inviteCode === 'string'
        && typeof value.ownerPlayerId === 'string';
    case 'room_joined':
      return typeof value.roomId === 'string'
        && typeof value.inviteCode === 'string'
        && typeof value.playerId === 'string'
        && typeof value.worldId === 'string';
    case 'room_roster':
      return typeof value.roomId === 'string'
        && Array.isArray(value.players)
        && value.players.every(isRoomRosterPlayer);
    case 'world_snapshot':
      return typeof value.roomId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && isObject(value.snapshot);
    case 'snapshot_chunk':
      return typeof value.roomId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && Number.isInteger(value.index)
        && Number.isInteger(value.total)
        && isObject(value.chunk);
    case 'party_warp':
      return typeof value.roomId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && isPartyWarpHandoff(value.handoff);
    case 'world_event':
      return typeof value.roomId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && 'event' in value;
    case 'predicted_world_event':
      return typeof value.roomId === 'string'
        && typeof value.worldId === 'string'
        && typeof value.commandId === 'string'
        && 'event' in value;
    case 'command_accepted':
      return typeof value.commandId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && Array.isArray(value.events);
    case 'command_rejected':
      return typeof value.commandId === 'string'
        && typeof value.code === 'string'
        && typeof value.reason === 'string';
    case 'prediction_rollback':
      return typeof value.commandId === 'string' && 'rollback' in value;
    case 'pose_update':
      return typeof value.playerId === 'string'
        && typeof value.worldId === 'string'
        && Number.isInteger(value.seq)
        && isObject(value.pose);
    case 'teleport_marker':
      return typeof value.playerId === 'string'
        && typeof value.worldId === 'string'
        && isObject(value.marker);
    case 'pong':
      return typeof value.nonce === 'string'
        && typeof value.serverTimeMs === 'number'
        && optionalNumber(value.clientTimeMs);
    case 'error':
      return typeof value.code === 'string' && typeof value.message === 'string';
    case 'disconnect':
      return typeof value.code === 'string' && typeof value.reason === 'string';
    default:
      return false;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlayerIdentity(value: unknown): value is { playerId: string; displayName?: string } {
  return isObject(value)
    && typeof value.playerId === 'string'
    && optionalString(value.displayName);
}

function isRoomRosterPlayer(value: unknown): value is MultiplayerRoomPlayer {
  return isObject(value)
    && typeof value.playerId === 'string'
    && optionalString(value.displayName)
    && typeof value.connected === 'boolean'
    && (value.owner === undefined || typeof value.owner === 'boolean');
}

function isPartyWarpHandoff(value: unknown): value is MultiplayerPartyWarpHandoff {
  return isObject(value)
    && typeof value.fromWorldId === 'string'
    && typeof value.worldId === 'string'
    && isObject(value.destination)
    && typeof value.destination.x === 'number'
    && typeof value.destination.y === 'number'
    && typeof value.actorPlayerId === 'string'
    && Array.isArray(value.players)
    && value.players.every(isPartyWarpPlayerHandoff)
    && typeof value.requestedAtMs === 'number';
}

function isPartyWarpPlayerHandoff(value: unknown): value is MultiplayerPartyWarpPlayerHandoff {
  return isObject(value)
    && typeof value.playerId === 'string'
    && Number.isInteger(value.spawnSlot)
    && (value.pose === undefined || isObject(value.pose));
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function isLocalHost(value: string): boolean {
  return value.startsWith('localhost') || value.startsWith('127.0.0.1') || value.startsWith('[::1]');
}
