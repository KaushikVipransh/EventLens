import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES, FACE_EMBEDDING_DIM, PHOTO_STATUS } from './constants.js';

// ── Auth (organizer accounts) ────────────────────────────────────────────────
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Events ───────────────────────────────────────────────────────────────────
export const createEventSchema = z.object({
  name: z.string().min(1).max(160),
  // ISO date (yyyy-mm-dd) or full datetime; optional for MVP.
  date: z.string().min(1).max(40).optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Albums ────────────────────────────────────────────────────────────────────
export const createAlbumSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

// ── Photographers ─────────────────────────────────────────────────────────────
export const createPhotographerSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreatePhotographerInput = z.infer<typeof createPhotographerSchema>;

// ── Uploads ───────────────────────────────────────────────────────────────────
const uploadFileSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024), // 25 MB cap per photo
});

export const presignRequestSchema = z.object({
  files: z.array(uploadFileSchema).min(1).max(200),
});
export type PresignRequestInput = z.infer<typeof presignRequestSchema>;

export const uploadCompleteSchema = z.object({
  // Optional album to place this whole batch into (null/omitted = ungrouped).
  albumId: z.string().uuid().optional(),
  photos: z
    .array(
      z.object({
        storageKey: z.string().min(1).max(512),
        filename: z.string().min(1).max(255),
        contentType: z.enum(ALLOWED_IMAGE_TYPES),
        size: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(200),
});
export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;

// ── Attendee access ───────────────────────────────────────────────────────────
export const attendeeAccessSchema = z.object({
  code: z.string().min(4).max(40),
});
export type AttendeeAccessInput = z.infer<typeof attendeeAccessSchema>;

// ── Search ────────────────────────────────────────────────────────────────────
/** A raw embedding vector produced by the face service. */
export const embeddingSchema = z.array(z.number()).length(FACE_EMBEDDING_DIM);
export type Embedding = z.infer<typeof embeddingSchema>;

/** One detected face returned by the Python face service. */
export const detectedFaceSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // x1,y1,x2,y2
  detScore: z.number(),
  embedding: embeddingSchema,
});
export type DetectedFace = z.infer<typeof detectedFaceSchema>;

export const detectEmbedResponseSchema = z.object({
  faces: z.array(detectedFaceSchema),
});
export type DetectEmbedResponse = z.infer<typeof detectEmbedResponseSchema>;

export const photoStatusSchema = z.enum(PHOTO_STATUS);
