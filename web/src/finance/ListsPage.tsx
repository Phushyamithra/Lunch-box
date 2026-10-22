import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { useFinance } from './FinanceContext';
import { formatINR, newTransaction, validateTransaction, type ListItem } from './model';
import { reminders } from './planner';
import { blankInput, TransactionFields, type DraftTx } from './TransactionForm';
import { AmountField } from './ui';

const KEY = 'YYYY-MM-DD';
const now = () => new Date().toISOString();

function ItemDialog({ kind, item, onClose }: { kind: ListItem['kind']; item: ListItem | null; onClose: () => void }) {
  const { update } = useFinance();
  const [title, setTitle] = useState(item?.title ?? '');
  const [due, setDue] = useState(item?.due ?? '');
  const [amount, setAmount] = useState<number | null>(item?.amount ?? null);
  const [note, setNote] = useState(item?.note ?? '');
  const save = async () => {
    const row: ListItem = item
      ? { ...item, title: title.trim(), due: due || null, amount, note: note.trim() || null, updatedAt: now() }
      : { id: crypto.randomUUID(), kind, title: title.trim(), status: 'open', due: due || null, amount, category: kind === 'want' ? 'Wants' : null, note: note.trim() || null, createdAt: now(), updatedAt: now(), deletedAt: null, transactionId: null };
    await update((d) => ({ ...d, lists: item ? (d.lists ?? []).map((x) => (x.id === row.id ? row : x)) : [...(d.lists ?? []), row] }));
    onClose();
  };
  const remove = async () => {
    if (!item) return;
    await update((d) => ({ ...d, lists: (d.lists ?? []).map((x) => (x.id === item.id ? { ...x, deletedAt: now(), updatedAt: now() } : x)) }));
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{item ? 'Edit' : kind === 'want' ? 'Buy later' : 'New checklist item'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label={kind === 'want' ? 'What' : 'Item'} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus inputProps={{ maxLength: 120 }} placeholder={kind === 'want' ? 'e.g. Running shoes' : 'e.g. Renew the salad subscription'} />
          <AmountField label={kind === 'want' ? 'About how much' : 'Amount (optional)'} value={amount} onChange={setAmount} />
          <TextField type="date" label={kind === 'want' ? 'Not before (optional)' : 'Due (optional)'} value={due} onChange={(e) => setDue(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 300 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {item && (
          <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!title.trim()} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Turn an item into a real expense (and tick it off). */
function ConvertDialog({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const [form, setForm] = useState<DraftTx>({ ...blankInput(item.category ?? (item.kind === 'want' ? 'Wants' : 'Other'), 'UPI'), amount: item.amount, note: item.title });
  const problem = form.amount === null ? null : validateTransaction({ ...form, amount: form.amount }, doc!.settings);
  const save = async () => {
    if (form.amount === null) return;
    const t = newTransaction({ ...form, amount: form.amount });
    await update((d) => ({
      ...d,
      transactions: [...d.transactions, t],
      lists: (d.lists ?? []).map((x) => (x.id === item.id ? { ...x, status: 'done', transactionId: t.id, updatedAt: now() } : x)),
    }));
    toast(`Added ${formatINR(t.amount)} · ${t.category}; ticked off`);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Record as an expense</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TransactionFields value={form} onChange={setForm} />
        </Box>
        {problem && <Alert severity="warning" sx={{ mt: 1.5 }}>{problem}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={form.amount === null || !!problem} onClick={() => void save()}>
          Add expense
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ItemRow({ item, onEdit, onConvert, onToggle, extra }: { item: ListItem; onEdit: () => void; onConvert: () => void; onToggle: () => void; extra?: React.ReactNode }) {
  const today = dayjs().format(KEY);
  const overdue = item.status === 'open' && item.kind === 'task' && item.due && item.due < today;
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', opacity: item.status === 'done' ? 0.6 : 1 }}>
      <Checkbox checked={item.status === 'done'} onChange={onToggle} inputProps={{ 'aria-label': item.status === 'done' ? `Reopen ${item.title}` : `Tick off ${item.title}` }} />
      <Box component="button" onClick={onEdit} sx={{ flexGrow: 1, minWidth: 0, border: 0, p: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <Typography sx={{ fontWeight: 600, textDecoration: item.status === 'done' ? 'line-through' : undefined }} noWrap>
          {item.title}
        </Typography>
        <Typography variant="body2" color={overdue ? 'warning.main' : 'text.secondary'} noWrap>
          {[item.amount !== null ? formatINR(item.amount) : null, item.due ? `${item.kind === 'want' ? 'not before' : overdue ? 'was due' : 'due'} ${dayjs(item.due).format('D MMM')}` : null, item.transactionId ? 'recorded as an expense' : null, item.note]
            .filter(Boolean)
            .join(' · ') || (item.kind === 'want' ? 'Wants' : 'Open')}
        </Typography>
      </Box>
      {extra}
      {item.status === 'open' && (
        <Button size="small" onClick={onConvert}>
          {item.kind === 'want' ? 'Bought' : 'Expense'}
        </Button>
      )}
    </Stack>
  );
}

/** Reminders, an open checklist, and wants deferred for later. */
export default function ListsPage() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const navigate = useNavigate();
  const today = dayjs().format(KEY);
  const [editing, setEditing] = useState<{ kind: ListItem['kind']; item: ListItem | null } | null>(null);
  const [converting, setConverting] = useState<ListItem | null>(null);
  const [showDone, setShowDone] = useState(false);
  const rem = useMemo(() => (doc ? reminders(doc, today) : []), [doc, today]);
  if (!doc) return null;
  const items = (doc.lists ?? []).filter((x) => !x.deletedAt);
  const sortOpen = (a: ListItem, b: ListItem) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt);
  const tasks = items.filter((x) => x.kind === 'task');
  const wants = items.filter((x) => x.kind === 'want');
  const toggle = (x: ListItem) => void update((d) => ({ ...d, lists: (d.lists ?? []).map((y) => (y.id === x.id ? { ...y, status: y.status === 'done' ? 'open' : 'done', updatedAt: now() } : y)) }));
  const verify = (txId: string) =>
    void update((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === txId ? { ...t, cashbackVerified: true, updatedAt: now() } : t)) })).then(() => toast('Cashback checked'));

  const section = (list: ListItem[], kind: ListItem['kind']) => {
    const open = list.filter((x) => x.status === 'open').sort(sortOpen);
    const done = list.filter((x) => x.status === 'done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (
      <>
        {open.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {kind === 'want' ? 'Nothing deferred. When you hold off on a want, park it here.' : 'Nothing open.'}
          </Typography>
        )}
        {open.map((x) => (
          <ItemRow
            key={x.id}
            item={x}
            onEdit={() => setEditing({ kind, item: x })}
            onConvert={() => setConverting(x)}
            onToggle={() => toggle(x)}
            extra={
              kind === 'want' && x.amount !== null ? (
                <Button size="small" color="inherit" onClick={() => navigate('/finance/what-if', { state: { amount: x.amount, category: 'Wants', note: x.title } })}>
                  Afford?
                </Button>
              ) : undefined
            }
          />
        ))}
        {showDone && done.map((x) => <ItemRow key={x.id} item={x} onEdit={() => setEditing({ kind, item: x })} onConvert={() => setConverting(x)} onToggle={() => toggle(x)} />)}
      </>
    );
  };
  const doneCount = items.filter((x) => x.status === 'done').length;

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      {rem.length > 0 && (
        <Card title="🔔 Reminders">
          <Stack spacing={1}>
            {rem.map((r) => (
              <Stack key={r.key} direction="row" spacing={1} alignItems="center">
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{r.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.detail}
                  </Typography>
                </Box>
                {r.transactionId && (
                  <Button size="small" variant="outlined" onClick={() => verify(r.transactionId as string)}>
                    Checked
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      <Card title="✅ Checklist" aside={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setEditing({ kind: 'task', item: null })}>Add</Button>}>
        {section(tasks, 'task')}
      </Card>

      <Card
        title="🛒 Buy later (deferred wants)"
        aside={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setEditing({ kind: 'want', item: null })}>Add</Button>}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Wants you’re holding off on. “Afford?” checks one against this month; “Bought” records it under Wants.
        </Typography>
        {section(wants, 'want')}
        {wants.some((w) => w.status === 'open' && w.amount !== null) && (
          <Chip
            size="small"
            variant="outlined"
            sx={{ mt: 1.5 }}
            label={`Total waiting: ${formatINR(wants.filter((w) => w.status === 'open').reduce((a, w) => a + (w.amount ?? 0), 0))}`}
          />
        )}
      </Card>

      {doneCount > 0 && (
        <Button size="small" onClick={() => setShowDone((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
          {showDone ? 'Hide' : 'Show'} done ({doneCount})
        </Button>
      )}

      {editing && <ItemDialog kind={editing.kind} item={editing.item} onClose={() => setEditing(null)} />}
      {converting && <ConvertDialog item={converting} onClose={() => setConverting(null)} />}
    </Stack>
  );
}
