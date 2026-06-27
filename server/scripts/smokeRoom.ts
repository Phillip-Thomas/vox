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

const timestamp = Date.now();
const forgedTreeCommandId = `smoke-forged-tree-${timestamp}`;
const forgedVoxelCommandId = `smoke-forged-voxel-${timestamp}`;
const structureCommandId = `smoke-structure-${timestamp}`;
const removeStructureCommandId = `smoke-remove-structure-${timestamp}`;
const refundStructureCommandId = `smoke-refund-structure-${timestamp}`;
const unaffordableStructureCommandId = `smoke-no-wood-structure-${timestamp}`;
const invalidForageCommandId = `smoke-invalid-forage-${timestamp}`;
const outOfBoundsResourceCommandId = `smoke-oob-resource-${timestamp}`;
const forgedDepositCommandId = `smoke-forged-deposit-${timestamp}`;
const replicatedCommands = [
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: forgedTreeCommandId,
    commandType: 'resource_taken',
    worldId: bobJoined.worldId,
    payload: { source: 'tree', coord: [21, 2, 3], id: 'void_glass', qty: 999 }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: forgedVoxelCommandId,
    commandType: 'voxel_mined',
    worldId: bobJoined.worldId,
    payload: {
      coord: [0, 1, 0],
      blockId: 'stone',
      deposit: null,
      drops: [{ id: 'void_glass', qty: 999 }],
      exposedNeighbors: 999,
      flooded: []
    }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: structureCommandId,
    commandType: 'structure_placed',
    worldId: bobJoined.worldId,
    payload: { cell: [23, 0, 0], face: 0, type: 'foundation', material: 'wood', state: { forged: true } }
  }),
  await sendAndExpectWorldEvent(bobSocket, aliceSocket, {
    commandId: removeStructureCommandId,
    commandType: 'structure_removed',
    worldId: bobJoined.worldId,
    payload: { cell: [23, 0, 0], face: 0, refund: [{ id: 'void_glass', qty: 999 }] }
  }),
  await sendAndExpectWorldEvent(aliceSocket, bobSocket, {
    commandId: refundStructureCommandId,
    commandType: 'structure_placed',
    worldId: bobJoined.worldId,
    payload: { cell: [23, 0, 0], face: 0, type: 'wall', material: 'wood' }
  })
];
const forgedTree = replicatedCommands[0]!;
const forgedVoxel = replicatedCommands[1]!;
const structure = replicatedCommands[2]!;
const removedStructure = replicatedCommands[3]!;
const refundStructure = replicatedCommands[4]!;
const treePayload = readEventPayload(forgedTree.accepted.events[0]);
if (treePayload.id !== 'wood' || treePayload.qty === 999) {
  throw new Error(`Forged tree yield was not canonicalized: ${JSON.stringify(treePayload)}`);
}
const voxelPayload = readEventPayload(forgedVoxel.accepted.events[0]);
const voxelDrops = Array.isArray(voxelPayload.drops) ? voxelPayload.drops : [];
if (voxelDrops.some(drop => readPayload(drop).id === 'void_glass')) {
  throw new Error(`Forged voxel yield kept void_glass: ${JSON.stringify(voxelPayload)}`);
}
if (!voxelDrops.some(drop => readPayload(drop).id === 'stone')) {
  throw new Error(`Canonical voxel yield did not include stone: ${JSON.stringify(voxelPayload)}`);
}
const structurePayload = readEventPayload(structure.accepted.events[0]);
if (
  structurePayload.type !== 'foundation'
  || structurePayload.material !== 'wood'
  || readPayload(structurePayload.state).forged === true
) {
  throw new Error(`Structure placement was not canonicalized: ${JSON.stringify(structurePayload)}`);
}
const removedStructurePayload = readEventPayload(removedStructure.accepted.events[0]);
const removedStructureCell = Array.isArray(removedStructurePayload.cell)
  ? removedStructurePayload.cell.join(',')
  : '';
if (
  removedStructureCell !== '23,0,0'
  || removedStructurePayload.face !== 0
  || readPayload(removedStructurePayload.refund).id === 'void_glass'
) {
  throw new Error(`Structure removal was not canonicalized: ${JSON.stringify(removedStructurePayload)}`);
}
const refundStructurePayload = readEventPayload(refundStructure.accepted.events[0]);
if (refundStructurePayload.type !== 'wall' || refundStructurePayload.material !== 'wood') {
  throw new Error(`Owner refund did not fund the follow-up wall placement: ${JSON.stringify(refundStructurePayload)}`);
}

