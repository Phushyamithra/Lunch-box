import { Alert, Box, Paper, Typography } from '@mui/material';

/** Shown when the build has no (valid) Supabase configuration. */
export function SetupRequired() {
  return (
    <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          🍱 LunchBox needs setup
        </Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This build is not connected to Supabase.
        </Alert>
        <Typography color="text.secondary">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (in{' '}
          <code>.env.local</code> for local development, or in the Vercel project settings), then
          rebuild. See <code>docs/WEB_APP_SETUP.md</code>.
        </Typography>
      </Paper>
    </Box>
  );
}
