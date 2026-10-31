import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../finance/FinanceContext';
import { newTransaction } from '../finance/model';
import { useFitness } from '../fitness/FitnessContext';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { FOOD_COLUMNS, LOG_COLUMNS, parseImportFile, planImport, planIsEmpty, toCsv, type RowError } from '../nutrition/backup';
import { useNutrition } from '../nutrition/NutritionContext';
import { FINANCE_COLUMNS, MEASURE_COLUMNS, WORKOUT_COLUMNS, dropExamples, missingColumn, planFinance, planMeasurements, planWorkouts, readTable, tableToCsv, type Table } from './templates';

const MAX_BYTES = 15 * 1024 * 1024;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** What a file will add, ready to confirm. */
interface Prepared {
  adds: string[];
  duplicates: number;
  errors: RowError[];
  empty: boolean;
  run: (progress: (pct: number) => void) => Promise<void>;
}

function TemplateRow({ title, hint, fileName, template, prepare }: { title: string; hint: string; fileName: string; template: () => string; prepare: (table: Table, fileName: string) => Prepared | { fatal: string } }) {
  const toast = useSnackbar();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; prepared: Prepared } | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (f: File | undefined) => {
    setFile(null);
    setFatal(null);
    if (input.current) input.current.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) return setFatal('That file is over 15 MB.');
    try {
      const prepared = prepare(dropExamples(await readTable(f)), f.name);
      if ('fatal' in prepared) setFatal(prepared.fatal);
      else setFile({ name: f.name, prepared });
    } catch {
      setFatal('Couldn’t read that file. Use the template, saved as .csv or .xlsx.');
    }
  };
  const run = async () => {
    if (!file) return;
    setProgress(0);
    try {
      await file.prepared.run(setProgress);
      toast(`📥 Added ${file.prepared.adds.join(', ')}`);
      setFile(null);
    } catch (e) {
      toast(`Import stopped: ${e instanceof Error ? e.message : 'error'}. Rows added before that are kept; uploading the file again skips them.`, { severity: 'error' });
    } finally {
      setProgress(null);
    }
  };
  const p = file?.prepared;

  return (
    <Box>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
        {hint}
      </Typography>
      <input ref={input} type="file" accept=".csv,.xlsx,text/csv" hidden aria-label={`Upload ${title}`} onChange={(e) => void pick(e.target.files?.[0])} />
      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="outlined" onClick={() => download(fileName, template())}>
          Download template
        </Button>
        <Button variant="contained" disabled={progress !== null} onClick={() => input.current?.click()}>
          Upload filled file
        </Button>
      </Stack>
      {fatal && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setFatal(null)}>
          {fatal}
        </Alert>
      )}
      {p && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{file.name}</Typography>
          <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75, my: 1.25 }}>
            {p.adds.map((a) => (
              <Chip key={a} color="primary" label={`+${a}`} />
            ))}
            {p.duplicates > 0 && <Chip variant="outlined" label={`${p.duplicates} already here · skipped`} />}
            {p.errors.length > 0 && <Chip color="warning" variant="outlined" label={`${plural(p.errors.length, 'problem')} · skipped`} />}
          </Stack>
          {p.errors.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1.25 }}>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {p.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>
                    <b>{e.where}:</b> {e.message}
                  </li>
                ))}
              </Box>
              {p.errors.length > 8 && `…and ${p.errors.length - 8} more.`}
            </Alert>
          )}
          {progress !== null && <LinearProgress variant="determinate" value={progress} sx={{ mb: 1.25 }} aria-label="Importing" />}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={p.empty || progress !== null} onClick={() => void run()}>
              {p.empty ? 'Nothing new to add' : 'Add these'}
            </Button>
            <Button disabled={progress !== null} onClick={() => setFile(null)}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

const columnsMissing = (table: Table, needed: readonly string[]) => {
  const missing = missingColumn(table, needed);
  return missing ? { fatal: `This file has no “${missing}” column. Start from the template.` } : null;
};

