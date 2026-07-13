import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import type { ServerConfig } from './config.js';
import type { PlayerIdentity } from './protocol.js';

const LOCAL_PLAYER_ID_HEX_LENGTH = 16;
const LOCAL_PLAYER_TOKEN_FALLBACK = 'local-dev-player';

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<PlayerIdentity>;
}

export function createFirebaseTokenVerifier(config: ServerConfig): TokenVerifier {
  if (config.authDisabled) {
    return {
      async verifyIdToken(token: string): Promise<PlayerIdentity> {
        // Auth-disabled mode still receives arbitrary bearer strings from local
        // clients and smoke tools. Never promote that secret into playerId:
        // room snapshots and structured rejection logs expose player IDs.
        const opaqueId = createHash('sha256')
          .update(token || LOCAL_PLAYER_TOKEN_FALLBACK)
          .digest('hex')
          .slice(0, LOCAL_PLAYER_ID_HEX_LENGTH);
        return {
          playerId: `local-${opaqueId}`,
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
