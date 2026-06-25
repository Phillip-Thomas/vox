import { describe, expect, it } from 'vitest';
import { createMultiplayerConnection, isMultiplayerServerMessage, toWebSocketUrl } from './multiplayerClient.ts';

describe('multiplayer client URLs', () => {
  it('converts http and https server roots to the play socket', () => {
    expect(toWebSocketUrl('http://127.0.0.1:8080')).toBe('ws://127.0.0.1:8080/play');
    expect(toWebSocketUrl('https://paravoxia-state.run.app')).toBe('wss://paravoxia-state.run.app/play');
  });

  it('keeps explicit WebSocket URLs and preserves explicit paths', () => {
    expect(toWebSocketUrl('ws://localhost:8080/play')).toBe('ws://localhost:8080/play');
    expect(toWebSocketUrl('wss://example.com/custom')).toBe('wss://example.com/custom');
  });

  it('infers a protocol for localhost and deployed host shorthands', () => {
    expect(toWebSocketUrl('localhost:8080')).toBe('ws://localhost:8080/play');
    expect(toWebSocketUrl('state.paravoxia.com')).toBe('wss://state.paravoxia.com/play');
  });

  it('rejects empty URLs', () => {
    expect(() => toWebSocketUrl('')).toThrow('empty');
  });
});

describe('multiplayer server message validation', () => {
  it('accepts shaped protocol messages', () => {
    expect(isMultiplayerServerMessage({
      type: 'pose_update',
      playerId: 'remote',
      worldId: '0,0',
      seq: 4,
      pose: { position: [1, 2, 3] }
    })).toBe(true);
    expect(isMultiplayerServerMessage({
      type: 'predicted_world_event',
      roomId: 'room',
      worldId: '0,0',
      commandId: 'door-fast',
      event: { seq: 0, type: 'door_toggled', playerId: 'alice', payload: { cell: [1, 2, 3], face: 0, open: true } }
    })).toBe(true);
  });

  it('rejects malformed protocol messages', () => {
    expect(isMultiplayerServerMessage({ type: 'hello', protocolVersion: 999, serverTimeMs: 1 })).toBe(false);
    expect(isMultiplayerServerMessage({ type: 'world_snapshot', roomId: 'r', worldId: '0,0', seq: 1 })).toBe(false);
    expect(isMultiplayerServerMessage({ type: 'pose_update', playerId: 'remote', worldId: '0,0', seq: 1, pose: [] })).toBe(false);
  });
});

describe('multiplayer client messages', () => {
  it('queues subscribe and ack messages until authentication succeeds', () => {
    StubWebSocket.instances.length = 0;
    const connection = createMultiplayerConnection({
      serverUrl: 'http://127.0.0.1:8080',
      token: 'token',
      WebSocketImpl: StubWebSocket as unknown as typeof WebSocket
    });
    const socket = StubWebSocket.instances[0]!;

    socket.open();
    connection.send({ type: 'subscribe_world', worldId: '0,0', lastAppliedSeq: 4 });
    expect(socket.sent.map(parseSentType)).toEqual(['auth']);

    socket.message({ type: 'auth_ok', player: { playerId: 'alice' }, serverTimeMs: 1 });
    expect(socket.sent.map(parseSentType)).toEqual(['auth', 'subscribe_world']);

    connection.send({ type: 'ack_world_events', worldId: '0,0', appliedSeq: 5 });
    expect(socket.sent.map(parseSentType)).toEqual(['auth', 'subscribe_world', 'ack_world_events']);
  });

  it('sends resume cursor when joining a room after reconnect', () => {
    StubWebSocket.instances.length = 0;
    const connection = createMultiplayerConnection({
      serverUrl: 'http://127.0.0.1:8080',
      token: 'token',
      WebSocketImpl: StubWebSocket as unknown as typeof WebSocket
    });
    const socket = StubWebSocket.instances[0]!;

    socket.open();
    socket.message({ type: 'auth_ok', player: { playerId: 'alice' }, serverTimeMs: 1 });
    connection.joinRoom('abc123', { worldId: '0,0', lastAppliedSeq: 7 });

    expect(JSON.parse(socket.sent[socket.sent.length - 1]!)).toEqual({
      type: 'join_room',
      inviteCode: 'ABC123',
      resume: { worldId: '0,0', lastAppliedSeq: 7 }
    });
  });
});

class StubWebSocket {
  static instances: StubWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    StubWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  message(value: unknown): void {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

function parseSentType(raw: string): string {
  const parsed = JSON.parse(raw) as { type: string };
  return parsed.type;
}
