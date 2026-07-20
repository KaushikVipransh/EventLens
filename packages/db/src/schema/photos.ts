import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from './events';
import { photographers } from './photographers';

// Mirrors PHOTO_STATUS in @eventlens/shared (kept inline so drizzle-kit's
// config loader doesn't have to resolve the workspace package).
const PHOTO_STATUS = ['pending', 'processing', 'processed', 'failed'] as const;

export const photoStatusEnum = pgEnum('photo_status', PHOTO_STATUS);

/** An uploaded event photo and its processing state. */
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  photographerId: uuid('photographer_id').references(() => photographers.id, {
    onDelete: 'set null',
  }),
  storageKey: text('storage_key').notNull(),
  // Small resized preview for gallery grids (nullable until generated).
  thumbStorageKey: text('thumb_storage_key'),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  status: photoStatusEnum('status').notNull().default('pending'),
  faceCount: integer('face_count').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
