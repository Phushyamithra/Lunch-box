import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { APP_NAME, APP_TAGLINE, EMAIL_REGEX } from '../constants';
import { useAppData } from '../context/AppDataContext';

/**
 * First-launch screen. Collects an email as the local user identifier —
 * designed to be replaced by Google Sign-In later (saveEmail is the only
 * integration point).
 */
export default function Onboarding() {
  const { saveEmail } = useAppData();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const valid = EMAIL_REGEX.test(email.trim());
  const showError = touched && email.length > 0 && !valid;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    await saveEmail(email);
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        px: 3,
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'radial-gradient(circle at 30% 20%, rgba(208,188,255,0.18), transparent 60%), radial-gradient(circle at 80% 90%, rgba(34,197,94,0.12), transparent 55%)'
            : 'radial-gradient(circle at 30% 20%, rgba(103,80,164,0.14), transparent 60%), radial-gradient(circle at 80% 90%, rgba(34,197,94,0.12), transparent 55%)',
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        aria-hidden
        style={{ fontSize: 64, lineHeight: 1 }}
      >
        🥪
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ textAlign: 'center' }}
      >
        <Typography variant="h5" component="h1">
          Welcome to {APP_NAME}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {APP_TAGLINE}
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ width: '100%' }}
      >
        <Paper elevation={0} variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Email address"
            type="email"
            value={email}
            autoFocus
            fullWidth
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            error={showError}
            helperText={showError ? 'Please enter a valid email address.' : ' '}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!valid || submitting}
            onClick={() => void handleSubmit()}
          >
            Get started
          </Button>
          <Typography variant="caption" color="text.secondary" align="center">
            Stored only on this device — used as your identity for meal logs.
          </Typography>
        </Paper>
      </motion.div>
    </Box>
  );
}
