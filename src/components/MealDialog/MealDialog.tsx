import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { getCategoryMeta } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { MealCategory } from '../../models';
import { formatWithWeekday } from '../../utils/date';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { MealCard } from '../MealCard/MealCard';
import { NutritionCard } from '../Nutrition/NutritionCard';
import { SuccessCheck } from './SuccessCheck';

type Step = 'category' | 'meal' | 'success';

interface MealDialogProps {
  open: boolean;
  /** Date being logged (YYYY-MM-DD); null when closed. */
  dateKey: string | null;
  onClose: () => void;
}

const SUCCESS_CLOSE_DELAY_MS = 1100;

const stepVariants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

/**
 * Two-step logging flow: pick a category, pick a meal, save. Categories
 * come from the live catalog, so new ones appear automatically. Selecting
 * a meal reveals its nutrition card before saving.
 */
export function MealDialog({ open, dateKey, onClose }: MealDialogProps) {
  const { meals, mealById, categories, logs, logMeal, deleteLog } = useAppData();
  const { showSnackbar } = useSnackbar();

  const existingLog = dateKey ? (logs[dateKey] ?? null) : null;
  const existingMeal = existingLog ? mealById.get(existingLog.mealId) : undefined;

  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<MealCategory | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-initialize whenever the dialog opens for a (possibly new) date.
  useEffect(() => {
    if (open) {
      setStep('category');
      setCategory(existingMeal?.category ?? null);
      setSelectedMealId(existingLog?.mealId ?? null);
      setConfirmDelete(false);
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey]);

  const categoryMeals = useMemo(
    () => meals.filter((m) => m.category === category),
    [meals, category],
  );
  const selectedMeal = selectedMealId ? mealById.get(selectedMealId) : undefined;

  const handlePickCategory = (picked: MealCategory) => {
    setCategory(picked);
    if (existingMeal?.category !== picked) setSelectedMealId(null);
    else setSelectedMealId(existingLog?.mealId ?? null);
    setStep('meal');
  };

  const handleSave = async () => {
    if (!dateKey || !selectedMealId || saving) return;
    setSaving(true);
    try {
      await logMeal(dateKey, selectedMealId);
      setStep('success');
      window.setTimeout(onClose, SUCCESS_CLOSE_DELAY_MS);
    } catch {
      setSaving(false);
      showSnackbar("Couldn't save your meal. Please try again.", 'error');
    }
  };

  const handleDelete = async () => {
    if (!dateKey) return;
    setConfirmDelete(false);
    try {
      await deleteLog(dateKey);
      showSnackbar('Meal log removed');
      onClose();
    } catch {
      showSnackbar("Couldn't delete the log. Please try again.", 'error');
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={step === 'success' ? undefined : onClose}
        fullWidth
        maxWidth="xs"
        aria-labelledby="meal-dialog-title"
      >
        {/* Title bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pt: 2, gap: 1 }}>
          {step === 'meal' && (
            <IconButton aria-label="Back to categories" size="small" onClick={() => setStep('category')}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography id="meal-dialog-title" variant="h6">
              {existingLog ? 'Edit meal' : 'Log a meal'}
            </Typography>
            {dateKey && (
              <Typography variant="caption" color="text.secondary">
                {formatWithWeekday(dateKey)}
              </Typography>
            )}
          </Box>
          {step !== 'success' && (
            <IconButton aria-label="Close dialog" size="small" onClick={onClose}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Currently-logged banner (edit mode) */}
        {existingMeal && step !== 'success' && (
          <Box sx={{ px: 2.5, pt: 1 }}>
            <Chip
              label={`Logged: ${existingMeal.icon ?? getCategoryMeta(existingMeal.category).emoji} ${existingMeal.name}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        )}

        <DialogContent sx={{ overflow: 'hidden', px: 2.5, pb: 2.5 }}>
          <AnimatePresence mode="wait" initial={false}>
            {step === 'category' && (
              <motion.div
                key="category"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  What did you have?
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                    gap: 1.25,
                  }}
                >
                  {categories.map((cat) => {
                    const meta = getCategoryMeta(cat);
                    return (
                      <motion.div key={cat} whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.95 }}>
                        <ButtonBase
                          onClick={() => handlePickCategory(cat)}
                          aria-label={`Choose ${cat} — ${meta.description}`}
                          sx={{
                            width: '100%',
                            flexDirection: 'column',
                            gap: 0.75,
                            py: 2.5,
                            borderRadius: 5,
                            background: meta.gradient,
                            color: '#1C1B1F',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                          }}
                        >
                          <span aria-hidden style={{ fontSize: 38, lineHeight: 1 }}>
                            {meta.emoji}
                          </span>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {cat}
                          </Typography>
                        </ButtonBase>
                      </motion.div>
                    );
                  })}
                </Box>
              </motion.div>
            )}

            {step === 'meal' && category && (
              <motion.div
                key="meal"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  {getCategoryMeta(category).emoji} Pick your {category.toLowerCase()}
                </Typography>
                {categoryMeals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No {category.toLowerCase()} meals yet — add some from Manage Meals.
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      maxHeight: 208,
                      overflowY: 'auto',
                      pr: 0.5,
                    }}
                  >
                    {categoryMeals.map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        selected={selectedMealId === meal.id}
                        onClick={() => setSelectedMealId(meal.id)}
                      />
                    ))}
                  </Box>
                )}

                {/* Nutrition preview for the selected meal */}
                <AnimatePresence mode="wait">
                  {selectedMeal && (
                    <Box sx={{ mt: 1.5 }}>
                      <NutritionCard key={selectedMeal.id} meal={selectedMeal} />
                    </Box>
                  )}
                </AnimatePresence>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  {existingLog && (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={!selectedMealId || saving}
                    onClick={() => void handleSave()}
                  >
                    {existingLog ? 'Update' : 'Save'}
                  </Button>
                </Box>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SuccessCheck message={existingLog ? 'Updated!' : 'Meal logged!'} />
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this meal log?"
        message={
          dateKey
            ? `The meal logged on ${formatWithWeekday(dateKey)} will be removed. The meal itself stays in your catalog.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
