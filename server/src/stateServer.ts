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
  isServerAuthoritativeCommand,
  resolveServerCanonicalCommandPayload,
  resolveServerAuthoritativeCommand,
  structureRefundFor,
  type AuthoritativeStructureClaim
} from './economyAuthority.js';
import {
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseClientMessage,
  type ClientMessage,
  type JsonObject,
  type PartyWarpHandoff,
  type PlayerIdentity,
  type ServerMessage
} from './protocol.js';
import {
  InMemoryRoomStore,
  applyPlayerInventoryDelta,
  applyPlayerStatePatch,
  canDebitPlayerInventory,
  createPlayersStateSnapshot,
  createWorldSnapshot,
  ensurePlayerState,
  type CommandFingerprint,
  type PlayerSession,
  type RoomState,
  type ShardEvent,
  roomRoster
} from './rooms.js';
import { canonicalWorldId, parseWorldId } from './worldAuthority.js';

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

interface ActiveStructure {
  ownerPlayerId: string;
  type: string;
  material: string;
  claimIds: string[];
}

const COMMAND_RATE_WINDOW_MS = 1000;
const MAX_COMMANDS_PER_WINDOW = 40;
const MAX_COMMANDS_PER_TYPE_PER_WINDOW = 20;
const PAYLOAD_ACTOR_FIELDS = ['actorId', 'playerId'];
const STRUCTURE_FACE_DIRS: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];
const POSE_POSITION_BOUND = 10000;
const POSE_VELOCITY_BOUND = 1500;
const POSE_UNIT_VECTOR_BOUND = 1.25;

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
      const room = detachSession(state, rooms, socketsBySessionId);
      if (room) broadcastRoomRoster(room, socketsBySessionId);
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
      const worldId = canonicalWorldId(startWorldId);
      if (!worldId) {
        sendJson(res, 400, { error: 'invalid_world', message: 'startWorldId must be a coordinate key like "0,0".' });
        return;
      }
      const room = rooms.createRoom(player, worldId);
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
    case 'predict_world_event':
      handlePredictedWorldEvent(ws, state, rooms, socketsBySessionId, message);
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
  const worldId = canonicalWorldId(startWorldId);
  if (!worldId) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'startWorldId must be a coordinate key like "0,0".' });
    return;
  }
  const room = rooms.createRoom(state.player!, worldId);
  await persistence.persistRoom(room);
  attachSession(ws, state, room, rooms, socketsBySessionId);
  send(ws, { type: 'room_created', roomId: room.roomId, inviteCode: room.inviteCode, ownerPlayerId: room.ownerPlayerId });
  await sendRoomJoined(ws, state, rooms, persistence, worldId);
  broadcastRoomRoster(room, socketsBySessionId);
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
    if (message.resume.worldId === room.activeWorldId) {
      state.session?.appliedSeqByWorld.set(message.resume.worldId, message.resume.lastAppliedSeq);
      await sendRoomResume(ws, state, rooms, persistence, message.resume.worldId, message.resume.lastAppliedSeq);
    } else {
      await sendRoomJoined(ws, state, rooms, persistence, room.activeWorldId);
    }
    broadcastRoomRoster(room, socketsBySessionId);
    return;
  }
  await sendRoomJoined(ws, state, rooms, persistence, firstWorldId(room));
  broadcastRoomRoster(room, socketsBySessionId);
}

