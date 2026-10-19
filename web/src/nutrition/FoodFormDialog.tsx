import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { DIET, energyCheck, validateFood, type Basis, type DietType, type Food, type FoodInput } from './foodLog';
import { useNutrition } from './NutritionContext';

type Text = Record<'name' | 'brand' | 'serving_g' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'sodium_mg', string>;
const NUMS: { key: keyof Text; label: string; required?: boolean }[] = [
  { key: 'kcal', label: 'Calories (kcal)', required: true },
  { key: 'protein', label: 'Protein (g)', required: true },
  { key: 'carbs', label: 'Carbs (g)', required: true },
  { key: 'fat', label: 'Fat (g)', required: true },
  { key: 'fibre', label: 'Fibre (g)' },
  { key: 'sugar', label: 'Sugar (g)' },
  { key: 'sodium_mg', label: 'Sodium (mg)' },
];
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

/** Create or edit one of your foods, straight from a label or a recipe card. */
export function FoodFormDialog({
  open,
  food,
  initialName,
  onClose,
  onArchive,
}: {
  open: boolean;
  food: Food | null;
  initialName?: string;
  onClose: (saved?: Food) => void;
  onArchive?: (food: Food) => void;
}) {
  const { saveFood } = useNutrition();
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [text, setText] = useState<Text>({} as Text);
  const [diet, setDiet] = useState<DietType | null>(null);
  const [basis, setBasis] = useState<Basis>('100g');
  const [portions, setPortions] = useState<{ label: string; grams: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText({
      name: food?.name ?? initialName ?? '',
      brand: food?.brand ?? '',
      serving_g: str(food?.serving_g),
      kcal: str(food?.kcal),
      protein: str(food?.protein),
      carbs: str(food?.carbs),
      fat: str(food?.fat),
      fibre: str(food?.fibre),
      sugar: str(food?.sugar),
      sodium_mg: str(food?.sodium_mg),
    });
    setDiet(food?.diet ?? null);
    setBasis(food?.basis ?? '100g');
    setPortions(food?.portions.map((p) => ({ label: p.label, grams: String(p.grams) })) ?? []);
    setError(null);
  }, [open, food, initialName]);

  const input = (): FoodInput => ({
    name: text.name ?? '',
    brand: text.brand?.trim() || null,
    diet,
    basis,
    serving_g: num(text.serving_g ?? ''),
    portions: portions.filter((p) => p.label.trim() || p.grams.trim()).map((p) => ({ label: p.label.trim(), grams: Number(p.grams) })),
    kcal: num(text.kcal ?? '') ?? NaN,
    protein: num(text.protein ?? '') ?? NaN,
    carbs: num(text.carbs ?? '') ?? NaN,
    fat: num(text.fat ?? '') ?? NaN,
    fibre: num(text.fibre ?? '') ?? 0,
    sugar: num(text.sugar ?? ''),
    sodium_mg: num(text.sodium_mg ?? ''),
  });
  const draft = input();
  const energy = [draft.kcal, draft.protein, draft.carbs, draft.fat].every((v) => v >= 0) ? energyCheck(draft) : null;
  const per = basis === 'serving' ? 'per serving' : basis === '100ml' ? 'per 100 ml' : 'per 100 g';

  const save = async () => {
    const problem = validateFood(draft);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      onClose(await saveFood(draft, food?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose()} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="food-form-title">
      <DialogTitle id="food-form-title">{food ? 'Edit food' : 'New food'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={text.name ?? ''} onChange={(e) => setText({ ...text, name: e.target.value })} autoFocus={!food} inputProps={{ maxLength: 120 }} />
          <TextField label="Brand (optional)" value={text.brand ?? ''} onChange={(e) => setText({ ...text, brand: e.target.value })} inputProps={{ maxLength: 80 }} />
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }} role="group" aria-label="Diet type">
            {(Object.keys(DIET) as DietType[]).map((d) => (
              <Chip key={d} label={`${DIET[d].emoji} ${DIET[d].label}`} color={diet === d ? 'secondary' : 'default'} variant={diet === d ? 'filled' : 'outlined'} onClick={() => setDiet(diet === d ? null : d)} />
            ))}
          </Box>
          <ToggleButtonGroup exclusive fullWidth size="small" value={basis} onChange={(_, v) => v && setBasis(v)} aria-label="Nutrition is given">
            <ToggleButton value="100g">Per 100 g</ToggleButton>
            <ToggleButton value="100ml">Per 100 ml</ToggleButton>
            <ToggleButton value="serving">Per serving</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            label={`Serving size (${basis === '100ml' ? 'ml' : 'g'})${basis === 'serving' ? '' : ' — optional'}`}
            inputMode="decimal"
            value={text.serving_g ?? ''}
            onChange={(e) => setText({ ...text, serving_g: e.target.value })}
            helperText={basis === 'serving' ? 'If the label gives the weight, add it so you can also log by grams.' : 'Lets you log “1 serving”.'}
          />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Nutrition {per}
          </Typography>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {NUMS.map((n) => (
              <TextField
                key={n.key}
                size="small"
                label={`${n.label}${n.required ? '' : ' — optional'}`}
                inputMode="decimal"
                value={text[n.key] ?? ''}
                onChange={(e) => setText({ ...text, [n.key]: e.target.value })}
                sx={n.key === 'kcal' ? { gridColumn: '1 / -1' } : undefined}
              />
            ))}
          </Box>
          {energy && !energy.ok && (
            <Alert severity="warning">
              Protein, carbs and fat work out to about {energy.computed} kcal, but calories say {draft.kcal} ({energy.gapPct > 0 ? '+' : ''}
              {energy.gapPct}%). Check for a typo; labels can differ a little because of fibre and rounding.
            </Alert>
          )}
          {basis !== 'serving' && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                Household portions
              </Typography>
              <Stack spacing={1}>
                {portions.map((p, i) => (
                  <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 1, alignItems: 'center' }}>
                    <TextField size="small" label="Portion" placeholder="1 katori" value={p.label} onChange={(e) => setPortions(portions.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))} />
                    <TextField size="small" label={basis === '100ml' ? 'ml' : 'grams'} inputMode="decimal" value={p.grams} onChange={(e) => setPortions(portions.map((x, n) => (n === i ? { ...x, grams: e.target.value } : x)))} />
                    <IconButton aria-label={`Remove portion ${i + 1}`} onClick={() => setPortions(portions.filter((_, n) => n !== i))}>
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button startIcon={<AddRoundedIcon />} onClick={() => setPortions([...portions, { label: '', grams: '' }])} sx={{ alignSelf: 'flex-start' }}>
                  Add portion (katori, roti, glass…)
                </Button>
              </Stack>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {food && (
            <Typography variant="caption" color="text.secondary">
              Changes apply to future logs only. Days you already logged keep the values they had.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {food && onArchive && (
          <Button color="error" onClick={() => onArchive(food)} sx={{ mr: 'auto' }}>
            Archive
          </Button>
        )}
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          Save food
        </Button>
      </DialogActions>
    </Dialog>
  );
}
