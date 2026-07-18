import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireDatabaseUrl } from './env.js';
import * as schema from './schema/index.js';

/**
 * Shared postgres-js connection. `max: 10` keeps us well under free-tier
 * connection caps; raise for the worker if throughput demands it.
 */
export const queryClient = postgres(requireDatabaseUrl(), { max: 10 });

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
