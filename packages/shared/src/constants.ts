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
  attendeeUser: 'eventlens:attendee-user',
  photographer: 'eventlens:photographer-upload',
} as const;

/** Allowed image content types for photo uploads. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Allowed video content types (frame-sampled for face detection). */
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export type AllowedVideoType = (typeof ALLOWED_VIDEO_TYPES)[number];

/** All uploadable media types. */
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export const isVideoType = (t: string): boolean =>
  (ALLOWED_VIDEO_TYPES as readonly string[]).includes(t);

/** Per-file upload size caps (bytes). */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
