import WebSocket from 'ws';
import { PROTOCOL_VERSION, type ServerMessage } from '../src/protocol.js';

interface FirebaseAnonSession {
  idToken: string;
  localId: string;
}

const serverUrl = requiredEnv('PARAVOXIA_STATE_SERVER_URL');
const firebaseApiKey = requiredEnv('FIREBASE_WEB_API_KEY');
const worldId = process.env.PARAVOXIA_SMOKE_WORLD_ID ?? '0,0';

const alice = await signInAnonymously(firebaseApiKey);
const bob = await signInAnonymously(firebaseApiKey);
const charlie = await signInAnonymously(firebaseApiKey);

const aliceSocket = await connectPlayer(serverUrl, alice.idToken);
aliceSocket.send({ type: 'create_room', startWorldId: worldId });
const created = await aliceSocket.waitFor('room_created');
const aliceJoined = await aliceSocket.waitFor('room_joined');
await aliceSocket.waitFor('world_snapshot');

const bobSocket = await connectPlayer(serverUrl, bob.idToken);
bobSocket.send({ type: 'join_room', inviteCode: created.inviteCode });
const bobJoined = await bobSocket.waitFor('room_joined');
await bobSocket.waitFor('world_snapshot');

if (aliceJoined.roomId !== bobJoined.roomId) {
  throw new Error(`Players joined different rooms: ${aliceJoined.roomId} vs ${bobJoined.roomId}`);
}
if (bobJoined.inviteCode !== created.inviteCode) {
  throw new Error(`Invite code mismatch: ${bobJoined.inviteCode} vs ${created.inviteCode}`);
}

const commandId = `smoke-mine-${Date.now()}`;
const replicatedCommands = [
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId,
    commandType: 'voxel_mined',
    worldId: bobJoined.worldId,
    payload: { coord: [0, 1, 0] }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: `smoke-water-${Date.now()}`,
    commandType: 'water_flooded',
    worldId: bobJoined.worldId,
    payload: { cells: [[0, 1, 0]] }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: `smoke-tree-${Date.now()}`,
    commandType: 'resource_taken',
    worldId: bobJoined.worldId,
    payload: { source: 'tree', coord: [1, 2, 3], id: 'wood', qty: 2 }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: `smoke-structure-${Date.now()}`,
    commandType: 'structure_placed',
    worldId: bobJoined.worldId,
    payload: { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood', up: 2 }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: `smoke-door-${Date.now()}`,
    commandType: 'door_toggled',
    worldId: bobJoined.worldId,
    payload: { cell: [0, 0, 0], face: 3, open: true }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: `smoke-campfire-${Date.now()}`,
    commandType: 'campfire_placed',
    worldId: bobJoined.worldId,
    payload: { pos: [1, 1, 1], up: [0, 1, 0] }
  })
];
const accepted = replicatedCommands[0]!.accepted;
const bobWorldEvent = replicatedCommands[0]!.worldEvent;

const charlieSocket = await connectPlayer(serverUrl, charlie.idToken);
charlieSocket.send({ type: 'join_room', inviteCode: created.inviteCode });
const charlieJoined = await charlieSocket.waitFor('room_joined');
const charlieSnapshot = await charlieSocket.waitFor('world_snapshot');
const snapshotEvents = readSnapshotEvents(charlieSnapshot.snapshot);
if (charlieJoined.roomId !== created.roomId || charlieSnapshot.seq !== replicatedCommands.at(-1)!.accepted.seq) {
  throw new Error(`Late-join snapshot mismatch: room ${charlieJoined.roomId}, seq ${charlieSnapshot.seq}`);
}
if (!snapshotEvents.some(event => event.seq === accepted.seq && event.type === 'voxel_mined')) {
  throw new Error(`Late-join snapshot did not include replicated command ${commandId}`);
}

aliceSocket.close();
bobSocket.close();
charlieSocket.close();

console.log(JSON.stringify({
  ok: true,
  roomId: created.roomId,
  inviteCode: created.inviteCode,
  worldId: bobJoined.worldId,
  players: [alice.localId, bob.localId, charlie.localId],
  replicatedCommand: {
    commandId,
    seq: accepted.seq,
    event: bobWorldEvent.event
  },
  replicatedCommandTypes: replicatedCommands.map(command => readWorldEventType(command.worldEvent.event)),
  lateJoinSnapshot: {
    player: charlie.localId,
    seq: charlieSnapshot.seq,
    eventCount: snapshotEvents.length
  }
}, null, 2));

