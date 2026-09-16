'use client';

import { useState } from 'react';
import { Button } from '@breezebox/ui';
import { signOut } from '@breezebox/auth/client';

/**
 * §11: sign-out clears the session, the capture queue, and cached pages. The
 * queue and caches register their own cleanups with @breezebox/pwa at step 6;
 * this only has to ask.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ reason: 'user' });
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
