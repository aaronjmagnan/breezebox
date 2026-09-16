'use client';

import { useState } from 'react';
import { Button } from '@breezebox/ui';
import { OAUTH_PROVIDERS, PROVIDER_LABELS, type OAuthProvider } from '@breezebox/auth';
import { signInWithProvider } from '@breezebox/auth/client';

export function SignInButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const { error: failure } = await signInWithProvider(provider, { next });
    if (failure) {
      setError('We could not start sign-in. Please try again.');
      setPending(null);
    }
    // On success the browser is already navigating to the provider.
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {OAUTH_PROVIDERS.map((provider) => (
        <Button
          key={provider}
          variant={provider === 'google' ? 'primary' : 'secondary'}
          fullWidth
          disabled={pending !== null}
          onClick={() => void start(provider)}
        >
          {pending === provider
            ? `Opening ${PROVIDER_LABELS[provider]}…`
            : `Continue with ${PROVIDER_LABELS[provider]}`}
        </Button>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-bb-muted">
          {error}
        </p>
      ) : null}
    </div>
  );
}