async function handleCommand(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence,
  message: Extract<ClientMessage, { type: 'command' }>
): Promise<void> {
  const reject = (code: string, reason: string) => {
    rejectCommand(ws, state, message, code, reason, socketsBySessionId);
  };
  if (!state.room) {
    reject('not_in_room', 'Join a room before sending commands.');
    return;
  }
  if (!state.session) {
    reject('not_in_room', 'Join a room before sending commands.');
    return;
  }
  if (canonicalWorldId(message.worldId) !== message.worldId) {
    reject('invalid_world', 'Command world must be a canonical coordinate key.');
    return;
  }
  if (!state.room.shards.has(message.worldId)) {
    reject('invalid_world', 'Command world is not active in this room.');
    return;
  }
  const envelopeError = validateCommandEnvelope(state, message);
  if (envelopeError) {
    reject(envelopeError.code, envelopeError.reason);
    return;
  }
  const partyWarpResolution = message.commandType === 'party_warp_requested'
    ? resolvePartyWarpPayload(message.payload, message.worldId)
    : null;
  if (partyWarpResolution && 'code' in partyWarpResolution) {
    reject(partyWarpResolution.code, partyWarpResolution.reason);
    return;
  }
  const canonicalResolution = resolveServerCanonicalCommandPayload(message.commandType, message.payload, {
    worldId: message.worldId
  });
  if (canonicalResolution && 'code' in canonicalResolution) {
    reject(canonicalResolution.code, canonicalResolution.reason);
    return;
  }
  const playerState = isServerAuthoritativeCommand(message.commandType)
    ? persistence.configured
      ? await persistence.loadPlayerState(state.player!.playerId)
      : ensurePlayerState(state.room, state.player!.playerId)
    : undefined;
  const authoritativeResolution = resolveServerAuthoritativeCommand(message.commandType, message.payload, playerState);
  if (authoritativeResolution && 'code' in authoritativeResolution) {
    reject(authoritativeResolution.code, authoritativeResolution.reason);
    return;
  }
  const commandPayload = partyWarpResolution?.commandPayload
    ?? authoritativeResolution?.commandPayload
    ?? canonicalResolution?.commandPayload
    ?? message.payload;
  const shard = rooms.getOrCreateShard(state.room, message.worldId);
  const fingerprint = fingerprintCommand(state.player!, message, commandPayload);
  const cached = shard.commandCache.get(message.commandId);
  if (cached) {
    if (sameCommandFingerprint(cached.fingerprint, fingerprint)) {
      send(ws, cached.response as ServerMessage);
    } else {
      reject('replay', 'Command id was already used for a different command.');
    }
    return;
  }
  if (message.worldId !== state.room.activeWorldId) {
    reject('invalid_world', 'Command world is not the current party world.');
    return;
  }
  let inMemoryStructureRemoval: ActiveStructure | null = null;
  if (!authoritativeResolution) {
    const mutationValidationError = sharedMutationValidationError(message.commandType, commandPayload);
    if (mutationValidationError) {
      reject('validation_failed', mutationValidationError);
      return;
    }
    if (!persistence.configured && message.commandType === 'structure_removed') {
      const structureValidation = resolveInMemoryStructureRemoval(state.room, message.worldId, commandPayload);
      if ('error' in structureValidation) {
        reject(structureValidation.error.code, structureValidation.error.reason);
        return;
      }
      inMemoryStructureRemoval = structureValidation.structure;
    }
  }
  const rateLimitReason = consumeCommandRateLimit(state.session, message.commandType);
  if (rateLimitReason) {
    reject('rate_limited', rateLimitReason);
    return;
  }
  if (partyWarpResolution) {
    await handlePartyWarpCommand({
      ws,
      state,
      rooms,
      socketsBySessionId,
      persistence,
      message,
      sourceShard: shard,
      fingerprint,
      payload: partyWarpResolution.commandPayload
    });
    return;
  }
  if (authoritativeResolution) {
    if (!persistence.configured) {
      if (!canDebitPlayerInventory(state.room, state.player!.playerId, authoritativeResolution.debit)) {
        reject('validation_failed', 'Insufficient authoritative inventory for command.');
        return;
      }
      if (authoritativeResolution.campfireClaim) {
        const key = `campfire:${authoritativeResolution.campfireClaim.campfireId}`;
        const existingCommandId = shard.mutationClaims.get(key);
        if (existingCommandId && existingCommandId !== message.commandId) {
          reject('conflict', 'Campfire placement target was already claimed by another command.');
          return;
        }
        shard.mutationClaims.set(key, message.commandId);
      }
      const structureClaimError = validateInMemoryStructureClaims(
        shard,
        authoritativeResolution.structureClaims,
        message.commandId
      );
      if (structureClaimError) {
        reject(structureClaimError.code, structureClaimError.reason);
        return;
      }
      applyInMemoryStructureClaims(shard, authoritativeResolution.structureClaims, message.commandId);
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
        applyPlayerStatePatch(state.room, state.player!.playerId, authoritativeResolution.playerStatePatch);
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
        reject('replay', 'Command id was already used for a different command.');
      } else if (error instanceof CommandConflictError) {
        reject('conflict', 'World mutation target was already claimed by another command.');
      } else if (error instanceof CommandInventoryError) {
        reject('validation_failed', 'Insufficient authoritative inventory for command.');
      } else {
        reject('persistence_failed', error instanceof Error ? error.message : 'Could not persist command.');
      }
      return;
    }

    rooms.appendKnownShardEvents(state.room, message.worldId, events);
    const deltas = await hydrateCommandPlayerDeltas(state.room, persistence, state.player!.playerId);
    const accepted = acceptedCommandResponse(message, events, deltas);
    shard.commandCache.set(message.commandId, { fingerprint, response: accepted });
    shard.predictedRollbacks.delete(message.commandId);
    send(ws, accepted);
    broadcastWorldEvents(state, socketsBySessionId, message.worldId, events);
    return;
  }
  const memoryClaimKey = !persistence.configured
    ? sharedMutationClaimForCommand(message.commandType, commandPayload)?.key
    : null;
  if (memoryClaimKey) {
    const existingCommandId = shard.mutationClaims.get(memoryClaimKey);
    if (existingCommandId && existingCommandId !== message.commandId) {
      reject('conflict', 'World mutation target was already claimed by another command.');
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
        payload: commandPayload
      })
      : rooms.appendShardEvent(state.room, message.worldId, state.player!.playerId, message.commandType, commandPayload, message.commandId);
  } catch (error) {
    if (error instanceof CommandReplayMismatchError) {
      reject('replay', 'Command id was already used for a different command.');
    } else if (error instanceof CommandConflictError) {
      reject('conflict', 'World mutation target was already claimed by another command.');
    } else {
      reject('persistence_failed', error instanceof Error ? error.message : 'Could not persist command.');
    }
    return;
  }
  if (!persistence.configured) {
    if (inMemoryStructureRemoval) {
      clearInMemoryStructureClaims(shard, inMemoryStructureRemoval);
      applyPlayerInventoryDelta(state.room, inMemoryStructureRemoval.ownerPlayerId, {
        credit: structureRefundFor(inMemoryStructureRemoval.type, inMemoryStructureRemoval.material)
      });
    } else {
      applyPlayerInventoryDelta(state.room, state.player!.playerId, {
        credit: inventoryCreditsForAcceptedCommand(message.commandType, commandPayload)
      });
    }
  }
  rooms.appendKnownShardEvent(state.room, message.worldId, event);
  const deltas = await hydrateCommandPlayerDeltas(state.room, persistence, state.player!.playerId);
  const accepted = acceptedCommandResponse(message, [event], deltas);
  shard.commandCache.set(message.commandId, { fingerprint, response: accepted });
  shard.predictedRollbacks.delete(message.commandId);
  send(ws, accepted);
  broadcastWorldEvents(state, socketsBySessionId, message.worldId, [event]);
}

