import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_COLOR_PALETTE } from '../../../src/constants';
import { useSnackbar } from '../layout/Snackbar';
import { useFood } from './FoodContext';
import type { CategoryInput, CategoryRow } from './foodApi';

/** Food categories: add, rename, recolour, hide, reorder, delete. */
export default function CategoriesPage() {
  const navigate = useNavigate();
  const showToast = useSnackbar();
  const { data, editCategory, moveCategory, addCategory, removeCategory } = useFood();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const categories = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
  const mealCount = (id: string) => data.meals.filter((m) => m.category_id === id && !m.archived_at).length;
  const inPlan = (id: string) => data.quotas.some((q) => q.category_id === id);

  const run = async (action: () => Promise<void>, done?: string) => {
    try {
      await action();
      if (done) showToast(done);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Not saved.', { severity: 'error' });
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 680 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/food')}>
          Back to Food
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setAdding(true)}>
          Add a category
        </Button>
      </Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
          Hidden categories disappear from logging and new plans; their meals and history are kept.
        </Typography>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {categories.map((c, index) => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, opacity: c.enabled ? 1 : 0.6 }}>
              <Box
                aria-hidden
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  bgcolor: `${c.color}33`,
                  boxShadow: `inset 0 0 0 1.5px ${c.color}88`,
                }}
              >
                {c.icon}
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>
                  {c.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mealCount(c.id)} meal{mealCount(c.id) === 1 ? '' : 's'}
                  {inPlan(c.id) ? ' · in a plan' : ''}
                  {c.enabled ? '' : ' · hidden'}
                </Typography>
              </Box>
              <Tooltip title={c.enabled ? 'Shown' : 'Hidden'}>
                <Switch
                  checked={c.enabled}
                  onChange={(e) => void run(() => editCategory(c.id, { enabled: e.target.checked }))}
                  inputProps={{ 'aria-label': `Show ${c.name}` }}
                />
              </Tooltip>
              <IconButton aria-label={`Move ${c.name} up`} disabled={index === 0} onClick={() => void run(() => moveCategory(c.id, -1))}>
                <ArrowUpwardRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`Move ${c.name} down`}
                disabled={index === categories.length - 1}
                onClick={() => void run(() => moveCategory(c.id, 1))}
              >
                <ArrowDownwardRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Paper>

      <CategoryDialog
        open={adding || Boolean(editing)}
        category={editing}
        existing={data.categories}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={async (input) => {
          if (editing) await editCategory(editing.id, input);
          else await addCategory(input);
          showToast(editing ? `Saved ${input.name}` : `Added ${input.name}`);
        }}
      />
      <DeleteCategoryDialog
        category={deleting}
        categories={categories}
        mealCount={deleting ? data.meals.filter((m) => m.category_id === deleting.id).length : 0}
        inPlan={deleting ? inPlan(deleting.id) : false}
        onClose={() => setDeleting(null)}
        onHide={(c) => void run(() => editCategory(c.id, { enabled: false }), `${c.name} hidden`)}
        onDelete={async (c, moveTo) => {
          await removeCategory(c.id, moveTo);
          showToast(`Deleted ${c.name}`);
        }}
      />
    </Stack>
  );
}

/** Validates a category form; returns an error message or clean input. */
export function validateCategory(input: CategoryInput, existing: CategoryRow[], editingId?: string): string | CategoryInput {
  const name = input.name.trim();
  if (!name) return 'Give the category a name.';
  if (existing.some((c) => c.id !== editingId && c.name.trim().toLowerCase() === name.toLowerCase())) {
    return `"${name}" already exists.`;
  }
  return { name, icon: input.icon.trim() || '🍽️', color: input.color };
}

function CategoryDialog({
  open,
  category,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  category: CategoryRow | null;
  existing: CategoryRow[];
  onClose: () => void;
  onSave: (input: CategoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState<CategoryInput>({ name: '', icon: '', color: CATEGORY_COLOR_PALETTE[0] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ name: category?.name ?? '', icon: category?.icon ?? '', color: category?.color ?? CATEGORY_COLOR_PALETTE[0] });
      setError(null);
    }
  }, [open, category]);

  const save = async () => {
    const result = validateCategory(form, existing, category?.id);
    if (typeof result === 'string') return setError(result);
    setBusy(true);
    try {
      await onSave(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="category-title">
      <DialogTitle id="category-title">{category ? 'Edit category' : 'Add a category'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 1.5 }}>
            <TextField label="Emoji" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} inputProps={{ maxLength: 4 }} />
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Box>
          <Box role="radiogroup" aria-label="Colour" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {CATEGORY_COLOR_PALETTE.map((color) => (
              <Box
                key={color}
                component="button"
                role="radio"
                aria-checked={form.color === color}
                aria-label={color}
                onClick={() => setForm({ ...form, color })}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 0,
                  cursor: 'pointer',
                  bgcolor: color,
                  boxShadow: (t) => (form.color === color ? `0 0 0 3px ${t.palette.background.default}, 0 0 0 5px ${t.palette.text.primary}` : 'none'),
                }}
              />
            ))}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          {category ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category,
  categories,
  mealCount,
  inPlan,
  onClose,
  onHide,
  onDelete,
}: {
  category: CategoryRow | null;
  categories: CategoryRow[];
  mealCount: number;
  inPlan: boolean;
  onClose: () => void;
  onHide: (c: CategoryRow) => void;
  onDelete: (c: CategoryRow, moveTo: string | null) => Promise<void>;
}) {
  const targets = categories.filter((c) => c.id !== category?.id);
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setMoveTo(targets[0]?.id ?? '');
    setError(null);
    // Reset only when a different category is chosen.
  }, [category?.id]);

  if (!category) return null;
  const needsMove = mealCount > 0;

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(category, needsMove ? moveTo : null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not deleted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="delete-category-title">
      <DialogTitle id="delete-category-title">Delete {category.name}?</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {inPlan ? (
            <Alert severity="info">
              {category.name} is part of a meal plan, so it can't be deleted. You can hide it instead: its meals and history stay.
            </Alert>
          ) : needsMove ? (
            <>
              <Typography color="text.secondary">
                It has {mealCount} meal{mealCount === 1 ? '' : 's'}. They move to another category, with their history.
              </Typography>
              <TextField select label="Move meals to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {targets.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <Typography color="text.secondary">It has no meals. This can't be undone.</Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {inPlan ? (
          <Button
            variant="contained"
            onClick={() => {
              onHide(category);
              onClose();
            }}
          >
            Hide instead
          </Button>
        ) : (
          <Button variant="outlined" color="error" disabled={busy || (needsMove && !moveTo)} onClick={() => void remove()}>
            {needsMove ? 'Move meals and delete' : 'Delete'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
