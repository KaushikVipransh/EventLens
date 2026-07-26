import { db, queryClient, schema } from '@eventlens/db';
import {
  attendeeLoginSchema,
  attendeeSignupSchema,
  detectEmbedResponseSchema,
} from '@eventlens/shared';
import { eq } from 'drizzle-orm';
import express, { Router } from 'express';
import { z } from 'zod';
import { requireAttendeeUser } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signAttendeeUserToken } from '../auth/tokens.js';
import { config } from '../config.js';
import { asyncHandler, badRequest, conflict, notFound, parse, unauthorized } from '../http.js';
import { presignGet } from '../storage.js';

export const attendeeAuthRouter = Router();

const publicUser = (u: { id: string; email: string; name: string; faceEmbedding: unknown }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  hasFace: u.faceEmbedding != null,
});

attendeeAuthRouter.post(
  '/attendee-auth/signup',
  asyncHandler(async (req, res) => {
    const input = parse(attendeeSignupSchema, req.body);
    const existing = await db.query.attendeeUsers.findFirst({
      where: eq(schema.attendeeUsers.email, input.email),
    });
    if (existing) throw conflict('An account with that email already exists');

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(schema.attendeeUsers)
      .values({ email: input.email, passwordHash, name: input.name })
      .returning();
    res.status(201).json({ token: signAttendeeUserToken(user!.id), user: publicUser(user!) });
  }),
);

attendeeAuthRouter.post(
  '/attendee-auth/login',
  asyncHandler(async (req, res) => {
    const input = parse(attendeeLoginSchema, req.body);
    const user = await db.query.attendeeUsers.findFirst({
      where: eq(schema.attendeeUsers.email, input.email),
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized('Invalid email or password');
    }
    res.json({ token: signAttendeeUserToken(user.id), user: publicUser(user) });
  }),
);

attendeeAuthRouter.get(
  '/attendee-auth/me',
  requireAttendeeUser,
  asyncHandler(async (req, res) => {
    const user = await db.query.attendeeUsers.findFirst({
      where: eq(schema.attendeeUsers.id, req.attendeeUser!.attendeeUserId),
    });
    if (!user) throw notFound('Account not found');
    res.json({ user: publicUser(user) });
  }),
);

/** Enroll (or replace) the account's reference face from a selfie. */
attendeeAuthRouter.post(
  '/attendee-auth/face',
  requireAttendeeUser,
  express.raw({ type: '*/*', limit: '12mb' }),
  asyncHandler(async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Missing selfie image');

    const faceRes = await fetch(`${config.FACE_SERVICE_URL}/detect-embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body,
    });
    if (!faceRes.ok) throw badRequest(`Face service error (${faceRes.status})`);
    const { faces } = detectEmbedResponseSchema.parse(await faceRes.json());
    if (faces.length === 0) throw badRequest('No face detected in the selfie. Try again.');

    const best = faces.reduce((a, b) => (b.detScore > a.detScore ? b : a));
    await db
      .update(schema.attendeeUsers)
      .set({ faceEmbedding: best.embedding })
      .where(eq(schema.attendeeUsers.id, req.attendeeUser!.attendeeUserId));
    res.json({ hasFace: true });
  }),
);

const searchSchema = z.object({ code: z.string().min(4).max(40) });

/** Find the signed-in account's photos in an event, using the stored face. */
attendeeAuthRouter.post(
  '/attendee-auth/search',
  requireAttendeeUser,
  asyncHandler(async (req, res) => {
    const { code } = parse(searchSchema, req.body);

    const user = await db.query.attendeeUsers.findFirst({
      where: eq(schema.attendeeUsers.id, req.attendeeUser!.attendeeUserId),
      columns: { faceEmbedding: true },
    });
    if (!user?.faceEmbedding) throw badRequest('Add a selfie to your account first');

    const event = await db.query.events.findFirst({
      where: eq(schema.events.attendeeCode, code.toUpperCase()),
      columns: { id: true, name: true },
    });
    if (!event) throw notFound('Event not found for that code');

    const vectorLiteral = `[${(user.faceEmbedding as number[]).join(',')}]`;
    const rows = await queryClient<
      {
        id: string;
        filename: string;
        storage_key: string;
        thumb_storage_key: string | null;
        media_type: 'photo' | 'video';
        distance: number;
      }[]
    >`
      select p.id, p.filename, p.storage_key, p.thumb_storage_key, p.media_type,
             min(f.embedding <=> ${vectorLiteral}::vector) as distance
      from faces f
      join photos p on p.id = f.photo_id
      where f.event_id = ${event.id} and p.status = 'processed'
      group by p.id, p.filename, p.storage_key, p.thumb_storage_key, p.media_type
      having min(f.embedding <=> ${vectorLiteral}::vector) < ${config.FACE_MATCH_THRESHOLD}
      order by distance asc
      limit 300
    `;

    const matches = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        filename: r.filename,
        distance: Number(r.distance),
        mediaType: r.media_type,
        url: await presignGet(r.thumb_storage_key ?? r.storage_key),
        fullUrl: await presignGet(r.storage_key),
      })),
    );

    res.json({ event: { name: event.name }, count: matches.length, matches });
  }),
);
