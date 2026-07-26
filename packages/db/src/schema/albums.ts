import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';

/** A named grouping of photos within an event (like a Drive folder). */
export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
