import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFinance } from './FinanceContext';
import { applyMonthImport, parseMonthMarkdown, type ImportItem, type ParsedMonth } from './mdImport';
import { formatINR } from './model';

const KIND_LABEL: Record<ImportItem['kind'], string> = {
  transaction: 'Expense',
  event: 'One-off',
  voucher: 'Voucher',
  income: 'Income',
  task: 'Checklist',
  balance: 'Balance check',
  opening: 'Setting',
};

/** Paste or pick a month summary (.md), review every row, then add what's ticked. */
export function MonthImportDialog({ onClose }: { onClose: () => void }) {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [undated, setUndated] = useState('');
  const [busy, setBusy] = useState(false);
  const s = doc!.settings;
  const existing = useMemo(() => new Set([...doc!.transactions, ...(doc!.events ?? []), ...(doc!.vouchers ?? []), ...(doc!.incomes ?? []), ...(doc!.lists ?? []), ...doc!.balances].map((r) => r.id)), [doc]);

  const read = (md: string) => {
    setText(md);
    const p = parseMonthMarkdown(md, { categories: s.categories, methods: s.methods });
    if ('error' in p) {
      setError(p.error);
      setParsed(null);
      return;
    }
    setError(null);
    setParsed(p);
    setUndated(p.generated);
    setItems(p.items.map((i) => (i.record.id && existing.has(i.record.id as string) ? { ...i, include: false, note: 'Already imported.' } : i)));
  };
  const set = (key: string, patch: Partial<ImportItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const chosen = items.filter((i) => i.include);
  const sections = [...new Set(items.map((i) => i.section))];

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      let added = 0;
      await update((d) => {
        const r = applyMonthImport(d, parsed, chosen, undated);
        added = r.added;
        return r.doc;
      });
      toast(`Imported ${added} item${added === 1 ? '' : 's'} from ${parsed.title}`);
      onClose();
    } catch (e) {
      toast(`Not imported: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{parsed ? parsed.title : 'Import a month (Markdown)'}</DialogTitle>
      <DialogContent dividers>
        {!parsed ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              A month summary with front matter (<code>month: 2026-10</code>) and sections: Balances, Fixed and recurring, Logged purchases and expenses, Income, Amazon Pay
              voucher, Pending reimbursements, Open checklist. You’ll see every row before anything is added; nothing you have is changed, and importing the same file again
              adds nothing twice.
            </Typography>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => void e.target.files?.[0]?.text().then(read)} />
            <Button variant="outlined" onClick={() => fileRef.current?.click()} sx={{ alignSelf: 'flex-start' }}>
              Choose a .md file
            </Button>
            <TextField label="…or paste it here" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={8} maxRows={16} inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <TextField type="date" size="small" label="Date for undated rows" value={undated} onChange={(e) => setUndated(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Typography variant="caption" color="text.secondary">
                Purchases have no dates in the file; they’re all given this date (it decides which card statement they land on). Fixed costs use the 1st of the month.
              </Typography>
            </Stack>
            {sections.map((sec) => (
              <Box key={sec}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {sec}
                </Typography>
                {items
                  .filter((i) => i.section === sec)
                  .map((i) => (
                    <Stack key={i.key} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                      <Checkbox size="small" checked={i.include} onChange={(e) => set(i.key, { include: e.target.checked })} inputProps={{ 'aria-label': `Import ${i.label}` }} sx={{ mt: -0.5 }} />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {i.label}
                          </Typography>
                          {i.amount !== null && (
                            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {formatINR(i.amount)}
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }} alignItems="center">
                          <Chip size="small" variant="outlined" label={KIND_LABEL[i.kind]} />
                          {i.kind === 'transaction' && (
                            <>
                              <TextField select size="small" value={i.category} onChange={(e) => set(i.key, { category: e.target.value })} sx={{ minWidth: 120 }} inputProps={{ 'aria-label': 'Category' }}>
                                {s.categories.map((c) => (
                                  <MenuItem key={c} value={c}>
                                    {c}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField select size="small" value={i.method} onChange={(e) => set(i.key, { method: e.target.value })} sx={{ minWidth: 120 }} inputProps={{ 'aria-label': 'Paid with' }}>
                                {[...new Set([...s.methods, i.method as string])].map((m) => (
                                  <MenuItem key={m} value={m}>
                                    {m}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </>
                          )}
                        </Stack>
                        {i.note && (
                          <Typography variant="caption" color={i.include ? 'text.secondary' : 'warning.main'} component="div" sx={{ mt: 0.5 }}>
                            {i.note}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ))}
              </Box>
            ))}
            {parsed.skippedSections.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Not imported (the app works these out itself): {parsed.skippedSections.join(', ')}.
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {parsed && (
          <Button onClick={() => setParsed(null)} sx={{ mr: 'auto' }}>
            Back
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        {parsed ? (
          <Button variant="contained" disabled={!chosen.length || busy || !undated} onClick={() => void run()}>
            Import {chosen.length}
          </Button>
        ) : (
          <Button variant="contained" disabled={!text.trim()} onClick={() => read(text)}>
            Preview
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
