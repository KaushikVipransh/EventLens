import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';

/** A contributing photographer invited to upload into a single event pool. */
export const photographers = pgTable('photographers', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Opaque token embedded in the scoped upload link (also encoded in a JWT).
  uploadToken: text('upload_token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Photographer = typeof photographers.$inferSelect;
export type NewPhotographer = typeof photographers.$inferInsert;
