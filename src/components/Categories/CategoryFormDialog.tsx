import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { CATEGORY_COLOR_PALETTE } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Category } from '../../models';
import { IconPickerDialog } from './IconPickerDialog';

interface CategoryFormDialogProps {
  open: boolean;
  /** When set, edits this category; otherwise creates a new one. */
  category: Category | null;
  onClose: () => void;
}

/** Add / edit a category: name, icon (from the built-in library), color. */
export function CategoryFormDialog({ open, category, onClose }: CategoryFormDialogProps) {
  const { addCategory, updateCategory } = useAppData();
  const { showSnackbar } = useSnackbar();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🍽️');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setIcon(category?.icon ?? '🍽️');
      setColor(category?.color ?? CATEGORY_COLOR_PALETTE[0]);
      setError(null);
      setSaving(false);
    }
  }, [open, category]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), icon, color };
      if (category) {
        await updateCategory(category.id, input);
        showSnackbar('Category updated');
      } else {
        await addCategory(input);
        showSnackbar('Category added');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="category-form-title">
        <DialogTitle id="category-form-title">
          {category ? 'Edit category' : 'Add a category'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <ButtonBase
              onClick={() => setPickerOpen(true)}
              aria-label={`Category icon: ${icon}. Click to change`}
              sx={{
                fontSize: 28,
                width: 56,
                height: 56,
                borderRadius: 3,
                border: '2px dashed',
                borderColor: 'divider',
                flexShrink: 0,
                bgcolor: `${color}22`,
              }}
            >
              {icon}
            </ButtonBase>
            <TextField
              label="Category name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              error={Boolean(error)}
              helperText={error ?? 'e.g. Pizza, Coffee, Cheat Meal'}
              autoFocus
              fullWidth
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Accent color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {CATEGORY_COLOR_PALETTE.map((c) => (
                <ButtonBase
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    border: '3px solid',
                    borderColor: color === c ? 'text.primary' : 'transparent',
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </DialogActions>
      </Dialog>

      <IconPickerDialog
        open={pickerOpen}
        value={icon}
        onSelect={setIcon}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
