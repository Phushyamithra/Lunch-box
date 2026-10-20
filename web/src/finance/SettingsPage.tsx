import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { fingerprintError } from './biometric';
import { useFinance } from './FinanceContext';
import { formatINR, validateSettings, type FinanceSettings } from './model';
import { AmountField } from './ui';
import { passphraseProblem, WrongPassphraseError } from './vault';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const uid = () => crypto.randomUUID().slice(0, 8);

function DaySelect({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <TextField select size="small" label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} sx={{ flex: '1 1 140px', minWidth: 140 }}>
      <MenuItem value="">Not set</MenuItem>
      {DAYS.map((d) => (
        <MenuItem key={d} value={d}>
          {d}
        </MenuItem>
      ))}
    </TextField>
  );
}

function FingerprintDialog({ onClose }: { onClose: () => void }) {
  const { enableFingerprint } = useFinance();
  const toast = useSnackbar();
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Lock Finance with your fingerprint</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Your phone will offer to save a passkey for Tracker; confirm with your fingerprint (it may ask twice). Finance then opens with a touch and locks again after 5 minutes
            in the background. Your passphrase keeps working as a fallback.
          </Typography>
          <TextField label="Finance passphrase" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" autoFocus />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!p || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const mode = await enableFingerprint(p);
              toast(mode === 'prf' ? '🔒 Fingerprint on: your key is now encrypted with it' : '🔒 Fingerprint check on');
              onClose();
            } catch (e) {
              setErr(e instanceof WrongPassphraseError ? 'That passphrase is wrong.' : fingerprintError(e));
              setBusy(false);
            }
          }}
        >
          {busy ? 'Follow the prompts…' : 'Turn on'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PassphraseDialog({ onClose }: { onClose: () => void }) {
  const { changePassphrase } = useFinance();
  const toast = useSnackbar();
  const [cur, setCur] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const problem = passphraseProblem(p, c);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Change passphrase</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Your data is re-encrypted with the new passphrase. Other devices will ask for the new one next time they sync.
          </Typography>
          <TextField label="Current passphrase" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <TextField label="New passphrase" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" helperText={p && problem ? problem : ' '} />
          <TextField label="New passphrase again" type="password" value={c} onChange={(e) => setC(e.target.value)} autoComplete="new-password" />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!cur || !!problem || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await changePassphrase(cur, p);
              toast('🔐 Passphrase changed');
              onClose();
            } catch (e) {
              setErr(e instanceof WrongPassphraseError ? 'The current passphrase is wrong.' : e instanceof Error ? e.message : 'Could not change it.');
              setBusy(false);
            }
          }}
        >
          Change
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Your numbers (seeded from the plan), cards, savings goals, and security / backup. */
export default function FinanceSettingsPage() {
  const finance = useFinance();
  const toast = useSnackbar();
  const [form, setForm] = useState<FinanceSettings>(() => structuredClone(finance.doc!.settings));
  const [formKey, setFormKey] = useState(0);
  const [changing, setChanging] = useState(false);
  const [enablingBio, setEnablingBio] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const error = validateSettings(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(finance.doc!.settings);
  const set = (patch: Partial<FinanceSettings>) => setForm((f) => ({ ...f, ...patch }));
  const move = <T,>(list: T[], i: number, by: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    return next;
  };

  const save = async () => {
    await finance.updateSettings(form);
    toast('Settings saved');
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(finance.doc, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `tracker-finance-${dayjs().format('YYYY-MM-DD')}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { added } = await finance.restore(JSON.parse(await file.text()));
      toast(`Restored: ${added} new transaction${added === 1 ? '' : 's'}; newer edits kept`);
      setForm(structuredClone(finance.doc!.settings));
      setFormKey((k) => k + 1);
    } catch (e) {
      toast(e instanceof SyntaxError ? 'That file isn’t valid JSON.' : e instanceof Error ? e.message : 'Could not restore.', { severity: 'error' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 860, pb: dirty ? 10 : 0 }} key={formKey}>
      <Card title="💼 Income">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <AmountField label="Salary (in hand, monthly)" value={form.salary} onChange={(v) => v !== null && set({ salary: v })} />
          <TextField
            select
            label="Credited on"
            value={String(form.salaryDay)}
            onChange={(e) => set({ salaryDay: e.target.value === 'last' ? 'last' : Number(e.target.value) })}
            sx={{ minWidth: 180 }}
            helperText="That salary pays the next month’s bills."
          >
            <MenuItem value="last">Last day of the month</MenuItem>
            {DAYS.map((d) => (
              <MenuItem key={d} value={String(d)}>
                Day {d}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <Card title="💳 Cards">
        <Stack spacing={2}>
          {form.cards.map((c, i) => (
            <Box key={c.id}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                {c.name} <Typography component="span" variant="body2" color="text.secondary">· {c.purpose} · paid with “{c.method}”</Typography>
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
                <Box sx={{ flex: '1 1 100%' }}><AmountField size="small" label="Limit" value={c.limit} onChange={(v) => v !== null && set({ cards: form.cards.map((x, j) => (j === i ? { ...x, limit: v } : x)) })} /></Box>
                <DaySelect label="Statement day" value={c.statementDay} onChange={(v) => set({ cards: form.cards.map((x, j) => (j === i ? { ...x, statementDay: v } : x)) })} />
                <DaySelect label="Due day" value={c.dueDay} onChange={(v) => set({ cards: form.cards.map((x, j) => (j === i ? { ...x, dueDay: v } : x)) })} />
              </Stack>
            </Box>
          ))}
          <AmountField label="Combined monthly cap (both cards)" value={form.combinedCardCap} onChange={(v) => v !== null && set({ combinedCardCap: v })} helperText="Both cards are paid in full from the next salary." />
          <Typography variant="caption" color="text.secondary">
            Statement and due days are on your card statements. Days 29–31 aren’t offered because not every month has them; pick 28 for “end of month”.
          </Typography>
        </Stack>
      </Card>

      <Card title="🏠 Fixed monthly costs">
        <Stack spacing={1.5}>
          {form.fixed.map((f, i) => (
            <Stack key={f.id} direction="row" spacing={1} useFlexGap alignItems="flex-start" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <TextField size="small" label="Name" value={f.name} onChange={(e) => set({ fixed: form.fixed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} sx={{ flex: '1 1 140px' }} />
              <Box sx={{ flex: '1 1 120px' }}>
                <AmountField size="small" label="Amount" value={f.amount} onChange={(v) => v !== null && set({ fixed: form.fixed.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} />
              </Box>
              <TextField
                size="small"
                type="month"
                label="Last month (optional)"
                value={f.endsOn ?? ''}
                onChange={(e) => set({ fixed: form.fixed.map((x, j) => (j === i ? { ...x, endsOn: e.target.value || null } : x)) })}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: '1 1 150px' }}
              />
              <IconButton aria-label={`Remove ${f.name}`} onClick={() => set({ fixed: form.fixed.filter((_, j) => j !== i) })}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddRoundedIcon />} onClick={() => set({ fixed: [...form.fixed, { id: uid(), name: '', amount: 0, category: 'Bills', endsOn: null }] })} sx={{ alignSelf: 'flex-start' }}>
            Add a fixed cost
          </Button>
        </Stack>
      </Card>

      <Card title="🗓️ Periodic costs">
        <Stack spacing={2}>
          {form.periodic.map((p, i) => (
            <Box key={p.id}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField size="small" label="Name" value={p.name} onChange={(e) => set({ periodic: form.periodic.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} sx={{ flex: 1 }} />
                <Box sx={{ flex: 1 }}>
                  <AmountField size="small" label="Amount" value={p.amount} onChange={(v) => v !== null && set({ periodic: form.periodic.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} />
                </Box>
                <IconButton aria-label={`Remove ${p.name}`} onClick={() => set({ periodic: form.periodic.filter((_, j) => j !== i) })}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }} aria-label={`${p.name} months`}>
                {MONTHS.map((m, k) => {
                  const on = p.months.includes(k + 1);
                  return (
                    <Chip
                      key={m}
                      size="small"
                      label={m}
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      onClick={() => set({ periodic: form.periodic.map((x, j) => (j === i ? { ...x, months: on ? x.months.filter((n) => n !== k + 1) : [...x.months, k + 1].sort((a, b) => a - b) } : x)) })}
                    />
                  );
                })}
              </Stack>
            </Box>
          ))}
          <Button startIcon={<AddRoundedIcon />} onClick={() => set({ periodic: [...form.periodic, { id: uid(), name: '', amount: 0, category: 'Bills', months: [] }] })} sx={{ alignSelf: 'flex-start' }}>
            Add a periodic cost
          </Button>
        </Stack>
      </Card>

      <Card title="🎚️ Variable budgets">
        <Stack spacing={1.5}>
          {form.budgets.map((b, i) => (
            <Stack key={b.category} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ minWidth: 90, fontWeight: 600 }}>{b.category}</Typography>
              <AmountField size="small" label="Per month" value={b.amount} onChange={(v) => v !== null && set({ budgets: form.budgets.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} />
              <FormControlLabel
                control={<Switch checked={b.rollover} onChange={(e) => set({ budgets: form.budgets.map((x, j) => (j === i ? { ...x, rollover: e.target.checked } : x)) })} />}
                label="Unspent → savings"
                sx={{ whiteSpace: 'nowrap' }}
              />
            </Stack>
          ))}
        </Stack>
      </Card>

      <Card title="🪜 Savings goals (filled in this order)">
        <Stack spacing={2}>
          {form.goals.map((g, i) => (
            <Box key={g.id}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 700, minWidth: 22 }}>{i + 1}.</Typography>
                <TextField size="small" label="Goal" value={g.name} onChange={(e) => set({ goals: form.goals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} sx={{ flex: 1 }} />
                <IconButton aria-label="Move up" disabled={i === 0} onClick={() => set({ goals: move(form.goals, i, -1) })}>
                  <ArrowUpwardRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton aria-label="Move down" disabled={i === form.goals.length - 1} onClick={() => set({ goals: move(form.goals, i, 1) })}>
                  <ArrowDownwardRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ pl: 3.5 }}>
                <AmountField size="small" label="Target" value={g.target} onChange={(v) => v !== null && set({ goals: form.goals.map((x, j) => (j === i ? { ...x, target: v } : x)) })} />
                <AmountField size="small" label="Saved already" value={g.savedAtStart} onChange={(v) => v !== null && set({ goals: form.goals.map((x, j) => (j === i ? { ...x, savedAtStart: v } : x)) })} />
              </Stack>
              {g.note && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5, display: 'block', mt: 0.5 }}>
                  {g.note}
                </Typography>
              )}
            </Box>
          ))}
          <Typography variant="body2" color="text.secondary">
            Total: {formatINR(form.goals.reduce((a, g) => a + g.target, 0))}. A later goal only gets money once the ones above it are full.
          </Typography>
        </Stack>
      </Card>

      <Card title="📍 Starting point">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField type="month" label="Tracking starts" value={form.startMonth} onChange={(e) => set({ startMonth: e.target.value })} InputLabelProps={{ shrink: true }} />
          <AmountField label="Bank balance at the start" value={form.openingBalance} onChange={(v) => set({ openingBalance: v })} helperText="What the bank held on the 1st of the start month (after the previous salary landed). Used for Finance → Bank." />
        </Stack>
      </Card>

      <Card title="🔐 Security and backup">
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Synced only in encrypted form. Last synced: {finance.sync.lastSyncedAt ? dayjs(finance.sync.lastSyncedAt).format('D MMM YYYY, HH:mm') : 'not yet'}.
          </Typography>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => t.tracker.tonal }}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!finance.fingerprint.mode}
                  disabled={!finance.fingerprint.available && !finance.fingerprint.mode}
                  onChange={(e) => (e.target.checked ? setEnablingBio(true) : void finance.disableFingerprint().then(() => toast('Fingerprint lock off')))}
                />
              }
              label={<Typography sx={{ fontWeight: 600 }}>Fingerprint lock</Typography>}
            />
            <Typography variant="body2" color="text.secondary">
              {finance.fingerprint.mode === 'prf'
                ? 'On. Your finance key on this phone is encrypted with your fingerprint passkey; without the fingerprint (or passphrase) it can’t be read. Locks after 5 minutes in the background.'
                : finance.fingerprint.mode === 'gate'
                  ? 'On. This phone can’t encrypt with the fingerprint, so it asks for it before opening (the key stays stored on this device). Locks after 5 minutes in the background.'
                  : finance.fingerprint.available
                    ? 'Open Finance with your fingerprint instead of the passphrase. Only Finance is locked; the rest of the app is unchanged.'
                    : 'This device or browser has no fingerprint passkey support (use Chrome on your phone).'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="outlined" onClick={() => setChanging(true)}>
              Change passphrase
            </Button>
            <Button variant="outlined" onClick={() => void finance.lock()}>
              Lock now
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            The backup file is <b>not encrypted</b>: anyone with the file can read it. Keep it somewhere private. Restoring adds its records to yours; newer edits win and nothing
            is deleted.
          </Typography>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="outlined" onClick={download}>
              Download backup
            </Button>
            <Button variant="outlined" onClick={() => fileRef.current?.click()}>
              Restore from file
            </Button>
          </Stack>
          <Button color="error" onClick={() => setConfirmForget(true)} sx={{ alignSelf: 'flex-start' }}>
            Remove Finance from this device
          </Button>
        </Stack>
      </Card>

      {dirty && (
        <Box sx={{ position: 'sticky', bottom: { xs: 88, md: 16 }, zIndex: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.25, borderRadius: 3, bgcolor: 'background.paper', boxShadow: 6 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }} color={error ? 'warning.main' : 'text.secondary'}>
              {error ?? 'Unsaved changes'}
            </Typography>
            <Button onClick={() => (setForm(structuredClone(finance.doc!.settings)), setFormKey((k) => k + 1))}>Discard</Button>
            <Button variant="contained" disabled={!!error} onClick={() => void save()}>
              Save
            </Button>
          </Stack>
        </Box>
      )}

      {changing && <PassphraseDialog onClose={() => setChanging(false)} />}
      {enablingBio && <FingerprintDialog onClose={() => setEnablingBio(false)} />}
      <Dialog open={confirmForget} onClose={() => setConfirmForget(false)}>
        <DialogTitle>Remove Finance from this device?</DialogTitle>
        <DialogContent>
          <Typography>
            This device’s copy and remembered key are removed. Your encrypted copy stays in the cloud; unlock with your passphrase to get it back. Anything not yet synced would be
            lost, so it syncs first.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmForget(false)}>Cancel</Button>
          <Button color="error" onClick={() => void finance.forgetDevice()}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
