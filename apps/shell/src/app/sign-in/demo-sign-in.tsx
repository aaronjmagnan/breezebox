'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@breezebox/ui';
import { deniedMessage, isAuthDeniedReason } from '@breezebox/auth';
import { signInWithPassword } from '@breezebox/auth/client';

/**
 * Email and password sign-in, shown only on a district with demo_mode set.
 *
 * Exists so the platform can be demonstrated and role behaviour checked
 * without a real Google or Microsoft account per role. It is not a shortcut
 * past anything: these are real accounts, the domain check still runs in the
 * database, and RLS still decides what each role sees.
 *
 * PHONE FIRST.
 */
export function DemoSignIn({
  districtId,
  districtName,
  ssoDomain,
  next,
}: {
  districtId: string;
  districtName: string;
  ssoDomain: string | null;
  next: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await signInWithPassword({
      email,
      password,
      districtId,
      districtIsDemo: true,
    });

    if (result.ok) {
      router.replace(next);
      router.refresh();
      return;
    }

    setError(
      isAuthDeniedReason(result.reason)
        ? deniedMessage(result.reason, { districtName, ssoDomain }).body
        : result.message,
    );
    setPending(false);
  }

  if (!open) {
    return (
      <Button variant="ghost" fullWidth className="mt-3" onClick={() => setOpen(true)}>
        Use a demo account
      </Button>
    );
  }

  return (
    <Card as="section" padding="sm" className="mt-3">
      <h2 className="text-base font-semibold">Demo account</h2>
      <p className="mt-1 text-sm leading-relaxed text-bb-muted">
        For demonstrations only. Real districts sign in with Google or
        Microsoft.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-tap rounded-bb border border-bb-border bg-bb-surface px-3 text-base text-bb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-tap rounded-bb border border-bb-border bg-bb-surface px-3 text-base text-bb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm leading-relaxed text-accent-coral-ink">
            {error}
          </p>
        ) : null}

        <Button variant="primary" fullWidth type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
