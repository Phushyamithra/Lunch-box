import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { NumberStepper } from '../fitness/NumberStepper';
import { useFood } from '../food/FoodContext';
import { useSnackbar } from '../layout/Snackbar';
import { BarcodeLookup } from './BarcodeLookup';
import { RestaurantStep } from './RestaurantStep';
import { chainOf, searchMenu } from './restaurants/index';
import type { MenuItem as RestaurantItem } from './restaurants/types';
import { FoodFormDialog } from './FoodFormDialog';
import {
  DIET,
  MEALS,
  frequentFoods,
  mealPrepSnapshot,
  nutrientsFor,
  unitsFor,
  type Entry,
  type Food,
  type MealSlot,
} from './foodLog';
import { useNutrition } from './NutritionContext';
import { CATEGORY_ORDER } from './reference/catalog';
import { dietAllowed, searchFoods, type DietFilter } from './search';
import type { EntryInput } from './nutritionApi';

type Mode = 'search' | 'scan' | 'out' | 'quick' | 'mealprep';

/** Search your foods, quick-add, or add a meal-prep delivery: everything lands in the same log. */
export function AddFoodSheet({ open, day, meal: initialMeal, onClose }: { open: boolean; day: string; meal: MealSlot; onClose: () => void }) {
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<MealSlot>(initialMeal);
  const [picked, setPicked] = useState<{ food: Food; quantity?: number; unit?: string } | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [copying, setCopying] = useState<Food | null>(null);
  const [menuItem, setMenuItem] = useState<RestaurantItem | null>(null);

  const close = () => {
    setPicked(null);
    setMenuItem(null);
    setMode('search');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      aria-labelledby="add-food-title"
      TransitionProps={{ onEnter: () => setMeal(initialMeal) }}
      PaperProps={{ sx: { minHeight: { sm: 560 } } }}
    >
      <DialogTitle id="add-food-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        {picked && (
          <IconButton aria-label="Back to search" onClick={() => setPicked(null)} edge="start">
            <ArrowBackRoundedIcon />
          </IconButton>
        )}
        <Box sx={{ flexGrow: 1 }}>Add to</Box>
        <TextField select size="small" value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)} aria-label="Meal" sx={{ minWidth: 150 }}>
          {MEALS.map((m) => (
            <MenuItem key={m.key} value={m.key}>
              {m.emoji} {m.label}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={close}>Done</Button>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {/* No exit wait: switching steps is instant, the new step just slides in. */}
          {picked ? (
            <motion.div key="portion" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <PortionStep food={picked.food} quantity={picked.quantity} unit={picked.unit} day={day} meal={meal} onAdded={() => setPicked(null)} onCopy={(f) => setCopying(f)} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <Tabs value={mode} onChange={(_, v) => setMode(v)} variant="fullWidth" sx={{ mb: 1.5 }}>
                <Tab value="search" label="🔎 Foods" sx={{ minWidth: 0, px: 0.5 }} />
                <Tab value="scan" label="📷 Scan" sx={{ minWidth: 0, px: 0.5 }} />
                <Tab value="out" label="🍽️ Out" sx={{ minWidth: 0, px: 0.5 }} />
                <Tab value="quick" label="⚡ Quick" sx={{ minWidth: 0, px: 0.5 }} />
                <Tab value="mealprep" label="🚚 Prep" sx={{ minWidth: 0, px: 0.5 }} />
              </Tabs>
              {mode === 'search' && (
                <SearchStep
                  day={day}
                  meal={meal}
                  onPick={(food, quantity, unit) => setPicked({ food, quantity, unit })}
                  onCreate={(name) => setCreating(name)}
                  onPickMenu={(item) => {
                    setMenuItem(item);
                    setMode('out');
                  }}
                />
              )}
              {mode === 'out' && <RestaurantStep key={menuItem?.id ?? 'menu'} day={day} meal={meal} filter={readFilter()} initialItem={menuItem} />}
              {mode === 'scan' && <BarcodeLookup onFood={(food) => setPicked({ food })} />}
              {mode === 'quick' && <QuickAdd day={day} meal={meal} />}
              {mode === 'mealprep' && <MealPrepStep day={day} meal={meal} />}
            </motion.div>
          )}
      </DialogContent>
      <FoodFormDialog
        open={creating !== null || copying !== null}
        food={null}
        copyFrom={copying ?? undefined}
        initialName={creating ?? ''}
        onClose={(saved) => {
          setCreating(null);
          setCopying(null);
          if (saved) setPicked({ food: saved });
        }}
      />
    </Dialog>
  );
}

const FILTERS: { key: DietFilter; label: string }[] = [
  { key: 'veg', label: '🟢 Veg' },
  { key: 'egg', label: '🥚 + Egg' },
  { key: 'all', label: '🍗 All' },
];
const FILTER_KEY = 'tracker.nutrition.dietFilter';
const readFilter = (): DietFilter => {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return v === 'veg' || v === 'egg' || v === 'all' ? v : 'all';
  } catch {
    return 'all';
  }
};

