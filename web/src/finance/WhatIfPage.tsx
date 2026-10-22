import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { useFinance } from './FinanceContext';
import { formatINR, newTransaction, rupees, toRupees, validateTransaction, type Paise } from './model';
import { affordability, compareScenario, currentLevers, scenarioSettings, type WhatIf } from './scenarios';
import { blankInput, TransactionFields, type DraftTx } from './TransactionForm';

const ym = (m: string | null) => (m ? dayjs(`${m}-01`).format('MMM YYYY') : 'beyond 10 yrs');
const shift = (n: number | null) => (n === null ? '' : n === 0 ? 'no change' : n > 0 ? `${n} mo later` : `${-n} mo sooner`);
const shiftColor = (n: number | null) => (!n ? 'text.secondary' : n > 0 ? 'warning.main' : 'success.main');

function GoalTable({ rows }: { rows: { name: string; before: string | null; after: string | null; change: number | null }[] }) {
  return (
    <Box sx={{ overflowX: 'auto', mx: -1 }}>
      <Table size="small" aria-label="Goal dates before and after">
        <TableHead>
          <TableRow>
            <TableCell>Goal</TableCell>
            <TableCell>Now</TableCell>
            <TableCell>Then</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.name}>
              <TableCell>{g.name}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{ym(g.before)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {ym(g.after)}
                <Typography variant="caption" component="div" color={shiftColor(g.change)}>
                  {shift(g.change)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Afford() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const today = dayjs().format('YYYY-MM-DD');
  const prefill = (useLocation().state ?? null) as { amount?: number; category?: string; note?: string } | null;
  const [form, setForm] = useState<DraftTx>(() => ({ ...blankInput(prefill?.category ?? 'Wants', 'UPI'), amount: prefill?.amount ?? null, note: prefill?.note ?? null }));
  const [formKey, setFormKey] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const input = form.amount === null ? null : { ...form, amount: form.amount };
  const problem = input ? validateTransaction(input, doc!.settings) : null;
  const result = useMemo(() => (input && !problem ? affordability(doc!, today, input) : null), [doc, today, input?.amount, input?.category, input?.method, input?.date, problem]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!input) return;
    const t = newTransaction(input);
    await update((d) => ({ ...d, transactions: [...d.transactions, t] }));
    toast(`Added ${formatINR(t.amount)} · ${t.category}`);
    setConfirm(false);
    setForm(blankInput(form.category, form.method));
    setFormKey((k) => k + 1);
  };
  const tone = result?.level === 'over' ? 'error' : result?.level === 'stretch' ? 'warning' : 'success';

  return (
    <Card title="🛍️ Can I afford it?">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Try a purchase. Nothing is saved unless you choose to add it.
      </Typography>
      <TransactionFields key={formKey} value={form} onChange={setForm} />
      {problem && <Alert severity="warning" sx={{ mt: 1.5 }}>{problem}</Alert>}
      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert severity={tone} icon={false}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{result.level === 'over' ? 'Breaks a limit' : result.level === 'stretch' ? 'Affordable, but costs savings' : 'Fits your plan'}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
              {result.verdict.map((v) => (
                <li key={v}>
                  <Typography variant="body2">{v}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            <Typography variant="body2">
              This month’s savings: {formatINR(result.savings.before)} → <b>{formatINR(result.savings.after)}</b>
            </Typography>
            {result.card && (
              <Typography variant="body2">
                {result.card.name}: {formatINR(result.card.before)} → <b>{formatINR(result.card.after)}</b> of {formatINR(result.card.limit)}
                {result.card.billDue ? ` · on the bill due ${dayjs(result.card.billDue).format('D MMM')}` : ''}
              </Typography>
            )}
            {result.combined && (
              <Typography variant="body2" color={result.combined.level === 'over' ? 'error.main' : undefined}>
                Both cards this month: {formatINR(result.combined.after)} of {formatINR(result.combined.cap)}
              </Typography>
            )}
          </Stack>
          {result.goals.some((g) => g.delay) && (
            <Box sx={{ mt: 1.5 }}>
              <GoalTable rows={result.goals.map((g) => ({ ...g, change: g.delay }))} />
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Goal dates are estimates from your plan.
          </Typography>
          <Button variant="outlined" sx={{ mt: 1.5 }} onClick={() => setConfirm(true)}>
            I bought it: add as a real transaction
          </Button>
        </Box>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Add this transaction?</DialogTitle>
        <DialogContent>
          <Typography>
            {input && `${formatINR(input.amount)} · ${input.category} · ${input.method} · ${dayjs(input.date).format('D MMM YYYY')}`}. It becomes part of your records.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void add()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function Lever({ label, value, onChange, min, max, step, base }: { label: string; value: Paise; onChange: (v: Paise) => void; min: number; max: number; step: number; base: Paise }) {
  const r = toRupees(value);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color={value === base ? 'text.secondary' : 'primary.main'}>
          {formatINR(value)}
          {value !== base ? ` (was ${formatINR(base)})` : ''}
        </Typography>
      </Stack>
      <Slider
        size="small"
        value={Math.min(Math.max(r, min), max)}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(rupees(v as number))}
        aria-label={label}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => formatINR(rupees(v))}
      />
    </Box>
  );
}

function Scenario() {
  const { doc, updateSettings } = useFinance();
  const toast = useSnackbar();
  const today = dayjs().format('YYYY-MM-DD');
  const month = today.slice(0, 7);
  const base = useMemo(() => currentLevers(doc!.settings, month), [doc, month]);
  const [w, setW] = useState<WhatIf>(base);
  const [confirm, setConfirm] = useState(false);
  const changed = JSON.stringify(w) !== JSON.stringify(base);
  const result = useMemo(() => (changed ? compareScenario(doc!, today, w) : null), [doc, today, w, changed]);
  const set = (patch: Partial<WhatIf>) => setW((x) => ({ ...x, ...patch }));
  const apply = async () => {
    await updateSettings(scenarioSettings(doc!.settings, w, month));
    toast('Applied from this month; earlier months keep their values');
    setConfirm(false);
  };

  return (
    <Card title="🎛️ Change the plan">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Move the levers to compare goal dates. Your settings don’t change unless you apply, and even then only from this month on.
      </Typography>
      <Stack spacing={1.5}>
        <Lever label="Salary" value={w.salary} base={base.salary} onChange={(v) => set({ salary: v })} min={30000} max={150000} step={1000} />
        <Lever label="Card cap (both cards)" value={w.combinedCardCap} base={base.combinedCardCap} onChange={(v) => set({ combinedCardCap: v })} min={0} max={25000} step={500} />
        <Lever label="SIP" value={w.sip} base={base.sip} onChange={(v) => set({ sip: v })} min={0} max={25000} step={500} />
        <Lever label="Rent" value={w.rent} base={base.rent} onChange={(v) => set({ rent: v })} min={5000} max={50000} step={500} />
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            type="month"
            size="small"
            label="Gold scheme’s last month"
            value={w.goldEndsOn ?? ''}
            onChange={(e) => set({ goldEndsOn: e.target.value || null })}
            InputLabelProps={{ shrink: true }}
            helperText={w.goldEndsOn !== base.goldEndsOn ? `was ${base.goldEndsOn ? ym(base.goldEndsOn) : 'ongoing'}` : ' '}
          />
        </Stack>
      </Stack>

      {result && (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 1.5 }} useFlexGap>
            <Chip label={`A normal month saves ${formatINR(result.monthly.after)} (was ${formatINR(result.monthly.before)})`} color={result.monthly.after >= result.monthly.before ? 'success' : 'warning'} variant="outlined" />
            <Chip label={`All goals: ${ym(result.finish.after)} · ${shift(result.finish.change)}`} color={(result.finish.change ?? 0) <= 0 ? 'success' : 'warning'} variant="outlined" />
          </Stack>
          <GoalTable rows={result.goals} />
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Estimates. Both columns use the same assumptions; only the levers differ.
          </Typography>
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button disabled={!changed} onClick={() => setW(base)}>
          Reset
        </Button>
        <Button variant="contained" disabled={!changed} onClick={() => setConfirm(true)}>
          Apply from this month
        </Button>
      </Stack>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Apply these changes?</DialogTitle>
        <DialogContent>
          <Typography>
            Your settings change from {dayjs().format('MMMM YYYY')} on. Earlier months keep their old values, so your history and actual savings don’t change.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void apply()}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

/** Test a purchase, or test a change to the plan; nothing changes until you confirm. */
export default function WhatIfPage() {
  const { doc } = useFinance();
  if (!doc) return null;
  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Afford />
      <Scenario key={JSON.stringify(doc.settings.planHistory ?? []) + doc.settings.updatedAt} />
    </Stack>
  );
}
