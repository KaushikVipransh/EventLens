import { pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

// Mirrors FACE_EMBEDDING_DIM in @eventlens/shared (ArcFace = 512-d).
const FACE_EMBEDDING_DIM = 512;

/**
 * An optional attendee account. Lets a guest enroll their face once and then
 * find themselves across events without re-uploading a selfie each time.
 */
export const attendeeUsers = pgTable('attendee_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  // The enrolled reference face embedding (null until the user adds a selfie).
  faceEmbedding: vector('face_embedding', { dimensions: FACE_EMBEDDING_DIM }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AttendeeUser = typeof attendeeUsers.$inferSelect;
export type NewAttendeeUser = typeof attendeeUsers.$inferInsert;
