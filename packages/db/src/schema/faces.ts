import { index, jsonb, pgTable, real, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { events } from './events';
import { photos } from './photos';

// Mirrors FACE_EMBEDDING_DIM in @eventlens/shared (ArcFace = 512-d).
const FACE_EMBEDDING_DIM = 512;

/**
 * One detected face in a photo, with its ArcFace embedding.
 * `eventId` is denormalized so attendee search can filter to a single event
 * (multi-tenancy) before the vector similarity scan.
 */
export const faces = pgTable(
  'faces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // [x1, y1, x2, y2] pixel bounding box.
    bbox: jsonb('bbox').$type<[number, number, number, number]>().notNull(),
    detScore: real('det_score').notNull(),
    embedding: vector('embedding', { dimensions: FACE_EMBEDDING_DIM }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('faces_event_id_idx').on(table.eventId),
    // HNSW index for fast cosine-distance nearest-neighbour search.
    index('faces_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Face = typeof faces.$inferSelect;
export type NewFace = typeof faces.$inferInsert;
