import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerConfig } from './config.js';
import type { TokenVerifier } from './auth.js';
import { createDatabase, type Database } from './neon.js';
import {
  isClaimedSharedMutationType,
  sharedMutationClaimForCommand,
  sharedMutationValidationError
} from './commandAuthority.js';
import {
  CommandConflictError,
  CommandInventoryError,
  CommandReplayMismatchError,
  MultiplayerPersistence
} from './persistence.js';
import {
  inventoryCreditsForAcceptedCommand,
  resolveServerAuthoritativeCommand
} from './economyAuthority.js';
import {
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseClientMessage,
  type ClientMessage,
  type PlayerIdentity,
  type ServerMessage
} from './protocol.js';
import {
  InMemoryRoomStore,
  applyPlayerInventoryDelta,
  canDebitPlayerInventory,
  createWorldSnapshot,
  type CommandFingerprint,
  type PlayerSession,
  type RoomState,
  type ShardEvent
} from './rooms.js';

export interface StateServerOptions {
  config: ServerConfig;
  tokenVerifier: TokenVerifier;
  rooms?: InMemoryRoomStore;
  database?: Database;
  persistence?: MultiplayerPersistence;
}

interface SocketState {
  player: PlayerIdentity | null;
  room: RoomState | null;
  session: PlayerSession | null;
}

const COMMAND_RATE_WINDOW_MS = 1000;
const MAX_COMMANDS_PER_WINDOW = 40;
const MAX_COMMANDS_PER_TYPE_PER_WINDOW = 20;
const PAYLOAD_ACTOR_FIELDS = ['actorId', 'playerId'];

export function createStateServer({
  config,
  tokenVerifier,
  rooms = new InMemoryRoomStore(),
  database = createDatabase(config),
  persistence = new MultiplayerPersistence(database)
}: StateServerOptions) {
  const socketsBySessionId = new Map<string, WebSocket>();

  const httpServer = createServer(async (req, res) => {
    try {
      await routeHttp(req, res, config, tokenVerifier, rooms, database, persistence);
    } catch (error) {
      sendJson(res, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown server error.'
      });
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/play') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', ws => {
    const state: SocketState = { player: null, room: null, session: null };
    send(ws, { type: 'hello', protocolVersion: PROTOCOL_VERSION, serverTimeMs: Date.now() });

    ws.on('message', data => {
      void handleSocketMessage(ws, state, data.toString(), tokenVerifier, rooms, socketsBySessionId, persistence)
        .catch(error => {
          send(ws, {
            type: 'error',
            code: 'internal_error',
            message: error instanceof Error ? error.message : 'Unknown server error.'
          });
        });
    });

    ws.on('close', () => {
      if (state.session) {
        socketsBySessionId.delete(state.session.sessionId);
        rooms.removeSession(state.session.sessionId);
      }
    });
  });

  return {
    httpServer,
    rooms,
    database,
    persistence,
    close: () => new Promise<void>(resolve => {
      wss.close(() => {
        httpServer.close(() => resolve());
      });
    })
  };
}

async function routeHttp(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
  tokenVerifier: TokenVerifier,
  rooms: InMemoryRoomStore,
  database: Database,
  persistence: MultiplayerPersistence
): Promise<void> {
  setCors(req, res, config);
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(res, 200, { ok: true, service: 'paravoxia-state-server', serverTimeMs: Date.now() });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/readyz') {
    sendJson(res, 200, { ok: true, databaseConfigured: database.configured });
    return;
  }

  if (url.pathname.startsWith('/v1/')) {
    const player = await authenticateHttp(req, tokenVerifier);
    if (!player) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Missing or invalid bearer token.' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/rooms') {
      const body = await readJsonBody(req);
      const startWorldId = typeof body.startWorldId === 'string' ? body.startWorldId : '0,0';
      const room = rooms.createRoom(player, startWorldId);
      await persistence.persistRoom(room);
      sendJson(res, 201, rooms.summarize(room));
      return;
    }

    const joinMatch = url.pathname.match(/^\/v1\/rooms\/([^/]+)\/join$/);
    if (req.method === 'POST' && joinMatch) {
      const room = await joinRoomByInvite(rooms, persistence, decodeURIComponent(joinMatch[1] ?? ''), player);
      if (!room) {
        sendJson(res, 404, { error: 'room_not_found', message: 'Invite code was not found.' });
        return;
      }
      sendJson(res, 200, rooms.summarize(room));
      return;
    }

    const roomMatch = url.pathname.match(/^\/v1\/rooms\/([^/]+)$/);
    if (req.method === 'GET' && roomMatch) {
      const room = rooms.getRoom(decodeURIComponent(roomMatch[1] ?? ''));
      if (!room) {
        sendJson(res, 404, { error: 'room_not_found', message: 'Room was not found.' });
        return;
      }
      sendJson(res, 200, rooms.summarize(room));
      return;
    }
  }

  sendJson(res, 404, { error: 'not_found', message: 'Route not found.' });
}

