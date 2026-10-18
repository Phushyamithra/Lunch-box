import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { EMAIL_REGEX } from '../../../src/constants';
import { describeAuthError, useAuth } from './AuthContext';

type Step = 'email' | 'sent';

/**
 * Passwordless sign-in. The email contains a link that opens the app
 * signed in. Supabase only allows editing the email template (to add a
 * 6-digit {{ .Token }} code) once custom SMTP is set up, so the code box
 * is an optional extra rather than the main path.
 */
export function SignIn() {
  const { sendMagicLink, verifyCode } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    void run(async () => {
      await sendMagicLink(email);
      setStep('sent');
    });
  };

  const handleVerify = (event: FormEvent) => {
    event.preventDefault();
    void run(() => verifyCode(email, code));
  };

  return (
    <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 3, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Tracker
        </Typography>
        {step === 'email' ? (
          <Stack component="form" spacing={2} onSubmit={handleSend} noValidate>
            <Typography color="text.secondary">
              Sign in with your email. No password needed.
            </Typography>
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </Stack>
        ) : (
          <Stack component="form" spacing={2} onSubmit={handleVerify} noValidate>
            <Alert severity="success">
              Sent to {email}. Open the link in that email on this device to sign in.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              If the email also shows a 6-digit code, you can type it here instead.
            </Typography>
            <TextField
              label="Code from the email (optional)"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in with code'}
            </Button>
            <Button
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            >
              Use a different email or resend
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
