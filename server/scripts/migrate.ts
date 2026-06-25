import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../src/config.js';
import { createDatabase } from '../src/neon.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'migrations');
const config = readConfig();
const db = createDatabase(config);

if (!db.configured) {
  throw new Error('DATABASE_URL is required to run migrations.');
}

await db.query(`
  create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);

const files = (await readdir(migrationsDir))
  .filter(file => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  const version = file.replace(/\.sql$/, '');
  const existing = await db.query<{ version: string }>(
    'select version from schema_migrations where version = $1',
    [version]
  );
  if (existing.length > 0) {
    console.log(`skip ${version}`);
    continue;
  }
  const sql = await readFile(join(migrationsDir, file), 'utf8');
  await db.transaction([
    ...splitSqlStatements(sql).map(statement => ({ sql: statement })),
    { sql: 'insert into schema_migrations (version) values ($1)', params: [version] }
  ]);
  console.log(`applied ${version}`);
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
}
