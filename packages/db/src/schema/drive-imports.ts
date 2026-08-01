import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';

/**
 * OAuth refresh token for a Google Drive import, so the worker can mint fresh
 * access tokens while downloading the folder's files.
 * NOTE: stored plaintext for dev — encrypt at rest before production.
 */
export const driveImports = pgTable('drive_imports', {
  eventId: uuid('event_id')
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DriveImport = typeof driveImports.$inferSelect;
export type NewDriveImport = typeof driveImports.$inferInsert;
