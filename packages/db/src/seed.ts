import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db, queryClient } from './client.js';
import { events, organizers } from './schema/index.js';

// Human-friendly, unambiguous attendee codes (no 0/O/1/I).
const makeCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

const DEMO_EMAIL = 'demo@eventlens.test';
const DEMO_PASSWORD = 'password123';

async function seed(): Promise<void> {
  const existing = await db.query.organizers.findFirst({
    where: eq(organizers.email, DEMO_EMAIL),
  });

  let organizerId: string;
  if (existing) {
    organizerId = existing.id;
    console.log('Demo organizer already present:', DEMO_EMAIL);
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const [org] = await db
      .insert(organizers)
      .values({ email: DEMO_EMAIL, passwordHash, name: 'Demo Studio' })
      .returning();
    organizerId = org!.id;
    console.log(`Created demo organizer ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }

  const hasEvent = await db.query.events.findFirst({
    where: eq(events.organizerId, organizerId),
  });
  if (hasEvent) {
    console.log('Demo event already present:', hasEvent.name, `(code ${hasEvent.attendeeCode})`);
  } else {
    const [event] = await db
      .insert(events)
      .values({
        organizerId,
        name: 'Demo Wedding',
        date: '2026-06-20',
        attendeeCode: makeCode(),
      })
      .returning();
    console.log(`Created demo event "${event!.name}" — attendee code: ${event!.attendeeCode}`);
  }
}

try {
  await seed();
} finally {
  await queryClient.end();
}
