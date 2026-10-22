import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';
import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { useFinance } from '../finance/FinanceContext';
import { useFitness } from '../fitness/FitnessContext';
import { useFood } from '../food/FoodContext';
import { useGoals } from '../goals/GoalsContext';
import { useSnackbar } from '../layout/Snackbar';
import { clearOfflineCache } from '../lib/offlineCache';
import { useInstall } from '../lib/install';
import { buildBackup } from '../nutrition/backup';
import { useNutrition } from '../nutrition/NutritionContext';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Paper>
  );
}

/** Install as an app, and how offline works. */
export function AppSection() {
  const { canInstall, installed, install } = useInstall();
  const toast = useSnackbar();
  return (
    <Section title="App">
      {installed ? (
        <Typography>✅ Running as an installed app.</Typography>
      ) : canInstall ? (
        <Button variant="contained" size="large" startIcon={<InstallMobileRoundedIcon />} onClick={() => void install().then((ok) => ok && toast('Installed: open Tracker from your home screen'))}>
          Install Tracker on this device
        </Button>
      ) : (
        <Typography variant="body2" color="text.secondary">
          To install: open the browser menu (⋮) and choose “Add to home screen” or “Install app”.
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        Offline, the app still opens and shows the last copy of your data saved on this device, clearly marked with its time. Saving needs a connection, except Finance, which
        works fully offline and syncs (encrypted) later. Updates install themselves when you reopen the app.
      </Typography>
      <Button size="small" color="inherit" sx={{ alignSelf: 'flex-start' }} onClick={() => void clearOfflineCache().then(() => toast('Offline copies removed from this device'))}>
        Remove offline copies from this device
      </Button>
    </Section>
  );
}

/** Everything in one file, for safekeeping. */
export function ExportSection() {
  const fitness = useFitness();
  const nutrition = useNutrition();
  const goals = useGoals();
  const food = useFood();
  const finance = useFinance();
  const toast = useSnackbar();
  const [withFinance, setWithFinance] = useState(false);
  const financeReady = finance.status === 'ready' && !!finance.doc;
  const ready = !!fitness.data || !!nutrition.data || !!goals.data;

  const download = () => {
    const today = dayjs().format('YYYY-MM-DD');
    const body = {
      schema: 'tracker.export',
      version: 1,
      exported_at: new Date().toISOString(),
      note: 'Safety copy of every module. Nutrition and Finance parts can be restored from their own screens; the rest is for keeping or analysis.',
      fitness: fitness.data,
      nutrition: nutrition.data ? buildBackup(nutrition.data) : null,
      goals: goals.data,
      mealPrep: food.error ? null : food.data,
      finance: withFinance && financeReady ? finance.doc : null,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `tracker-everything-${today}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Exported');
  };

  return (
    <Section title="Export everything">
      <Typography variant="body2" color="text.secondary">
        One JSON file with Fitness, Nutrition, Goals and Meal prep. Nutrition and Finance can be restored from their own screens (Nutrition → Backup, Finance → Settings); the
        rest is a copy to keep. The file isn’t encrypted.
      </Typography>
      <FormControlLabel
        control={<Checkbox checked={withFinance && financeReady} disabled={!financeReady} onChange={(e) => setWithFinance(e.target.checked)} />}
        label={financeReady ? 'Include Finance (readable, not encrypted)' : 'Include Finance (unlock Finance first)'}
      />
      {withFinance && financeReady && <Alert severity="warning">The file will contain your finance data in plain text. Keep it somewhere private.</Alert>}
      <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={!ready} onClick={download} sx={{ alignSelf: 'flex-start' }}>
        Download (.json)
      </Button>
    </Section>
  );
}