async function handlePartyWarpCommand(input: {
  ws: WebSocket;
  state: SocketState;
  rooms: InMemoryRoomStore;
  socketsBySessionId: Map<string, WebSocket>;
  persistence: MultiplayerPersistence;
  message: Extract<ClientMessage, { type: 'command' }>;
  sourceShard: { commandCache: Map<string, { fingerprint: CommandFingerprint; response: unknown }>; poses: Map<string, JsonObject> };
  fingerprint: CommandFingerprint;
  payload: JsonObject;
}): Promise<void> {
  const { ws, state, rooms, socketsBySessionId, persistence, message, sourceShard, fingerprint, payload } = input;
  if (!state.room || !state.session || !state.player) return;
  const destinationWorldId = readString(payload.destinationWorldId);
  const destination = readObject(payload.destination);
  if (!destinationWorldId || !destination) {
    rejectCommand(ws, state, message, 'validation_failed', 'Party warp requires a destination world.', socketsBySessionId);
    return;
  }

  const requestedAtMs = Date.now();
  const handoff = createPartyWarpHandoff(
    state.room,
    sourceShard.poses,
    state.player.playerId,
    message.worldId,
    destinationWorldId,
    destination,
    requestedAtMs
  );
  const eventPayload: JsonObject = {
    fromWorldId: message.worldId,
    destinationWorldId,
    destination,
    handoff
  };

  let event: ShardEvent;
  try {
    rooms.getOrCreateShard(state.room, destinationWorldId);
    event = persistence.configured
      ? await persistence.appendCommandEvent({
        room: state.room,
        worldId: destinationWorldId,
        actor: state.player,
        commandId: message.commandId,
        commandType: 'party_warped',
        payload: eventPayload
      })
      : rooms.appendShardEvent(
        state.room,
        destinationWorldId,
        state.player.playerId,
        'party_warped',
        eventPayload,
        message.commandId
      );
    rooms.setActiveWorld(state.room, destinationWorldId);
    await persistence.activateWorldShard(state.room, destinationWorldId);
    if (persistence.configured) {
      rooms.appendKnownShardEvent(state.room, destinationWorldId, event);
      await hydrateShardEvents(rooms, persistence, state.room, destinationWorldId);
    }
  } catch (error) {
    if (error instanceof CommandReplayMismatchError) {
      rejectCommand(ws, state, message, 'replay', 'Command id was already used for a different command.', socketsBySessionId);
    } else {
      rejectCommand(
        ws,
        state,
        message,
        'persistence_failed',
        error instanceof Error ? error.message : 'Could not persist party warp.',
        socketsBySessionId
      );
    }
    return;
  }

  const accepted: ServerMessage = {
    type: 'command_accepted',
    commandId: message.commandId,
    worldId: destinationWorldId,
    seq: event.seq,
    events: [event]
  };
  sourceShard.commandCache.set(message.commandId, { fingerprint, response: accepted });
  send(ws, accepted);
  broadcastRoom(state, socketsBySessionId, {
    type: 'party_warp',
    roomId: state.room.roomId,
    worldId: destinationWorldId,
    seq: event.seq,
    handoff
  });
  await broadcastWorldSnapshot(state.room, socketsBySessionId, persistence, destinationWorldId);
}

