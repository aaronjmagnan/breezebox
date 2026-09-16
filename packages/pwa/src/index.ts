/**
 * @breezebox/pwa
 *
 * Caching rules, the offline capture queue, the update prompt and the install
 * guide (backbone §11).
 *
 * Only the shell registers a service worker, at root scope. Tools never
 * register their own, and never add caching rules: everything lives in
 * ./policy so there is one answer to "is this cached?".
 *
 * Client-only entry points are in ./client, so a server component importing
 * the policy constants does not drag hooks into the bundle.
 */

export {
  CACHE_PREFIX,
  CACHE_FIRST_PREFIXES,
  NEVER_CACHE_PREFIXES,
  NETWORK_ONLY_HOST_FRAGMENTS,
  OFFLINE_PATH,
  PRECACHE_PATHS,
  CAPTURE_TTL_MS,
  CAPTURE_WARN_BEFORE_MS,
  CAPTURE_MAX_ATTEMPTS,
  shellCacheName,
  isManagedCacheName,
} from './policy';

export type { CaptureItem, NewCapture, CaptureUploader, FlushResult } from './queue';
