import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, parseClientMessage } from '../src/protocol.js';

describe('protocol validation', () => {
  it('accepts known client messages at the current protocol version', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'auth',
      protocolVersion: PROTOCOL_VERSION,
      token: 'alice-token'
    }))).toMatchObject({ type: 'auth', token: 'alice-token' });

    expect(parseClientMessage(JSON.stringify({
      type: 'command',
      commandId: 'cmd-1',
      commandType: 'mineVoxel',
      worldId: '0,0',
      payload: { coord: [0, 1, 0] }
    }))).toMatchObject({ type: 'command', commandId: 'cmd-1' });

    expect(parseClientMessage(JSON.stringify({
      type: 'request_world_events',
      worldId: '0,0',
      sinceSeq: 1
    }))).toMatchObject({ type: 'request_world_events', sinceSeq: 1 });

    expect(parseClientMessage(JSON.stringify({
      type: 'join_room',
      inviteCode: 'ABC123',
      resume: { worldId: '0,0', lastAppliedSeq: 2 }
    }))).toMatchObject({
      type: 'join_room',
      inviteCode: 'ABC123',
      resume: { worldId: '0,0', lastAppliedSeq: 2 }
    });

    expect(parseClientMessage(JSON.stringify({
      type: 'subscribe_world',
      worldId: '0,0',
      lastAppliedSeq: 1
    }))).toMatchObject({ type: 'subscribe_world', lastAppliedSeq: 1 });

    expect(parseClientMessage(JSON.stringify({
      type: 'ack_world_events',
      worldId: '0,0',
      appliedSeq: 2
    }))).toMatchObject({ type: 'ack_world_events', appliedSeq: 2 });
  });

  it('rejects malformed or incompatible messages', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'auth',
      protocolVersion: PROTOCOL_VERSION + 1,
      token: 'alice-token'
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'command',
      commandId: 'cmd-1',
      worldId: '0,0',
      payload: {}
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'request_world_events',
      worldId: '0,0',
      sinceSeq: -1
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'subscribe_world',
      worldId: '0,0',
      lastAppliedSeq: -1
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'ack_world_events',
      worldId: '0,0',
      appliedSeq: -1
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      type: 'join_room',
      inviteCode: 'ABC123',
      resume: { worldId: '0,0', lastAppliedSeq: -1 }
    }))).toBeNull();
  });
});
