'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, attendeeToken, type AttendeeUser } from '@/lib/api';
import { SelfieCapture } from '@/components/SelfieCapture';
import { Card, Field, GradientBlob, Mark, Nav, PillButton } from '@/components/ui';
import { Reveal } from '@/components/motion';

const navRight = <span className="text-sm text-ink/50">my account</span>;

export default function AccountPage() {
  const [user, setUser] = useState<AttendeeUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const t = attendeeToken.get();
    if (!t) {
      setChecked(true);
      return;
    }
    api
      .attendeeMe(t)
      .then(({ user }) => setUser(user))
      .catch(() => attendeeToken.clear())
      .finally(() => setChecked(true));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } =
        mode === 'signup'
          ? await api.attendeeSignup(form)
          : await api.attendeeLogin({ email: form.email, password: form.password });
      attendeeToken.set(token);
      setUser(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onSelfie(blob: Blob) {
    const t = attendeeToken.get();
    if (!t) return;
    setEnrolling(true);
    setError(null);
    try {
      await api.enrollFace(t, blob);
      setUser((u) => (u ? { ...u, hasFace: true } : u));
      setShowCamera(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your face');
    } finally {
      setEnrolling(false);
    }
  }

  function logout() {
    attendeeToken.clear();
    setUser(null);
    setForm({ email: '', password: '', name: '' });
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav right={navRight} />
      <GradientBlob className="left-[-10%] top-[-5%] h-96 w-96" color="#8B6FD9" />
      <GradientBlob className="right-[-10%] bottom-[-10%] h-96 w-96" color="#63C48A" />

      <div className="relative z-10 mx-auto mt-12 max-w-md px-6">
        <Reveal>
          {!checked ? (
            <Card>
              <p className="text-ink/50">Loading…</p>
            </Card>
          ) : user ? (
            <Card>
              <span className="text-grape">
                <Mark />
              </span>
              <h1 className="mt-2 text-h2 font-semibold lowercase">hi, {user.name}</h1>
              <p className="mt-1 text-sm text-ink/60">{user.email}</p>

              <div className="mt-6 rounded-2xl bg-cream p-4">
                <p className="text-sm font-medium">Your face</p>
                <p className="mt-1 text-sm text-ink/60">
                  {user.hasFace
                    ? 'Saved. On any event you can find your photos in one tap — no selfie needed.'
                    : 'Add a selfie once, then find your photos across events instantly.'}
                </p>
                <div className="mt-3">
                  <PillButton variant="accent" onClick={() => setShowCamera(true)}>
                    <Mark className="h-4 w-4" /> {user.hasFace ? 'Update selfie' : 'Add selfie'}
                  </PillButton>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-coral">{error}</p>}

              <div className="mt-6 flex items-center justify-between text-sm">
                <Link href="/" className="text-ink/60 hover:text-ink" data-hover>
                  ← Home
                </Link>
                <button onClick={logout} className="text-ink/60 hover:text-ink" data-hover>
                  Log out
                </button>
              </div>
            </Card>
          ) : (
            <Card>
              <h1 className="text-h2 font-semibold lowercase">
                {mode === 'signup' ? 'create your account' : 'welcome back'}
              </h1>
              <p className="mt-1 text-sm text-ink/60">
                Optional — save your face once and skip the selfie at every event.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === 'signup' && (
                  <Field
                    label="Name"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    placeholder="Your name"
                  />
                )}
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                  hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
                />
                {error && <p className="text-sm text-coral">{error}</p>}
                <PillButton type="submit" disabled={busy} className="w-full">
                  {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
                </PillButton>
              </form>
              <p className="mt-4 text-center text-sm text-ink/60">
                {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
                <button
                  onClick={() => {
                    setMode(mode === 'signup' ? 'login' : 'signup');
                    setError(null);
                  }}
                  className="font-medium text-ink hover:opacity-70"
                  data-hover
                >
                  {mode === 'signup' ? 'Log in' : 'Create an account'}
                </button>
              </p>
            </Card>
          )}
        </Reveal>
      </div>

      {showCamera && (
        <SelfieCapture onCapture={onSelfie} onClose={() => setShowCamera(false)} busy={enrolling} />
      )}
    </main>
  );
}
