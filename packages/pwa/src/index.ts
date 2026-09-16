/**
 * @breezebox/pwa
 *
 * Caching rules, the offline capture queue, the update prompt, and the install
 * guide (backbone §11). Only the shell registers a service worker, at root
 * scope; tools never register their own.
 *
 * What lands in step 6:
 *   - cache-first versioned app shell assets; Supabase data network-only
 *   - offline fallback page listing any queued captures
 *   - capture queue in IndexedDB, keyed by tool and user: delete on successful
 *     upload, clear on sign-out, 72-hour expiry with a warning, retry on app
 *     open and on the `online` event, no Background Sync
 *   - "New version available, tap to refresh" when a worker is waiting
 *   - install prompt (Android, desktop Chrome/Edge) and an iOS Safari
 *     "Add to Home Screen" guide
 */

export {};
