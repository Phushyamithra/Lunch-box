import { Alert, Box, Button, Chip, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useRef, useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import {
  buildBackup,
  entriesToCsv,
  exportName,
  FOOD_COLUMNS,
  foodsToCsv,
  LOG_COLUMNS,
  parseImportFile,
  planImport,
  planIsEmpty,
  toCsv,
  type ImportPlan,
  type ParsedImport,
} from './backup';
import { MEALS } from './foodLog';
import { useNutrition } from './NutritionContext';

const KIND_LABEL: Record<ParsedImport['kind'], string> = { backup: 'Tracker backup', log_csv: 'Food log CSV', foods_csv: 'Foods CSV' };
const MAX_BYTES = 15 * 1024 * 1024;

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const mealLabel = (k: string) => MEALS.find((m) => m.key === k)?.label ?? k;

/** Backups and CSV export / import. Import only adds; nothing is overwritten or deleted. */
export default function DataPage() {
  const nutrition = useNutrition();
  const data = nutrition.data!;
  const toast = useSnackbar();
  const input = useRef<HTMLInputElement>(null);
  const today = dayjs().format('YYYY-MM-DD');
  const [file, setFile] = useState<{ name: string; parsed: ParsedImport; plan: ImportPlan } | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const own = useMemo(
    () => ({ foods: data.foods.filter((f) => f.user_id !== null).length, entries: data.entries.filter((e) => !e.deleted_at).length, targets: data.targets.length }),
    [data],
  );

  const pick = async (f: File | undefined) => {
    setFile(null);
    setFatal(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setFatal('That file is over 15 MB, too big to be a nutrition backup.');
    const parsed = parseImportFile(f.name, await f.text());
    if ('fatal' in parsed) return setFatal(parsed.fatal);
    setFile({ name: f.name, parsed, plan: planImport(data, parsed, () => crypto.randomUUID()) });
  };

  const run = async () => {
    if (!file) return;
    const { plan } = file;
    setProgress(0);
    try {
      await nutrition.importRows({ foods: plan.foods, entries: plan.entries, targets: plan.targets, profile: plan.profile }, (done, total) => setProgress(total ? (done / total) * 100 : 100));
      const parts = [plan.foods.length && plural(plan.foods.length, 'food'), plan.entries.length && plural(plan.entries.length, 'log entry', 'log entries'), plan.targets.length && plural(plan.targets.length, 'target version')].filter(Boolean);
      toast(`📥 Imported ${parts.join(', ') || 'your profile'}`);
      setFile(null);
    } catch (e) {
      toast(`Import stopped: ${e instanceof Error ? e.message : 'error'}. Rows added before the error are kept; importing the file again skips them.`, { severity: 'error' });
      setFile(null);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  const plan = file?.plan;
  const parsed = file?.parsed;
  const days = plan?.entries.map((e) => e.day).sort() ?? [];

  return (
    <Stack spacing={2}>
      <Card title="💾 Back up and export">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {plural(own.entries, 'log entry', 'log entries')}, {plural(own.foods, 'food')} of yours and {plural(own.targets, 'target version')}. The backup restores everything here; the CSVs open in
          Sheets or Excel. Indian catalog foods and restaurant menus are built into the app, so they aren’t copied (your log keeps what each entry counted).
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" onClick={() => download(exportName('backup', today), JSON.stringify(buildBackup(data), null, 1), 'application/json')}>
            Full backup (.json)
          </Button>
          <Button variant="outlined" disabled={!own.entries} onClick={() => download(exportName('food-log', today), entriesToCsv(data.entries), 'text/csv;charset=utf-8')}>
            Food log (.csv)
          </Button>
          <Button variant="outlined" disabled={!own.foods} onClick={() => download(exportName('foods', today), foodsToCsv(data.foods), 'text/csv;charset=utf-8')}>
            My foods (.csv)
          </Button>
        </Stack>
      </Card>

      <Card title="📥 Import">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          A Tracker backup, or a CSV of food-log rows or foods. Import only adds: nothing you have is changed or deleted, and rows you already have are skipped. You’ll see what
          will be added first.
        </Typography>
        <input ref={input} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" onClick={() => input.current?.click()} disabled={progress !== null}>
            Choose file
          </Button>
          <Button size="small" onClick={() => download('food-log-template.csv', toCsv(LOG_COLUMNS, [{ day: today, meal: 'breakfast', name: 'Poha, 1 plate', quantity: 1, unit: 'serving', kcal: 270, protein: 5, carbs: 48, fat: 7, fibre: 2, verification: 'user', source: 'quick' }]), 'text/csv;charset=utf-8')}>
            Log template
          </Button>
          <Button size="small" onClick={() => download('foods-template.csv', toCsv(FOOD_COLUMNS, [{ name: 'Paneer bhurji', diet: 'veg', basis: '100g', serving_g: 150, portions: '1 katori:150', kcal: 250, protein: 14, carbs: 6, fat: 19, fibre: 1, source: 'user', verification: 'user' }]), 'text/csv;charset=utf-8')}>
            Foods template
          </Button>
        </Stack>

        {fatal && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setFatal(null)}>
            {fatal}
          </Alert>
        )}

        {plan && parsed && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">
              {KIND_LABEL[parsed.kind]} · {file.name}
              {parsed.exportedAt && ` · made ${dayjs(parsed.exportedAt).format('D MMM YYYY, HH:mm')}`}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75, my: 1.25 }}>
              {plan.entries.length > 0 && (
                <Chip color="primary" label={`+${plural(plan.entries.length, 'log entry', 'log entries')}${days[0] === days[days.length - 1] ? ` · ${dayjs(days[0]).format('D MMM YY')}` : ` · ${dayjs(days[0]).format('D MMM')}–${dayjs(days[days.length - 1]).format('D MMM YY')}`}`} />
              )}
              {plan.foods.length > 0 && <Chip color="primary" label={`+${plural(plan.foods.length, 'food')}`} />}
              {plan.targets.length > 0 && <Chip color="primary" label={`+${plural(plan.targets.length, 'target version')}`} />}
              {plan.profile && <Chip color="primary" label="+ profile" />}
              {plan.duplicates.entries + plan.duplicates.foods + plan.duplicates.targets > 0 && (
                <Chip variant="outlined" label={`${plan.duplicates.entries + plan.duplicates.foods + plan.duplicates.targets} already here · skipped`} />
              )}
              {parsed.errors.length > 0 && <Chip color="warning" variant="outlined" label={`${plural(parsed.errors.length, 'row')} with problems · skipped`} />}
            </Stack>

            {parsed.errors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1.25 }}>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {parsed.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      <b>{e.where}:</b> {e.message}
                    </li>
                  ))}
                </Box>
                {parsed.errors.length > 8 && `…and ${parsed.errors.length - 8} more. Fix them in the file and import again; the good rows will be skipped as duplicates.`}
              </Alert>
            )}
            {plan.notes.length > 0 && (
              <Alert severity="info" sx={{ mb: 1.25 }}>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {plan.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </Box>
              </Alert>
            )}

            {plan.entries.length > 0 && (
              <Box sx={{ overflowX: 'auto', mb: 1.25 }}>
                <Table size="small" aria-label="Log entries to add">
                  <TableHead>
                    <TableRow>
                      <TableCell>Day</TableCell>
                      <TableCell>Meal</TableCell>
                      <TableCell>Food</TableCell>
                      <TableCell align="right">kcal</TableCell>
                      <TableCell align="right">P</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plan.entries.slice(0, 5).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(e.day).format('D MMM')}</TableCell>
                        <TableCell>{mealLabel(e.meal)}</TableCell>
                        <TableCell>{e.name}</TableCell>
                        <TableCell align="right">{Math.round(e.kcal)}</TableCell>
                        <TableCell align="right">{e.protein}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {plan.entries.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    …and {plan.entries.length - 5} more
                  </Typography>
                )}
              </Box>
            )}
            {plan.foods.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                Foods: {plan.foods.slice(0, 6).map((f) => f.name).join(', ')}
                {plan.foods.length > 6 && ` and ${plan.foods.length - 6} more`}
              </Typography>
            )}

            {progress !== null && <LinearProgress variant="determinate" value={progress} sx={{ mb: 1.25 }} aria-label="Import progress" />}
            {planIsEmpty(plan) ? (
              <Alert severity="success" action={<Button color="inherit" onClick={() => setFile(null)}>OK</Button>}>
                Nothing new: everything in this file is already here.
              </Alert>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void run()} disabled={progress !== null}>
                  Import
                </Button>
                <Button onClick={() => setFile(null)} disabled={progress !== null}>
                  Cancel
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Card>
    </Stack>
  );
}
