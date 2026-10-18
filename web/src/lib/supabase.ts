import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

const env = readSupabaseEnv(import.meta.env as Record<string, string | undefined>);

/**
 * The single Supabase client, or null when the app is not configured yet.
 * Sessions persist in localStorage and refresh automatically; magic-link
 * tokens arriving in the URL are picked up on load.
 */
export const supabase: SupabaseClient | null = env
  ? createClient(env.url, env.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
