import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

const env = readSupabaseEnv(import.meta.env as Record<string, string | undefined>);

/**
 * The single Supabase client, or null when the app is not configured yet.
 * Sessions persist in localStorage and refresh automatically; magic-link
 * tokens arriving in the URL are picked up on load.
 */
/** Network failures become one plain message ("No connection: …") instead of "TypeError: Failed to fetch". */
const offlineAwareFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    const err = new Error('try again once you’re online.');
    err.name = 'No connection';
    throw err;
  }
};

export const supabase: SupabaseClient | null = env
  ? createClient(env.url, env.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: offlineAwareFetch },
    })
  : null;
