import { Alert, Box, Button, Chip, CircularProgress, Link, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { isIndianBarcode, mapOffProduct, normaliseBarcode, offProductUrl, type OffLookup } from './barcode';
import { FoodFormDialog } from './FoodFormDialog';
import type { Food, FoodInput } from './foodLog';
import { useNutrition } from './NutritionContext';

type State =
  | { step: 'scan' }
  | { step: 'looking'; code: string }
  | { step: 'off'; code: string; result: OffLookup }
  | { step: 'unknown'; code: string; offline: boolean };

/**
 * Scan or type a barcode → your own product if you've saved it, else Open
 * Food Facts (you check its values against the pack before saving), else
 * enter it from the label. Ends with a food in your library.
 */
export function BarcodeLookup({ onFood }: { onFood: (food: Food) => void }) {
  const { data } = useNutrition();
  const [state, setState] = useState<State>({ step: 'scan' });
  const [form, setForm] = useState<{ draft: FoodInput; notice: React.ReactNode } | null>(null);

  const lookup = async (raw: string) => {
    const code = normaliseBarcode(raw);
    const mine = data!.foods.find((f) => f.user_id && f.barcode === code);
    if (mine) return onFood(mine);
    setState({ step: 'looking', code });
    try {
      const res = await fetch(offProductUrl(code), { headers: { Accept: 'application/json' } });
      const json = res.status === 404 ? { status: 0 } : await res.json();
      const result = mapOffProduct(code, json);
      setState(result.status === 'not_found' ? { step: 'unknown', code, offline: false } : { step: 'off', code, result });
    } catch {
      setState({ step: 'unknown', code, offline: true });
    }
  };

  const blank = (code: string): FoodInput => ({
    barcode: code,
    name: '',
    brand: null,
    diet: null,
    basis: '100g',
    serving_g: null,
    portions: [],
    kcal: NaN,
    protein: NaN,
    carbs: NaN,
    fat: NaN,
    fibre: 0,
    sugar: null,
    sodium_mg: null,
  });

  return (
    <Stack spacing={1.5}>
      {state.step === 'scan' && <BarcodeScanner onCode={(c) => void lookup(c)} />}

      {state.step === 'looking' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
          <CircularProgress size={22} />
          <Typography>Looking up {state.code}…</Typography>
        </Box>
      )}

      {state.step === 'off' && state.result.draft && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Stack spacing={1.25} sx={{ p: 1.5, borderRadius: '18px', border: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>{state.result.draft.name}</Typography>
              <Chip size="small" variant="outlined" label="Open Food Facts" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {state.result.draft.brand ? `${state.result.draft.brand} · ` : ''}
              {state.code}
              {isIndianBarcode(state.code) ? ' · India' : ''}
            </Typography>
            <Typography variant="body2">
              Per {state.result.draft.basis === '100ml' ? '100 ml' : '100 g'}:{' '}
              {[
                ['kcal', state.result.draft.kcal, ''],
                ['P', state.result.draft.protein, ' g'],
                ['C', state.result.draft.carbs, ' g'],
                ['F', state.result.draft.fat, ' g'],
              ]
                .map(([k, v, u]) => `${k} ${Number.isFinite(v as number) ? `${v}${u}` : '?'}`)
                .join(' · ')}
            </Typography>
            {state.result.warnings.map((w) => (
              <Alert key={w} severity="warning" sx={{ py: 0 }}>
                {w}
              </Alert>
            ))}
            <Alert severity="info" sx={{ py: 0 }}>
              Open Food Facts is entered by volunteers. Check the numbers against your pack before saving.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() =>
                  setForm({
                    draft: { ...state.result.draft!, source: 'off', source_url: state.result.url },
                    notice: (
                      <Alert severity="info">
                        Prefilled from{' '}
                        <Link href={state.result.url} target="_blank" rel="noopener noreferrer">
                          Open Food Facts
                        </Link>
                        . Compare with the label on your pack and fix anything that differs.
                      </Alert>
                    ),
                  })
                }
              >
                Check & save
              </Button>
              <Button onClick={() => setState({ step: 'scan' })}>Scan another</Button>
            </Box>
          </Stack>
        </motion.div>
      )}

      {state.step === 'unknown' && (
        <Stack spacing={1}>
          <Alert severity={state.offline ? 'warning' : 'info'}>
            {state.offline ? 'Couldn’t reach Open Food Facts (offline?).' : `${state.code} isn’t in Open Food Facts yet.`} Enter it from the nutrition label once and it’s
            yours from then on.
          </Alert>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => setForm({ draft: blank(state.code), notice: <Alert severity="info">Copy the values from the “Nutrition information” panel on the pack.</Alert> })}
            >
              Enter from label
            </Button>
            {state.offline && <Button onClick={() => void lookup(state.code)}>Try again</Button>}
            <Button onClick={() => setState({ step: 'scan' })}>Scan another</Button>
          </Box>
        </Stack>
      )}

      <FoodFormDialog
        open={form !== null}
        food={null}
        draft={form?.draft}
        notice={form?.notice}
        onClose={(saved) => {
          setForm(null);
          if (saved) {
            setState({ step: 'scan' });
            onFood(saved);
          }
        }}
      />
    </Stack>
  );
}
