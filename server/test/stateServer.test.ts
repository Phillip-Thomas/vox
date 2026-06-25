import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { readConfig } from '../src/config.js';
import { createStaticTokenVerifier } from '../src/auth.js';
import type { Database } from '../src/neon.js';
import { MultiplayerPersistence } from '../src/persistence.js';
import { createStateServer } from '../src/stateServer.js';
import { PROTOCOL_VERSION, type ServerMessage } from '../src/protocol.js';
import type { LoadedRoomState, RoomState, ShardEvent } from '../src/rooms.js';

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(server => server.close()));
});

describe('state server', () => {
  it('serves health and authenticated lobby endpoints', async () => {
    const started = await startTestServer();

    const health = await fetch(`${started.baseUrl}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: 'paravoxia-state-server' });

    const denied = await fetch(`${started.baseUrl}/v1/rooms`, { method: 'POST' });
    expect(denied.status).toBe(401);

    const created = await fetch(`${started.baseUrl}/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer alice-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ startWorldId: '5,-2' })
    });
    expect(created.status).toBe(201);
    const room = await created.json() as { inviteCode: string; worldIds: string[] };
    expect(room.worldIds).toEqual(['5,-2']);

    const joined = await fetch(`${started.baseUrl}/v1/rooms/${room.inviteCode}/join`, {
      method: 'POST',
      headers: { authorization: 'Bearer bob-token' }
    });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({ memberCount: 2 });
  });

  it('accepts authenticated WebSocket room and command messages', async () => {
    const started = await startTestServer();
    const ws = new WebSocket(`${started.wsUrl}/play`);
    const messages: ServerMessage[] = [];
    ws.on('message', data => messages.push(JSON.parse(data.toString()) as ServerMessage));

    await onceOpen(ws);
    await waitForType(messages, 'hello');
    ws.send(JSON.stringify({ type: 'auth', protocolVersion: PROTOCOL_VERSION, token: 'alice-token' }));
    await waitForType(messages, 'auth_ok');

    ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    const created = await waitForType(messages, 'room_created');
    await waitForType(messages, 'room_joined');
    const initialSnapshot = await waitForType(messages, 'world_snapshot');
    expect(initialSnapshot.snapshot.worldTimeMs).toEqual(expect.any(Number));

    ws.send(JSON.stringify({
      type: 'command',
      commandId: 'cmd-1',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [0, 1, 0] }
    }));
    const accepted = await waitForType(messages, 'command_accepted');
    expect(accepted).toMatchObject({ commandId: 'cmd-1', worldId: '0,0', seq: 1 });
    const event = await waitForType(messages, 'world_event');
    expect(event).toMatchObject({
      roomId: expect.any(String),
      worldId: '0,0',
      seq: 1,
      event: {
        seq: 1,
        type: 'voxel_mined',
        playerId: 'alice',
        payload: { coord: [0, 1, 0] }
      }
    });

    const lateWs = new WebSocket(`${started.wsUrl}/play`);
    const lateMessages: ServerMessage[] = [];
    lateWs.on('message', data => lateMessages.push(JSON.parse(data.toString()) as ServerMessage));
    await onceOpen(lateWs);
    await waitForType(lateMessages, 'hello');
    lateWs.send(JSON.stringify({ type: 'auth', protocolVersion: PROTOCOL_VERSION, token: 'bob-token' }));
    await waitForType(lateMessages, 'auth_ok');
    lateWs.send(JSON.stringify({ type: 'join_room', inviteCode: created.inviteCode }));
    await waitForType(lateMessages, 'room_joined');
    const lateSnapshot = await waitForType(lateMessages, 'world_snapshot');
    expect(lateSnapshot).toMatchObject({ worldId: '0,0', seq: 1 });
    expect(lateSnapshot.snapshot.worldTimeMs).toEqual(expect.any(Number));
    expect(lateSnapshot.snapshot).toMatchObject({
      world: {
        events: [
          {
            seq: 1,
            type: 'voxel_mined',
            playerId: 'alice',
            payload: { coord: [0, 1, 0] }
          }
        ]
      }
    });

    ws.send(JSON.stringify({
      type: 'command',
      commandId: 'cmd-2',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [1, 1, 0] }
    }));
    await waitForMessage(messages, 'command_accepted', message => message.commandId === 'cmd-2');

    lateWs.send(JSON.stringify({ type: 'subscribe_world', worldId: '0,0', lastAppliedSeq: 1 }));
    const replayed = await waitForMessage(lateMessages, 'world_event', message => message.seq === 2);
    expect(replayed).toMatchObject({
      worldId: '0,0',
      seq: 2,
      event: {
        seq: 2,
        type: 'voxel_mined',
        playerId: 'alice',
        payload: { coord: [1, 1, 0] }
      }
    });
    lateWs.send(JSON.stringify({ type: 'ack_world_events', worldId: '0,0', appliedSeq: 2 }));
    await waitForCondition(() => {
      const room = started.server.rooms.getRoom(created.roomId);
      return [...(room?.sessions.values() ?? [])]
        .some(session => session.player.playerId === 'bob' && session.appliedSeqByWorld.get('0,0') === 2);
    });

    lateWs.close();
    ws.close();
  });

  it('rejects command actor spoofing and inactive shard targets', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = await startTestServer();
    const alice = await connectAndAuth(started.wsUrl, 'alice-token');

    alice.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    const created = await waitForType(alice.messages, 'room_created');
    await waitForType(alice.messages, 'room_joined');
    await waitForType(alice.messages, 'world_snapshot');

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'wrong-world',
      commandType: 'voxel_mined',
      worldId: '9,9',
      payload: { coord: [0, 1, 0] }
    }));
    const wrongWorld = await waitForMessage(alice.messages, 'command_rejected', message => message.commandId === 'wrong-world');
    expect(wrongWorld).toMatchObject({ code: 'invalid_world' });
    expect(started.server.rooms.getRoom(created.roomId)?.shards.has('9,9')).toBe(false);

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'spoof-actor',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [0, 1, 0], actorId: 'bob' }
    }));
    const spoofed = await waitForMessage(alice.messages, 'command_rejected', message => message.commandId === 'spoof-actor');
    expect(spoofed).toMatchObject({ code: 'invalid_actor' });

    alice.ws.close();
  });

  it('keeps command ids idempotent while rejecting mismatched replays and bursts', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = await startTestServer();
    const alice = await connectAndAuth(started.wsUrl, 'alice-token');

    alice.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    await waitForType(alice.messages, 'room_created');
    await waitForType(alice.messages, 'room_joined');
    await waitForType(alice.messages, 'world_snapshot');

    const command = {
      type: 'command',
      commandId: 'stable-command-id',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [0, 1, 0] }
    };
    alice.ws.send(JSON.stringify(command));
    const accepted = await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === command.commandId);
    expect(accepted.seq).toBe(1);

    const retryStart = alice.messages.length;
    alice.ws.send(JSON.stringify(command));
    const retried = await waitForMessage(
      alice.messages,
      'command_accepted',
      message => message.commandId === command.commandId,
      retryStart
    );
    expect(retried.seq).toBe(1);

    alice.ws.send(JSON.stringify({
      ...command,
      payload: { coord: [1, 1, 0] }
    }));
    const replay = await waitForMessage(alice.messages, 'command_rejected', message => message.commandId === command.commandId);
    expect(replay).toMatchObject({ code: 'replay' });

    for (let i = 0; i < 25; i++) {
      alice.ws.send(JSON.stringify({
        type: 'command',
        commandId: `burst-${i}`,
        commandType: 'resource_taken',
        worldId: '0,0',
        payload: { source: 'tree', coord: [i, 2, 3], id: 'wood', qty: 1 }
      }));
    }
    const limited = await waitForMessage(alice.messages, 'command_rejected', message => message.code === 'rate_limited');
    expect(limited.reason).toContain('resource_taken');

    alice.ws.close();
  });

  it('enforces first-wins claims for shared world mutation targets', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = await startTestServer();
    const alice = await connectAndAuth(started.wsUrl, 'alice-token');

    alice.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    const created = await waitForType(alice.messages, 'room_created');
    await waitForType(alice.messages, 'room_joined');
    await waitForType(alice.messages, 'world_snapshot');

    const bob = await connectAndAuth(started.wsUrl, 'bob-token');
    bob.ws.send(JSON.stringify({ type: 'join_room', inviteCode: created.inviteCode }));
    await waitForType(bob.messages, 'room_joined');
    await waitForType(bob.messages, 'world_snapshot');

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'mine-first',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [4, 1, 0] }
    }));
    await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === 'mine-first');

    bob.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'mine-second',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [4, 1, 0] }
    }));
    await expectRejected(bob.messages, 'mine-second', 'conflict');

    bob.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'tree-first',
      commandType: 'resource_taken',
      worldId: '0,0',
      payload: { source: 'tree', coord: [2, 2, 3], id: 'wood', qty: 2 }
    }));
    await waitForMessage(bob.messages, 'command_accepted', message => message.commandId === 'tree-first');

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'tree-second',
      commandType: 'resource_taken',
      worldId: '0,0',
      payload: { source: 'tree', coord: [2, 2, 3], id: 'wood', qty: 2 }
    }));
    await expectRejected(alice.messages, 'tree-second', 'conflict');

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'structure-first',
      commandType: 'structure_placed',
      worldId: '0,0',
      payload: { cell: [3, 0, 0], face: 3, type: 'foundation', material: 'wood', up: 2 }
    }));
    await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === 'structure-first');

    bob.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'structure-second',
      commandType: 'structure_placed',
      worldId: '0,0',
      payload: { cell: [3, 0, 0], face: 3, type: 'foundation', material: 'wood', up: 2 }
    }));
    await expectRejected(bob.messages, 'structure-second', 'conflict');

    bob.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'structure-other-face',
      commandType: 'structure_placed',
      worldId: '0,0',
      payload: { cell: [3, 0, 0], face: 4, type: 'foundation', material: 'wood', up: 2 }
    }));
    await waitForMessage(bob.messages, 'command_accepted', message => message.commandId === 'structure-other-face');

    alice.ws.close();
    bob.ws.close();
  });

  it('authorizes campfire craft/place against server inventory atomically', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = await startTestServer();
    const alice = await connectAndAuth(started.wsUrl, 'alice-token');

    alice.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    const created = await waitForType(alice.messages, 'room_created');
    await waitForType(alice.messages, 'room_joined');
    await waitForType(alice.messages, 'world_snapshot');

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'campfire-too-soon',
      commandType: 'craft_campfire',
      worldId: '0,0',
      payload: { recipeId: 'campfire', pos: [1.25, 2.5, 3.75], up: [0, 1, 0] }
    }));
    await expectRejected(alice.messages, 'campfire-too-soon', 'validation_failed');

    const seedCommands = [
      {
        commandId: 'seed-biofiber',
        commandType: 'resource_taken',
        payload: { source: 'forage', kind: 'biofiber', coord: [1, 0, 0], id: 'biofiber', qty: 3 }
      },
      {
        commandId: 'craft-biofuel',
        commandType: 'recipe_crafted',
        payload: { recipeId: 'biofuel' }
      },
      {
        commandId: 'seed-wood',
        commandType: 'resource_taken',
        payload: { source: 'tree', coord: [2, 0, 0], id: 'wood', qty: 3 }
      },
      {
        commandId: 'seed-flint',
        commandType: 'resource_taken',
        payload: { source: 'loose_stone', coord: [3, 0, 0], id: 'flint', qty: 2 }
      }
    ];
    for (const command of seedCommands) {
      alice.ws.send(JSON.stringify({
        type: 'command',
        commandId: command.commandId,
        commandType: command.commandType,
        worldId: '0,0',
        payload: command.payload
      }));
      await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === command.commandId);
    }

    const roomBeforeCraft = started.server.rooms.getRoom(created.roomId);
    expect(roomBeforeCraft?.playerInventories.get('alice')).toEqual(new Map([
      ['faulty_maw', 1],
      ['biofuel', 1],
      ['wood', 3],
      ['flint', 2]
    ]));

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'campfire-authorized',
      commandType: 'craft_campfire',
      worldId: '0,0',
      payload: { recipeId: 'campfire', pos: [1.25, 2.5, 3.75], up: [0, 1, 0] }
    }));
    const accepted = await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === 'campfire-authorized');
    expect(accepted).toMatchObject({
      commandId: 'campfire-authorized',
      worldId: '0,0',
      seq: 6,
      events: [
        { seq: 5, type: 'recipe_crafted', payload: { recipeId: 'campfire' } },
        { seq: 6, type: 'campfire_placed', payload: { pos: [1.25, 2.5, 3.75], up: [0, 1, 0] } }
      ]
    });
    expect(started.server.rooms.getRoom(created.roomId)?.playerInventories.get('alice')).toEqual(new Map([
      ['faulty_maw', 1]
    ]));

    await waitForCondition(() => alice.messages
      .filter((message): message is Extract<ServerMessage, { type: 'world_event' }> => message.type === 'world_event')
      .filter(message => {
        const event = message.event as { commandId?: string };
        return event.commandId === 'campfire-authorized';
      }).length === 2);

    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'campfire-no-materials',
      commandType: 'craft_campfire',
      worldId: '0,0',
      payload: { recipeId: 'campfire', pos: [5, 2, 3], up: [0, 1, 0] }
    }));
    await expectRejected(alice.messages, 'campfire-no-materials', 'validation_failed');

    alice.ws.close();
  });

  it('hydrates persistent world events by room and world cursor', async () => {
    const persistence = new FakePersistence();
    const firstServer = await startTestServer({ persistence });
    const alice = await connectAndAuth(firstServer.wsUrl, 'alice-token');

    alice.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    const created = await waitForType(alice.messages, 'room_created');
    await waitForType(alice.messages, 'room_joined');
    await waitForType(alice.messages, 'world_snapshot');
    alice.ws.send(JSON.stringify({
      type: 'command',
      commandId: 'persisted-cmd-1',
      commandType: 'voxel_mined',
      worldId: '0,0',
      payload: { coord: [2, 1, 0] }
    }));
    await waitForMessage(alice.messages, 'command_accepted', message => message.commandId === 'persisted-cmd-1');

    const restartedServer = await startTestServer({ persistence });
    const bob = await connectAndAuth(restartedServer.wsUrl, 'bob-token');
    bob.ws.send(JSON.stringify({ type: 'join_room', inviteCode: created.inviteCode }));
    await waitForType(bob.messages, 'room_joined');
    const hydratedSnapshot = await waitForType(bob.messages, 'world_snapshot');
    expect(hydratedSnapshot).toMatchObject({ worldId: '0,0', seq: 1 });
    expect(hydratedSnapshot.snapshot).toMatchObject({
      world: {
        events: [
          {
            seq: 1,
            commandId: 'persisted-cmd-1',
            type: 'voxel_mined',
            playerId: 'alice',
            payload: { coord: [2, 1, 0] }
          }
        ]
      }
    });

    bob.ws.send(JSON.stringify({ type: 'request_world_events', worldId: '0,0', sinceSeq: 0 }));
    const replayed = await waitForMessage(bob.messages, 'world_event', message => message.seq === 1);
    expect(replayed).toMatchObject({
      roomId: created.roomId,
      worldId: '0,0',
      seq: 1,
      event: {
        commandId: 'persisted-cmd-1',
        type: 'voxel_mined',
        payload: { coord: [2, 1, 0] }
      }
    });

    const resuming = await connectAndAuth(restartedServer.wsUrl, 'charlie-token');
    resuming.ws.send(JSON.stringify({
      type: 'join_room',
      inviteCode: created.inviteCode,
      resume: { worldId: '0,0', lastAppliedSeq: 0 }
    }));
    await waitForType(resuming.messages, 'room_joined');
    const resumedEvent = await waitForMessage(resuming.messages, 'world_event', message => message.seq === 1);
    expect(resumedEvent).toMatchObject({
      worldId: '0,0',
      event: {
        commandId: 'persisted-cmd-1',
        type: 'voxel_mined'
      }
    });
    await wait(50);
    expect(resuming.messages.some(message => message.type === 'world_snapshot')).toBe(false);

    const dana = await connectAndAuth(restartedServer.wsUrl, 'dana-token');
    dana.ws.send(JSON.stringify({ type: 'create_room', startWorldId: '0,0' }));
    await waitForType(dana.messages, 'room_created');
    await waitForType(dana.messages, 'room_joined');
    const isolatedSnapshot = await waitForMessage(dana.messages, 'world_snapshot', message => message.worldId === '0,0');
    expect(isolatedSnapshot.seq).toBe(0);
    expect(isolatedSnapshot.snapshot).toMatchObject({ world: { events: [] } });

    alice.ws.close();
    bob.ws.close();
    resuming.ws.close();
    dana.ws.close();
  });
});