function handlePredictedWorldEvent(
  ws: WebSocket,
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>,
  message: Extract<ClientMessage, { type: 'predict_world_event' }>
): void {
  if (!state.room || !state.session) {
    send(ws, { type: 'error', code: 'not_in_room', message: 'Join a room before predicting world events.' });
    return;
  }
  if (canonicalWorldId(message.worldId) !== message.worldId || !state.room.shards.has(message.worldId)) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'Predicted event world is not active in this room.' });
    return;
  }
  const event = createPredictedWorldEvent(state.player!.playerId, message);
  if (!event) {
    send(ws, { type: 'error', code: 'invalid_prediction', message: 'Predicted world event is not allowed.' });
    return;
  }

  const shard = rooms.getOrCreateShard(state.room, message.worldId);
  if (message.rollback) shard.predictedRollbacks.set(message.commandId, message.rollback);
  broadcastRoom(state, socketsBySessionId, {
    type: 'predicted_world_event',
    roomId: state.room.roomId,
    worldId: message.worldId,
    commandId: message.commandId,
    event
  });
}

function createPredictedWorldEvent(
  playerId: string,
  message: Extract<ClientMessage, { type: 'predict_world_event' }>
): ShardEvent | null {
  const event = readObject(message.event);
  const payload = readObject(event?.payload);
  if (event?.type !== 'door_toggled' || !payload) return null;
  const cell = readIntCoord(payload.cell);
  const face = readInt(payload.face);
  if (!cell || face === null || typeof payload.open !== 'boolean') return null;
  return {
    seq: 0,
    eventId: `${message.commandId}:predicted`,
    commandId: message.commandId,
    type: 'door_toggled',
    playerId,
    payload: { cell, face, open: payload.open },
    timeMs: Date.now()
  };
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
  events: ShardEvent[],
  deltas?: JsonObject
): ServerMessage {
  return {
    type: 'command_accepted',
    commandId: message.commandId,
    worldId: message.worldId,
    seq: events.at(-1)?.seq ?? 0,
    events,
    ...(deltas ? { deltas } : {})
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

function resolvePartyWarpPayload(
  payload: JsonObject,
  fromWorldId: string
): { commandPayload: JsonObject } | { code: 'validation_failed'; reason: string } {
  const rawDestinationWorldId = readString(payload.destinationWorldId);
  if (!rawDestinationWorldId) {
    return { code: 'validation_failed', reason: 'Party warp requires destinationWorldId.' };
  }
  const destinationWorldId = canonicalWorldId(rawDestinationWorldId);
  const destination = destinationWorldId ? parseWorldId(destinationWorldId) : null;
  if (!destinationWorldId || !destination) {
    return { code: 'validation_failed', reason: 'Party warp destination must be a canonical coordinate key.' };
  }
  if (destinationWorldId === fromWorldId) {
    return { code: 'validation_failed', reason: 'Party warp destination must differ from the current world.' };
  }
  return {
    commandPayload: {
      destinationWorldId,
      destination: { x: destination.x, y: destination.y }
    }
  };
}

function createPartyWarpHandoff(
  room: RoomState,
  sourcePoses: Map<string, JsonObject>,
  actorPlayerId: string,
  fromWorldId: string,
  worldId: string,
  destination: JsonObject,
  requestedAtMs: number
): PartyWarpHandoff {
  const players = [...room.members.values()]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map((player, index) => {
      const pose = readObject(sourcePoses.get(player.playerId));
      return {
        playerId: player.playerId,
        spawnSlot: index,
        ...(pose ? { pose } : {})
      };
    });
  return {
    fromWorldId,
    worldId,
    destination: {
      x: readInt(destination.x) ?? 0,
      y: readInt(destination.y) ?? 0
    },
    actorPlayerId,
    players,
    requestedAtMs
  };
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

function readObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function readInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readIntCoord(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    ? [x, y, z]
    : null;
}

function rejectCommand(
  ws: WebSocket,
  state: SocketState,
  message: Extract<ClientMessage, { type: 'command' }>,
  code: string,
  reason: string,
  socketsBySessionId?: Map<string, WebSocket>
): void {
  logCommandReject(state, message, code, reason);
  send(ws, { type: 'command_rejected', commandId: message.commandId, code, reason });
  if (socketsBySessionId) rollbackPredictedCommand(state, socketsBySessionId, message);
}

function rollbackPredictedCommand(
  state: SocketState,
  socketsBySessionId: Map<string, WebSocket>,
  message: Extract<ClientMessage, { type: 'command' }>
): void {
  if (!state.room) return;
  const shard = state.room.shards.get(message.worldId);
  const rollback = shard?.predictedRollbacks.get(message.commandId);
  if (!shard || rollback === undefined) return;
  shard.predictedRollbacks.delete(message.commandId);
  broadcastRoom(state, socketsBySessionId, {
    type: 'prediction_rollback',
    commandId: message.commandId,
    rollback
  });
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

function validateInMemoryStructureClaims(
  shard: { mutationClaims: Map<string, string>; events: ShardEvent[] },
  claims: AuthoritativeStructureClaim[] | undefined,
  commandId: string
): { code: string; reason: string } | null {
  for (const claim of claims ?? []) {
    const key = structureClaimKey(claim.structureId);
    const existingCommandId = shard.mutationClaims.get(key);
    if (existingCommandId && existingCommandId !== commandId) {
      return { code: 'conflict', reason: 'Structure placement target was already claimed by another command.' };
    }
    if (claim.mode === 'door_leaf') {
      const doorKey = structureClaimKey(claim.structureId);
      const existingDoorCommandId = shard.mutationClaims.get(doorKey);
      if (existingDoorCommandId && existingDoorCommandId !== commandId) {
        return { code: 'conflict', reason: 'Door was already fitted at this doorway.' };
      }
      if (!hasAcceptedDoorway(shard.events, claim.requiredStructureId)) {
        return { code: 'validation_failed', reason: 'Door fitting requires an existing doorway.' };
      }
    }
  }
  return null;
}

function applyInMemoryStructureClaims(
  shard: { mutationClaims: Map<string, string> },
  claims: AuthoritativeStructureClaim[] | undefined,
  commandId: string
): void {
  for (const claim of claims ?? []) {
    shard.mutationClaims.set(structureClaimKey(claim.structureId), commandId);
  }
}

function resolveInMemoryStructureRemoval(
  room: RoomState,
  worldId: string,
  payload: Record<string, unknown>
): { structure: ActiveStructure } | { error: { code: 'validation_failed' | 'conflict'; reason: string } } {
  const cell = readIntCoord(payload.cell);
  const face = readInt(payload.face);
  if (!cell || face === null) {
    return { error: { code: 'validation_failed', reason: 'Structure removal requires a valid cell and face.' } };
  }
  const shard = room.shards.get(worldId);
  if (!shard) return { error: { code: 'validation_failed', reason: 'Structure removal world is not active.' } };
  const active = activeStructuresFromEvents(shard.events);
  const structure = active.get(structureSlotId(cell, face));
  return structure
    ? { structure }
    : { error: { code: 'conflict', reason: 'Structure removal target is not present.' } };
}

function activeStructuresFromEvents(events: ShardEvent[]): Map<string, ActiveStructure> {
  const active = new Map<string, ActiveStructure>();
  const partners = new Map<string, string>();
  for (const event of events) {
    const payload = event.payload;
    const cell = readIntCoord(payload.cell);
    const face = readInt(payload.face);
    if (!cell || face === null) continue;
    const id = structureSlotId(cell, face);
    if (event.type === 'structure_placed') {
      const type = typeof payload.type === 'string' ? payload.type : null;
      const material = typeof payload.material === 'string' ? payload.material : null;
      if (!type || !material) continue;
      if (type === 'door') {
        const doorway = active.get(id);
        const doorId = doorLeafId(cell, face);
        if (doorway?.type === 'doorway' && !doorway.claimIds.includes(doorId)) {
          doorway.claimIds.push(doorId);
        }
        continue;
      }
      const structure: ActiveStructure = {
        ownerPlayerId: event.playerId,
        type,
        material,
        claimIds: [id]
      };
      active.set(id, structure);
      const up = readInt(payload.up);
      if (type === 'doorway' && up !== null && STRUCTURE_FACE_DIRS[up]) {
        const dir = STRUCTURE_FACE_DIRS[up];
        const upper: [number, number, number] = [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]];
        const upperId = structureSlotId(upper, face);
        structure.claimIds.push(upperId);
        active.set(upperId, structure);
        partners.set(id, upperId);
        partners.set(upperId, id);
      }
      continue;
    }
    if (event.type === 'structure_removed') {
      const structure = active.get(id);
      const slotIds = structure?.claimIds.filter(claimId => claimId.startsWith('slot:')) ?? [id];
      for (const slotId of slotIds) {
        active.delete(slotId);
        const partnerId = partners.get(slotId);
        if (partnerId) active.delete(partnerId);
        partners.delete(slotId);
        if (partnerId) partners.delete(partnerId);
      }
    }
  }
  return active;
}

function clearInMemoryStructureClaims(
  shard: { mutationClaims: Map<string, string> },
  structure: ActiveStructure
): void {
  for (const claimId of structure.claimIds) {
    shard.mutationClaims.delete(structureClaimKey(claimId));
  }
}

function hasAcceptedDoorway(events: ShardEvent[], requiredStructureId: string): boolean {
  return events.some(event => {
    if (event.type !== 'structure_placed') return false;
    const payload = event.payload;
    if (payload.type !== 'doorway') return false;
    const cell = Array.isArray(payload.cell) && payload.cell.length === 3
      && payload.cell.every(value => Number.isInteger(value))
      ? payload.cell as [number, number, number]
      : null;
    return cell !== null
      && Number.isInteger(payload.face)
      && requiredStructureId === `slot:${cell.join(',')}:${payload.face}`;
  });
}

function structureClaimKey(structureId: string): string {
  return `structure:${structureId}`;
}

function structureSlotId(cell: [number, number, number], face: number): string {
  return `slot:${cell.join(',')}:${face}`;
}

function doorLeafId(cell: [number, number, number], face: number): string {
  return `door:${cell.join(',')}:${face}`;
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
  if (canonicalWorldId(worldId) !== worldId) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'Requested world must be a canonical coordinate key.' });
    return;
  }
  const shard = state.room.shards.get(worldId);
  if (!shard) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'Requested world is not part of this room.' });
    return;
  }
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
  if (!state.room || !state.session) {
    send(ws, { type: 'error', code: 'not_in_room', message: 'Join a room before sending pose updates.' });
    return;
  }
  if (canonicalWorldId(message.worldId) !== message.worldId || !state.room.shards.has(message.worldId)) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'Pose world is not active in this room.' });
    return;
  }
  if (message.worldId !== state.room.activeWorldId) {
    send(ws, { type: 'error', code: 'invalid_world', message: 'Pose world is not the current party world.' });
    return;
  }
  const poseError = validatePosePayload(message.pose);
  if (poseError) {
    send(ws, { type: 'error', code: 'invalid_pose', message: poseError });
    return;
  }
  const shard = rooms.getOrCreateShard(state.room, message.worldId);
  const currentPose = readObject(shard.poses.get(state.player!.playerId));
  const currentSeq = readInt(currentPose?.seq) ?? -1;
  if (message.seq <= currentSeq) return;
  shard.poses.set(state.player!.playerId, message.pose);
  broadcastRoom(state, socketsBySessionId, {
    type: 'pose_update',
    playerId: state.player!.playerId,
    worldId: message.worldId,
    seq: message.seq,
    pose: message.pose
  });
}