async function handleSocketMessage(
  ws: WebSocket,
  state: SocketState,
  raw: string,
  tokenVerifier: TokenVerifier,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence
): Promise<void> {
  const message = parseClientMessage(raw);
  if (!message) {
    send(ws, { type: 'error', code: 'invalid_message', message: 'Message failed protocol validation.' });
    return;
  }

  if (!state.player && message.type !== 'auth') {
    send(ws, { type: 'error', code: 'auth_required', message: 'Authenticate before sending gameplay messages.' });
    return;
  }

  switch (message.type) {
    case 'auth':
      await handleAuth(ws, state, message.token, tokenVerifier);
      return;
    case 'create_room':
      await handleCreateRoom(ws, state, rooms, socketsBySessionId, persistence, message.startWorldId ?? '0,0');
      return;
    case 'join_room':
      await handleJoinRoom(ws, state, rooms, socketsBySessionId, persistence, message);
      return;
    case 'request_world_events':
      await handleRequestWorldEvents(ws, state, rooms, persistence, message.worldId, message.sinceSeq);
      return;
    case 'subscribe_world':
      await handleRequestWorldEvents(ws, state, rooms, persistence, message.worldId, message.lastAppliedSeq);
      return;
    case 'ack_world_events':
      handleAckWorldEvents(ws, state, message.worldId, message.appliedSeq);
      return;
    case 'command':
      await handleCommand(ws, state, rooms, socketsBySessionId, persistence, message);
      return;
    case 'pose_update':
      handlePose(ws, state, rooms, socketsBySessionId, message);
      return;
    case 'teleport_marker':
      broadcastRoom(state, socketsBySessionId, {
        type: 'teleport_marker',
        playerId: state.player!.playerId,
        worldId: message.worldId,
        marker: message.marker
      });
      return;
    case 'ping':
      send(ws, { type: 'pong', nonce: message.nonce, serverTimeMs: Date.now(), clientTimeMs: message.clientTimeMs });
      return;
  }
}

async function handleAuth(ws: WebSocket, state: SocketState, token: string, tokenVerifier: TokenVerifier): Promise<void> {
  try {
    state.player = await tokenVerifier.verifyIdToken(token);
    send(ws, { type: 'auth_ok', player: state.player, serverTimeMs: Date.now() });
  } catch {
    send(ws, { type: 'error', code: 'auth_failed', message: 'Firebase ID token verification failed.' });
    ws.close(1008, 'auth_failed');
  }
}

async function handleCreateRoom(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence,
  startWorldId: string
): Promise<void> {
  const room = rooms.createRoom(state.player!, startWorldId);
  await persistence.persistRoom(room);
  attachSession(ws, state, room, rooms, socketsBySessionId);
  send(ws, { type: 'room_created', roomId: room.roomId, inviteCode: room.inviteCode, ownerPlayerId: room.ownerPlayerId });
  await sendRoomJoined(ws, state, rooms, persistence, startWorldId);
}

