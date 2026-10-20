import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { fingerprintError } from './biometric';
import { useFinance } from './FinanceContext';
import { parseINR, toRupees, type Paise } from './model';
import { passphraseProblem, WrongPassphraseError } from './vault';

const TABS = [
  { path: '/finance', label: 'Today' },
  { path: '/finance/month', label: 'Month' },
  { path: '/finance/cards', label: 'Cards' },
  { path: '/finance/savings', label: 'Savings' },
  { path: '/finance/plan', label: 'Plan' },
  { path: '/finance/bank', label: 'Bank' },
  { path: '/finance/transactions', label: 'Transactions' },
  { path: '/finance/settings', label: 'Settings' },
];

/** Amount field in rupees; reports paise (null while empty or invalid). */
export function AmountField({
  label,
  value,
  onChange,
  autoFocus,
  size,
  helperText,
  fullWidth = true,
}: {
  label: string;
  value: Paise | null;
  onChange: (p: Paise | null) => void;
  autoFocus?: boolean;
  size?: 'small' | 'medium';
  helperText?: ReactNode;
  fullWidth?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : String(toRupees(value)));
  const parsed = parseINR(text);
  return (
    <TextField
      label={label}
      value={text}
      size={size}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseINR(e.target.value));
      }}
      error={text !== '' && parsed === null}
      helperText={text !== '' && parsed === null ? 'Numbers only, up to 2 decimals' : helperText}
      inputProps={{ inputMode: 'decimal', 'aria-label': label }}
      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
    />
  );
}

export function SyncChip() {
  const { sync, syncNow } = useFinance();
  const when = sync.lastSyncedAt ? dayjs(sync.lastSyncedAt).format('D MMM, HH:mm') : 'never';
  const conf = {
    synced: { icon: <CloudDoneRoundedIcon />, label: 'Synced', color: 'success' as const, tip: `Encrypted copy up to date (last ${when}).` },
    saving: { icon: <CloudSyncRoundedIcon />, label: 'Syncing', color: 'default' as const, tip: 'Encrypting and uploading.' },
    pending: { icon: <CloudSyncRoundedIcon />, label: 'Saved here', color: 'default' as const, tip: 'Saved on this device; syncing shortly.' },
    offline: { icon: <CloudOffRoundedIcon />, label: 'Offline', color: 'warning' as const, tip: sync.message ?? 'Saved on this device only for now.' },
    error: { icon: <ErrorOutlineRoundedIcon />, label: 'Sync failed', color: 'error' as const, tip: sync.message ?? 'Tap to retry.' },
  }[sync.state];
  return (
    <Tooltip title={conf.tip}>
      <Chip size="small" variant="outlined" color={conf.color} icon={conf.icon} label={conf.label} onClick={() => void syncNow()} />
    </Tooltip>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, maxWidth: 520, mx: 'auto' }}>
      {children}
    </Paper>
  );
}

function SetupScreen() {
  const { setup } = useFinance();
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [remember, setRemember] = useState(true);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const problem = passphraseProblem(p, c);
  return (
    <Centered>
      <Typography variant="h6" component="h2" gutterBottom>
        🔐 Set up Finance
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Your finance data is kept on this device and synced to your other devices <b>only in encrypted form</b>. The key comes from a passphrase that never leaves your
          device, so the server (and anyone with access to it) sees only scrambled data.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No bank logins, no SMS reading: you enter everything yourself. It starts with the salary, costs, cards and savings goals from your plan; you can change all of them.
        </Typography>
      </Stack>
      <Stack spacing={2}>
        <TextField label="Passphrase" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" helperText="At least 10 characters. A few unrelated words work well." />
        <TextField label="Type it again" type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="new-password" error={!!c && c !== p} />
        <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label="Remember on this device (you won’t be asked each time)" />
        <Alert severity="warning" icon={false}>
          <FormControlLabel
            control={<Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />}
            label="I understand: if I forget this passphrase, the synced copy can’t be recovered by anyone. (A device that’s already unlocked keeps working, and a backup file still restores.)"
          />
        </Alert>
        {err && <Alert severity="error">{err}</Alert>}
        <Button
          variant="contained"
          size="large"
          disabled={!!problem || !ack || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await setup(p, remember);
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Setup failed.');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Creating your encrypted vault…' : 'Create'}
        </Button>
        {p && problem && <Typography variant="caption" color="text.secondary">{problem}</Typography>}
      </Stack>
    </Centered>
  );
}

