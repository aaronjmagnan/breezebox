'use client';

import { useState } from 'react';
import { OAUTH_PROVIDERS, PROVIDER_LABELS, type OAuthProvider } from '@breezebox/auth';
import { signInWithProvider } from '@breezebox/auth/client';

/**
 * Minimal for now. Step 5 rebuilds this from @breezebox/ui components.
 *
 * Tap targets are 48px, above the 44px floor in §6, because this is the one
 * screen every user hits on a phone.
 */
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
        <button
          key={provider}
          type="button"
          onClick={() => void start(provider)}
          disabled={pending !== null}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border px-4 text-base disabled:opacity-60"
        >
          {pending === provider
            ? `Opening ${PROVIDER_LABELS[provider]}…`
            : `Continue with ${PROVIDER_LABELS[provider]}`}
        </button>
      ))}

      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
