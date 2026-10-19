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
import { useEffect, useState, type ReactNode } from 'react';
import { isValidBarcode, normaliseBarcode } from './barcode';
import { DIET, energyCheck, validateFood, type Basis, type DietType, type Food, type FoodInput } from './foodLog';
import { useNutrition } from './NutritionContext';

type Text = Record<'name' | 'brand' | 'barcode' | 'serving_g' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'sodium_mg', string>;
const NUMS: { key: keyof Text; label: string; required?: boolean }[] = [
  { key: 'kcal', label: 'Calories (kcal)', required: true },
  { key: 'protein', label: 'Protein (g)', required: true },
  { key: 'carbs', label: 'Carbs (g)', required: true },
  { key: 'fat', label: 'Fat (g)', required: true },
  { key: 'fibre', label: 'Fibre (g)' },
  { key: 'sugar', label: 'Sugar (g)' },
  { key: 'sodium_mg', label: 'Sodium (mg)' },
];
const str = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '' : String(v));
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

/** Create or edit one of your foods, straight from a label or a recipe card. */
export function FoodFormDialog({
  open,
  food,
  initialName,
  copyFrom,
  draft,
  notice,
  onClose,
  onArchive,
}: {
  open: boolean;
  food: Food | null;
  initialName?: string;
  /** Start from another food (e.g. a catalog dish) and save it as your own version. */
  copyFrom?: Food;
  /** Prefill for a new food, e.g. from a barcode lookup (you check it before saving). */
  draft?: FoodInput;
  /** Shown above the form (where the prefill came from, what's missing). */
  notice?: ReactNode;
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
    const src = food ?? copyFrom ?? draft ?? null;
    setText({
      name: food?.name ?? (copyFrom ? `${copyFrom.name} (my version)` : draft?.name ?? initialName ?? ''),
      barcode: (food ?? draft)?.barcode ?? '',
      brand: src?.brand ?? '',
      serving_g: str(src?.serving_g),
      kcal: str(src?.kcal),
      protein: str(src?.protein),
      carbs: str(src?.carbs),
      fat: str(src?.fat),
      fibre: str(src?.fibre),
      sugar: str(src?.sugar),
      sodium_mg: str(src?.sodium_mg),
    });
    setDiet(src?.diet ?? null);
    setBasis(src?.basis ?? '100g');
    setPortions(src?.portions.map((p) => ({ label: p.label, grams: String(p.grams) })) ?? []);
    setError(null);
  }, [open, food, copyFrom, draft, initialName]);

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
    barcode: text.barcode?.trim() ? normaliseBarcode(text.barcode) : null,
    ...(copyFrom && !food ? { parent_food_id: copyFrom.id } : {}),
    ...(draft?.source && !food ? { source: draft.source, source_url: draft.source_url ?? null } : {}),
  });
  const values = input();
  const energy = [values.kcal, values.protein, values.carbs, values.fat].every((v) => v >= 0) ? energyCheck(values) : null;
  const per = basis === 'serving' ? 'per serving' : basis === '100ml' ? 'per 100 ml' : 'per 100 g';

  const save = async () => {
    const problem = validateFood(values) ?? (values.barcode && !isValidBarcode(values.barcode) ? 'Check the barcode digits.' : null);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      onClose(await saveFood(values, food?.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save.';
      setError(/foods_user_barcode/.test(msg) ? 'You already have a product with this barcode. Search for it, or archive the old one first.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose()} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="food-form-title">
      <DialogTitle id="food-form-title">{food ? 'Edit food' : copyFrom ? 'Make my version' : 'New food'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {notice}
          <TextField label="Name" value={text.name ?? ''} onChange={(e) => setText({ ...text, name: e.target.value })} autoFocus={!food} inputProps={{ maxLength: 120 }} />
          <TextField label="Brand (optional)" value={text.brand ?? ''} onChange={(e) => setText({ ...text, brand: e.target.value })} inputProps={{ maxLength: 80 }} />
          <TextField
            size="small"
            label="Barcode (packaged foods, optional)"
            inputMode="numeric"
            value={text.barcode ?? ''}
            onChange={(e) => setText({ ...text, barcode: e.target.value })}
            error={Boolean(text.barcode?.trim()) && !isValidBarcode(text.barcode ?? '')}
            helperText={text.barcode?.trim() && !isValidBarcode(text.barcode ?? '') ? 'Check the digits: the check digit doesn’t match.' : 'Scan it next time and this food comes straight up.'}
          />
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
              Protein, carbs and fat work out to about {energy.computed} kcal, but calories say {values.kcal} ({energy.gapPct > 0 ? '+' : ''}
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
