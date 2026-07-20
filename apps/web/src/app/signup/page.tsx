'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError, orgToken } from '@/lib/api';
import { Card, Field, GradientBlob, Nav, PillButton } from '@/components/ui';
import { Reveal } from '@/components/motion';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.signup(form);
      orgToken.set(token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav />
      <GradientBlob className="right-[-10%] top-[-5%] h-96 w-96" color="#8B6FD9" />
      <GradientBlob className="left-[-10%] bottom-[-10%] h-96 w-96" color="#F0997B" />
      <div className="relative z-10 mx-auto mt-12 max-w-md px-6">
        <Reveal>
          <Card>
            <h1 className="text-h2 font-semibold lowercase">create your studio account</h1>
            <p className="mt-1 text-sm text-ink/60">Start centralizing your event photos.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field
                label="Studio / your name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                hint="At least 8 characters"
              />
              {error && <p className="text-sm text-coral">{error}</p>}
              <PillButton type="submit" disabled={busy} className="w-full">
                {busy ? 'Creating…' : 'Create account'}
              </PillButton>
            </form>
            <p className="mt-4 text-center text-sm text-ink/60">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-ink underline" data-hover>
                Log in
              </Link>
            </p>
          </Card>
        </Reveal>
      </div>
    </main>
  );
}
