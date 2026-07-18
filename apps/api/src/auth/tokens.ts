import { TOKEN_AUDIENCE } from '@eventlens/shared';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../http.js';

export interface OrganizerClaims {
  organizerId: string;
  email: string;
}

export function signOrganizerToken(organizerId: string, email: string): string {
  return jwt.sign({ email }, config.JWT_SECRET, {
    subject: organizerId,
    audience: TOKEN_AUDIENCE.organizer,
    expiresIn: '7d',
  });
}

export function verifyOrganizerToken(token: string): OrganizerClaims {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      audience: TOKEN_AUDIENCE.organizer,
    });
    if (typeof decoded === 'string' || !decoded.sub) throw unauthorized('Invalid token');
    return { organizerId: decoded.sub, email: String((decoded as jwt.JwtPayload).email ?? '') };
  } catch (err) {
    if (err instanceof Error && err.name === 'HttpError') throw err;
    throw unauthorized('Invalid or expired token');
  }
}

// ── Attendee (event-code) tokens ──────────────────────────────────────────────
export interface AttendeeClaims {
  eventId: string;
}

export function signAttendeeToken(eventId: string): string {
  return jwt.sign({}, config.JWT_SECRET, {
    subject: eventId,
    audience: TOKEN_AUDIENCE.attendee,
    expiresIn: config.ATTENDEE_TOKEN_TTL,
  });
}

export function verifyAttendeeToken(token: string): AttendeeClaims {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { audience: TOKEN_AUDIENCE.attendee });
    if (typeof decoded === 'string' || !decoded.sub) throw unauthorized('Invalid token');
    return { eventId: decoded.sub };
  } catch (err) {
    if (err instanceof Error && err.name === 'HttpError') throw err;
    throw unauthorized('Invalid or expired token');
  }
}

// ── Photographer upload-link tokens ───────────────────────────────────────────
export interface PhotographerClaims {
  photographerId: string;
  eventId: string;
}

export function signPhotographerToken(photographerId: string, eventId: string): string {
  return jwt.sign({ eventId }, config.JWT_SECRET, {
    subject: photographerId,
    audience: TOKEN_AUDIENCE.photographer,
    expiresIn: config.PHOTOGRAPHER_TOKEN_TTL,
  });
}

export function verifyPhotographerToken(token: string): PhotographerClaims {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { audience: TOKEN_AUDIENCE.photographer });
    if (typeof decoded === 'string' || !decoded.sub) throw unauthorized('Invalid token');
    const eventId = String((decoded as jwt.JwtPayload).eventId ?? '');
    if (!eventId) throw unauthorized('Invalid token');
    return { photographerId: decoded.sub, eventId };
  } catch (err) {
    if (err instanceof Error && err.name === 'HttpError') throw err;
    throw unauthorized('Invalid or expired token');
  }
}