async function signInAnonymously(apiKey: string): Promise<FirebaseAnonSession> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!response.ok) {
    throw new Error(`Firebase anonymous sign-in failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as { idToken?: string; localId?: string };
  if (!data.idToken || !data.localId) {
    throw new Error('Firebase anonymous sign-in did not return an idToken/localId.');
  }
  return { idToken: data.idToken, localId: data.localId };
}

async function connectPlayer(baseUrl: string, idToken: string): Promise<SmokeSocket> {
  const ws = new WebSocket(toWebSocketUrl(baseUrl));
  const messages: ServerMessage[] = [];
  ws.on('message', data => messages.push(JSON.parse(data.toString()) as ServerMessage));
  await onceOpen(ws);
  await waitForType(messages, 'hello');
  ws.send(JSON.stringify({ type: 'auth', protocolVersion: PROTOCOL_VERSION, token: idToken }));
  await waitForType(messages, 'auth_ok');
  return {
    send(message) {
      ws.send(JSON.stringify(message));
    },
    waitFor(type) {
      return waitForType(messages, type);
    },
    waitForCommandAccepted(commandId) {
      return waitForMessage(messages, 'command_accepted', message => message.commandId === commandId);
    },
    waitForWorldEventSeq(seq) {
      return waitForMessage(messages, 'world_event', message => message.seq === seq);
    },
    close() {
      ws.close(1000, 'smoke_complete');
    }
  };
}

interface SmokeSocket {
  send(message:
    | { type: 'create_room'; startWorldId?: string }
    | { type: 'join_room'; inviteCode: string }
    | { type: 'command'; commandId: string; commandType: string; worldId: string; payload: Record<string, unknown> }
  ): void;
  waitFor<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>>;
  waitForCommandAccepted(commandId: string): Promise<Extract<ServerMessage, { type: 'command_accepted' }>>;
  waitForWorldEventSeq(seq: number): Promise<Extract<ServerMessage, { type: 'world_event' }>>;
  close(): void;
}

async function sendAndExpectWorldEvent(
  sender: SmokeSocket,
  observer: SmokeSocket,
  command: { commandId: string; commandType: string; worldId: string; payload: Record<string, unknown> }
): Promise<{
  accepted: Extract<ServerMessage, { type: 'command_accepted' }>;
  worldEvent: Extract<ServerMessage, { type: 'world_event' }>;
}> {
  sender.send({ type: 'command', ...command });
  const accepted = await sender.waitForCommandAccepted(command.commandId);
  const worldEvent = await observer.waitForWorldEventSeq(accepted.seq);
  if (accepted.commandId !== command.commandId || accepted.seq !== worldEvent.seq) {
    throw new Error(`Command replication mismatch: accepted ${accepted.commandId}/${accepted.seq}, event seq ${worldEvent.seq}`);
  }
  const eventType = readWorldEventType(worldEvent.event);
  if (eventType !== command.commandType) {
    throw new Error(`World event type mismatch: expected ${command.commandType}, saw ${eventType}`);
  }
  return { accepted, worldEvent };
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
  predicate: (message: Extract<ServerMessage, { type: T }>) => boolean
): Promise<Extract<ServerMessage, { type: T }>> {
  const started = Date.now();
  for (;;) {
    const found = messages
      .filter((message): message is Extract<ServerMessage, { type: T }> => message.type === type)
      .find(predicate);
    if (found) return found;
    if (Date.now() - started > 10000) throw new Error(`Timed out waiting for ${type}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

function toWebSocketUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  if (!url.pathname || url.pathname === '/') url.pathname = '/play';
  return url.toString();
}

function readSnapshotEvents(snapshot: Record<string, unknown>): Array<{ seq?: number; type?: string }> {
  const world = typeof snapshot.world === 'object' && snapshot.world !== null && !Array.isArray(snapshot.world)
    ? snapshot.world as Record<string, unknown>
    : {};
  return Array.isArray(world.events)
    ? world.events.filter((event): event is { seq?: number; type?: string } => typeof event === 'object' && event !== null)
    : [];
}

function readWorldEventType(event: unknown): string | undefined {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) return undefined;
  const type = (event as { type?: unknown }).type;
  return typeof type === 'string' ? type : undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
