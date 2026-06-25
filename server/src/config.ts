export interface ServerConfig {
  port: number;
  nodeEnv: string;
  authDisabled: boolean;
  firebaseProjectId?: string;
  databaseUrl?: string;
  allowedOrigins: string[];
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? '8080');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8080;
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT),
    nodeEnv: env.NODE_ENV ?? 'development',
    authDisabled: parseBoolean(env.PARAVOXIA_AUTH_DISABLED),
    firebaseProjectId: env.FIREBASE_PROJECT_ID,
    databaseUrl: env.DATABASE_URL,
    allowedOrigins: parseList(env.PARAVOXIA_ALLOWED_ORIGINS)
  };
}
