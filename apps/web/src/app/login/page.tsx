'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError, orgToken } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton } from '@/components/ui';
import { Field } from '../signup/page';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(form);
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
      <GradientBlob className="left-[-10%] top-[-5%] h-96 w-96" color="#6FA8E8" />
      <Nav />
      <div className="relative z-10 mx-auto mt-8 max-w-md px-6">
        <Card>
          <h1 className="text-h2 font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-ink/60">Log in to manage your events.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
            />
            {error && <p className="text-sm text-coral">{error}</p>}
            <PillButton type="submit" disabled={busy} className="w-full">
              {busy ? 'Logging in…' : 'Log in'}
            </PillButton>
          </form>
          <p className="mt-4 text-center text-sm text-ink/60">
            New here?{' '}
            <Link href="/signup" className="font-medium text-ink underline">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
