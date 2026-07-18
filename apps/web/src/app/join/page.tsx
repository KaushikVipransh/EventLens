'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton, Sparkle } from '@/components/ui';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.attendeeSession(code.trim().toUpperCase());
      router.push(`/e/${code.trim().toUpperCase()}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not find that event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <GradientBlob className="left-[-10%] top-0 h-96 w-96" color="#6FA8E8" />
      <Nav />
      <div className="relative z-10 mx-auto mt-10 max-w-md px-6">
        <Card className="text-center">
          <span className="text-amber">
            <Sparkle />
          </span>
          <h1 className="mt-2 text-h2 font-semibold">Enter your event code</h1>
          <p className="mt-1 text-sm text-ink/60">
            Find the code on the link or card shared by your event organizer.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              maxLength={12}
              className="w-full rounded-xl border border-ink/15 bg-cream-light px-4 py-3 text-center font-mono text-lg tracking-widest outline-none focus:border-ink/40"
            />
            {error && <p className="text-sm text-coral">{error}</p>}
            <PillButton type="submit" disabled={busy || code.length < 4} className="w-full">
              {busy ? 'Finding…' : 'View event photos'}
            </PillButton>
          </form>
        </Card>
      </div>
    </main>
  );
}
