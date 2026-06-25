import { randomBytes, randomUUID } from 'node:crypto';
import type { JsonObject, PlayerIdentity } from './protocol.js';
import {
  defaultServerPlayerState,
  starterInventory,
  type AuthoritativePlayerStatePatch,
  type ItemStack,
  type ServerPlayerState
} from './economyAuthority.js';

export interface PlayerSession {
  sessionId: string;
  player: PlayerIdentity;
  roomId: string;
  connectedAtMs: number;
  lastSeenAtMs: number;
  appliedSeqByWorld: Map<string, number>;
  commandRateLimits: Map<string, RateLimitBucket>;
}

export interface RateLimitBucket {
  windowStartedAtMs: number;
  count: number;
}

export interface ShardEvent {
  seq: number;
  eventId: string;
  commandId?: string;
  type: string;
  playerId: string;
  payload: JsonObject;
  timeMs: number;
}

export interface ShardState {
  worldId: string;
  seq: number;
  worldTimeMs: number;
  events: ShardEvent[];
  poses: Map<string, JsonObject>;
  commandCache: Map<string, CachedCommandResponse>;
  mutationClaims: Map<string, string>;
  predictedRollbacks: Map<string, unknown>;
}

export interface CommandFingerprint {
  actorPlayerId: string;
  worldId: string;
  commandType: string;
  payloadHash: string;
}

export interface CachedCommandResponse {
  fingerprint: CommandFingerprint;
  response: unknown;
}

export interface RoomState {
  roomId: string;
  inviteCode: string;
  ownerPlayerId: string;
  createdAtMs: number;
  sessions: Map<string, PlayerSession>;
  members: Map<string, PlayerIdentity>;
  playerInventories: Map<string, Map<string, number>>;
  playerStates: Map<string, ServerPlayerState>;
  shards: Map<string, ShardState>;
}

export interface RoomSummary {
  roomId: string;
  inviteCode: string;
  ownerPlayerId: string;
  memberCount: number;
  sessionCount: number;
  worldIds: string[];
}

export interface LoadedRoomState {
  roomId: string;
  inviteCode: string;
  ownerPlayerId: string;
  createdAtMs: number;
  members: PlayerIdentity[];
  worldIds: string[];
}

export class InMemoryRoomStore {
  private readonly rooms = new Map<string, RoomState>();
  private readonly inviteIndex = new Map<string, string>();

  createRoom(owner: PlayerIdentity, startWorldId = '0,0'): RoomState {
    const roomId = randomUUID();
    const inviteCode = this.createInviteCode();
    const now = Date.now();
    const room: RoomState = {
      roomId,
      inviteCode,
      ownerPlayerId: owner.playerId,
      createdAtMs: now,
      sessions: new Map(),
      members: new Map([[owner.playerId, owner]]),
      playerInventories: new Map([[owner.playerId, createStarterInventory()]]),
      playerStates: new Map([[owner.playerId, defaultServerPlayerState()]]),
      shards: new Map([[startWorldId, createShard(startWorldId)]])
    };
    this.rooms.set(roomId, room);
    this.inviteIndex.set(inviteCode, roomId);
    return room;
  }

  joinByInvite(inviteCode: string, player: PlayerIdentity): RoomState | null {
    const roomId = this.inviteIndex.get(inviteCode);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.members.set(player.playerId, player);
    ensurePlayerInventory(room, player.playerId);
    ensurePlayerState(room, player.playerId);
    return room;
  }

  getRoom(roomId: string): RoomState | null {
    return this.rooms.get(roomId) ?? null;
  }

  getRoomByInvite(inviteCode: string): RoomState | null {
    const roomId = this.inviteIndex.get(inviteCode);
    return roomId ? this.getRoom(roomId) : null;
  }

  loadRoom(loaded: LoadedRoomState): RoomState {
    const existing = this.rooms.get(loaded.roomId);
    if (existing) return existing;
    const room: RoomState = {
      roomId: loaded.roomId,
      inviteCode: loaded.inviteCode,
      ownerPlayerId: loaded.ownerPlayerId,
      createdAtMs: loaded.createdAtMs,
      sessions: new Map(),
      members: new Map(loaded.members.map(member => [member.playerId, member])),
      playerInventories: new Map(loaded.members.map(member => [member.playerId, createStarterInventory()])),
      playerStates: new Map(loaded.members.map(member => [member.playerId, defaultServerPlayerState()])),
      shards: new Map(loaded.worldIds.map(worldId => [worldId, createShard(worldId)]))
    };
    this.rooms.set(room.roomId, room);
    this.inviteIndex.set(room.inviteCode, room.roomId);
    return room;
  }

  addMember(room: RoomState, player: PlayerIdentity): void {
    room.members.set(player.playerId, player);
    ensurePlayerInventory(room, player.playerId);
    ensurePlayerState(room, player.playerId);
  }

  addSession(room: RoomState, player: PlayerIdentity): PlayerSession {
    const session: PlayerSession = {
      sessionId: randomUUID(),
      player,
      roomId: room.roomId,
      connectedAtMs: Date.now(),
      lastSeenAtMs: Date.now(),
      appliedSeqByWorld: new Map(),
      commandRateLimits: new Map()
    };
    room.members.set(player.playerId, player);
    ensurePlayerInventory(room, player.playerId);
    ensurePlayerState(room, player.playerId);
    room.sessions.set(session.sessionId, session);
    return session;
  }

  removeSession(sessionId: string): void {
    for (const room of this.rooms.values()) {
      if (room.sessions.delete(sessionId)) return;
    }
  }

