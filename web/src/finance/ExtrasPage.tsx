import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { eventsOf, isInflow, pendingCash, validateEvent, voucherState } from './extras';
import { useFinance } from './FinanceContext';
import { EVENT_KINDS, formatINR, type MoneyEvent, type Paise, type VoucherEntry } from './model';
import { AmountField } from './ui';

const KEY = 'YYYY-MM-DD';
const d = (s: string) => dayjs(s).format('D MMM YYYY');
const now = () => new Date().toISOString();
const ACCOUNT_LABEL = { bank: 'Bank', card: 'Card', voucher: 'Amazon Pay (voucher)' } as const;

function VoucherDialog({ onClose }: { onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const [kind, setKind] = useState<'load' | 'adjust'>('load');
  const [amount, setAmount] = useState<Paise | null>(null);
  const [minus, setMinus] = useState(false);
  const [date, setDate] = useState(dayjs().format(KEY));
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const save = async () => {
    if (amount === null) return;
    const row: VoucherEntry = { id: crypto.randomUUID(), date, kind, amount: kind === 'adjust' && minus ? -amount : amount, expiresOn: kind === 'load' && expires ? expires : null, note: note.trim() || null, updatedAt: now(), deletedAt: null };
    await update((x) => ({ ...x, vouchers: [...(x.vouchers ?? []), row] }));
    toast(kind === 'load' ? `Added ${formatINR(amount)} to Amazon Pay` : 'Balance corrected');
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Amazon Pay balance</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={kind} onChange={(_, v) => v && setKind(v)} aria-label="Kind">
            <ToggleButton value="load" sx={{ textTransform: 'none', px: 2 }}>
              Add value (gift card)
            </ToggleButton>
            <ToggleButton value="adjust" sx={{ textTransform: 'none', px: 2 }}>
              Correct the balance
            </ToggleButton>
          </ToggleButtonGroup>
          <AmountField label="Amount" value={amount} onChange={setAmount} autoFocus />
          {kind === 'adjust' && (
            <ToggleButtonGroup exclusive size="small" value={minus ? 'down' : 'up'} onChange={(_, v) => v && setMinus(v === 'down')} aria-label="Direction">
              <ToggleButton value="up" sx={{ textTransform: 'none', px: 2 }}>
                Add
              </ToggleButton>
              <ToggleButton value="down" sx={{ textTransform: 'none', px: 2 }}>
                Remove
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <Stack direction="row" spacing={1}>
            <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            {kind === 'load' && <TextField type="date" label="Expires (optional)" value={expires} onChange={(e) => setExpires(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />}
          </Stack>
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 120 }} />
          <Typography variant="caption" color="text.secondary">
            Spending it: log a purchase paid with “Amazon Pay” (Today → Quick add). Cashback to Amazon Pay: add it under refunds and one-offs, landing in Amazon Pay.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={amount === null || amount === 0 || !date || (!!expires && expires < date)} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type Draft = Omit<MoneyEvent, 'id' | 'updatedAt' | 'deletedAt' | 'amount'> & { amount: Paise | null };

function EventDialog({ event, onClose }: { event: MoneyEvent | 'new'; onClose: () => void }) {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const isNew = event === 'new';
  const cards = doc!.settings.cards;
  const [f, setF] = useState<Draft>(() =>
    isNew ? { date: dayjs().format(KEY), kind: 'refund', amount: null, description: '', status: 'pending', settledOn: null, account: 'bank', cardMethod: null } : { ...event },
  );
  const set = (p: Partial<Draft>) => setF((x) => ({ ...x, ...p }));
  const problem = f.amount === null ? 'Enter an amount.' : validateEvent({ ...f, amount: f.amount });
  const save = async () => {
    if (f.amount === null) return;
    const row: MoneyEvent = { ...(isNew ? { id: crypto.randomUUID(), deletedAt: null } : { id: event.id, deletedAt: null }), ...f, amount: f.amount, description: f.description.trim(), cardMethod: f.account === 'card' ? f.cardMethod : null, settledOn: f.status === 'settled' ? f.settledOn : null, updatedAt: now() };
    await update((x) => ({ ...x, events: isNew ? [...(x.events ?? []), row] : (x.events ?? []).map((e) => (e.id === row.id ? row : e)) }));
    toast(isNew ? 'Added' : 'Saved');
    onClose();
  };
  const remove = async () => {
    if (isNew) return;
    await update((x) => ({ ...x, events: (x.events ?? []).map((e) => (e.id === event.id ? { ...e, deletedAt: now(), updatedAt: now() } : e)) }));
    toast('Deleted', { action: { label: 'Undo', run: () => void update((x) => ({ ...x, events: (x.events ?? []).map((e) => (e.id === event.id ? { ...e, deletedAt: null, updatedAt: now() } : e)) })) } });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isNew ? 'Refund or one-off' : 'Edit'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="What" value={f.kind} onChange={(e) => set({ kind: e.target.value as MoneyEvent['kind'] })}>
            {EVENT_KINDS.map((k) => (
              <MenuItem key={k.key} value={k.key}>
                {k.label}
              </MenuItem>
            ))}
          </TextField>
          <AmountField label="Amount" value={f.amount} onChange={(amount) => set({ amount })} />
          <TextField label="Description" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Myntra return" inputProps={{ maxLength: 120 }} />
          <TextField type="date" label="Started on" value={f.date} onChange={(e) => set({ date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Stack direction="row" spacing={1}>
            <TextField select label={isInflow(f) ? 'Lands in' : 'Paid from'} value={f.account} onChange={(e) => set({ account: e.target.value as MoneyEvent['account'] })} fullWidth>
              {(['bank', 'card', 'voucher'] as const).map((a) => (
                <MenuItem key={a} value={a}>
                  {ACCOUNT_LABEL[a]}
                </MenuItem>
              ))}
            </TextField>
            {f.account === 'card' && (
              <TextField select label="Card" value={f.cardMethod ?? ''} onChange={(e) => set({ cardMethod: e.target.value })} fullWidth>
                {cards.map((c) => (
                  <MenuItem key={c.id} value={c.method}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
          <ToggleButtonGroup exclusive size="small" value={f.status} onChange={(_, v) => v && set({ status: v, settledOn: v === 'settled' ? f.settledOn ?? dayjs().format(KEY) : null })} aria-label="Status">
            <ToggleButton value="pending" sx={{ textTransform: 'none', px: 2 }}>
              Pending
            </ToggleButton>
            <ToggleButton value="settled" sx={{ textTransform: 'none', px: 2 }}>
              Settled
            </ToggleButton>
          </ToggleButtonGroup>
          {f.status === 'settled' && <TextField type="date" label="Settled on" value={f.settledOn ?? ''} onChange={(e) => set({ settledOn: e.target.value || null })} InputLabelProps={{ shrink: true }} />}
          <Typography variant="caption" color="text.secondary">
            {f.status === 'pending'
              ? 'Pending: shown and labelled, but not added to savings, cards or the bank until settled.'
              : f.account === 'voucher'
                ? 'Lands as Amazon Pay value: not cash, never counted as savings.'
                : `Counts in ${f.settledOn ? dayjs(f.settledOn).format('MMMM') : 'the month it settled'}${f.account === 'card' ? ', lowering that card’s bill' : ''}.`}
          </Typography>
          {f.amount !== null && problem && <Alert severity="warning">{problem}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isNew && (
          <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!!problem} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EventRow({ e, onOpen, onSettle }: { e: MoneyEvent; onOpen: () => void; onSettle?: () => void }) {
  const kind = EVENT_KINDS.find((k) => k.key === e.kind)?.label ?? e.kind;
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box component="button" onClick={onOpen} sx={{ flexGrow: 1, minWidth: 0, border: 0, p: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <Typography sx={{ fontWeight: 600 }} noWrap>
          {e.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {kind} · {e.status === 'settled' && e.settledOn ? `settled ${d(e.settledOn)}` : `since ${d(e.date)}`} · {ACCOUNT_LABEL[e.account]}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} color={isInflow(e) ? 'success.main' : undefined}>
        {isInflow(e) ? '+' : '−'}
        {formatINR(e.amount)}
      </Typography>
      {onSettle && (
        <Button size="small" variant="outlined" onClick={onSettle}>
          Settled
        </Button>
      )}
    </Stack>
  );
}

/** Amazon Pay voucher balance (not cash), and refunds / one-offs that are pending or settled. */
export default function ExtrasPage() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyEvent | 'new' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const v = useMemo(() => (doc ? voucherState(doc, today) : null), [doc, today]);
  if (!doc || !v) return null;
  const events = eventsOf(doc).sort((a, b) => (b.settledOn ?? b.date).localeCompare(a.settledOn ?? a.date));
  const pending = events.filter((e) => e.status === 'pending');
  const settled = events.filter((e) => e.status === 'settled');
  const pc = pendingCash(doc);
  const settle = (e: MoneyEvent) =>
    void update((x) => ({ ...x, events: (x.events ?? []).map((y) => (y.id === e.id ? { ...y, status: 'settled', settledOn: today, updatedAt: now() } : y)) })).then(() =>
      toast(`Settled today: ${e.description}`, { action: { label: 'Undo', run: () => void update((x) => ({ ...x, events: (x.events ?? []).map((y) => (y.id === e.id ? { ...y, status: 'pending', settledOn: null, updatedAt: now() } : y)) })) } }),
    );

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Card title="🎟️ Amazon Pay balance" aside={<Chip size="small" variant="outlined" label="Not cash" />}>
        <Typography sx={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(v.balance)}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Voucher value: never counted in savings or your bank. Purchases paid with “Amazon Pay” come out of it (earliest-expiring first) and don’t use your cash budgets.
        </Typography>
        {v.expiringSoon.map((x) => (
          <Alert key={x.expiresOn} severity="warning" sx={{ mb: 1 }}>
            {formatINR(x.amount)} expires {d(x.expiresOn)}. Use it before then.
          </Alert>
        ))}
        {v.shortfall > 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {formatINR(v.shortfall)} of Amazon Pay spending had no voucher value to cover it. Add the missing gift card, or correct the balance.
          </Alert>
        )}
        {v.expired > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Expired unused so far: {formatINR(v.expired)}.
          </Typography>
        )}
        <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={() => setVoucherOpen(true)}>
          Add value or correct
        </Button>
        {v.lines.length > 0 && (
          <Stack spacing={0.25} sx={{ mt: 2 }}>
            {[...v.lines].reverse().slice(0, showAll ? undefined : 8).map((l, i) => (
              <Stack key={`${l.date}-${i}`} direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {dayjs(l.date).format('D MMM')}
                  </Typography>{' '}
                  {l.label}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} color={l.kind === 'expired' ? 'warning.main' : l.amount > 0 ? 'success.main' : undefined}>
                  {formatINR(l.amount, { sign: true })}
                </Typography>
              </Stack>
            ))}
            {v.lines.length > 8 && (
              <Button size="small" onClick={() => setShowAll((s) => !s)} sx={{ alignSelf: 'flex-start' }}>
                {showAll ? 'Show less' : `Show all ${v.lines.length}`}
              </Button>
            )}
          </Stack>
        )}
      </Card>

      <Card title="↩️ Refunds and one-offs" aside={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setEditing('new')}>Add</Button>}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Refunds, exchange amounts, cashback and other one-offs. Pending ones are listed, never counted; once settled they count in that month (bank or card), or as voucher value.
        </Typography>
        {pending.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Pending
            </Typography>
            {pending.map((e) => (
              <EventRow key={e.id} e={e} onOpen={() => setEditing(e)} onSettle={() => settle(e)} />
            ))}
            {(pc.in > 0 || pc.out > 0) && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                If they all come through: {pc.in ? `+${formatINR(pc.in)}` : ''}
                {pc.in && pc.out ? ' · ' : ''}
                {pc.out ? `−${formatINR(pc.out)}` : ''} (estimate, not included anywhere yet)
              </Typography>
            )}
          </Box>
        )}
        {settled.length > 0 && (
          <Box>
            <Typography variant="subtitle2">Settled</Typography>
            {settled.slice(0, 12).map((e) => (
              <EventRow key={e.id} e={e} onOpen={() => setEditing(e)} />
            ))}
          </Box>
        )}
        {events.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nothing yet.
          </Typography>
        )}
      </Card>

      {voucherOpen && <VoucherDialog onClose={() => setVoucherOpen(false)} />}
      {editing && <EventDialog event={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