function FoodRow({ f, onPick }: { f: Food; onPick: (f: Food) => void }) {
  return (
    <ListItemButton onClick={() => onPick(f)} sx={{ borderRadius: '12px' }}>
      <ListItemText
        primary={
          <>
            {f.diet && <span aria-label={DIET[f.diet].label}>{DIET[f.diet].emoji} </span>}
            {f.name}
            {f.brand && (
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                · {f.brand}
              </Typography>
            )}
          </>
        }
        secondary={`${Math.round(f.kcal)} kcal · P ${f.protein} · C ${f.carbs} · F ${f.fat} ${f.basis === 'serving' ? 'per serving' : f.basis === '100ml' ? 'per 100 ml' : 'per 100 g'}${
          f.portions[0] ? ` · ${f.portions[0].label} = ${Math.round((f.kcal * f.portions[0].grams) / 100)} kcal` : ''
        }`}
      />
      <Chip
        size="small"
        variant="outlined"
        label={f.user_id ? 'Mine' : f.verification === 'official' ? 'Official' : 'Estimated'}
        color={f.user_id ? 'secondary' : f.verification === 'official' ? 'success' : 'default'}
        sx={{ ml: 1, flexShrink: 0 }}
      />
    </ListItemButton>
  );
}

function SearchStep({
  day,
  meal,
  onPick,
  onCreate,
  onPickMenu,
}: {
  day: string;
  meal: MealSlot;
  onPick: (f: Food, quantity?: number, unit?: string) => void;
  onCreate: (name: string) => void;
  onPickMenu: (item: RestaurantItem) => void;
}) {
  const { data, addEntry } = useNutrition();
  const toast = useSnackbar();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DietFilter>(readFilter);
  const [category, setCategory] = useState<string | null>(null);
  const foods = data!.foods;
  const frequent = useMemo(() => frequentFoods(data!.entries, day), [data, day]);
  const results = useMemo(() => searchFoods(foods, q, filter), [foods, q, filter]);
  const menuHits = useMemo(() => searchMenu(q).filter((i) => dietAllowed(i.diet, filter)).slice(0, 8), [q, filter]);
  const categories = useMemo(() => {
    const present = new Set(foods.map((f) => f.category).filter((c): c is string => Boolean(c)));
    return [...(CATEGORY_ORDER as string[]).filter((c) => present.has(c)), ...[...present].filter((c) => !(CATEGORY_ORDER as string[]).includes(c))];
  }, [foods]);
  const inCategory = category ? foods.filter((f) => f.category === category && dietAllowed(f.diet, filter)).sort((a, b) => a.name.localeCompare(b.name)) : [];

  const chooseFilter = (f: DietFilter) => {
    setFilter(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      /* private mode: keep it for this session only */
    }
  };

  const again = async (last: Entry) => {
    const input: EntryInput = { ...last, day, meal, meal_log_id: null };
    for (const k of ['id', 'logged_at', 'deleted_at'] as const) delete (input as unknown as Record<string, unknown>)[k];
    try {
      await addEntry(input);
      toast(`✅ ${last.name} added`);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Stack spacing={1}>
      <TextField
        autoFocus
        placeholder="Search: dal, roti, paneer, chai…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCategory(null);
        }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
      />
      <Box sx={{ display: 'flex', gap: 0.75 }} role="group" aria-label="Diet filter">
        {FILTERS.map((f) => (
          <Chip key={f.key} size="small" label={f.label} color={filter === f.key ? 'secondary' : 'default'} variant={filter === f.key ? 'filled' : 'outlined'} onClick={() => chooseFilter(f.key)} />
        ))}
      </Box>
      <List dense disablePadding>
        {!q.trim() && !category && frequent.length > 0 && <ListSubheader disableSticky>Frequent</ListSubheader>}
        {!q.trim() &&
          !category &&
          frequent.map((f) => {
            const food = f.food_id ? foods.find((x) => x.id === f.food_id) : undefined;
            return (
              <ListItemButton key={f.key} onClick={() => (food ? onPick(food, f.last.quantity, f.last.unit) : void again(f.last))} sx={{ borderRadius: '12px' }}>
                <ListItemText
                  primary={f.name}
                  secondary={`${food ? `${f.last.quantity} × ${f.last.unit}` : 'tap to add again'} · ${f.last.kcal} kcal · ${f.last.protein} g protein · ${f.count}× in 30 days`}
                />
              </ListItemButton>
            );
          })}
        {q.trim() && results.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} />)}
        {q.trim() && menuHits.length > 0 && <ListSubheader disableSticky>Restaurants</ListSubheader>}
        {q.trim() &&
          menuHits.map((i) => (
            <ListItemButton key={i.id} onClick={() => onPickMenu(i)} sx={{ borderRadius: '12px' }}>
              <ListItemText
                primary={`${DIET[i.diet].emoji} ${i.name}`}
                secondary={`${chainOf(i.chain).emoji} ${chainOf(i.chain).name} · ${Math.round(i.options[0].kcal)} kcal${i.options.length > 1 ? ` · ${i.options.length} sizes` : ''}`}
              />
              <Chip size="small" variant="outlined" color="success" label="Official" sx={{ ml: 1, flexShrink: 0 }} />
            </ListItemButton>
          ))}
        {category && (
          <ListSubheader disableSticky sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>{category}</Box>
            <Button size="small" onClick={() => setCategory(null)}>
              All categories
            </Button>
          </ListSubheader>
        )}
        {inCategory.map((f) => (
          <FoodRow key={f.id} f={f} onPick={onPick} />
        ))}
      </List>
      {!q.trim() && !category && categories.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Browse
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {categories.map((c) => (
              <Chip key={c} label={c} variant="outlined" onClick={() => setCategory(c)} />
            ))}
          </Box>
        </Box>
      )}
      {q.trim() && results.length === 0 && menuHits.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No match{filter !== 'all' ? ' with this diet filter' : ''}. Create it once and it’s yours from then on, or use Quick add.
        </Typography>
      )}
      <Button startIcon={<AddRoundedIcon />} onClick={() => onCreate(q.trim())} sx={{ alignSelf: 'flex-start' }}>
        {q.trim() ? `Create “${q.trim()}”` : 'Create a food'}
      </Button>
    </Stack>
  );
}

