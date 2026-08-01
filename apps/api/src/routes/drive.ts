import { randomUUID } from 'node:crypto';
import { db, schema } from '@eventlens/db';
import { enqueuePhotoJob } from '@eventlens/queue';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
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

type DriveAuth = { key: string } | { bearer: string };

/** List image files in a Drive folder — via API key (public) or OAuth bearer. */
async function listDriveImages(folderId: string, auth: DriveAuth): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id,name,mimeType,size)',
    pageSize: '1000',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const headers: Record<string, string> = {};
  if ('bearer' in auth) headers.authorization = `Bearer ${auth.bearer}`;
  else params.set('key', auth.key);

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers,
  });
  if (res.status === 403 || res.status === 404) {
    throw badRequest(
      'Could not access that folder. Check the link, and that you have access to it.',
    );
  }
  if (!res.ok) throw badRequest(`Google Drive error (${res.status})`);
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

/** Create an ad-hoc event from Drive files and enqueue each for processing. */
async function createImportEvent(
  files: DriveFile[],
  refreshToken?: string,
): Promise<{ code: string; id: string }> {
  const organizerId = await ensureSystemOrganizer();
  const [event] = await db
    .insert(schema.events)
    .values({ organizerId, name: 'Google Drive import', attendeeCode: makeAttendeeCode() })
    .returning();

  if (refreshToken) {
    await db.insert(schema.driveImports).values({ eventId: event!.id, refreshToken });
  }

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
  return { code: event!.attendeeCode, id: event!.id };
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
 * Legacy API-key import (public folders only, small sizes — Google throttles
 * bulk downloads). Kept for convenience; the OAuth flow below is preferred.
 */
driveRouter.post(
  '/drive/session',
  asyncHandler(async (req, res) => {
    if (!config.GOOGLE_API_KEY) {
      throw badRequest('Google Drive import (API key) is not configured on this server.');
    }
    const { url } = parse(bodySchema, req.body);
    const folderId = parseDriveId(url);
    if (!folderId) throw badRequest('That does not look like a Google Drive folder link.');

    const files = (await listDriveImages(folderId, { key: config.GOOGLE_API_KEY })).slice(0, MAX_FILES);
    if (files.length === 0) {
      throw badRequest('No images found in that folder (or it is not shared publicly).');
    }
    const { code, id } = await createImportEvent(files);
    res.status(201).json({ code, token: signAttendeeToken(id), name: 'Google Drive import', count: files.length });
  }),
);

// ── OAuth import (reliable for large / private folders) ───────────────────────
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/** Step 1: bounce the user to Google's consent screen (folder carried in state). */
driveRouter.get(
  '/drive/oauth/start',
  asyncHandler(async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      throw badRequest('Google Drive OAuth is not configured on this server.');
    }
    const folderId = parseDriveId(String(req.query.url ?? ''));
    if (!folderId) throw badRequest('That does not look like a Google Drive folder link.');

    const state = jwt.sign({ folderId }, config.JWT_SECRET, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.GOOGLE_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    res.redirect(`${OAUTH_AUTH_URL}?${params.toString()}`);
  }),
);

/** Step 2: exchange the code, list the folder, create the import, open the gallery. */
driveRouter.get(
  '/drive/oauth/callback',
  asyncHandler(async (req, res) => {
    const fail = (msg: string) =>
      res.redirect(`${config.WEB_BASE_URL}/join?drive_error=${encodeURIComponent(msg)}`);

    if (req.query.error) return fail('Google sign-in was cancelled.');
    const code = String(req.query.code ?? '');
    const stateRaw = String(req.query.state ?? '');
    if (!code || !stateRaw) return fail('Missing authorization code.');

    let folderId: string;
    try {
      folderId = (jwt.verify(stateRaw, config.JWT_SECRET) as { folderId: string }).folderId;
    } catch {
      return fail('Your sign-in session expired — please try again.');
    }

    // Exchange the auth code for tokens.
    const tokenRes = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID!,
        client_secret: config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: config.GOOGLE_OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('Google sign-in failed. Please try again.');
    const tok = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (!tok.access_token || !tok.refresh_token) {
      return fail('Could not get Drive access. Remove EventLens from your Google account permissions and retry.');
    }

    try {
      const files = (await listDriveImages(folderId, { bearer: tok.access_token })).slice(0, MAX_FILES);
      if (files.length === 0) return fail('No images found in that folder.');
      const { code: eventCode } = await createImportEvent(files, tok.refresh_token);
      return res.redirect(`${config.WEB_BASE_URL}/e/${eventCode}`);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Import failed.');
    }
  }),
);
