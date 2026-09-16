'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@breezebox/db';
import { supabaseEnv } from '../env';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * The browser Supabase client for the current district origin.
 *
 * One per origin, and the shell and every tool share it, because they share
 * an origin. That is what makes one session cover every tool (§5).
 */
export function browserClient() {
  if (cached) return cached;
  const { url, anonKey } = supabaseEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
