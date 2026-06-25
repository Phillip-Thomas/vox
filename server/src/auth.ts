import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ServerConfig } from './config.js';
import type { PlayerIdentity } from './protocol.js';

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<PlayerIdentity>;
}

export function createFirebaseTokenVerifier(config: ServerConfig): TokenVerifier {
  if (config.authDisabled) {
    return {
      async verifyIdToken(token: string): Promise<PlayerIdentity> {
        return {
          playerId: token || 'local-dev-player',
          displayName: 'Local Dev'
        };
      }
    };
  }

  ensureFirebaseApp(config);
  const auth = getAuth();
  return {
    async verifyIdToken(token: string): Promise<PlayerIdentity> {
      const decoded = await auth.verifyIdToken(token);
      return {
        playerId: decoded.uid,
        displayName: typeof decoded.name === 'string' ? decoded.name : undefined
      };
    }
  };
}

function ensureFirebaseApp(config: ServerConfig): void {
  if (getApps().length > 0) return;
  const appConfig = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? { credential: applicationDefault(), projectId: config.firebaseProjectId }
    : { projectId: config.firebaseProjectId };
  initializeApp(appConfig);
}

export function createStaticTokenVerifier(players: Record<string, PlayerIdentity>): TokenVerifier {
  return {
    async verifyIdToken(token: string): Promise<PlayerIdentity> {
      const player = players[token];
      if (!player) throw new Error('invalid token');
      return player;
    }
  };
}