async function handleJoinRoom(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence,
  message: Extract<ClientMessage, { type: 'join_room' }>
): Promise<void> {
  const room = await joinRoomByInvite(rooms, persistence, message.inviteCode, state.player!);
  if (!room) {
    send(ws, { type: 'error', code: 'room_not_found', message: 'Invite code was not found.' });
    return;
  }
  attachSession(ws, state, room, rooms, socketsBySessionId);
  if (message.resume) {
    state.session?.appliedSeqByWorld.set(message.resume.worldId, message.resume.lastAppliedSeq);
    await sendRoomResume(ws, state, rooms, persistence, message.resume.worldId, message.resume.lastAppliedSeq);
    return;
  }
  await sendRoomJoined(ws, state, rooms, persistence, firstWorldId(room));
}

async function handleCommand(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence,
  message: Extract<ClientMessage, { type: 'command' }>
): Promise<void> {
  if (!state.room) {
    rejectCommand(ws, state, message, 'not_in_room', 'Join a room before sending commands.');
    return;
  }
  if (!state.session) {
    rejectCommand(ws, state, message, 'not_in_room', 'Join a room before sending commands.');
    return;
  }
  if (!state.room.shards.has(message.worldId)) {
    rejectCommand(ws, state, message, 'invalid_world', 'Command world is not active in this room.');
    return;
  }
  const envelopeError = validateCommandEnvelope(state, message);
  if (envelopeError) {
    rejectCommand(ws, state, message, envelopeError.code, envelopeError.reason);
    return;
  }
  const authoritativeResolution = resolveServerAuthoritativeCommand(message.commandType, message.payload);
  if (authoritativeResolution && 'code' in authoritativeResolution) {
    rejectCommand(ws, state, message, authoritativeResolution.code, authoritativeResolution.reason);
    return;
  }
  const commandPayload = authoritativeResolution?.commandPayload ?? message.payload;
  if (!authoritativeResolution) {
    const mutationValidationError = sharedMutationValidationError(message.commandType, message.payload);
    if (mutationValidationError) {
      rejectCommand(ws, state, message, 'validation_failed', mutationValidationError);
      return;
    }
  }
  const shard = rooms.getOrCreateShard(state.room, message.worldId);
  const fingerprint = fingerprintCommand(state.player!, message, commandPayload);
  const cached = shard.commandCache.get(message.commandId);
  if (cached) {
    if (sameCommandFingerprint(cached.fingerprint, fingerprint)) {
      send(ws, cached.response as ServerMessage);
    } else {
      rejectCommand(ws, state, message, 'replay', 'Command id was already used for a different command.');
    }
    return;
  }
  const rateLimitReason = consumeCommandRateLimit(state.session, message.commandType);
  if (rateLimitReason) {
    rejectCommand(ws, state, message, 'rate_limited', rateLimitReason);
    return;
  }
  if (authoritativeResolution) {
    if (!persistence.configured) {
      if (!canDebitPlayerInventory(state.room, state.player!.playerId, authoritativeResolution.debit)) {
        rejectCommand(ws, state, message, 'validation_failed', 'Insufficient authoritative inventory for command.');
        return;
      }
      if (authoritativeResolution.campfireClaim) {
        const key = `campfire:${authoritativeResolution.campfireClaim.campfireId}`;
        const existingCommandId = shard.mutationClaims.get(key);
        if (existingCommandId && existingCommandId !== message.commandId) {
          rejectCommand(ws, state, message, 'conflict', 'Campfire placement target was already claimed by another command.');
          return;
        }
        shard.mutationClaims.set(key, message.commandId);
      }
    }

    let events: ShardEvent[];
    try {
      if (persistence.configured) {
        events = await persistence.appendAuthoritativeCommandEvents({
          room: state.room,
          worldId: message.worldId,
          actor: state.player!,
          commandId: message.commandId,
          commandType: message.commandType,
          resolution: authoritativeResolution
        });
      } else {
        applyPlayerInventoryDelta(state.room, state.player!.playerId, {
          debit: authoritativeResolution.debit,
          credit: authoritativeResolution.credit
        });
        events = rooms.appendShardEvents(
          state.room,
          message.worldId,
          state.player!.playerId,
          message.commandId,
          authoritativeResolution.events
        );
      }
    } catch (error) {
      if (error instanceof CommandReplayMismatchError) {
        rejectCommand(ws, state, message, 'replay', 'Command id was already used for a different command.');
      } else if (error instanceof CommandConflictError) {
        rejectCommand(ws, state, message, 'conflict', 'World mutation target was already claimed by another command.');
      } else if (error instanceof CommandInventoryError) {
        rejectCommand(ws, state, message, 'validation_failed', 'Insufficient authoritative inventory for command.');
      } else {
        rejectCommand(ws, state, message, 'persistence_failed', error instanceof Error ? error.message : 'Could not persist command.');
      }
      return;
    }

    rooms.appendKnownShardEvents(state.room, message.worldId, events);
    const accepted = acceptedCommandResponse(message, events);
    shard.commandCache.set(message.commandId, { fingerprint, response: accepted });
    send(ws, accepted);
    broadcastWorldEvents(state, socketsBySessionId, message.worldId, events);
    return;
  }
  const memoryClaimKey = !persistence.configured
    ? sharedMutationClaimForCommand(message.commandType, message.payload)?.key
    : null;
  if (memoryClaimKey) {
    const existingCommandId = shard.mutationClaims.get(memoryClaimKey);
    if (existingCommandId && existingCommandId !== message.commandId) {
      rejectCommand(ws, state, message, 'conflict', 'World mutation target was already claimed by another command.');
      return;
    }
    shard.mutationClaims.set(memoryClaimKey, message.commandId);
  }
  let event: ShardEvent;
  try {
    event = persistence.configured
      ? await persistence.appendCommandEvent({
        room: state.room,
        worldId: message.worldId,
        actor: state.player!,
        commandId: message.commandId,
        commandType: message.commandType,
        payload: message.payload
      })
      : rooms.appendShardEvent(state.room, message.worldId, state.player!.playerId, message.commandType, message.payload, message.commandId);
  } catch (error) {
    if (error instanceof CommandReplayMismatchError) {
      rejectCommand(ws, state, message, 'replay', 'Command id was already used for a different command.');
    } else if (error instanceof CommandConflictError) {
      rejectCommand(ws, state, message, 'conflict', 'World mutation target was already claimed by another command.');
    } else {
      rejectCommand(ws, state, message, 'persistence_failed', error instanceof Error ? error.message : 'Could not persist command.');
    }
    return;
  }
  if (!persistence.configured) {
    applyPlayerInventoryDelta(state.room, state.player!.playerId, {
      credit: inventoryCreditsForAcceptedCommand(message.commandType, message.payload)
    });
  }
  rooms.appendKnownShardEvent(state.room, message.worldId, event);
  const accepted = acceptedCommandResponse(message, [event]);
  shard.commandCache.set(message.commandId, { fingerprint, response: accepted });
  send(ws, accepted);
  broadcastWorldEvents(state, socketsBySessionId, message.worldId, [event]);
}

