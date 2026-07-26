import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { albums } from './albums';
import { events } from './events';

/** A public, tokenized read-only link to an event (or a single album). */
export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  // null = the whole event; otherwise scoped to one album.
  albumId: uuid('album_id').references(() => albums.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  allowDownload: boolean('allow_download').notNull().default(true),
  // null = never expires.
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
export type NewShareLink = typeof shareLinks.$inferInsert;