async function startTestServer(options: { persistence?: MultiplayerPersistence } = {}) {
  const config = readConfig({
    PORT: '0',
    NODE_ENV: 'test',
    PARAVOXIA_AUTH_DISABLED: 'false'
  });
  const tokenVerifier = createStaticTokenVerifier({
    'alice-token': { playerId: 'alice', displayName: 'Alice' },
    'bob-token': { playerId: 'bob', displayName: 'Bob' },
    'charlie-token': { playerId: 'charlie', displayName: 'Charlie' },
    'dana-token': { playerId: 'dana', displayName: 'Dana' }
  });
  const server = createStateServer({ config, tokenVerifier, persistence: options.persistence });
  await new Promise<void>((resolve, reject) => {
    server.httpServer.once('error', reject);
    server.httpServer.listen(0, '127.0.0.1', () => {
      server.httpServer.off('error', reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.httpServer.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}`
  };
}

async function connectAndAuth(wsUrl: string, token: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
  const ws = new WebSocket(`${wsUrl}/play`);
  const messages: ServerMessage[] = [];
  ws.on('message', data => messages.push(JSON.parse(data.toString()) as ServerMessage));
  await onceOpen(ws);
  await waitForType(messages, 'hello');
  ws.send(JSON.stringify({ type: 'auth', protocolVersion: PROTOCOL_VERSION, token }));
  await waitForType(messages, 'auth_ok');
  return { ws, messages };
}

function onceOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

async function waitForType<T extends ServerMessage['type']>(
  messages: ServerMessage[],
  type: T
): Promise<Extract<ServerMessage, { type: T }>> {
  return waitForMessage(messages, type, () => true);
}

async function waitForMessage<T extends ServerMessage['type']>(
  messages: ServerMessage[],
  type: T,
  predicate: (message: Extract<ServerMessage, { type: T }>) => boolean,
  startIndex = 0
): Promise<Extract<ServerMessage, { type: T }>> {
  const started = Date.now();
  for (;;) {
    const found = messages
      .slice(startIndex)
      .filter((message): message is Extract<ServerMessage, { type: T }> => message.type === type)
      .find(predicate);
    if (found) return found;
    if (Date.now() - started > 1500) throw new Error(`Timed out waiting for ${type}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
  const started = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - started > 1500) throw new Error('Timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function expectRejected(messages: ServerMessage[], commandId: string, code: string): Promise<void> {
  const rejected = await waitForMessage(
    messages,
    'command_rejected',
    message => message.commandId === commandId
  );
  expect(rejected).toMatchObject({ commandId, code });
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FakePersistence extends MultiplayerPersistence {
  private readonly roomsByInvite = new Map<string, LoadedRoomState>();
  private readonly eventsByRoomWorld = new Map<string, ShardEvent[]>();

  constructor() {
    super(fakeDatabase);
  }

  override get configured(): boolean {
    return true;
  }

  override async persistRoom(room: RoomState): Promise<void> {
    this.roomsByInvite.set(room.inviteCode, {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      ownerPlayerId: room.ownerPlayerId,
      createdAtMs: room.createdAtMs,
      members: [...room.members.values()],
      worldIds: [...room.shards.keys()]
    });
  }

  override async persistRoomMember(room: RoomState): Promise<void> {
    await this.persistRoom(room);
  }

  override async loadRoomByInvite(inviteCode: string): Promise<LoadedRoomState | null> {
    return this.roomsByInvite.get(inviteCode) ?? null;
  }

  override async appendCommandEvent(input: {
    room: RoomState;
    worldId: string;
    actor: { playerId: string };
    commandId: string;
    commandType: string;
    payload: Record<string, unknown>;
  }): Promise<ShardEvent> {
    await this.persistRoom(input.room);
    const key = eventKey(input.room.roomId, input.worldId);
    const events = this.eventsByRoomWorld.get(key) ?? [];
    const existing = events.find(event => event.commandId === input.commandId);
    if (existing) return existing;
    const event: ShardEvent = {
      seq: events.length + 1,
      eventId: `${input.commandId}:0`,
      commandId: input.commandId,
      type: input.commandType,
      playerId: input.actor.playerId,
      payload: input.payload,
      timeMs: Date.now()
    };
    events.push(event);
    this.eventsByRoomWorld.set(key, events);
    return event;
  }

  override async listWorldEvents(roomId: string, worldId: string, sinceSeq = 0): Promise<ShardEvent[]> {
    return (this.eventsByRoomWorld.get(eventKey(roomId, worldId)) ?? [])
      .filter(event => event.seq > sinceSeq);
  }
}

const fakeDatabase: Database = {
  configured: false,
  async query<T>(): Promise<T[]> {
    return [];
  },
  async transaction<T>(): Promise<T[][]> {
    return [];
  }
};

function eventKey(roomId: string, worldId: string): string {
  return `${roomId}::${worldId}`;
}
