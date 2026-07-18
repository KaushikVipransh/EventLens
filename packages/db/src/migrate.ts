import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { requireDatabaseUrl } from './env.js';

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

const sql = postgres(requireDatabaseUrl(), { max: 1 });

try {
  // pgvector must exist before migrations that declare vector(...) columns.
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(drizzle(sql), { migrationsFolder });
  console.log('Migrations applied from', migrationsFolder);
} finally {
  await sql.end();
}
