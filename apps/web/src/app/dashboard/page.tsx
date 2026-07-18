'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, orgToken, type EventRecord } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton } from '@/components/ui';

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = orgToken.get();
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    api
      .listEvents(t)
      .then((r) => setEvents(r.events))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          orgToken.clear();
          router.replace('/login');
        }
      });
  }, [router]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { event } = await api.createEvent(token, { name, date: date || undefined });
      setEvents([event, ...events]);
      setName('');
      setDate('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <GradientBlob className="right-[-8%] top-[-5%] h-80 w-80" color="#63C48A" />
      <Nav />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-h1">your events</h1>
          <button
            onClick={() => {
              orgToken.clear();
              router.replace('/login');
            }}
            className="text-sm text-ink/60 hover:text-ink"
          >
            Log out
          </button>
        </div>

        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Create a new event</h2>
          <form onSubmit={createEvent} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium">Event name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Priya & Arjun's Wedding"
                className="w-full rounded-xl border border-ink/15 bg-cream-light px-4 py-2.5 text-sm outline-none focus:border-ink/40"
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-ink/15 bg-cream-light px-4 py-2.5 text-sm outline-none focus:border-ink/40"
              />
            </label>
            <PillButton type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </PillButton>
          </form>
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
        </Card>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <Link key={ev.id} href={`/dashboard/events/${ev.id}`}>
              <Card className="transition hover:-translate-y-0.5 hover:shadow-xl">
                <h3 className="text-lg font-semibold">{ev.name}</h3>
                <p className="mt-1 text-sm text-ink/60">{ev.date ?? 'No date set'}</p>
                <p className="mt-3 text-xs text-ink/50">
                  Attendee code <span className="font-mono font-semibold text-ink">{ev.attendeeCode}</span>
                </p>
              </Card>
            </Link>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-ink/50">No events yet — create your first one above.</p>
          )}
        </div>
      </div>
    </main>
  );
}
