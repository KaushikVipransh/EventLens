import { customAlphabet } from 'nanoid';

/** Human-friendly attendee event code (no ambiguous 0/O/1/I). */
export const makeAttendeeCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

/** Opaque, URL-safe token embedded in a photographer upload link. */
export const makeUploadToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  24,
);

/** Opaque, URL-safe token embedded in a public share link. */
export const makeShareToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  20,
);