function UnlockScreen() {
  const { unlock, fingerprint, unlockWithFingerprint } = useFinance();
  const [p, setP] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usePass, setUsePass] = useState(!fingerprint.mode);
  const tried = useRef(false);
  const touch = async () => {
    setBusy(true);
    setErr(null);
    try {
      await unlockWithFingerprint();
    } catch (e) {
      setErr(fingerprintError(e));
      setBusy(false);
    }
  };
  // Ask for the fingerprint straight away once; if the phone wants a tap first, the button is there.
  useEffect(() => {
    if (fingerprint.mode && !tried.current) {
      tried.current = true;
      void touch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint.mode]);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await unlock(p, remember);
    } catch (e) {
      setErr(e instanceof WrongPassphraseError ? e.message : e instanceof Error ? e.message : 'Could not unlock.');
      setBusy(false);
    }
  };
  return (
    <Centered>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <LockRoundedIcon color="action" />
        <Typography variant="h6" component="h2">
          Finance is locked
        </Typography>
      </Stack>
      {fingerprint.mode && !usePass ? (
        <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => void touch()}
            disabled={busy}
            startIcon={<FingerprintRoundedIcon sx={{ fontSize: '32px !important' }} />}
            sx={{ py: 1.5, px: 3, borderRadius: 999 }}
          >
            {busy ? 'Waiting for fingerprint…' : 'Unlock with fingerprint'}
          </Button>
          {err && <Alert severity="warning" sx={{ width: '100%' }}>{err}</Alert>}
          <Button size="small" onClick={() => (setUsePass(true), setErr(null))}>
            Use passphrase instead
          </Button>
        </Stack>
      ) : (
      <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter your finance passphrase to decrypt your data on this device.
      </Typography>
      <Stack spacing={2} component="form" onSubmit={(e) => (e.preventDefault(), void go())}>
        <TextField label="Passphrase" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" autoFocus />
        {!fingerprint.mode && <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label="Remember on this device" />}
        {err && <Alert severity="error">{err}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={!p || busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
        {fingerprint.mode && (
          <Button size="small" startIcon={<FingerprintRoundedIcon />} onClick={() => (setUsePass(false), void touch())}>
            Use fingerprint
          </Button>
        )}
      </Stack>
      </>
      )}
    </Centered>
  );
}

/** Frame for Finance: setup / unlock first, then section tabs and the sync status. */
export function FinanceLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const finance = useFinance();
  const current = TABS.find((t) => t.path === pathname)?.path ?? false;

  if (finance.status === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Opening Finance" />
      </Box>
    );
  }
  if (finance.status === 'error') {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={() => window.location.reload()}>Retry</Button>}>
        {finance.error}
        {finance.error && /finance_vault/.test(finance.error) && ' — run supabase/migrations/0015_finance_vault.sql in the Supabase SQL Editor, then Retry.'}
      </Alert>
    );
  }
  if (finance.status === 'setup') return <SetupScreen />;
  if (finance.status === 'locked' || !finance.doc) return <UnlockScreen />;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Tabs
          value={current}
          onChange={(_, path: string) => navigate(path)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Finance sections"
          sx={{
            flexGrow: 1,
            minHeight: 44,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': { minHeight: 40, borderRadius: 999, textTransform: 'none', fontWeight: 600, px: 2, mr: 0.5 },
            '& .Mui-selected': { bgcolor: (t) => t.tracker.tonal, color: (t) => `${t.tracker.onTonal} !important` },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.path} value={t.path} label={t.label} />
          ))}
        </Tabs>
        <SyncChip />
      </Stack>
      {finance.sync.state === 'error' && finance.sync.message && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => void finance.syncNow()}>Retry</Button>}>
          {finance.sync.message}
        </Alert>
      )}
      <motion.div key={pathname} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
        <Outlet />
      </motion.div>
    </Box>
  );
}