function validateCommandEnvelope(
  state: SocketState,
  message: Extract<ClientMessage, { type: 'command' }>
): { code: string; reason: string } | null {
  const payloadWorldId = message.payload.worldId;
  if (typeof payloadWorldId === 'string' && payloadWorldId !== message.worldId) {
    return { code: 'invalid_world', reason: 'Command payload world does not match command world.' };
  }
  if (payloadWorldId !== undefined && typeof payloadWorldId !== 'string') {
    return { code: 'invalid_world', reason: 'Command payload world must be a string when provided.' };
  }
  for (const field of PAYLOAD_ACTOR_FIELDS) {
    const value = message.payload[field];
    if (typeof value === 'string' && value !== state.player?.playerId) {
      return { code: 'invalid_actor', reason: 'Command payload actor does not match authenticated player.' };
    }
  }
  if (isClaimedSharedMutationType(message.commandType) && Object.keys(message.payload).length === 0) {
    return { code: 'validation_failed', reason: 'Authoritative shared-world command payload is empty.' };
  }
  return null;
}

function consumeCommandRateLimit(session: PlayerSession, commandType: string): string | null {
  const overall = consumeRateBucket(session, '*', MAX_COMMANDS_PER_WINDOW);
  if (!overall) return 'Too many commands in a short period.';
  const typed = consumeRateBucket(session, commandType, MAX_COMMANDS_PER_TYPE_PER_WINDOW);
  return typed ? null : `Too many ${commandType} commands in a short period.`;
}

