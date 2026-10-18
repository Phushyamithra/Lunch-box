import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { SupabaseClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateBackup } from '../../../src/core/backupFormat';
import { useFood } from './FoodContext';
import { runImport, type ImportResult } from './foodApi';
import { planImport, type ImportPlan } from './importPlan';

const MAX_BYTES = 20 * 1024 * 1024;

type State =
  | { step: 'choose'; error?: string }
  | { step: 'preview'; plan: ImportPlan; fileName: string }
  | { step: 'importing'; plan: ImportPlan; fileName: string }
  | { step: 'done'; result: ImportResult }
  | { step: 'failed'; plan: ImportPlan; fileName: string; error: string };

/**
 * Two-step import: read and validate the file locally, show exactly what
 * will be added, and write to the cloud only after explicit confirmation.
 */
export default function ImportPage({ client }: { client: SupabaseClient }) {
  const navigate = useNavigate();
  const { reload } = useFood();
  const [state, setState] = useState<State>({ step: 'choose' });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setState({ step: 'choose', error: 'That file is too large to be a LunchBox backup.' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setState({ step: 'choose', error: 'That file is not valid JSON. Choose the .json file from Settings → Backup.' });
      return;
    }
    const validation = validateBackup(parsed);
    if (!validation.ok) {
      setState({ step: 'choose', error: validation.error });
      return;
    }
    setState({ step: 'preview', plan: planImport(validation.backup), fileName: file.name });
  };

  const handleImport = async (plan: ImportPlan, fileName: string) => {
    setState({ step: 'importing', plan, fileName });
    try {
      const result = await runImport(client, plan);
      await reload();
      setState({ step: 'done', result });
    } catch (e) {
      setState({ step: 'failed', plan, fileName, error: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 640 }}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/food')} sx={{ alignSelf: 'flex-start' }}>
        Back to Food
      </Button>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Import from LunchBox
        </Typography>

        {state.step === 'choose' && (
          <Stack spacing={2}>
            <Typography color="text.secondary">
              In the Chrome extension, open Settings → Backup → Download full backup. Then choose that file here.
              Nothing is saved until you confirm, and your extension data stays untouched.
            </Typography>
            {state.error && <Alert severity="error">{state.error}</Alert>}
            <Button variant="contained" size="large" component="label" startIcon={<UploadFileRoundedIcon />}>
              Choose backup file
              <input hidden type="file" accept="application/json,.json" onChange={(e) => void handleFile(e)} />
            </Button>
          </Stack>
        )}

        {(state.step === 'preview' || state.step === 'importing' || state.step === 'failed') && (
          <Stack spacing={2}>
            <Typography color="text.secondary">
              {state.fileName} · exported {dayjs(state.plan.exportedAt).format('D MMM YYYY, HH:mm')}
            </Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0.75, m: 0, columnGap: 2 }}>
              <dt>Categories</dt>
              <dd style={{ margin: 0 }}>{state.plan.categories.length}</dd>
              <dt>Meals</dt>
              <dd style={{ margin: 0 }}>
                {state.plan.meals.filter((m) => !m.archived).length}
                {state.plan.meals.some((m) => m.archived) && ` (+${state.plan.meals.filter((m) => m.archived).length} deleted, kept for history)`}
              </dd>
              <dt>Meal logs</dt>
              <dd style={{ margin: 0 }}>
                {state.plan.logs.length}
                {state.plan.logs.length > 0 &&
                  ` (${dayjs(state.plan.logs[0].logDate).format('D MMM YYYY')} – ${dayjs(state.plan.logs[state.plan.logs.length - 1].logDate).format('D MMM YYYY')})`}
              </dd>
              <dt>Achievements</dt>
              <dd style={{ margin: 0 }}>{Object.keys(state.plan.achievements).length}</dd>
            </Box>
            {state.plan.warnings.map((w) => (
              <Alert key={w} severity="warning">
                {w}
              </Alert>
            ))}
            <Alert severity="info">
              Safe to run more than once. Anything already imported is skipped, and nothing in Tracker is overwritten.
            </Alert>
            {state.step === 'failed' && <Alert severity="error">{state.error}</Alert>}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="large"
                disabled={state.step === 'importing'}
                onClick={() => void handleImport(state.plan, state.fileName)}
              >
                {state.step === 'importing' ? 'Importing…' : state.step === 'failed' ? 'Try again' : 'Import into Tracker'}
              </Button>
              <Button size="large" disabled={state.step === 'importing'} onClick={() => setState({ step: 'choose' })}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}

        {state.step === 'done' && (
          <Stack spacing={2}>
            <Alert severity="success">
              Import complete: {state.result.categoriesAdded} categories, {state.result.mealsAdded} meals and{' '}
              {state.result.logsAdded} logs added
              {state.result.logsAlreadyPresent > 0 && ` (${state.result.logsAlreadyPresent} logs were already here)`}.
            </Alert>
            <Button variant="contained" size="large" onClick={() => navigate('/food')}>
              Go to Food
            </Button>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
