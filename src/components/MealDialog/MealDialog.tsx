import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { getCategoryMeta } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useSnackbar } from '../../context/SnackbarContext';
import type { MealCategory, MealLog } from '../../models';
import { formatWithWeekday } from '../../utils/date';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { MealCard } from '../MealCard/MealCard';
import { NutritionCard } from '../Nutrition/NutritionCard';
import { SuccessCheck } from './SuccessCheck';

/**
 * view     — day overview: logged meals (removable) + "Add another meal"
 * category — pick a category (vertical list)
 * meal     — pick a meal (vertical list) + nutrition preview + Add
 * success  — brief checkmark, then back to the day overview
 */
type Step = 'view' | 'category' | 'meal' | 'success';

interface MealDialogProps {
  open: boolean;
  /** Date being logged (YYYY-MM-DD); null when closed. */
  dateKey: string | null;
  onClose: () => void;
}

const SUCCESS_TO_VIEW_DELAY_MS = 900;

const stepVariants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

/**
 * Day logging dialog. A day can hold MULTIPLE meals. One scrollable body
 * hosts every step, so nothing is ever clipped; after adding a meal you
 * return to the day overview to add more or finish.
 */
export function MealDialog({ open, dateKey, onClose }: MealDialogProps) {
  const { meals, mealById, categories, logs, logMeal, deleteLog } = useAppData();
  const { showSnackbar } = useSnackbar();

  const dayLogs: MealLog[] = useMemo(
    () => (dateKey ? (logs[dateKey] ?? []) : []),
    [logs, dateKey],
  );
  const loggedMealIds = useMemo(() => new Set(dayLogs.map((l) => l.mealId)), [dayLogs]);
  const dayCalories = useMemo(
    () =>
      Math.round(
        dayLogs.reduce((sum, log) => sum + (mealById.get(log.mealId)?.nutrition?.calories ?? 0), 0),
      ),
    [dayLogs, mealById],
  );

  const [step, setStep] = useState<Step>('view');
  const [category, setCategory] = useState<MealCategory | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MealLog | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-initialize whenever the dialog opens for a (possibly new) date.
  useEffect(() => {
    if (open) {
      setStep(dateKey && (logs[dateKey]?.length ?? 0) > 0 ? 'view' : 'category');
      setCategory(null);
      setSelectedMealId(null);
      setDeleteTarget(null);
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey]);

  // If the last log is removed while viewing, fall through to the add flow.
  const effectiveStep: Step = step === 'view' && dayLogs.length === 0 ? 'category' : step;

  const categoryMeals = useMemo(
    () => meals.filter((m) => m.category === category),
    [meals, category],
  );
  const selectedMeal = selectedMealId ? mealById.get(selectedMealId) : undefined;

  const showBack =
    effectiveStep === 'meal' || (effectiveStep === 'category' && dayLogs.length > 0);

  const handleBack = () => {
    if (effectiveStep === 'meal') setStep('category');
    else if (dayLogs.length > 0) setStep('view');
  };

  const handlePickCategory = (picked: MealCategory) => {
    setCategory(picked);
    setSelectedMealId(null);
    setStep('meal');
  };

  const handleSave = async () => {
    if (!dateKey || !selectedMealId || saving) return;
    setSaving(true);
    try {
      await logMeal(dateKey, selectedMealId);
      setStep('success');
      window.setTimeout(() => {
        setSaving(false);
        setSelectedMealId(null);
        setCategory(null);
        setStep('view');
      }, SUCCESS_TO_VIEW_DELAY_MS);
    } catch (error) {
      setSaving(false);
      showSnackbar(
        error instanceof Error ? error.message : "Couldn't save your meal. Please try again.",
        'error',
      );
    }
  };

  const handleDelete = async () => {
    if (!dateKey || !deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteLog(dateKey, target.id);
      showSnackbar('Meal log removed');
    } catch {
      showSnackbar("Couldn't delete the log. Please try again.", 'error');
    }
  };

  const titles: Record<Step, string> = {
    view: 'Meals for this day',
    category: dayLogs.length > 0 ? 'Add another meal' : 'Log a meal',
    meal: category ? `Pick a ${category.toLowerCase()}` : 'Pick a meal',
    success: 'Meal logged',
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={effectiveStep === 'success' ? undefined : onClose}
        fullWidth
        maxWidth="xs"
        aria-labelledby="meal-dialog-title"
        PaperProps={{
          sx: { maxHeight: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* Fixed title bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pt: 2, pb: 1, gap: 1, flexShrink: 0 }}>
          {showBack && (
            <IconButton aria-label="Back" size="small" onClick={handleBack}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography id="meal-dialog-title" variant="h6" noWrap>
              {titles[effectiveStep]}
            </Typography>
            {dateKey && (
              <Typography variant="caption" color="text.secondary">
                {formatWithWeekday(dateKey)}
                {dayLogs.length > 0 &&
                  ` · ${dayLogs.length} meal${dayLogs.length === 1 ? '' : 's'} · ${dayCalories} kcal`}
              </Typography>
            )}
          </Box>
          {effectiveStep !== 'success' && (
            <IconButton aria-label="Close dialog" size="small" onClick={onClose}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Single scrollable body — nothing ever gets clipped */}
        <DialogContent sx={{ overflowY: 'auto', px: 2.5, pb: 2.5, pt: 0.5 }}>
          <AnimatePresence mode="wait" initial={false}>
            {effectiveStep === 'view' && (
              <motion.div
                key="view"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <Paper variant="outlined" sx={{ overflow: 'hidden', mb: 2 }}>
                  {dayLogs.map((log, index) => {
                    const meal = mealById.get(log.mealId);
                    const icon = meal ? (meal.icon ?? getCategoryMeta(meal.category).emoji) : '🍽️';
                    return (
                      <Box
                        key={log.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 1.5,
                          py: 1,
                          borderBottom: index < dayLogs.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 20 }}>
                          {icon}
                        </span>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {meal?.name ?? 'Meal removed from catalog'}
                          </Typography>
                          {meal && (
                            <Typography variant="caption" color="text.secondary">
                              {meal.category} · {meal.nutrition?.calories ?? 0} kcal
                            </Typography>
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          aria-label={`Remove ${meal?.name ?? 'this meal'} from this day`}
                          onClick={() => setDeleteTarget(log)}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Paper>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => setStep('category')}
                >
                  Add another meal
                </Button>
                <Button fullWidth sx={{ mt: 1 }} color="inherit" onClick={onClose}>
                  Done
                </Button>
              </motion.div>
            )}

            {effectiveStep === 'category' && (
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
                {/* Vertical category list — no horizontal scrolling */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {categories.map((cat) => {
                    const meta = getCategoryMeta(cat);
                    return (
                      <motion.div key={cat} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <ButtonBase
                          onClick={() => handlePickCategory(cat)}
                          aria-label={`Choose ${cat} — ${meta.description}`}
                          sx={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            gap: 1.5,
                            px: 2,
                            py: 1.5,
                            borderRadius: 4,
                            background: meta.gradient,
                            color: '#1C1B1F',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                            textAlign: 'left',
                          }}
                        >
                          <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>
                            {meta.emoji}
                          </span>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                              {cat}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              {meta.description}
                            </Typography>
                          </Box>
                        </ButtonBase>
                      </motion.div>
                    );
                  })}
                </Box>
              </motion.div>
            )}

            {effectiveStep === 'meal' && category && (
              <motion.div
                key="meal"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                {categoryMeals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No {category.toLowerCase()} meals yet — add some from Manage Meals.
                  </Typography>
                ) : (
                  /* Vertical single-column meal list — the dialog body scrolls */
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {categoryMeals.map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        selected={selectedMealId === meal.id}
                        logged={loggedMealIds.has(meal.id)}
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

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ mt: 2 }}
                  disabled={!selectedMealId || saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Saving…' : 'Add meal'}
                </Button>
              </motion.div>
            )}

            {effectiveStep === 'success' && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SuccessCheck message="Meal logged!" />
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this meal log?"
        message={
          dateKey
            ? `${mealById.get(deleteTarget?.mealId ?? '')?.name ?? 'This meal'} will be removed from ${formatWithWeekday(dateKey)}. The meal itself stays in your catalog.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
