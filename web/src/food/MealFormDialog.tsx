import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { CategoryRow, MealInput, MealRow } from './foodApi';

interface MealFormDialogProps {
  open: boolean;
  /** Edit this meal; omit to add a new one. */
  meal?: MealRow | null;
  categories: CategoryRow[];
  existing: MealRow[];
  onClose: () => void;
  onSave: (input: MealInput) => Promise<void>;
}

const NUTRIENTS = [
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
  ['fiber', 'Fiber', 'g'],
] as const;

type Form = { name: string; categoryId: string; icon: string; notes: string } & Record<(typeof NUTRIENTS)[number][0], string>;

const toForm = (meal: MealRow | null | undefined, categoryId: string): Form => ({
  name: meal?.name ?? '',
  categoryId: meal?.category_id ?? categoryId,
  icon: meal?.icon ?? '',
  notes: meal?.notes ?? '',
  calories: meal ? String(meal.calories) : '',
  protein: meal ? String(meal.protein) : '',
  carbs: meal ? String(meal.carbs) : '',
  fat: meal ? String(meal.fat) : '',
  fiber: meal ? String(meal.fiber) : '',
});

/** Validates the form; returns an error message or the input to save. */
export function validateMealForm(form: Form, existing: MealRow[], editingId?: string): string | MealInput {
  const name = form.name.trim();
  if (!name) return 'Give the meal a name.';
  if (!form.categoryId) return 'Choose a category.';
  const duplicate = existing.some(
    (m) => m.id !== editingId && m.category_id === form.categoryId && m.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) return `"${name}" already exists in that category.`;
  const numbers: Record<string, number> = {};
  for (const [key, label] of NUTRIENTS) {
    const raw = form[key].trim();
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) return `${label} must be a number of 0 or more.`;
    numbers[key] = value;
  }
  return {
    name,
    categoryId: form.categoryId,
    icon: form.icon.trim() || null,
    notes: form.notes.trim() || null,
    calories: numbers.calories,
    protein: numbers.protein,
    carbs: numbers.carbs,
    fat: numbers.fat,
    fiber: numbers.fiber,
  };
}

export function MealFormDialog({ open, meal, categories, existing, onClose, onSave }: MealFormDialogProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const usable = categories.filter((c) => c.enabled || c.id === meal?.category_id);
  const [form, setForm] = useState<Form>(() => toForm(meal, usable[0]?.id ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(meal, usable[0]?.id ?? ''));
      setError(null);
    }
    // Reset only when the dialog opens or the edited meal changes.
  }, [open, meal?.id]);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const result = validateMealForm(form, existing, meal?.id);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setBusy(true);
    try {
      await onSave(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the meal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="meal-form-title">
      <DialogTitle id="meal-form-title">{meal ? 'Edit meal' : 'Add a meal'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 1.5 }}>
            <TextField label="Emoji" value={form.icon} onChange={set('icon')} inputProps={{ maxLength: 4 }} />
            <TextField label="Name" value={form.name} onChange={set('name')} autoFocus={!phone} required />
          </Box>
          <TextField select label="Category" value={form.categoryId} onChange={set('categoryId')} required>
            {usable.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {NUTRIENTS.map(([key, label, unit]) => (
              <TextField
                key={key}
                label={`${label} (${unit})`}
                value={form[key]}
                onChange={set(key)}
                inputMode="decimal"
                placeholder="0"
              />
            ))}
          </Box>
          <TextField label="Notes (optional)" value={form.notes} onChange={set('notes')} multiline minRows={2} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={busy}>
          {busy ? 'Saving…' : meal ? 'Save changes' : 'Add meal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
