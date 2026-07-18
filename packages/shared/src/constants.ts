/** Dimensionality of ArcFace (InsightFace buffalo_l) face embeddings. */
export const FACE_EMBEDDING_DIM = 512;

/** Lifecycle of an uploaded photo through the processing pipeline. */
export const PHOTO_STATUS = ['pending', 'processing', 'processed', 'failed'] as const;
export type PhotoStatus = (typeof PHOTO_STATUS)[number];

/** Roles for account-holding users (attendees are tokenized, not accounts). */
export const USER_ROLE = ['organizer', 'photographer'] as const;
export type UserRole = (typeof USER_ROLE)[number];

/** Token audiences — keeps attendee/photographer/organizer JWTs non-interchangeable. */
export const TOKEN_AUDIENCE = {
  organizer: 'eventlens:organizer',
  attendee: 'eventlens:attendee',
  photographer: 'eventlens:photographer-upload',
} as const;

/** Allowed image content types for photo uploads. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
