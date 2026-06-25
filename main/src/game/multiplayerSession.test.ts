import { describe, expect, it } from 'vitest';
import { resolveMultiplayerConfig } from './multiplayerSession.ts';

const readyEnv = {
  VITE_PARAVOXIA_COOP: '1',
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'paravox-game.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'paravox-game',
  VITE_FIREBASE_APP_ID: 'app',
  VITE_PARAVOXIA_STATE_SERVER_URL: 'http://127.0.0.1:8080'
};

describe('multiplayer session config', () => {
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
});
