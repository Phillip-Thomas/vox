import { neon } from '@neondatabase/serverless';
import type { ServerConfig } from './config.js';

export interface Database {
  configured: boolean;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T = Record<string, unknown>>(queries: Array<{ sql: string; params?: unknown[] }>): Promise<T[][]>;
}

export function createDatabase(config: ServerConfig): Database {
  if (!config.databaseUrl) {
    return {
      configured: false,
      async query<T = Record<string, unknown>>(): Promise<T[]> {
        throw new Error('DATABASE_URL is not configured.');
      },
      async transaction<T = Record<string, unknown>>(): Promise<T[][]> {
        throw new Error('DATABASE_URL is not configured.');
      }
    };
  }

  const sql = neon(config.databaseUrl);
  return {
    configured: true,
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      return sql.query(text, params) as Promise<T[]>;
    },
    async transaction<T = Record<string, unknown>>(queries: Array<{ sql: string; params?: unknown[] }>): Promise<T[][]> {
      return sql.transaction(txn => queries.map(query => txn.query(query.sql, query.params ?? []))) as Promise<T[][]>;
    }
  };
}
