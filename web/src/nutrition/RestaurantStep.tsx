import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { NumberStepper } from '../fitness/NumberStepper';
import { useSnackbar } from '../layout/Snackbar';
import { FoodFormDialog } from './FoodFormDialog';
import { DIET, type FoodInput, type MealSlot, type Nutrients } from './foodLog';
import { useNutrition } from './NutritionContext';
import { CB_MEALS, cbDefaults, cbGroups, cbSizes, cbTotal, type CbMeal } from './restaurants/californiaBurrito';
import { CHAINS, MENU, NOT_AVAILABLE, chainOf, optionNutrients, searchMenu } from './restaurants/index';
import type { ChainId, MenuItem as RestaurantItem } from './restaurants/types';
import { dietAllowed, type DietFilter } from './search';

type View = { kind: 'menu' } | { kind: 'item'; item: RestaurantItem } | { kind: 'builder' };

/** Restaurants: official menus, by size or slice; customise into your own version. */
export function RestaurantStep({ day, meal, filter, initialItem }: { day: string; meal: MealSlot; filter: DietFilter; initialItem?: RestaurantItem | null }) {
  const [chain, setChain] = useState<ChainId>(initialItem?.chain ?? 'mcdonalds');
  const [view, setView] = useState<View>(initialItem ? { kind: 'item', item: initialItem } : { kind: 'menu' });
  const [q, setQ] = useState('');
  const items = useMemo(
    () => (q.trim() ? searchMenu(q) : MENU.filter((i) => i.chain === chain)).filter((i) => dietAllowed(i.diet, filter)),
    [q, chain, filter],
  );
  const categories = [...new Set(items.map((i) => i.category))];

  if (view.kind === 'item') return <ItemStep item={view.item} day={day} meal={meal} onBack={() => setView({ kind: 'menu' })} />;
  if (view.kind === 'builder') return <BurritoBuilder day={day} meal={meal} onBack={() => setView({ kind: 'menu' })} />;

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }} role="group" aria-label="Restaurant">
        {CHAINS.map((c) => (
          <Chip
            key={c.id}
            label={`${c.emoji} ${c.name}`}
            color={c.id === chain && !q.trim() ? 'secondary' : 'default'}
            variant={c.id === chain && !q.trim() ? 'filled' : 'outlined'}
            onClick={() => {
              setChain(c.id);
              setQ('');
            }}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>
      <TextField
        size="small"
        placeholder="Search all menus: farmhouse, mcveggie…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
      />
      {!q.trim() && chain === 'california-burrito' && (
        <Button variant="contained" onClick={() => setView({ kind: 'builder' })} sx={{ minHeight: 48 }}>
          🌯 Build a burrito or bowl
        </Button>
      )}
      <List dense disablePadding>
        {categories.map((cat) => [
          <ListSubheader key={`h-${cat}`} disableSticky>
            {cat}
          </ListSubheader>,
          ...items
            .filter((i) => i.category === cat)
            .map((i) => (
              <ListItemButton key={i.id} onClick={() => setView({ kind: 'item', item: i })} sx={{ borderRadius: '12px' }}>
                <ListItemText
                  primary={`${DIET[i.diet].emoji} ${i.name}`}
                  secondary={`${q.trim() ? `${chainOf(i.chain).name} · ` : ''}${Math.round(i.options[0].kcal)} kcal · P ${i.options[0].protein} g${i.options.length > 1 ? ` · ${i.options.length} sizes` : ''}`}
                />
              </ListItemButton>
            )),
        ])}
      </List>
      {items.length === 0 && <Typography color="text.secondary">Nothing matches{filter !== 'all' ? ' with this diet filter' : ''}.</Typography>}
      {!q.trim() && (
        <Typography variant="caption" color="text.secondary">
          {chainOf(chain).coverage} Source:{' '}
          <Link href={chainOf(chain).source.url} target="_blank" rel="noopener noreferrer">
            {chainOf(chain).source.title}
          </Link>{' '}
          ({chainOf(chain).source.captured}).
        </Typography>
      )}
      <Alert severity="info" sx={{ py: 0 }}>
        Not listed: {NOT_AVAILABLE.map((n) => `${n.name} (${n.why})`).join(' ')} Use Quick add or create the item from its label instead.
      </Alert>
    </Stack>
  );
}

function OfficialNote({ chain }: { chain: ChainId }) {
  const c = chainOf(chain);
  return (
    <Typography variant="caption" color="text.secondary">
      Official values from{' '}
      <Link href={c.source.url} target="_blank" rel="noopener noreferrer">
        {c.source.title}
      </Link>
      , captured {c.source.captured}.
    </Typography>
  );
}

function NutrientStrip({ n }: { n: Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'> }) {
  return (
    <motion.div key={`${n.kcal}-${n.protein}`} initial={{ scale: 0.98, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}>
      <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: (t) => t.tracker.tonal, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center' }}>
        {[
          ['kcal', n.kcal],
          ['protein', `${n.protein} g`],
          ['carbs', `${n.carbs} g`],
          ['fat', `${n.fat} g`],
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
  );
}

const CUSTOM_NOTICE = (
  <Alert severity="warning">
    Customised: leaving out or adding ingredients changes the numbers in ways the chain doesn’t publish. Adjust what you know (e.g. remove the mayo’s fat);
    it’s saved as your own values. The official item stays as it is.
  </Alert>
);

function ItemStep({ item, day, meal, onBack }: { item: RestaurantItem; day: string; meal: MealSlot; onBack: () => void }) {
  const { addEntry } = useNutrition();
  const toast = useSnackbar();
  const [optIndex, setOptIndex] = useState(0);
  const option = item.options[optIndex];
  const [unit, setUnit] = useState<'serving' | 'slice'>('serving');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [customising, setCustomising] = useState(false);
  const n = optionNutrients(option, qty || 0, unit);
  const chain = chainOf(item.chain);
  const name = `${chain.name}: ${item.name}${item.options.length > 1 ? ` (${option.label})` : ''}`;

  const add = async () => {
    if (!(qty > 0)) return;
    setBusy(true);
    try {
      await addEntry({
        ...n,
        day,
        meal,
        food_id: null,
        meal_log_id: null,
        source: 'restaurant',
        name,
        quantity: qty,
        unit: unit === 'slice' ? 'slice' : 'serving',
        grams: unit === 'serving' && option.grams ? Math.round(option.grams * qty) : null,
        verification: 'official',
      });
      toast(`✅ ${item.name} · ${n.kcal} kcal`);
      onBack();
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const draft: FoodInput = {
    name: `${item.name}${item.options.length > 1 ? ` (${option.label})` : ''} (my version)`,
    brand: chain.name,
    diet: item.diet,
    basis: 'serving',
    serving_g: option.grams ?? null,
    portions: [],
    kcal: option.kcal,
    protein: option.protein,
    carbs: option.carbs,
    fat: option.fat,
    fibre: 0,
    sugar: option.sugar ?? null,
    sodium_mg: option.sodium_mg ?? null,
    source: 'restaurant',
    source_url: chain.source.url,
  };

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
          Menu
        </Button>
        <Chip size="small" color="success" variant="outlined" label="Official" />
      </Box>
      <Box>
        <Typography variant="h6" component="p">
          {DIET[item.diet].emoji} {item.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {chain.emoji} {chain.name} · {item.category}
        </Typography>
      </Box>
      {item.options.length > 1 && (
        <TextField
          select
          size="small"
          label="Size"
          value={optIndex}
          onChange={(e) => {
            setOptIndex(Number(e.target.value));
            setUnit('serving');
            setQty(1);
          }}
        >
          {item.options.map((o, i) => (
            <MenuItem key={o.label} value={i}>
              {o.label}
              {o.slices ? ` (${o.slices} slices)` : o.grams ? ` (${o.grams} ${item.ml ? 'ml' : 'g'})` : ''} · {Math.round(o.kcal)} kcal
            </MenuItem>
          ))}
        </TextField>
      )}
      {option.slices && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={unit}
          onChange={(_, v) => {
            if (!v) return;
            setUnit(v);
            setQty(v === 'slice' ? option.slices ?? 1 : 1);
          }}
          aria-label="Log by"
        >
          <ToggleButton value="serving">Servings ({option.slices} slices each)</ToggleButton>
          <ToggleButton value="slice">Slices</ToggleButton>
        </ToggleButtonGroup>
      )}
      <NumberStepper label="Amount" unit={unit === 'slice' ? 'slices' : '×'} value={qty} step={unit === 'slice' ? 1 : 0.5} min={0} max={unit === 'slice' ? 16 : 10} decimals={unit === 'slice' ? 0 : 1} onChange={setQty} />
      <NutrientStrip n={n} />
      <OfficialNote chain={item.chain} />
      <Button variant="contained" size="large" onClick={() => void add()} disabled={busy || !(qty > 0)} sx={{ minHeight: 52 }}>
        Add · {n.kcal} kcal
      </Button>
      <Button onClick={() => setCustomising(true)}>✏️ Customise (save as my version)</Button>
      <FoodFormDialog
        open={customising}
        food={null}
        draft={draft}
        notice={CUSTOM_NOTICE}
        onClose={(saved) => {
          setCustomising(false);
          if (saved) toast(`Saved “${saved.name}” to My foods. Find it under Foods to log it.`);
        }}
      />
    </Stack>
  );
}

function BurritoBuilder({ day, meal, onBack }: { day: string; meal: MealSlot; onBack: () => void }) {
  const { addEntry } = useNutrition();
  const toast = useSnackbar();
  const [cbMeal, setCbMeal] = useState<CbMeal>('burrito');
  const [size, setSize] = useState('regular');
  const [picks, setPicks] = useState<Record<string, string[]>>(() => cbDefaults('burrito', 'regular'));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const groups = cbGroups(cbMeal, size);
  const total = cbTotal({ meal: cbMeal, size, picks });
  const mealLabel = CB_MEALS.find((m) => m.key === cbMeal)!.label;
  const title = `California Burrito: ${mealLabel} (${size})`;

  const reset = (m: CbMeal, s: string) => {
    setCbMeal(m);
    setSize(s);
    setPicks(cbDefaults(m, s));
  };
  const toggle = (key: string, name: string, pick: 'one' | 'many' | 'fixed') =>
    setPicks((p) => {
      const cur = p[key] ?? [];
      if (pick === 'one') return { ...p, [key]: [name] };
      return { ...p, [key]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] };
    });

  const add = async () => {
    setBusy(true);
    try {
      await addEntry({
        kcal: total.kcal,
        protein: total.protein,
        carbs: total.carbs,
        fat: total.fat,
        fibre: 0,
        sugar: null,
        sodium_mg: null,
        day,
        meal,
        food_id: null,
        meal_log_id: null,
        source: 'restaurant',
        name: `${title}: ${total.parts.join(', ')}`.slice(0, 160),
        quantity: 1,
        unit: 'serving',
        grams: null,
        verification: 'official',
      });
      toast(`✅ ${mealLabel} · ${total.kcal} kcal`);
      onBack();
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
          Menu
        </Button>
        <Chip size="small" color="success" variant="outlined" label="Official components" />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {CB_MEALS.map((m) => (
          <Chip key={m.key} label={`${m.emoji} ${m.label}`} color={m.key === cbMeal ? 'secondary' : 'default'} variant={m.key === cbMeal ? 'filled' : 'outlined'} onClick={() => reset(m.key, 'regular')} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {cbSizes(cbMeal).map((s) => (
          <Chip key={s} size="small" label={s[0].toUpperCase() + s.slice(1)} color={s === size ? 'secondary' : 'default'} variant={s === size ? 'filled' : 'outlined'} onClick={() => reset(cbMeal, s)} />
        ))}
      </Box>
      {groups.map((g) => (
        <Box key={g.key}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {g.label}
            {g.pick === 'many' ? ' · any' : g.pick === 'fixed' ? ' · included' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {g.options.map((o) => {
              const on = g.pick === 'fixed' || (picks[g.key] ?? []).includes(o.name);
              return (
                <Chip
                  key={o.name}
                  size="small"
                  label={`${o.name.toLowerCase()} · ${o.cal}`}
                  color={on ? 'secondary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  onClick={g.pick === 'fixed' ? undefined : () => toggle(g.key, o.name, g.pick)}
                  sx={{ textTransform: 'capitalize' }}
                />
              );
            })}
          </Box>
        </Box>
      ))}
      <Box sx={{ position: 'sticky', bottom: 0, pt: 1, bgcolor: 'background.paper' }}>
        <NutrientStrip n={total} />
        <OfficialNote chain="california-burrito" />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button variant="contained" onClick={() => void add()} disabled={busy} sx={{ minHeight: 48, flexGrow: 1 }}>
            Add · {total.kcal} kcal
          </Button>
          <Button onClick={() => setSaving(true)}>Save as my food</Button>
        </Box>
      </Box>
      <FoodFormDialog
        open={saving}
        food={null}
        draft={{
          name: `${mealLabel} (${size}): ${total.parts.join(', ')}`.slice(0, 120),
          brand: 'California Burrito',
          diet: null,
          basis: 'serving',
          serving_g: null,
          portions: [],
          kcal: total.kcal,
          protein: total.protein,
          carbs: total.carbs,
          fat: total.fat,
          fibre: 0,
          sugar: null,
          sodium_mg: null,
          source: 'restaurant',
          source_url: chainOf('california-burrito').source.url,
        }}
        notice={<Alert severity="info">Saves this exact build as one of your foods, so your usual order is one tap next time.</Alert>}
        onClose={(saved) => {
          setSaving(false);
          if (saved) toast(`Saved “${saved.name}” to My foods`);
        }}
      />
    </Stack>
  );
}
