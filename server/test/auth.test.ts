import { describe, expect, it } from 'vitest';
import { createFirebaseTokenVerifier } from '../src/auth.js';
import type { ServerConfig } from '../src/config.js';

const LOCAL_CONFIG: ServerConfig = {
  port: 8080,
  nodeEnv: 'development',
  authDisabled: true,
  allowedOrigins: []
};

describe('auth-disabled player identity', () => {
  it('derives a stable opaque id without exposing the supplied bearer token', async () => {
    const verifier = createFirebaseTokenVerifier(LOCAL_CONFIG);
    const token = 'secret-local-bearer-token';

    const first = await verifier.verifyIdToken(token);
    const second = await verifier.verifyIdToken(token);
    const other = await verifier.verifyIdToken('different-token');

    expect(first).toEqual(second);
    expect(first.playerId).toMatch(/^local-[a-f0-9]{16}$/);
    expect(first.playerId).not.toContain(token);
    expect(other.playerId).not.toBe(first.playerId);
  });
});
