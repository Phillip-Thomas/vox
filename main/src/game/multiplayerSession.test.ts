import { describe, expect, it } from 'vitest';
import {
  MULTIPLAYER_POSE_PUBLISH_INTERVAL_MS,
  planSnapshotReliableCommandReconciliation,
  resolveMultiplayerConfig,
  resolveMultiplayerPartyWarpDestination,
  shortPlayerId
} from './multiplayerSession.ts';

const readyEnv = {
  VITE_PARAVOXIA_COOP: '1',
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'paravox-game.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'paravox-game',
  VITE_FIREBASE_APP_ID: 'app',
  VITE_PARAVOXIA_STATE_SERVER_URL: 'http://127.0.0.1:8080'
};

describe('multiplayer session config', () => {
  it('uses a low-latency pose publish cadence', () => {
    expect(MULTIPLAYER_POSE_PUBLISH_INTERVAL_MS).toBeLessThanOrEqual(34);
  });

  it('keeps co-op disabled until the build flag is enabled', () => {
    expect(resolveMultiplayerConfig({}).reason).toBe('disabled');
  });

  it('reports missing Firebase config before opening a socket', () => {
    expect(resolveMultiplayerConfig({
      VITE_PARAVOXIA_COOP: '1',
      VITE_PARAVOXIA_STATE_SERVER_URL: 'http://127.0.0.1:8080'
    }).reason).toBe('missing_firebase_config');
  });

  it('reports missing state server URL after Firebase config is present', () => {
    expect(resolveMultiplayerConfig({
      ...readyEnv,
      VITE_PARAVOXIA_STATE_SERVER_URL: ''
    }).reason).toBe('missing_state_server_url');
  });

  it('accepts the full co-op config', () => {
    expect(resolveMultiplayerConfig(readyEnv)).toEqual({
      ok: true,
      enabled: true,
      serverUrl: 'http://127.0.0.1:8080',
      reason: 'ready'
    });
  });

  it('allows local validation auth to bypass Firebase web config', () => {
    expect(resolveMultiplayerConfig({
      VITE_PARAVOXIA_COOP: '1',
      VITE_PARAVOXIA_LOCAL_AUTH: '1',
      VITE_PARAVOXIA_STATE_SERVER_URL: 'http://127.0.0.1:8080'
    })).toEqual({
      ok: true,
      enabled: true,
      serverUrl: 'http://127.0.0.1:8080',
      reason: 'ready'
    });
  });

  it('shortens anonymous player ids for compact crew labels', () => {
    expect(shortPlayerId('alice')).toBe('alice');
    expect(shortPlayerId('0123456789abcdef')).toBe('0123...cdef');
  });

  it('preserves canonical planet identity for a same-coordinate party handoff', () => {
    expect(resolveMultiplayerPartyWarpDestination('-1,-1:p1')).toEqual({
      worldId: '-1,-1:p1',
      coordinate: { x: -1, y: -1 }
    });
    expect(resolveMultiplayerPartyWarpDestination({ x: -1, y: -1 })).toEqual({
      worldId: '-1,-1',
      coordinate: { x: -1, y: -1 }
    });
    expect(resolveMultiplayerPartyWarpDestination('-1,-1:p9')).toBeNull();
  });
});

describe('multiplayer reliable command reconnect reconciliation', () => {
  it('settles accepted snapshot commands and rolls back absent commands at the authoritative cursor', () => {
    const plan = planSnapshotReliableCommandReconciliation([
      { commandId: 'tree-accepted', worldId: '0,0' },
      { commandId: 'tree-lost-before-server', worldId: '0,0' },
      { commandId: 'other-world-pending', worldId: '1,0' }
    ], '0,0', new Set(['tree-accepted', 'unrelated-command']));

    expect(plan).toEqual({
      accepted: ['tree-accepted'],
      stale: ['tree-lost-before-server']
    });
  });
});
