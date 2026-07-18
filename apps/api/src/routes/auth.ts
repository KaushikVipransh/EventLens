import { db, schema } from '@eventlens/db';
import { loginSchema, signupSchema } from '@eventlens/shared';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { requireOrganizer } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signOrganizerToken } from '../auth/tokens.js';
import { asyncHandler, conflict, notFound, parse, unauthorized } from '../http.js';

export const authRouter = Router();

authRouter.post(
  '/auth/signup',
  asyncHandler(async (req, res) => {
    const input = parse(signupSchema, req.body);

    const existing = await db.query.organizers.findFirst({
      where: eq(schema.organizers.email, input.email),
    });
    if (existing) throw conflict('An account with that email already exists');

    const passwordHash = await hashPassword(input.password);
    const [organizer] = await db
      .insert(schema.organizers)
      .values({ email: input.email, passwordHash, name: input.name })
      .returning();

    const token = signOrganizerToken(organizer!.id, organizer!.email);
    res.status(201).json({
      token,
      organizer: { id: organizer!.id, email: organizer!.email, name: organizer!.name },
    });
  }),
);

authRouter.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema, req.body);

    const organizer = await db.query.organizers.findFirst({
      where: eq(schema.organizers.email, input.email),
    });
    if (!organizer || !(await verifyPassword(input.password, organizer.passwordHash))) {
      throw unauthorized('Invalid email or password');
    }

    const token = signOrganizerToken(organizer.id, organizer.email);
    res.json({
      token,
      organizer: { id: organizer.id, email: organizer.email, name: organizer.name },
    });
  }),
);

authRouter.get(
  '/auth/me',
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const organizer = await db.query.organizers.findFirst({
      where: eq(schema.organizers.id, req.organizer!.organizerId),
      columns: { id: true, email: true, name: true, createdAt: true },
    });
    if (!organizer) throw notFound('Organizer not found');
    res.json({ organizer });
  }),
);
