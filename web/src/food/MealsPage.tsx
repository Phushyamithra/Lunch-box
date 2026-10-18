import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../layout/Snackbar';
import { useFood } from './FoodContext';
import type { MealRow } from './foodApi';
import { MealFormDialog } from './MealFormDialog';

/** The meal catalog: add, edit, archive (history is always kept). */
export default function MealsPage() {
  const navigate = useNavigate();
  const showToast = useSnackbar();
  const { data, addMeal, editMeal, archiveMeal } = useFood();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<MealRow | null>(null);
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.categories
      .map((category) => ({
        category,
        meals: data.meals.filter(
          (m) =>
            m.category_id === category.id &&
            (showArchived || !m.archived_at) &&
            (!q || m.name.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.meals.length > 0);
  }, [data.categories, data.meals, query, showArchived]);

  const toggleArchive = async (meal: MealRow) => {
    const archive = !meal.archived_at;
    try {
      await archiveMeal(meal.id, archive);
      showToast(archive ? `Archived ${meal.name}. Its history is kept.` : `${meal.name} is back in the list`, {
        severity: 'info',
        action: { label: 'Undo', run: () => void archiveMeal(meal.id, !archive) },
      });
    } catch (e) {
      showToast(`Not saved: ${e instanceof Error ? e.message : 'unknown error'}`, { severity: 'error' });
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/food')}>
          Back to Food
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setAdding(true)}>
          Add a meal
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search meals"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: '1 1 220px' }}
          inputProps={{ 'aria-label': 'Search meals' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControlLabel control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />} label="Show archived" />
      </Box>

      {groups.length === 0 && <Typography color="text.secondary">No meals match.</Typography>}
      {groups.map(({ category, meals }) => (
        <Paper key={category.id} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>
            {category.icon} {category.name}
            <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
              {meals.length}
            </Typography>
          </Typography>
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {meals.map((meal) => (
              <Box key={meal.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, opacity: meal.archived_at ? 0.6 : 1 }}>
                <Box aria-hidden sx={{ fontSize: 22, width: 32, textAlign: 'center' }}>
                  {meal.icon ?? category.icon}
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {meal.name}
                    {meal.archived_at && ' · archived'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {Math.round(meal.calories)} kcal · {Math.round(meal.protein)} g protein · {Math.round(meal.carbs)} g carbs ·{' '}
                    {Math.round(meal.fat)} g fat
                  </Typography>
                </Box>
                <Tooltip title="Edit">
                  <IconButton aria-label={`Edit ${meal.name}`} onClick={() => setEditing(meal)}>
                    <EditRoundedIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={meal.archived_at ? 'Restore' : 'Archive'}>
                  <IconButton
                    aria-label={`${meal.archived_at ? 'Restore' : 'Archive'} ${meal.name}`}
                    onClick={() => void toggleArchive(meal)}
                  >
                    {meal.archived_at ? <UnarchiveRoundedIcon /> : <ArchiveRoundedIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        </Paper>
      ))}

      <MealFormDialog
        open={adding || Boolean(editing)}
        meal={editing}
        categories={data.categories}
        existing={data.meals}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={async (input) => {
          if (editing) {
            await editMeal(editing.id, input);
            showToast(`Saved ${input.name}`);
          } else {
            await addMeal(input);
            showToast(`Added ${input.name}`);
          }
        }}
      />
    </Stack>
  );
}