function PortionStep({
  food,
  quantity,
  unit,
  day,
  meal,
  onAdded,
  onCopy,
}: {
  food: Food;
  quantity?: number;
  unit?: string;
  day: string;
  meal: MealSlot;
  onAdded: () => void;
  onCopy?: (f: Food) => void;
}) {
  const { addEntry } = useNutrition();
  const toast = useSnackbar();
  const units = unitsFor(food);
  const preferred = units.find((u) => unit !== undefined && (u.key === unit || u.key === `p:${unit}`)) ?? units.find((u) => u.key.startsWith('p:')) ?? units.find((u) => u.key === 'serving') ?? units[0];
  const [unitKey, setUnitKey] = useState(preferred.key);
  const [qty, setQty] = useState(quantity ?? (preferred.key === 'g' || preferred.key === 'ml' ? 100 : 1));
  const [busy, setBusy] = useState(false);
  const grams = unitKey === 'g' || unitKey === 'ml';
  const { nutrients, grams: weight } = nutrientsFor(food, qty || 0, unitKey);

  const add = async () => {
    if (!(qty > 0)) return toast('Enter how much you had.', { severity: 'info' });
    setBusy(true);
    try {
      await addEntry({
        ...nutrients,
        day,
        meal,
        food_id: food.id,
        meal_log_id: null,
        source: 'food',
        name: food.brand ? `${food.name} (${food.brand})` : food.name,
        quantity: qty,
        unit: units.find((u) => u.key === unitKey)?.key.replace(/^p:/, '') ?? unitKey,
        grams: weight,
        verification: food.verification,
      });
      toast(`✅ ${food.name} · ${nutrients.kcal} kcal`);
      onAdded();
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" component="p">
          {food.diet && `${DIET[food.diet].emoji} `}
          {food.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {food.brand ? `${food.brand} · ` : ''}
          {food.user_id ? 'Your values' : food.verification === 'official' ? 'Official values' : 'Estimated values'}
        </Typography>
        {food.notes && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            {food.notes}
            {food.source_url && (
              <>
                {' '}
                <Link href={food.source_url} target="_blank" rel="noopener noreferrer">
                  Source
                </Link>
              </>
            )}
          </Typography>
        )}
        {!food.user_id && onCopy && (
          <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => onCopy(food)}>
            ✏️ Make my version (the original stays as it is)
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr', alignItems: 'center' }}>
        <NumberStepper label="Amount" unit={grams ? unitKey : '×'} value={qty} step={grams ? 10 : 0.5} max={grams ? 5000 : 50} decimals={grams ? 0 : 1} onChange={setQty} />
        <TextField
          select
          size="small"
          label="Unit"
          value={unitKey}
          onChange={(e) => {
            const next = e.target.value;
            setUnitKey(next);
            setQty(next === 'g' || next === 'ml' ? 100 : 1);
          }}
        >
          {units.map((u) => (
            <MenuItem key={u.key} value={u.key}>
              {u.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <motion.div key={`${qty}-${unitKey}`} initial={{ scale: 0.98, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}>
        <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: (t) => t.tracker.tonal, display: 'grid', gap: 0.5, gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center' }}>
          {[
            ['kcal', nutrients.kcal],
            ['protein', `${nutrients.protein} g`],
            ['carbs', `${nutrients.carbs} g`],
            ['fat', `${nutrients.fat} g`],
          ].map(([k, v]) => (
            <Box key={k}>
              <Typography sx={{ fontWeight: 800 }}>{v}</Typography>
              <Typography variant="caption" color="text.secondary">
                {k}
              </Typography>
            </Box>
          ))}
        </Box>
      </motion.div>
      {weight !== null && !grams && (
        <Typography variant="caption" color="text.secondary">
          = {weight} {food.basis === '100ml' ? 'ml' : 'g'}
          {nutrients.fibre ? ` · fibre ${nutrients.fibre} g` : ''}
        </Typography>
      )}
      <Button variant="contained" size="large" onClick={() => void add()} disabled={busy} sx={{ minHeight: 52 }}>
        Add · {nutrients.kcal} kcal
      </Button>
    </Stack>
  );
}

function QuickAdd({ day, meal }: { day: string; meal: MealSlot }) {
  const { addEntry } = useNutrition();
  const toast = useSnackbar();
  const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const n = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : 0);
  const add = async () => {
    if (!f.name.trim()) return toast('Give it a name so you can find it later.', { severity: 'info' });
    const values = { kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat) };
    if (Object.values(values).some((v) => !(v >= 0)) || values.kcal <= 0) return toast('Enter calories (and any macros you know).', { severity: 'info' });
    try {
      await addEntry({ ...values, fibre: 0, sugar: null, sodium_mg: null, day, meal, food_id: null, meal_log_id: null, source: 'quick', name: f.name.trim(), quantity: 1, unit: 'serving', grams: null, verification: 'user' });
      toast(`✅ ${f.name.trim()} · ${values.kcal} kcal`);
      setF({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        For a one-off: wedding food, a friend’s cooking. It counts toward today; it isn’t saved as a food.
      </Typography>
      <TextField label="What was it?" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <TextField key={k} size="small" label={k === 'kcal' ? 'Calories' : `${k[0].toUpperCase()}${k.slice(1)} (g)`} inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ))}
      </Box>
      <Button variant="contained" onClick={() => void add()} sx={{ minHeight: 48 }}>
        Add
      </Button>
    </Stack>
  );
}

function MealPrepStep({ day, meal }: { day: string; meal: MealSlot }) {
  const food = useFood();
  const { data, addEntry } = useNutrition();
  const toast = useSnackbar();
  const linked = new Set(data!.entries.filter((e) => e.meal_log_id).map((e) => e.meal_log_id));
  const meals = new Map(food.data.meals.map((m) => [m.id, m]));
  const deliveries = food.data.logs.filter((l) => l.log_date === day && l.kind === 'consumed' && !l.deleted_at);

  const add = async (logId: string, mealId: string) => {
    const m = meals.get(mealId);
    if (!m) return;
    const snap = mealPrepSnapshot(m);
    try {
      await addEntry({ ...snap, day, meal, food_id: null, meal_log_id: logId, source: 'meal_prep', quantity: 1, unit: 'serving', grams: null, verification: 'user' });
      toast(`✅ ${m.name} added from meal prep`);
    } catch (e) {
      toast(/duplicate|food_log_one_per_delivery/.test(String(e)) ? 'That delivery is already in your log.' : `Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  if (deliveries.length === 0) {
    return <Alert severity="info">No meal-prep deliveries logged for this day.</Alert>;
  }
  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Deliveries aren’t counted as eaten until you add them here. Each can be added once.
      </Typography>
      {deliveries.map((l) => {
        const m = meals.get(l.meal_id);
        const done = linked.has(l.id);
        return (
          <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: '14px', border: 1, borderColor: 'divider' }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {m?.name ?? 'Unknown meal'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {m ? `${Math.round(m.calories)} kcal · P ${m.protein} · C ${m.carbs} · F ${m.fat}` : ''}
              </Typography>
            </Box>
            {done ? <Chip size="small" color="success" label="In log" /> : <Button variant="outlined" size="small" onClick={() => void add(l.id, l.meal_id)}>Add</Button>}
          </Box>
        );
      })}
    </Stack>
  );
}
