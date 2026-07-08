import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ExportButton } from '../components/ImportExport/ExportButton';
import { ImportButton } from '../components/ImportExport/ImportButton';
import { MealFormDialog } from '../components/ManageMeals/MealFormDialog';
import { getCategoryMeta } from '../constants';
import { useAppData } from '../context/AppDataContext';
import { useSnackbar } from '../context/SnackbarContext';
import { useNavigation } from '../context/NavigationContext';
import type { Meal, MealCategory } from '../models';

type CategoryFilter = MealCategory | 'All';

/** Catalog management: search, filter, add, edit, delete, import, export. */
export default function ManageMeals() {
  const { meals, categories, deleteMeal } = useAppData();
  const { navigate } = useNavigation();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [formMeal, setFormMeal] = useState<Meal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Meal | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return meals
      .filter((m) => filter === 'All' || m.category === filter)
      .filter((m) => !query || m.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meals, search, filter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    setDeleteTarget(null);
    try {
      await deleteMeal(deleteTarget.id);
      showSnackbar(`"${name}" deleted`);
    } catch {
      showSnackbar("Couldn't delete the meal. Please try again.", 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <IconButton aria-label="Back to dashboard" size="small" onClick={() => navigate('dashboard')}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          Manage Meals
        </Typography>
        <Tooltip title="Manage categories">
          <IconButton aria-label="Manage categories" size="small" onClick={() => navigate('categories')}>
            <CategoryRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setFormMeal(null); setFormOpen(true); }}>
          Add
        </Button>
      </Box>

      {/* Search + filters */}
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search meals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          aria-label="Search meals"
        />
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.25, flexWrap: 'nowrap' }}>
          {(['All', ...categories] as CategoryFilter[]).map((cat) => (
            <Chip
              key={cat}
              label={cat === 'All' ? 'All' : `${getCategoryMeta(cat).emoji} ${getCategoryMeta(cat).plural}`}
              sx={{ flexShrink: 0 }}
              size="small"
              color={filter === cat ? 'primary' : 'default'}
              variant={filter === cat ? 'filled' : 'outlined'}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ImportButton />
          <ExportButton />
        </Box>
      </Box>

      {/* Meal list */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, pt: 1, pb: 2 }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Typography aria-hidden sx={{ fontSize: 36, mb: 0.5 }}>
              🔍
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {meals.length === 0 ? 'Your catalog is empty. Add or import meals!' : 'No meals match your search.'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            <AnimatePresence initial={false}>
              {filtered.map((meal) => {
                const meta = getCategoryMeta(meal.category);
                return (
                  <motion.div
                    key={meal.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ListItem
                      sx={{ borderRadius: 3.5, mb: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
                      secondaryAction={
                        <Box>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              aria-label={`Edit ${meal.name}`}
                              onClick={() => { setFormMeal(meal); setFormOpen(true); }}
                            >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              aria-label={`Delete ${meal.name}`}
                              onClick={() => setDeleteTarget(meal)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(meta.color, 0.2), fontSize: 18 }}>
                          <span aria-hidden>{meal.icon ?? meta.emoji}</span>
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={meal.name}
                        secondary={`${meal.category} · ${meal.nutrition?.calories ?? 0} kcal · P ${meal.nutrition?.protein ?? 0}g`}
                        primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                        sx={{ pr: 7 }}
                      />
                    </ListItem>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </List>
        )}
      </Box>

      <MealFormDialog open={formOpen} meal={formMeal} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        message="This removes the meal from your catalog. Days already logged with it will show as a removed meal."
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
