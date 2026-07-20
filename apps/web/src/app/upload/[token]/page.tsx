'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton, Mark } from '@/components/ui';
import { Reveal } from '@/components/motion';

const uploadNavRight = <span className="text-sm text-ink/50">photographer upload</span>;

interface Session {
  token: string;
  photographer: { id: string; name: string };
  event: { id: string; name: string; date: string | null };
}

export default function UploadPage() {
  const params = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .uploadSession(params.token)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'This upload link is invalid.'),
      );
  }, [params.token]);

  async function upload() {
    if (!session || files.length === 0) return;
    setBusy(true);
    setProgress(0);
    setDone(null);
    try {
      const { uploads } = await api.presign(
        session.token,
        files.map((f) => ({ filename: f.name, contentType: f.type, size: f.size })),
      );
      let n = 0;
      for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i]!;
        const file = files[i]!;
        const res = await fetch(u.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        n++;
        setProgress(Math.round((n / uploads.length) * 100));
      }
      await api.complete(
        session.token,
        uploads.map((u, i) => ({
          storageKey: u.storageKey,
          filename: u.filename,
          contentType: files[i]!.type,
          size: files[i]!.size,
        })),
      );
      setDone(uploads.length);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) {
    return (
      <main className="min-h-screen">
        <Nav right={uploadNavRight} />
        <div className="mx-auto max-w-md px-6 py-16">
          <Card>
            <h1 className="text-h2 font-semibold lowercase">link not valid</h1>
            <p className="mt-2 text-sm text-ink/60">{error}</p>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav right={uploadNavRight} />
      <GradientBlob className="right-[-10%] top-[10%] h-96 w-96" color="#F0997B" />
      <div className="relative z-10 mx-auto max-w-lg px-6 py-12">
        <Reveal>
        <Card>
          <span className="text-coral">
            <Mark />
          </span>
          <h1 className="mt-2 text-h2 font-semibold lowercase">
            {session ? `upload to ${session.event.name}` : 'Loading…'}
          </h1>
          {session && (
            <p className="mt-1 text-sm text-ink/60">
              Uploading as <strong>{session.photographer.name}</strong>. Your photos join the shared
              event pool and process automatically.
            </p>
          )}

          <div className="mt-6">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm file:mr-4 file:rounded-pill file:border-0 file:bg-ink file:px-5 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-black"
            />
            {files.length > 0 && (
              <p className="mt-3 text-sm text-ink/60">{files.length} photo(s) selected</p>
            )}
          </div>

          {busy && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-pill bg-cream">
                <div className="h-full bg-grass transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink/50">Uploading… {progress}%</p>
            </div>
          )}

          {done !== null && (
            <p className="mt-4 rounded-xl bg-grass/10 px-4 py-3 text-sm text-grass">
              ✓ {done} photo(s) received and queued for processing.
            </p>
          )}
          {error && session && <p className="mt-3 text-sm text-coral">{error}</p>}

          <PillButton
            onClick={upload}
            disabled={busy || files.length === 0 || !session}
            className="mt-6 w-full"
          >
            {busy ? 'Uploading…' : 'Upload photos'}
          </PillButton>
        </Card>
        </Reveal>
      </div>
    </main>
  );
}
