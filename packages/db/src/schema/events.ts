import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizers } from './organizers';

/** One event space owned by an organizer; the multi-tenancy boundary. */
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizerId: uuid('organizer_id')
    .notNull()
    .references(() => organizers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Free-form event date (ISO string) — optional for MVP.
  date: text('date'),
  // Short shareable code attendees use to access the event gallery.
  attendeeCode: text('attendee_code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
