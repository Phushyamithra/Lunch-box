import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CategoryFormDialog } from '../components/Categories/CategoryFormDialog';
import { DeleteCategoryDialog } from '../components/Categories/DeleteCategoryDialog';
import { useAppData } from '../context/AppDataContext';
import { useNavigation } from '../context/NavigationContext';
import { useSnackbar } from '../context/SnackbarContext';
import type { Category, CategoryDeleteAction } from '../models';

/**
 * Manage Categories: view, search, add, edit, reorder, disable, delete.
 * Deletion always asks what to do with the category's meals.
 */
export default function ManageCategories() {
  const { categoryList, meals, toggleCategory, moveCategory, deleteCategory } = useAppData();
  const { navigate } = useNavigation();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [formCategory, setFormCategory] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const mealCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meal of meals) counts.set(meal.category, (counts.get(meal.category) ?? 0) + 1);
    return counts;
  }, [meals]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categoryList.filter((c) => !query || c.name.toLowerCase().includes(query));
  }, [categoryList, search]);

  const handleDelete = async (action: CategoryDeleteAction) => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    setDeleteTarget(null);
    try {
      await deleteCategory(deleteTarget.id, action);
      showSnackbar(
        action.type === 'move'
          ? `"${name}" deleted — meals moved to ${action.targetCategoryName}`
          : `"${name}" and its meals deleted`,
      );
    } catch {
      showSnackbar("Couldn't delete the category. Please try again.", 'error');
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
          Manage Categories
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => {
            setFormCategory(null);
            setFormOpen(true);
          }}
        >
          Add
        </Button>
      </Box>

      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search categories"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Typography aria-hidden sx={{ fontSize: 36, mb: 0.5 }}>
              🗂️
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {categoryList.length === 0 ? 'No categories yet — add one!' : 'No categories match your search.'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            <AnimatePresence initial={false}>
              {filtered.map((category, index) => {
                const count = mealCounts.get(category.name) ?? 0;
                return (
                  <motion.div
                    key={category.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ListItem
                      sx={{
                        borderRadius: 3.5,
                        mb: 0.25,
                        opacity: category.enabled ? 1 : 0.55,
                        '&:hover': { bgcolor: 'action.hover' },
                        pr: 1,
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(category.color, 0.2), fontSize: 18 }}>
                          <span aria-hidden>{category.icon}</span>
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={category.name}
                        secondary={`${count} meal${count === 1 ? '' : 's'}${category.enabled ? '' : ' · disabled'}`}
                        primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Move up">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Move ${category.name} up`}
                              disabled={index === 0 || search.trim() !== ''}
                              onClick={() => void moveCategory(category.id, 'up')}
                            >
                              <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Move down">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Move ${category.name} down`}
                              disabled={index === filtered.length - 1 || search.trim() !== ''}
                              onClick={() => void moveCategory(category.id, 'down')}
                            >
                              <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={category.enabled ? 'Disable (hide from logging)' : 'Enable'}>
                          <Switch
                            size="small"
                            checked={category.enabled}
                            onChange={(e) => void toggleCategory(category.id, e.target.checked)}
                            inputProps={{ 'aria-label': `${category.name} enabled` }}
                          />
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            aria-label={`Edit ${category.name}`}
                            onClick={() => {
                              setFormCategory(category);
                              setFormOpen(true);
                            }}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            aria-label={`Delete ${category.name}`}
                            onClick={() => setDeleteTarget(category)}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItem>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </List>
        )}
      </Box>

      <CategoryFormDialog open={formOpen} category={formCategory} onClose={() => setFormOpen(false)} />

      <DeleteCategoryDialog
        open={deleteTarget !== null}
        category={deleteTarget}
        mealCount={deleteTarget ? (mealCounts.get(deleteTarget.name) ?? 0) : 0}
        otherCategories={categoryList.filter((c) => c.id !== deleteTarget?.id)}
        onConfirm={(action) => void handleDelete(action)}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
