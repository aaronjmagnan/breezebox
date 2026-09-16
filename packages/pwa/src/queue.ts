/**
 * The offline capture queue (backbone §11).
 *
 * Rules this file exists to hold, verbatim from §11:
 *
 *   - Queued items stay only on the device, keyed by tool and user.
 *   - Delete each item immediately after successful upload.
 *   - Clear the whole queue on sign-out.
 *   - Expire unsent items after 72 hours, with a warning shown before removal.
 *   - Retry on app open and on the browser's `online` event.
 *   - No Background Sync: Safari does not support it, and a phone is the
 *     device this matters on.
 *
 * The pitch language that goes with this is "never stored on our servers", not
 * "never stored": a queued photo does briefly live on the device.
 *
 * No tool uses this yet. It is built now so the first capture tool inherits a
 * queue that has already been thought through rather than inventing one under
 * deadline.
 */

import {
  CAPTURE_MAX_ATTEMPTS,
  CAPTURE_TTL_MS,
  CAPTURE_WARN_BEFORE_MS,
} from './policy';

const DB_NAME = 'breezebox-captures';
const DB_VERSION = 1;
const STORE = 'items';

export type CaptureItem = {
  id: string;
  /** Which tool owns this item. Its registered uploader is the only one used. */
  toolSlug: string;
  /** Supabase auth user id. Items are never shown or sent for another user. */
  userId: string;
  /** Free-form, owned by the tool. Blobs and Files survive IndexedDB fine. */
  payload: unknown;
  /** Shown in the offline fallback list, e.g. "Photo of room 12 form". */
  label: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastError?: string;
};

export type NewCapture = {
  toolSlug: string;
  userId: string;
  payload: unknown;
  label: string;
};

/** Uploads one item. Resolve to delete it, throw to retry later. */
export type CaptureUploader = (item: CaptureItem) => Promise<void>;

const uploaders = new Map<string, CaptureUploader>();

/**
 * A tool registers how its own captures are uploaded. Items whose tool has no
 * uploader registered are left alone rather than dropped: the tool's code may
 * simply not have loaded on this page.
 */
export function registerCaptureUploader(
  toolSlug: string,
  uploader: CaptureUploader,
): () => void {
  uploaders.set(toolSlug, uploader);
  return () => uploaders.delete(toolSlug);
}

// --- IndexedDB plumbing ----------------------------------------------------

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // "keyed by tool and user" (§11): every read is scoped by both.
        store.createIndex('toolUser', ['toolSlug', 'userId'], { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));

        tx.oncomplete = () => {
          db.close();
          resolve(request ? request.result : null);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Public API ------------------------------------------------------------

export async function enqueueCapture(input: NewCapture): Promise<CaptureItem | null> {
  if (!isAvailable()) return null;

  const now = Date.now();
  const item: CaptureItem = {
    id: newId(),
    toolSlug: input.toolSlug,
    userId: input.userId,
    payload: input.payload,
    label: input.label,
    createdAt: now,
    expiresAt: now + CAPTURE_TTL_MS,
    attempts: 0,
  };

  try {
    await runTransaction('readwrite', (store) => store.add(item));
    return item;
  } catch (error) {
    console.error('[pwa] could not queue capture:', error);
    return null;
  }
}

async function readAll(): Promise<CaptureItem[]> {
  if (!isAvailable()) return [];
  try {
    const items = await runTransaction<CaptureItem[]>('readonly', (store) =>
      store.getAll() as IDBRequest<CaptureItem[]>,
    );
    return items ?? [];
  } catch (error) {
    console.error('[pwa] could not read the capture queue:', error);
    return [];
  }
}

/**
 * Everything queued for one user, oldest first, with expired items already
 * removed. Pass no userId only from a context that is about to clear the queue.
 */
export async function listCaptures(userId?: string): Promise<CaptureItem[]> {
  const { remaining } = await purgeExpiredCaptures();
  const scoped = userId ? remaining.filter((i) => i.userId === userId) : remaining;
  return scoped.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeCapture(id: string): Promise<void> {
  if (!isAvailable()) return;
  try {
    await runTransaction('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
  } catch (error) {
    console.error('[pwa] could not remove a capture:', error);
  }
}

/** §11: clear the whole queue on sign-out. */
export async function clearCaptureQueue(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await runTransaction('readwrite', (store) => store.clear() as IDBRequest<undefined>);
  } catch (error) {
    console.error('[pwa] could not clear the capture queue:', error);
  }
}

export type PurgeResult = {
  /** Items that passed 72 hours and have just been deleted. */
  expired: CaptureItem[];
  /** Items still queued. */
  remaining: CaptureItem[];
};

/**
 * Delete anything past its 72 hours and report what went, so the caller can
 * tell the user rather than letting work vanish quietly.
 */
export async function purgeExpiredCaptures(now = Date.now()): Promise<PurgeResult> {
  const all = await readAll();
  const expired = all.filter((item) => item.expiresAt <= now);
  const remaining = all.filter((item) => item.expiresAt > now);

  for (const item of expired) {
    await removeCapture(item.id);
  }

  return { expired, remaining };
}

/** Items close enough to expiry that the user should be warned (§11). */
export function capturesNeedingWarning(
  items: CaptureItem[],
  now = Date.now(),
): CaptureItem[] {
  return items.filter((item) => item.expiresAt - now <= CAPTURE_WARN_BEFORE_MS);
}

export type FlushResult = {
  uploaded: number;
  failed: number;
  /** Queued for a tool whose uploader is not registered on this page. */
  skipped: number;
  expired: number;
};

/**
 * Try to upload everything queued.
 *
 * Called on app open and on the `online` event. Never from Background Sync:
 * Safari does not implement it, and pretending otherwise would mean the
 * feature works on Android and silently does nothing on the phones half our
 * users carry.
 */
export async function flushCaptureQueue(userId?: string): Promise<FlushResult> {
  const { expired, remaining } = await purgeExpiredCaptures();
  const result: FlushResult = { uploaded: 0, failed: 0, skipped: 0, expired: expired.length };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    result.skipped = remaining.length;
    return result;
  }

  for (const item of remaining) {
    if (userId && item.userId !== userId) continue;

    const uploader = uploaders.get(item.toolSlug);
    if (!uploader) {
      result.skipped += 1;
      continue;
    }

    if (item.attempts >= CAPTURE_MAX_ATTEMPTS) {
      // Stop hammering, but keep the item visible until it expires rather
      // than deleting work the user can still see listed.
      result.skipped += 1;
      continue;
    }

    try {
      await uploader(item);
      // §11: delete immediately after a successful upload.
      await removeCapture(item.id);
      result.uploaded += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      try {
        await runTransaction('readwrite', (store) =>
          store.put({ ...item, attempts: item.attempts + 1, lastError: message }),
        );
      } catch {
        // If we cannot even record the failure, leave the item as it was.
      }
    }
  }

  return result;
}
