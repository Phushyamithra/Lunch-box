import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { CATEGORY_META } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { MEAL_CATEGORIES, type Meal, type MealCategory } from '../../models';

interface MealFormDialogProps {
  open: boolean;
  /** When set, the dialog edits this meal; otherwise it creates a new one. */
  meal: Meal | null;
  onClose: () => void;
}

/** Add / edit form for a catalog meal. Validation lives in MealService. */
export function MealFormDialog({ open, meal, onClose }: MealFormDialogProps) {
  const { addMeal, updateMeal } = useAppData();
  const { showSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MealCategory>('Sandwich');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(meal?.name ?? '');
      setCategory(meal?.category ?? 'Sandwich');
      setError(null);
      setSaving(false);
    }
  }, [open, meal]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (meal) {
        await updateMeal(meal.id, name, category);
        showSnackbar('Meal updated');
      } else {
        await addMeal(name, category);
        showSnackbar('Meal added');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
          }}
        />
        <ToggleButtonGroup
          value={category}
          exclusive
          fullWidth
          onChange={(_, next: MealCategory | null) => {
            if (next) setCategory(next);
          }}
          aria-label="Meal category"
        >
          {MEAL_CATEGORIES.map((cat) => (
            <ToggleButton key={cat} value={cat} aria-label={cat}>
              {CATEGORY_META[cat].emoji}&nbsp;{cat}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {meal ? 'Save changes' : 'Add meal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
