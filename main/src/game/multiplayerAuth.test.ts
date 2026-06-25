import { describe, expect, it } from 'vitest';
import {
  getFirebaseClientConfig,
  getMultiplayerStateServerUrl,
  isCoopAuthEnabled,
  isLocalCoopAuthEnabled
} from './multiplayerAuth.ts';

describe('multiplayer auth config', () => {
  it('keeps co-op auth opt-in', () => {
    expect(isCoopAuthEnabled({})).toBe(false);
    expect(isCoopAuthEnabled({ VITE_PARAVOXIA_COOP: '1' })).toBe(true);
    expect(isCoopAuthEnabled({ VITE_PARAVOXIA_COOP: 'true' })).toBe(true);
    expect(isLocalCoopAuthEnabled({})).toBe(false);
    expect(isLocalCoopAuthEnabled({ VITE_PARAVOXIA_LOCAL_AUTH: '1' })).toBe(true);
  });

  it('requires the Firebase web app config before initializing auth', () => {
    expect(getFirebaseClientConfig({ VITE_FIREBASE_PROJECT_ID: 'paravox-game' })).toBeNull();
    expect(getFirebaseClientConfig({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'paravox-game.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'paravox-game',
      VITE_FIREBASE_APP_ID: 'app'
    })).toEqual({
      apiKey: 'key',
      authDomain: 'paravox-game.firebaseapp.com',
      projectId: 'paravox-game',
      appId: 'app'
    });
  });

  it('normalizes the optional state server URL gate', () => {
    expect(getMultiplayerStateServerUrl({})).toBeNull();
    expect(getMultiplayerStateServerUrl({ VITE_PARAVOXIA_STATE_SERVER_URL: '  ' })).toBeNull();
    expect(getMultiplayerStateServerUrl({ VITE_PARAVOXIA_STATE_SERVER_URL: ' https://state.run.app ' })).toBe('https://state.run.app');
  });
});
