export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Validates the Supabase build-time variables. Returns null (→ setup
 * screen) when they are missing or still the .env.example placeholders,
 * rather than letting the client fail with an opaque network error.
 */
export function readSupabaseEnv(env: Record<string, string | undefined>): SupabaseEnv | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !anonKey) return null;
  if (url.includes('your-project-ref') || anonKey.startsWith('your-')) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !local) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}