  getOrCreateShard(room: RoomState, worldId: string): ShardState {
    let shard = room.shards.get(worldId);
    if (!shard) {
      shard = createShard(worldId);
      room.shards.set(worldId, shard);
    }
    return shard;
  }

  appendShardEvent(
    room: RoomState,
    worldId: string,
    playerId: string,
    type: string,
    payload: JsonObject,
    commandId?: string
  ): ShardEvent {
    const shard = this.getOrCreateShard(room, worldId);
    const event: ShardEvent = {
      seq: ++shard.seq,
      eventId: commandId ? `${commandId}:0` : randomUUID(),
      commandId,
      type,
      playerId,
      payload,
      timeMs: Date.now()
    };
    shard.events.push(event);
    return event;
  }

  appendShardEvents(
    room: RoomState,
    worldId: string,
    playerId: string,
    commandId: string,
    events: Array<{ type: string; payload: JsonObject }>
  ): ShardEvent[] {
    const shard = this.getOrCreateShard(room, worldId);
    const now = Date.now();
    const appended = events.map((eventSpec, index): ShardEvent => ({
      seq: ++shard.seq,
      eventId: `${commandId}:${index}`,
      commandId,
      type: eventSpec.type,
      playerId,
      payload: eventSpec.payload,
      timeMs: now
    }));
    shard.events.push(...appended);
    return appended;
  }

  appendKnownShardEvent(room: RoomState, worldId: string, event: ShardEvent): ShardEvent {
    const shard = this.getOrCreateShard(room, worldId);
    if (shard.events.some(existing => existing.seq === event.seq)) return event;
    shard.events.push(event);
    shard.events.sort((a, b) => a.seq - b.seq);
    shard.seq = Math.max(shard.seq, event.seq);
    return event;
  }

  appendKnownShardEvents(room: RoomState, worldId: string, events: ShardEvent[]): ShardEvent[] {
    return events.map(event => this.appendKnownShardEvent(room, worldId, event));
  }

  replaceShardEvents(room: RoomState, worldId: string, events: ShardEvent[]): void {
    const shard = this.getOrCreateShard(room, worldId);
    shard.events = [...events].sort((a, b) => a.seq - b.seq);
    shard.seq = shard.events.at(-1)?.seq ?? 0;
  }

  summarize(room: RoomState): RoomSummary {
    return {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      ownerPlayerId: room.ownerPlayerId,
      memberCount: room.members.size,
      sessionCount: room.sessions.size,
      worldIds: [...room.shards.keys()]
    };
  }

  private createInviteCode(): string {
    for (;;) {
      const code = randomBytes(4).toString('base64url').slice(0, 6).toUpperCase();
      if (!this.inviteIndex.has(code)) return code;
    }
  }
}

export function ensurePlayerInventory(room: RoomState, playerId: string): Map<string, number> {
  let inventory = room.playerInventories.get(playerId);
  if (!inventory) {
    inventory = createStarterInventory();
    room.playerInventories.set(playerId, inventory);
  }
  return inventory;
}

export function ensurePlayerState(room: RoomState, playerId: string): ServerPlayerState {
  let state = room.playerStates.get(playerId);
  if (!state) {
    state = defaultServerPlayerState();
    room.playerStates.set(playerId, state);
  }
  return state;
}

export function canDebitPlayerInventory(room: RoomState, playerId: string, stacks: ItemStack[]): boolean {
  const inventory = ensurePlayerInventory(room, playerId);
  return stacks.every(stack => (inventory.get(stack.id) ?? 0) >= stack.qty);
}

export function applyPlayerInventoryDelta(
  room: RoomState,
  playerId: string,
  delta: { debit?: ItemStack[]; credit?: ItemStack[] }
): void {
  const inventory = ensurePlayerInventory(room, playerId);
  for (const stack of delta.debit ?? []) {
    const next = Math.max(0, (inventory.get(stack.id) ?? 0) - stack.qty);
    if (next === 0) inventory.delete(stack.id);
    else inventory.set(stack.id, next);
  }
  for (const stack of delta.credit ?? []) {
    inventory.set(stack.id, (inventory.get(stack.id) ?? 0) + stack.qty);
  }
}

export function applyPlayerStatePatch(
  room: RoomState,
  playerId: string,
  patch: AuthoritativePlayerStatePatch | undefined
): void {
  if (!patch) return;
  const state = ensurePlayerState(room, playerId);
  if (patch.vitals) state.vitals = { ...patch.vitals };
  if (patch.exhausted !== undefined) state.exhausted = patch.exhausted;
  if (patch.mawCharge !== undefined) state.mawCharge = patch.mawCharge;
  if (patch.waterskinFill !== undefined) state.waterskinFill = patch.waterskinFill;
}

export function createShard(worldId: string): ShardState {
  return {
    worldId,
    seq: 0,
    worldTimeMs: 0,
    events: [],
    poses: new Map(),
    commandCache: new Map(),
    mutationClaims: new Map(),
    predictedRollbacks: new Map()
  };
}

function createStarterInventory(): Map<string, number> {
  return new Map(starterInventory().map(stack => [stack.id, stack.qty]));
}

export function createWorldSnapshot(room: RoomState, worldId: string): JsonObject {
  const shard = room.shards.get(worldId) ?? createShard(worldId);
  return {
    roomId: room.roomId,
    worldId,
    seq: shard.seq,
    worldTimeMs: currentShardWorldTimeMs(room, shard),
    players: {
      poses: Object.fromEntries(shard.poses)
    },
    world: {
      events: shard.events
    }
  };
}

export function currentShardWorldTimeMs(room: RoomState, shard: ShardState, nowMs = Date.now()): number {
  return Math.max(0, shard.worldTimeMs + nowMs - room.createdAtMs);
}