function validatePosePayload(pose: JsonObject): string | null {
  if (!boundedVector(pose.position, POSE_POSITION_BOUND)) return 'Pose position is outside plausible bounds.';
  if (!boundedVector(pose.velocity, POSE_VELOCITY_BOUND)) return 'Pose velocity is outside plausible bounds.';
  if (!boundedVector(pose.forward, POSE_UNIT_VECTOR_BOUND)) return 'Pose forward vector is invalid.';
  if (!boundedVector(pose.up, POSE_UNIT_VECTOR_BOUND)) return 'Pose up vector is invalid.';
  if (typeof pose.pitch !== 'number' || !Number.isFinite(pose.pitch) || Math.abs(pose.pitch) > Math.PI) {
    return 'Pose pitch is invalid.';
  }
  if (typeof pose.action !== 'string' || !isKnownPoseAction(pose.action)) return 'Pose action is invalid.';
  if (typeof pose.submergence !== 'number' || !Number.isFinite(pose.submergence) || pose.submergence < 0 || pose.submergence > 1) {
    return 'Pose submergence is invalid.';
  }
  if (typeof pose.miningProgress !== 'number' || !Number.isFinite(pose.miningProgress) || pose.miningProgress < 0 || pose.miningProgress > 1) {
    return 'Pose mining progress is invalid.';
  }
  return null;
}

