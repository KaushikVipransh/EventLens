import { randomUUID } from 'node:crypto';
import { db, schema } from '@eventlens/db';
import { enqueuePhotoJob } from '@eventlens/queue';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { signAttendeeToken } from '../auth/tokens.js';
import { config } from '../config.js';
import { asyncHandler, badRequest, parse } from '../http.js';
import { makeAttendeeCode } from '../ids.js';
import { buildPhotoKey } from '../storage.js';

export const driveRouter = Router();

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

const MAX_FILES = 500;
const SYSTEM_ORG_EMAIL = 'system+drive@eventlens.local';

/** Pull the folder (or file) id out of common Google Drive link shapes. */
function parseDriveId(url: string): string | null {
  const patterns = [/\/folders\/([A-Za-z0-9_-]+)/, /[?&]id=([A-Za-z0-9_-]+)/, /\/d\/([A-Za-z0-9_-]+)/];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  // Bare id pasted directly.
  if (/^[A-Za-z0-9_-]{10,}$/.test(url.trim())) return url.trim();
  return null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

/** List image files in a public/shared Drive folder via the Drive API. */
async function listDriveImages(folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    key: config.GOOGLE_API_KEY!,
    fields: 'files(id,name,mimeType,size)',
    pageSize: '1000',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
  if (res.status === 403 || res.status === 404) {
    throw badRequest(
      'Could not access that folder. Make sure it is shared as "Anyone with the link can view".',
    );
  }
  if (!res.ok) throw badRequest(`Google Drive error (${res.status})`);
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

/** A shared system organizer that owns ad-hoc Drive-import events. */
async function ensureSystemOrganizer(): Promise<string> {
  const existing = await db.query.organizers.findFirst({
    where: eq(schema.organizers.email, SYSTEM_ORG_EMAIL),
    columns: { id: true },
  });
  if (existing) return existing.id;
  const passwordHash = await hashPassword(`sys-${randomUUID()}`);
  const [org] = await db
    .insert(schema.organizers)
    .values({ email: SYSTEM_ORG_EMAIL, passwordHash, name: 'Drive Imports' })
    .returning({ id: schema.organizers.id });
  return org!.id;
}

/**
 * Import a Google Drive folder: list its images, create an ad-hoc event, and
 * enqueue each image for face processing. Returns the event code so the client
 * can drop into the normal gallery (with selfie search) while it processes.
 */
driveRouter.post(
  '/drive/session',
  asyncHandler(async (req, res) => {
    if (!config.GOOGLE_API_KEY) {
      throw badRequest('Google Drive import is not configured on this server (GOOGLE_API_KEY).');
    }
    const { url } = parse(bodySchema, req.body);
    const folderId = parseDriveId(url);
    if (!folderId) throw badRequest('That does not look like a Google Drive folder link.');

    const files = (await listDriveImages(folderId)).slice(0, MAX_FILES);
    if (files.length === 0) {
      throw badRequest('No images found in that folder (or it is not shared publicly).');
    }

    const organizerId = await ensureSystemOrganizer();
    const [event] = await db
      .insert(schema.events)
      .values({ organizerId, name: 'Google Drive import', attendeeCode: makeAttendeeCode() })
      .returning();

    const rows = files.map((f) => ({
      eventId: event!.id,
      storageKey: buildPhotoKey(event!.id, f.name),
      filename: f.name,
      contentType: f.mimeType,
      size: f.size ? Number(f.size) : 0,
      status: 'pending' as const,
    }));
    const inserted = await db
      .insert(schema.photos)
      .values(rows)
      .returning({ id: schema.photos.id, storageKey: schema.photos.storageKey });

    await Promise.all(
      inserted.map((p, i) =>
        enqueuePhotoJob({
          photoId: p.id,
          eventId: event!.id,
          storageKey: p.storageKey,
          driveFileId: files[i]!.id,
        }),
      ),
    );

    res.status(201).json({
      code: event!.attendeeCode,
      token: signAttendeeToken(event!.id),
      name: event!.name,
      count: inserted.length,
    });
  }),
);