function consumeRateBucket(session: PlayerSession, key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = session.commandRateLimits.get(key);
  if (!bucket || now - bucket.windowStartedAtMs >= COMMAND_RATE_WINDOW_MS) {
    session.commandRateLimits.set(key, { windowStartedAtMs: now, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function fingerprintCommand(
  player: PlayerIdentity,
  message: Extract<ClientMessage, { type: 'command' }>,
  commandPayload: Record<string, unknown> = message.payload
): CommandFingerprint {
  return {
    actorPlayerId: player.playerId,
    worldId: message.worldId,
    commandType: message.commandType,
    payloadHash: stableStringify(commandPayload)
  };
}

function acceptedCommandResponse(
  message: Extract<ClientMessage, { type: 'command' }>,
  events: ShardEvent[]
): ServerMessage {
  return {
    type: 'command_accepted',
    commandId: message.commandId,
    worldId: message.worldId,
    seq: events.at(-1)?.seq ?? 0,
    events
  };
}

function broadcastWorldEvents(
  state: SocketState,
  socketsBySessionId: Map<string, WebSocket>,
  worldId: string,
  events: ShardEvent[]
): void {
  for (const event of events) {
    broadcastRoom(state, socketsBySessionId, {
      type: 'world_event',
      roomId: state.room!.roomId,
      worldId,
      seq: event.seq,
      event
    });
  }
}

function sameCommandFingerprint(a: CommandFingerprint, b: CommandFingerprint): boolean {
  return a.actorPlayerId === b.actorPlayerId
    && a.worldId === b.worldId
    && a.commandType === b.commandType
    && a.payloadHash === b.payloadHash;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function rejectCommand(
  ws: WebSocket,
  state: SocketState,
  message: Extract<ClientMessage, { type: 'command' }>,
  code: string,
  reason: string
): void {
  logCommandReject(state, message, code, reason);
  send(ws, { type: 'command_rejected', commandId: message.commandId, code, reason });
}

function logCommandReject(
  state: SocketState,
  message: Extract<ClientMessage, { type: 'command' }>,
  code: string,
  reason: string
): void {
  console.warn(JSON.stringify({
    level: 'warn',
    event: 'command_rejected',
    code,
    reason,
    roomId: state.room?.roomId ?? null,
    playerId: state.player?.playerId ?? null,
    worldId: message.worldId,
    commandId: message.commandId,
    commandType: message.commandType
  }));
}

async function handleRequestWorldEvents(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  persistence: MultiplayerPersistence,
  worldId: string,
  sinceSeq: number
): Promise<void> {
  if (!state.room) {
    send(ws, { type: 'error', code: 'not_in_room', message: 'Join a room before requesting world events.' });
    return;
  }
  const shard = rooms.getOrCreateShard(state.room, worldId);
  const events = persistence.configured
    ? await persistence.listWorldEvents(state.room.roomId, worldId, sinceSeq)
    : shard.events.filter(event => event.seq > sinceSeq);
  for (const event of events) {
    rooms.appendKnownShardEvent(state.room, worldId, event);
    if (event.seq <= sinceSeq) continue;
    send(ws, {
      type: 'world_event',
      roomId: state.room.roomId,
      worldId,
      seq: event.seq,
      event
    });
  }
}

function handleAckWorldEvents(
  ws: WebSocket,
  state: SocketState,
  worldId: string,
  appliedSeq: number
): void {
  if (!state.room || !state.session) {
    send(ws, { type: 'error', code: 'not_in_room', message: 'Join a room before acknowledging world events.' });
    return;
  }
  const previous = state.session.appliedSeqByWorld.get(worldId) ?? 0;
  state.session.appliedSeqByWorld.set(worldId, Math.max(previous, appliedSeq));
  state.session.lastSeenAtMs = Date.now();
}

function handlePose(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  message: Extract<ClientMessage, { type: 'pose_update' }>
): void {
  if (!state.room) {
    send(ws, { type: 'error', code: 'not_in_room', message: 'Join a room before sending pose updates.' });
    return;
  }
  const shard = rooms.getOrCreateShard(state.room, message.worldId);
  shard.poses.set(state.player!.playerId, message.pose);
  broadcastRoom(state, socketsBySessionId, {
    type: 'pose_update',
    playerId: state.player!.playerId,
    worldId: message.worldId,
    seq: message.seq,
    pose: message.pose
  });
}

function attachSession(
  ws: WebSocket,
  state: SocketState,
  room: RoomState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>
): void {
  if (state.session) {
    socketsBySessionId.delete(state.session.sessionId);
    rooms.removeSession(state.session.sessionId);
  }
  state.room = room;
  state.session = rooms.addSession(room, state.player!);
  socketsBySessionId.set(state.session.sessionId, ws);
}

async function sendRoomJoined(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  persistence: MultiplayerPersistence,
  worldId: string
): Promise<void> {
  if (!state.room || !state.session) return;
  await hydrateShardEvents(rooms, persistence, state.room, worldId);
  send(ws, {
    type: 'room_joined',
    roomId: state.room.roomId,
    inviteCode: state.room.inviteCode,
    playerId: state.player!.playerId,
    worldId
  });
  send(ws, {
    type: 'world_snapshot',
    roomId: state.room.roomId,
    worldId,
    seq: state.room.shards.get(worldId)?.seq ?? 0,
    snapshot: createWorldSnapshot(state.room, worldId)
  });
}

async function sendRoomResume(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  persistence: MultiplayerPersistence,
  worldId: string,
  lastAppliedSeq: number
): Promise<void> {
  if (!state.room || !state.session) return;
  rooms.getOrCreateShard(state.room, worldId);
  send(ws, {
    type: 'room_joined',
    roomId: state.room.roomId,
    inviteCode: state.room.inviteCode,
    playerId: state.player!.playerId,
    worldId
  });
  await handleRequestWorldEvents(ws, state, rooms, persistence, worldId, lastAppliedSeq);
}

async function joinRoomByInvite(
  rooms: InMemoryRoomStore,
  persistence: MultiplayerPersistence,
  inviteCode: string,
  player: PlayerIdentity
): Promise<RoomState | null> {
  let room = rooms.joinByInvite(inviteCode, player);
  if (!room && persistence.configured) {
    const loaded = await persistence.loadRoomByInvite(inviteCode);
    if (loaded) {
      room = rooms.loadRoom(loaded);
      rooms.addMember(room, player);
    }
  }
  if (room) {
    await persistence.persistRoomMember(room, player);
  }
  return room;
}

async function hydrateShardEvents(
  rooms: InMemoryRoomStore,
  persistence: MultiplayerPersistence,
  room: RoomState,
  worldId: string
): Promise<void> {
  if (!persistence.configured) return;
  const events = await persistence.listWorldEvents(room.roomId, worldId, 0);
  rooms.replaceShardEvents(room, worldId, events);
}

function broadcastRoom(state: SocketState, socketsBySessionId: Map<string, WebSocket>, message: ServerMessage): void {
  if (!state.room) return;
  for (const session of state.room.sessions.values()) {
    const socket = socketsBySessionId.get(session.sessionId);
    if (socket?.readyState === WebSocket.OPEN) send(socket, message);
  }
}

function firstWorldId(room: RoomState): string {
  return room.shards.keys().next().value as string;
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encodeServerMessage(message));
}

async function authenticateHttp(req: IncomingMessage, tokenVerifier: TokenVerifier): Promise<PlayerIdentity | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return await tokenVerifier.verifyIdToken(header.slice('Bearer '.length).trim());
  } catch {
    return null;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json)
  });
  res.end(json);
}

function setCors(req: IncomingMessage, res: ServerResponse, config: ServerConfig): void {
  const origin = req.headers.origin;
  const allowed = !origin
    ? undefined
    : config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)
      ? origin
      : undefined;
  if (allowed) res.setHeader('access-control-allow-origin', allowed);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization,content-type');
}
