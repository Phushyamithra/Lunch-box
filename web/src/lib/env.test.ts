import { describe, expect, it } from 'vitest';
import { readSupabaseEnv } from './env';

describe('readSupabaseEnv', () => {
  it('accepts a real-looking config and trims a trailing slash', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'eyJ.key' }),
    ).toEqual({ url: 'https://abc.supabase.co', anonKey: 'eyJ.key' });
  });

  it('allows a local Supabase over http', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).not.toBeNull();
  });

  it('rejects missing, placeholder, non-https or malformed values', () => {
    expect(readSupabaseEnv({})).toBeNull();
    expect(
      readSupabaseEnv({
        VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'your-anon-public-key',
      }),
    ).toBeNull();
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });
});
