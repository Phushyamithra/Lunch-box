import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { Category, CategoryDeleteAction } from '../../models';

interface DeleteCategoryDialogProps {
  open: boolean;
  category: Category | null;
  mealCount: number;
  /** Other categories the meals could move into. */
  otherCategories: Category[];
  onConfirm: (action: CategoryDeleteAction) => void;
  onClose: () => void;
}

/**
 * Deleting a category NEVER silently deletes data: the user explicitly
 * chooses to move its meals to another category or delete them.
 */
export function DeleteCategoryDialog({
  open,
  category,
  mealCount,
  otherCategories,
  onConfirm,
  onClose,
}: DeleteCategoryDialogProps) {
  const [mode, setMode] = useState<'move' | 'deleteMeals'>('move');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (open) {
      setMode(otherCategories.length > 0 ? 'move' : 'deleteMeals');
      setTarget(otherCategories[0]?.name ?? '');
    }
  }, [open, otherCategories]);

  if (!category) return null;

  const handleConfirm = () => {
    onConfirm(mode === 'move' ? { type: 'move', targetCategoryName: target } : { type: 'deleteMeals' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="delete-category-title">
      <DialogTitle id="delete-category-title">
        Delete "{category.icon} {category.name}"?
      </DialogTitle>
      <DialogContent>
        {mealCount === 0 ? (
          <DialogContentText>
            This category has no meals. It will be removed, along with its goal setting.
          </DialogContentText>
        ) : (
          <>
            <DialogContentText sx={{ mb: 1.5 }}>
              This category contains <strong>{mealCount}</strong> meal{mealCount === 1 ? '' : 's'}.
              What should happen to {mealCount === 1 ? 'it' : 'them'}?
            </DialogContentText>
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as 'move' | 'deleteMeals')}>
              <FormControlLabel
                value="move"
                control={<Radio size="small" />}
                disabled={otherCategories.length === 0}
                label="Move meals to another category"
              />
              {mode === 'move' && (
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Move to"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  sx={{ my: 1, ml: 3.5, width: 'calc(100% - 28px)' }}
                >
                  {otherCategories.map((c) => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.icon} {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <FormControlLabel
                value="deleteMeals"
                control={<Radio size="small" />}
                label={`Delete ${mealCount === 1 ? 'the meal' : `all ${mealCount} meals`} in this category`}
              />
            </RadioGroup>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={mealCount > 0 && mode === 'move' && !target}
        >
          Delete category
        </Button>
      </DialogActions>
    </Dialog>
  );
}
