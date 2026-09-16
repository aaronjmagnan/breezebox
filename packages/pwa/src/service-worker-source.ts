import {
  CACHE_FIRST_PREFIXES,
  NETWORK_ONLY_HOST_FRAGMENTS,
  NEVER_CACHE_PREFIXES,
  OFFLINE_PATH,
  PRECACHE_PATHS,
  shellCacheName,
} from './policy';

/**
 * The service worker, as source text.
 *
 * It lives here rather than as a static file in the shell's `public/` so that
 * the caching rules in policy.ts are the single definition of what is cached,
 * exactly as §11 asks. The shell serves this from a route handler at /sw.js,
 * which is what gives it root scope.
 *
 * Written as a string because a worker cannot import from a workspace package
 * and we are not adding a bundler step for one file. Everything variable is
 * interpolated from policy.ts below; nothing is hard-coded twice.
 *
 * Note it never calls skipWaiting() on its own. A new worker waits, the page
 * notices it waiting and offers "New version available, tap to refresh", and
 * only then do we activate. Swapping code under someone mid-form is the thing
 * §11 is warning about with "never leave users on stale code silently" -- the
 * fix is to tell them, not to reload under them.
 */
export function serviceWorkerSource(options: { version: string }): string {
  const cacheName = shellCacheName(options.version);

  const json = (value: unknown) => JSON.stringify(value);

  return `/*
 * Breeze Box service worker. Generated from @breezebox/pwa/policy.
 * Do not edit: change policy.ts and redeploy.
 *
 * Build: ${options.version}
 */
'use strict';

const CACHE = ${json(cacheName)};
const CACHE_PREFIX = ${json('breezebox-')};
const OFFLINE_PATH = ${json(OFFLINE_PATH)};
const PRECACHE = ${json(PRECACHE_PATHS)};
const CACHE_FIRST_PREFIXES = ${json(CACHE_FIRST_PREFIXES)};
const NEVER_CACHE_PREFIXES = ${json(NEVER_CACHE_PREFIXES)};
const NETWORK_ONLY_HOSTS = ${json(NETWORK_ONLY_HOST_FRAGMENTS)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch((error) => {
      // A failed precache must not block installation; the offline page just
      // will not be there until the next successful fetch.
      console.error('[sw] precache failed', error);
    })
  );
  // Deliberately NOT skipWaiting(): the page offers the update instead.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    /*
     * Sign-out (§11): cached pages go with the session.
     *
     * Then put the offline page straight back. Without this, signing out
     * takes the offline fallback with it and it does not return until the
     * next deploy reinstalls the worker -- so the next person to sign in on
     * this device and lose signal gets a bare error page instead of their
     * queued captures. Nothing in PRECACHE carries district data, so there is
     * nothing to keep out.
     */
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(
          names.filter((n) => n.indexOf(CACHE_PREFIX) === 0).map((n) => caches.delete(n))
        ))
        .then(() => caches.open(CACHE))
        .then((cache) => cache.addAll(PRECACHE))
        .catch((error) => console.error('[sw] re-precache after sign-out failed', error))
    );
  }
});

function isNetworkOnlyHost(url) {
  for (let i = 0; i < NETWORK_ONLY_HOSTS.length; i++) {
    if (url.hostname.indexOf(NETWORK_ONLY_HOSTS[i]) !== -1) return true;
  }
  return false;
}

function startsWithAny(pathname, prefixes) {
  for (let i = 0; i < prefixes.length; i++) {
    if (pathname.indexOf(prefixes[i]) === 0) return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only GET is ever considered. A POST is someone changing something.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /*
   * RULE 1, and the one that matters most: district data is network only and
   * is never written to a cache. Not a student name, not a staff row.
   */
  if (isNetworkOnlyHost(url)) return;

  // Cross-origin anything else: leave it to the network untouched.
  if (url.origin !== self.location.origin) return;

  if (startsWithAny(url.pathname, NEVER_CACHE_PREFIXES)) return;

  /*
   * RULE 2: immutable build output, cache first. /_next/static is
   * content-hashed by Next, so a stale entry cannot happen.
   */
  if (startsWithAny(url.pathname, CACHE_FIRST_PREFIXES)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  /*
   * RULE 3: navigations are network first, and the response is NEVER stored,
   * because a rendered page can carry district data. Offline falls back to a
   * page that contains none.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_PATH).then((hit) =>
          hit || new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
            '<p>You are offline.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
    );
    return;
  }

  // Everything else same-origin: straight to the network, uncached.
});
`;
}