aliceSocket.send({
  type: 'command',
  commandId: invalidForageCommandId,
  commandType: 'resource_taken',
  worldId: bobJoined.worldId,
  payload: { source: 'forage', kind: 'biofuel', coord: [21, 2, 1], id: 'biofuel', qty: 1 }
});
const rejected = await aliceSocket.waitForCommandRejected(invalidForageCommandId);
if (rejected.code !== 'validation_failed') {
  throw new Error(`Invalid forage rejected with unexpected code: ${rejected.code}`);
}
aliceSocket.send({
  type: 'command',
  commandId: outOfBoundsResourceCommandId,
  commandType: 'resource_taken',
  worldId: bobJoined.worldId,
  payload: { source: 'tree', coord: [26, 0, 0], id: 'wood', qty: 1 }
});
const outOfBoundsRejected = await aliceSocket.waitForCommandRejected(outOfBoundsResourceCommandId);
if (outOfBoundsRejected.code !== 'validation_failed') {
  throw new Error(`Out-of-bounds resource rejected with unexpected code: ${outOfBoundsRejected.code}`);
}
aliceSocket.send({
  type: 'command',
  commandId: forgedDepositCommandId,
  commandType: 'voxel_mined',
  worldId: bobJoined.worldId,
  payload: {
    coord: [22, 2, 0],
    blockId: 'stone',
    deposit: { resourceId: 'void_glass', richness: 1, scanLevel: 4 },
    drops: [{ id: 'void_glass', qty: 999 }]
  }
});
const forgedDepositRejected = await aliceSocket.waitForCommandRejected(forgedDepositCommandId);
if (forgedDepositRejected.code !== 'validation_failed') {
  throw new Error(`Forged deposit rejected with unexpected code: ${forgedDepositRejected.code}`);
}
bobSocket.send({
  type: 'command',
  commandId: unaffordableStructureCommandId,
  commandType: 'structure_placed',
  worldId: bobJoined.worldId,
  payload: { cell: [24, 0, 0], face: 0, type: 'foundation', material: 'wood' }
});
const unaffordableStructureRejected = await bobSocket.waitForCommandRejected(unaffordableStructureCommandId);
if (unaffordableStructureRejected.code !== 'validation_failed') {
  throw new Error(`Unaffordable structure rejected with unexpected code: ${unaffordableStructureRejected.code}`);
}

const charlieSocket = await connectPlayer(serverUrl, charlie.idToken);
charlieSocket.send({ type: 'join_room', inviteCode: created.inviteCode });
const charlieJoined = await charlieSocket.waitFor('room_joined');
const charlieSnapshot = await charlieSocket.waitFor('world_snapshot');
const snapshotEvents = readSnapshotEvents(charlieSnapshot.snapshot);
if (charlieJoined.roomId !== created.roomId || charlieSnapshot.seq !== replicatedCommands.at(-1)!.accepted.seq) {
  throw new Error(`Late-join snapshot mismatch: room ${charlieJoined.roomId}, seq ${charlieSnapshot.seq}`);
}
if (!snapshotEvents.some(event => event.seq === forgedTree.accepted.seq && event.type === 'resource_taken')) {
  throw new Error(`Late-join snapshot did not include replicated command ${forgedTreeCommandId}`);
}
if (!snapshotEvents.some(event => event.seq === forgedVoxel.accepted.seq && event.type === 'voxel_mined')) {
  throw new Error(`Late-join snapshot did not include replicated command ${forgedVoxelCommandId}`);
}
if (!snapshotEvents.some(event => event.seq === structure.accepted.seq && event.type === 'structure_placed')) {
  throw new Error(`Late-join snapshot did not include replicated command ${structureCommandId}`);
}
if (!snapshotEvents.some(event => event.seq === removedStructure.accepted.seq && event.type === 'structure_removed')) {
  throw new Error(`Late-join snapshot did not include replicated command ${removeStructureCommandId}`);
}
if (!snapshotEvents.some(event => event.seq === refundStructure.accepted.seq && event.type === 'structure_placed')) {
  throw new Error(`Late-join snapshot did not include replicated command ${refundStructureCommandId}`);
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
  canonicalResource: {
    commandId: forgedTreeCommandId,
    seq: forgedTree.accepted.seq,
    payload: treePayload
  },
  canonicalVoxel: {
    commandId: forgedVoxelCommandId,
    seq: forgedVoxel.accepted.seq,
    payload: voxelPayload
  },
  authoritativeStructure: {
    commandId: structureCommandId,
    seq: structure.accepted.seq,
    payload: structurePayload
  },
  removedStructure: {
    commandId: removeStructureCommandId,
    seq: removedStructure.accepted.seq,
    payload: removedStructurePayload
  },
  refundFundedStructure: {
    commandId: refundStructureCommandId,
    seq: refundStructure.accepted.seq,
    payload: refundStructurePayload
  },
  rejectedCommands: [
    { commandId: invalidForageCommandId, code: rejected.code },
    { commandId: outOfBoundsResourceCommandId, code: outOfBoundsRejected.code },
    { commandId: forgedDepositCommandId, code: forgedDepositRejected.code },
    { commandId: unaffordableStructureCommandId, code: unaffordableStructureRejected.code }
  ],
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
    waitForCommandRejected(commandId) {
      return waitForMessage(messages, 'command_rejected', message => message.commandId === commandId);
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
  waitForCommandRejected(commandId: string): Promise<Extract<ServerMessage, { type: 'command_rejected' }>>;
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
    if (Date.now() - started > 10000) {
      throw new Error(`Timed out waiting for ${type}. Recent messages: ${JSON.stringify(messages.slice(-8))}`);
    }
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

function readPayload(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readEventPayload(value: unknown): Record<string, unknown> {
  return readPayload(readPayload(value).payload);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
