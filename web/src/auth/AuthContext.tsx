import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface AuthValue {
  /** True until the stored session (or a magic-link token) is resolved. */
  loading: boolean;
  session: Session | null;
  /** Emails a magic link that also contains a 6-digit code. */
  sendMagicLink: (email: string) => Promise<void>;
  /** Signs in with the code from the email (works across browsers/PWA). */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Friendly wording for the auth errors a user can actually hit. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const text = message.toLowerCase();
  if (text.includes('rate limit') || text.includes('security purposes')) {
    return 'Too many sign-in emails were requested. Wait a minute and try again.';
  }
  if (text.includes('expired') || text.includes('invalid')) {
    return 'That code or link has expired or was already used. Request a new one.';
  }
  if (text.includes('signups not allowed') || text.includes('not allowed')) {
    return 'This email is not allowed to sign in to this app.';
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  return message;
}

export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      async sendMagicLink(email) {
        const { error } = await client.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      },
      async verifyCode(email, code) {
        const { error } = await client.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          type: 'email',
        });
        if (error) throw error;
      },
      async signOut() {
        // Local scope: signs this device out without ending other devices.
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      },
    }),
    [client, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
