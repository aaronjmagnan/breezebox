'use client';

import { Card } from '@breezebox/ui';
import { useCaptureQueue } from '@breezebox/pwa/client';

function ageLabel(expiresAt: number): string {
  const hours = Math.max(0, Math.round((expiresAt - Date.now()) / 3_600_000));
  if (hours <= 1) return 'less than an hour left';
  if (hours < 24) return `${hours} hours left`;
  return `${Math.round(hours / 24)} days left`;
}

/**
 * The queued-captures list on the offline page (backbone §11).
 *
 * Reads IndexedDB in the browser, so this page stays a static, data-free
 * document that the service worker can precache.
 *
 * No tool queues anything yet, so in practice this renders the empty case.
 * It is built now so the first capture tool does not have to invent it.
 */
export function OfflineQueue() {
  const { items, expiringSoon, justExpired, online } = useCaptureQueue();

  return (
    <>
      {justExpired.length > 0 ? (
        <Card as="section" role="alert" padding="sm" className="mt-4">
          <p className="text-base font-semibold">
            {justExpired.length} item{justExpired.length === 1 ? '' : 's'} expired
          </p>
          <p className="mt-1 text-sm leading-relaxed text-bb-muted">
            Anything waiting longer than 72 hours is removed from this device.
            You will need to capture it again.
          </p>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 text-base leading-relaxed text-bb-muted">
          Nothing is waiting to upload. When you are back online, everything
          will be where you left it.
        </p>
      ) : (
        <section className="mt-4">
          <h2 className="text-base font-semibold">
            Waiting to upload ({items.length})
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-bb-muted">
            These are saved on this device only. They upload on their own once
            you have a connection.
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => {
              const urgent = expiringSoon.some((i) => i.id === item.id);
              return (
                <li key={item.id}>
                  <Card padding="sm">
                    <p className="text-base">{item.label}</p>
                    <p className="mt-1 text-sm text-bb-muted">
                      {urgent ? (
                        <span className="text-accent-coral-ink">
                          Expires soon: {ageLabel(item.expiresAt)}
                        </span>
                      ) : (
                        ageLabel(item.expiresAt)
                      )}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="mt-6 text-sm text-bb-muted">
        {online ? 'Back online. Retrying now.' : 'No connection right now.'}
      </p>
    </>
  );
}
