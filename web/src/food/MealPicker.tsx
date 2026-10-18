import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { CategoryRow, MealRow } from './foodApi';

interface MealPickerProps {
  open: boolean;
  dateLabel: string;
  meals: MealRow[];
  categories: CategoryRow[];
  onClose: () => void;
  onPick: (meal: MealRow) => void;
}

/** Fast search-and-tap meal chooser; full screen on phones. */
export function MealPicker({ open, dateLabel, meals, categories, onClose, onPick }: MealPickerProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Only categories that have something to log (archived meals don't count).
  const enabled = useMemo(() => {
    const live = new Set(meals.filter((m) => !m.archived_at).map((m) => m.category_id));
    return categories.filter((c) => c.enabled && live.has(c.id));
  }, [categories, meals]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meals.filter((m) => {
      const category = categoryById.get(m.category_id);
      if (m.archived_at || !category?.enabled) return false;
      if (categoryId && m.category_id !== categoryId) return false;
      return !q || m.name.toLowerCase().includes(q) || category.name.toLowerCase().includes(q);
    });
  }, [meals, categoryById, categoryId, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="meal-picker-title">
      <DialogTitle id="meal-picker-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          Log a meal
          <Typography variant="body2" color="text.secondary">
            {dateLabel}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={close} size="large">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5} sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, pt: 1, pb: 1 }}>
          <TextField
            placeholder="Search meals"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={!phone}
            fullWidth
            inputProps={{ 'aria-label': 'Search meals' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            <Chip label="All" onClick={() => setCategoryId(null)} color={categoryId ? 'default' : 'secondary'} />
            {enabled.map((c) => (
              <Chip
                key={c.id}
                label={`${c.icon} ${c.name}`}
                onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
                color={c.id === categoryId ? 'secondary' : 'default'}
              />
            ))}
          </Stack>
        </Stack>
        {visible.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No meals match.
          </Typography>
        ) : (
          <List disablePadding>
            {visible.map((meal) => {
              const category = categoryById.get(meal.category_id);
              return (
                <ListItemButton
                  key={meal.id}
                  onClick={() => {
                    setQuery('');
                    onPick(meal);
                  }}
                  sx={{ minHeight: 56, gap: 1.5 }}
                >
                  <Box aria-hidden sx={{ fontSize: 24, width: 32, textAlign: 'center' }}>
                    {meal.icon ?? category?.icon}
                  </Box>
                  <ListItemText
                    primary={meal.name}
                    secondary={`${category?.name ?? ''} · ${Math.round(meal.calories)} kcal · ${Math.round(meal.protein)} g protein`}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
