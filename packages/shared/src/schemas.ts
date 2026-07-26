import { z } from 'zod';
import {
  ALLOWED_MEDIA_TYPES,
  FACE_EMBEDDING_DIM,
  isVideoType,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PHOTO_STATUS,
} from './constants.js';

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

// ── Attendee accounts (optional guest sign-in) ────────────────────────────────
export const attendeeSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
});
export type AttendeeSignupInput = z.infer<typeof attendeeSignupSchema>;

export const attendeeLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type AttendeeLoginInput = z.infer<typeof attendeeLoginSchema>;

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

// ── Share links ───────────────────────────────────────────────────────────────
export const createShareLinkSchema = z.object({
  // Omitted = share the whole event; otherwise scope to one album.
  albumId: z.string().uuid().optional(),
  allowDownload: z.boolean().default(true),
  // Omitted = never expires.
  expiresInDays: z.number().int().positive().max(365).optional(),
});
export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

// ── Photographers ─────────────────────────────────────────────────────────────
export const createPhotographerSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreatePhotographerInput = z.infer<typeof createPhotographerSchema>;

// ── Uploads ───────────────────────────────────────────────────────────────────
const uploadFileSchema = z
  .object({
    filename: z.string().min(1).max(255),
    contentType: z.enum(ALLOWED_MEDIA_TYPES),
    size: z.number().int().positive(),
  })
  // Per-type size cap: photos 25 MB, videos 500 MB.
  .refine(
    (f) => f.size <= (isVideoType(f.contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES),
    { message: 'File exceeds the size limit', path: ['size'] },
  );

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
        contentType: z.enum(ALLOWED_MEDIA_TYPES),
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