/** Add a lot at once: one template per kind of record, downloaded, filled in and uploaded. */
export default function TemplatesPage() {
  const navigate = useNavigate();
  const finance = useFinance();
  const fitness = useFitness();
  const nutrition = useNutrition();
  const today = dayjs().format('YYYY-MM-DD');
  const doc = finance.doc;

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Typography color="text.secondary">
        Download a template, fill it in with Excel or Sheets, then upload it as .csv or .xlsx. You’ll see what will be added first. Upload only adds: nothing you have is changed, and rows already here are skipped. Rows
        starting with EXAMPLE are ignored.
      </Typography>

      <Card title="💰 Finance">
        {doc ? (
          <TemplateRow
            title="Expenses"
            hint={`One row per expense. Method is one of: ${doc.settings.methods.join(', ')}. Category is one of: ${doc.settings.categories.join(', ')}.`}
            fileName="finance-expenses-template.csv"
            template={() => toCsv(FINANCE_COLUMNS, [{ date: today, amount: 250, category: doc.settings.categories[0], method: doc.settings.methods[0], note: 'EXAMPLE delete this row', one_off: 'no' }])}
            prepare={(table) => {
              const stop = columnsMissing(table, ['date', 'amount', 'method']);
              if (stop) return stop;
              const plan = planFinance(table, doc);
              return {
                adds: plan.transactions.length ? [plural(plan.transactions.length, 'expense')] : [],
                duplicates: plan.duplicates,
                errors: plan.errors,
                empty: plan.transactions.length === 0,
                run: async () => {
                  const rows = plan.transactions.map((t) => newTransaction(t));
                  await finance.update((d) => ({ ...d, transactions: [...d.transactions, ...rows] }));
                },
              };
            }}
          />
        ) : (
          <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/finance')}>Open Finance</Button>}>
            Unlock Finance first, then come back here.
          </Alert>
        )}
      </Card>

      <Card title="🏋️ Fitness">
        <Stack spacing={3}>
          <TemplateRow
            title="Measurements"
            hint="One row per day. Fill in any of weight, waist and steps. Time of day is morning, afternoon, evening or night."
            fileName="fitness-measurements-template.csv"
            template={() => toCsv(MEASURE_COLUMNS, [{ date: today, weight_kg: 72.5, time_of_day: 'morning', waist_cm: 84, steps: 9000, note: 'EXAMPLE delete this row' }])}
            prepare={(table) => {
              const stop = columnsMissing(table, ['date']);
              if (stop) return stop;
              const plan = planMeasurements(table, fitness.data!);
              const adds = [plan.weighIns.length && plural(plan.weighIns.length, 'weigh-in'), plan.waists.length && plural(plan.waists.length, 'waist measurement'), plan.steps.length && `${plural(plan.steps.length, 'day')} of steps`].filter((a): a is string => Boolean(a));
              return { adds, duplicates: plan.duplicates, errors: plan.errors, empty: adds.length === 0, run: (progress) => fitness.importMeasurements(plan, progress) };
            }}
          />
          <TemplateRow
            title="Workouts"
            hint="One row per set. Leave “set” empty to number them in order. Past days become finished sessions and count in history and lift trends."
            fileName="fitness-workouts-template.csv"
            template={() => toCsv(WORKOUT_COLUMNS, [{ date: today, exercise: 'EXAMPLE Bench Press', set: 1, weight_kg: 60, reps: 8 }])}
            prepare={(table) => {
              const stop = columnsMissing(table, ['date', 'exercise', 'reps']);
              if (stop) return stop;
              const plan = planWorkouts(table, fitness.data!);
              return { adds: plan.sets ? [`${plural(plan.sets, 'set')} on ${plural(plan.days.length, 'day')}`] : [], duplicates: plan.duplicates, errors: plan.errors, empty: plan.sets === 0, run: (progress) => fitness.importWorkouts(plan, progress) };
            }}
          />
        </Stack>
      </Card>

      <Card title="🥗 Nutrition">
        <Stack spacing={3}>
          <TemplateRow
            title="Food log"
            hint="One row per food eaten. Meal is breakfast, lunch, dinner or snacks. Give the values for the amount you had."
            fileName="nutrition-food-log-template.csv"
            template={() => toCsv(LOG_COLUMNS, [{ day: today, meal: 'breakfast', name: 'EXAMPLE Poha, 1 plate', quantity: 1, unit: 'serving', kcal: 270, protein: 5, carbs: 48, fat: 7, fibre: 2, verification: 'user', source: 'quick' }])}
            prepare={(table, name) => prepareNutrition(table, name, nutrition)}
          />
          <TemplateRow
            title="Foods"
            hint="Your own foods, to search for later. Values are per 100 g or 100 ml. Portions look like “1 katori:150”."
            fileName="nutrition-foods-template.csv"
            template={() => toCsv(FOOD_COLUMNS, [{ name: 'EXAMPLE Paneer bhurji', diet: 'veg', basis: '100g', serving_g: 150, portions: '1 katori:150', kcal: 250, protein: 14, carbs: 6, fat: 19, fibre: 1, source: 'user', verification: 'user' }])}
            prepare={(table, name) => prepareNutrition(table, name, nutrition)}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

function prepareNutrition(table: Table, name: string, nutrition: ReturnType<typeof useNutrition>): Prepared | { fatal: string } {
  const parsed = parseImportFile(name.replace(/\.xlsx$/i, '.csv'), tableToCsv(table));
  if ('fatal' in parsed) return parsed;
  const plan = planImport(nutrition.data!, parsed, () => crypto.randomUUID());
  const adds = [plan.entries.length && plural(plan.entries.length, 'log entry', 'log entries'), plan.foods.length && plural(plan.foods.length, 'food')].filter((a): a is string => Boolean(a));
  return {
    adds,
    duplicates: plan.duplicates.entries + plan.duplicates.foods,
    errors: parsed.errors,
    empty: planIsEmpty(plan),
    run: (progress) => nutrition.importRows({ foods: plan.foods, entries: plan.entries, targets: plan.targets, profile: plan.profile }, (done, total) => progress(total ? (done / total) * 100 : 100)),
  };
}