function boundedVector(value: unknown, bound: number): boolean {
  if (!Array.isArray(value) || value.length !== 3) return false;
  return value.every(component => typeof component === 'number' && Number.isFinite(component) && Math.abs(component) <= bound);
}

function isKnownPoseAction(value: string): boolean {
  return value === 'idle'
    || value === 'walk'
    || value === 'swim'
    || value === 'jetpack'
    || value === 'climb'
    || value === 'sprint'
    || value === 'mine'
    || value === 'build'
    || value === 'drink'
    || value === 'warp';
}

function attachSession(
  ws: WebSocket,
  state: SocketState,
  room: RoomState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>
): void {
  detachSession(state, rooms, socketsBySessionId);
  state.room = room;
  state.session = rooms.addSession(room, state.player!);
  socketsBySessionId.set(state.session.sessionId, ws);
}

function detachSession(
  state: SocketState,
  rooms: InMemoryRoomStore,
  socketsBySessionId: Map<string, WebSocket>
): RoomState | null {
  if (!state.session) return null;
  const room = state.room;
  socketsBySessionId.delete(state.session.sessionId);
  rooms.removeSession(state.session.sessionId);
  state.session = null;
  return room;
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
  await hydrateRoomPlayerAuthorityState(state.room, persistence);
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

async function hydrateRoomPlayerAuthorityState(
  room: RoomState,
  persistence: MultiplayerPersistence
): Promise<void> {
  if (!persistence.configured) return;
  await Promise.all([...room.members.keys()].map(playerId => hydratePlayerAuthorityState(room, persistence, playerId)));
}

async function hydratePlayerAuthorityState(
  room: RoomState,
  persistence: MultiplayerPersistence,
  playerId: string
): Promise<void> {
  if (!persistence.configured) return;
  const [inventory, playerState] = await Promise.all([
    persistence.loadPlayerInventory(playerId),
    persistence.loadPlayerState(playerId)
  ]);
  room.playerInventories.set(playerId, inventory);
  room.playerStates.set(playerId, playerState);
}

async function hydrateCommandPlayerDeltas(
  room: RoomState,
  persistence: MultiplayerPersistence,
  playerId: string
): Promise<JsonObject> {
  await hydratePlayerAuthorityState(room, persistence, playerId);
  return createPlayersStateSnapshot(room, [playerId]);
}

function broadcastRoom(state: SocketState, socketsBySessionId: Map<string, WebSocket>, message: ServerMessage): void {
  if (!state.room) return;
  broadcastToRoom(state.room, socketsBySessionId, message);
}

function broadcastRoomRoster(room: RoomState, socketsBySessionId: Map<string, WebSocket>): void {
  broadcastToRoom(room, socketsBySessionId, {
    type: 'room_roster',
    roomId: room.roomId,
    players: roomRoster(room)
  });
}

async function broadcastWorldSnapshot(
  room: RoomState,
  socketsBySessionId: Map<string, WebSocket>,
  persistence: MultiplayerPersistence,
  worldId: string
): Promise<void> {
  await hydrateRoomPlayerAuthorityState(room, persistence);
  broadcastToRoom(room, socketsBySessionId, {
    type: 'world_snapshot',
    roomId: room.roomId,
    worldId,
    seq: room.shards.get(worldId)?.seq ?? 0,
    snapshot: createWorldSnapshot(room, worldId)
  });
}

function broadcastToRoom(room: RoomState, socketsBySessionId: Map<string, WebSocket>, message: ServerMessage): void {
  for (const session of room.sessions.values()) {
    const socket = socketsBySessionId.get(session.sessionId);
    if (socket?.readyState === WebSocket.OPEN) send(socket, message);
  }
}

function firstWorldId(room: RoomState): string {
  return room.activeWorldId || room.shards.keys().next().value as string;
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
