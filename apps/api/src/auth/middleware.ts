import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../http.js';
import {
  verifyAttendeeToken,
  verifyOrganizerToken,
  verifyPhotographerToken,
} from './tokens.js';

function bearer(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
  return header.slice('Bearer '.length).trim();
}

/** Require a valid organizer JWT; attaches `req.organizer`. */
export function requireOrganizer(req: Request, _res: Response, next: NextFunction): void {
  req.organizer = verifyOrganizerToken(bearer(req));
  next();
}

/** Require a valid attendee event-code JWT; attaches `req.attendee`. */
export function requireAttendee(req: Request, _res: Response, next: NextFunction): void {
  req.attendee = verifyAttendeeToken(bearer(req));
  next();
}

/** Require a valid photographer upload-link JWT; attaches `req.photographer`. */
export function requirePhotographer(req: Request, _res: Response, next: NextFunction): void {
  req.photographer = verifyPhotographerToken(bearer(req));
  next();
}
