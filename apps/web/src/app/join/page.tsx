'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton, Mark } from '@/components/ui';
import { Reveal } from '@/components/motion';

type Mode = 'code' | 'drive';

export default function JoinPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = code.trim().toUpperCase();
      await api.attendeeSession(c);
      router.push(`/e/${c}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not find that event');
    } finally {
      setBusy(false);
    }
  }

  async function submitDrive(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { code } = await api.driveSession(driveUrl.trim());
      router.push(`/e/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not import that folder');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav />
      <GradientBlob className="left-[-10%] top-[10%] h-96 w-96" color="#6FA8E8" />
      <div className="relative z-10 mx-auto mt-12 max-w-md px-6">
        <Reveal>
          <Card className="text-center">
            <span className="text-amber">
              <Mark />
            </span>
            <h1 className="mt-2 text-h2 font-semibold lowercase">find your photos</h1>
            <p className="mt-1 text-sm text-ink/60">
              Enter an event code, or import a Google Drive folder of photos.
            </p>

            {/* Mode toggle */}
            <div className="mx-auto mt-6 inline-flex rounded-full bg-cream p-1">
              <ModeTab active={mode === 'code'} onClick={() => setMode('code')}>
                Event code
              </ModeTab>
              <ModeTab active={mode === 'drive'} onClick={() => setMode('drive')}>
                Google Drive
              </ModeTab>
            </div>

            {mode === 'code' ? (
              <form onSubmit={submitCode} className="mt-6 space-y-4">
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
            ) : (
              <form onSubmit={submitDrive} className="mt-6 space-y-4">
                <input
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                  className="w-full rounded-xl border border-ink/15 bg-cream-light px-4 py-3 text-sm outline-none focus:border-ink/40"
                />
                <p className="text-left text-xs text-ink/50">
                  Paste a Drive <strong>folder</strong> link shared as “Anyone with the link can
                  view.” We import the photos and find faces — same as an event.
                </p>
                {error && <p className="text-sm text-coral">{error}</p>}
                <PillButton
                  type="submit"
                  disabled={busy || driveUrl.trim().length < 10}
                  className="w-full"
                >
                  {busy ? 'Importing…' : 'Import & find photos'}
                </PillButton>
              </form>
            )}
          </Card>
        </Reveal>
      </div>
    </main>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-hover
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
