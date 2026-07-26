import type { OrganizerClaims } from '../auth/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      organizer?: OrganizerClaims;
      /** Set by attendee event-code auth (phase 3.3). */
      attendee?: { eventId: string };
      /** Set by attendee-account auth (optional guest sign-in). */
      attendeeUser?: { attendeeUserId: string };
      /** Set by photographer upload-link auth (phase 3.4). */
      photographer?: { photographerId: string; eventId: string };
    }
  }
}

export {};
