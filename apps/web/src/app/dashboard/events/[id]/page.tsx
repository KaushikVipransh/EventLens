'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  orgToken,
  type EventRecord,
  type Photographer,
} from '@/lib/api';
import { Card, Chip, CopyButton, GradientBlob, Nav, PillButton } from '@/components/ui';

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [token, setToken] = useState<string | null>(null);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [attendeeLink, setAttendeeLink] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const t = orgToken.get();
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    Promise.all([api.getEvent(t, id), api.listPhotographers(t, id), api.attendeeLink(t, id)])
      .then(([e, p, a]) => {
        setEvent(e.event);
        setPhotographers(p.photographers);
        setAttendeeLink(a.attendeeLink);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      });
  }, [id, router]);

  async function addPhotographer(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name) return;
    const { photographer, uploadLink } = await api.addPhotographer(token, id, { name });
    setPhotographers([{ ...photographer, uploadLink }, ...photographers]);
    setName('');
  }

  if (!event) {
    return (
      <main className="min-h-screen">
        <Nav />
        <p className="mx-auto max-w-4xl px-6 py-8 text-ink/50">Loading…</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <GradientBlob className="left-[-8%] top-0 h-80 w-80" color="#6FA8E8" />
      <Nav />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <Link href="/dashboard" className="text-sm text-ink/60 hover:text-ink">
          ← All events
        </Link>
        <h1 className="mt-2 text-h1">{event.name}</h1>
        <p className="text-ink/60">{event.date ?? 'No date set'}</p>

        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Attendee access</h2>
          <p className="mt-1 text-sm text-ink/60">
            Share this link (or the code) with guests so they can find their photos.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Chip color="#F0B429">code {event.attendeeCode}</Chip>
            <code className="rounded-lg bg-cream px-3 py-1.5 text-xs">{attendeeLink}</code>
            <CopyButton value={attendeeLink} label="Copy attendee link" />
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Photographer upload links</h2>
          <p className="mt-1 text-sm text-ink/60">
            Each photographer gets their own link to upload into this event.
          </p>
          <form onSubmit={addPhotographer} className="mt-4 flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Photographer name"
              className="flex-1 rounded-xl border border-ink/15 bg-cream-light px-4 py-2.5 text-sm outline-none focus:border-ink/40"
            />
            <PillButton type="submit">Add</PillButton>
          </form>

          <ul className="mt-4 space-y-3">
            {photographers.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-cream px-4 py-3"
              >
                <Chip color="#8B6FD9">{p.name}</Chip>
                <code className="flex-1 truncate text-xs text-ink/60">{p.uploadLink}</code>
                <CopyButton value={p.uploadLink} />
              </li>
            ))}
            {photographers.length === 0 && (
              <li className="text-sm text-ink/50">No photographers added yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </main>
  );
}
