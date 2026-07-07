import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { EMPTY_NUTRITION, NUTRIENT_META, getCategoryMeta } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Meal, Nutrition } from '../../models';

interface MealFormDialogProps {
  open: boolean;
  /** When set, the dialog edits this meal; otherwise it creates a new one. */
  meal: Meal | null;
  onClose: () => void;
}

/**
 * Add / edit form for a catalog meal, including nutrition. The category
 * field offers existing categories but accepts new ones (free text) —
 * new categories work everywhere without code changes.
 */
export function MealFormDialog({ open, meal, onClose }: MealFormDialogProps) {
  const { addMeal, updateMeal, categories } = useAppData();
  const { showSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sandwich');
  const [nutrition, setNutrition] = useState<Nutrition>({ ...EMPTY_NUTRITION });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(meal?.name ?? '');
      setCategory(meal?.category ?? categories[0] ?? 'Sandwich');
      setNutrition({ ...EMPTY_NUTRITION, ...meal?.nutrition });
      setError(null);
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meal]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const input = { name, category: category.trim(), nutrition };
      if (meal) {
        await updateMeal(meal.id, input);
        showSnackbar('Meal updated');
      } else {
        await addMeal(input);
        showSnackbar('Meal added');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  const setNutrient = (key: keyof Nutrition, raw: string) => {
    const value = Number(raw);
    setNutrition((n) => ({ ...n, [key]: Number.isFinite(value) && value > 0 ? value : 0 }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="meal-form-title">
      <DialogTitle id="meal-form-title">{meal ? 'Edit meal' : 'Add a meal'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Meal name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={Boolean(error)}
          helperText={error ?? ' '}
          autoFocus
          fullWidth
        />
        <Autocomplete
          freeSolo
          options={categories}
          value={category}
          onInputChange={(_, value) => setCategory(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Category"
              helperText="Pick one or type a new category"
            />
          )}
        />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            Nutrition (per serving)
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {NUTRIENT_META.map(({ key, label, unit, emoji }) => (
              <TextField
                key={key}
                size="small"
                type="number"
                label={`${emoji} ${label} (${unit})`}
                value={nutrition[key] === 0 ? '' : nutrition[key]}
                onChange={(e) => setNutrient(key, e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 'any', 'aria-label': label } }}
              />
            ))}
          </Box>
        </Box>
        {category.trim() && (
          <Typography variant="caption" color="text.secondary">
            {getCategoryMeta(category).emoji} Will appear under “{category.trim()}”
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim() || !category.trim()}
        >
          {meal ? 'Save changes' : 'Add meal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
