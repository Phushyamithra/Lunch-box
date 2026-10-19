import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { BarcodeLookup } from './BarcodeLookup';
import { FoodFormDialog } from './FoodFormDialog';
import { DIET, type Food } from './foodLog';
import { useNutrition } from './NutritionContext';

/** Your own foods: create once from a label or recipe, then log in one tap. */
export default function FoodsPage() {
  const { data, archiveFood } = useNutrition();
  const toast = useSnackbar();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [scanning, setScanning] = useState(false);
  const mine = data!.foods.filter((f) => f.user_id !== null);
  const shown = mine.filter((f) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const uses = new Map<string, number>();
  for (const e of data!.entries) if (e.food_id) uses.set(e.food_id, (uses.get(e.food_id) ?? 0) + 1);

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Card
        title="🥘 My foods"
        aside={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => setScanning(true)}>
              📷 Scan
            </Button>
            <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditing('new')}>
              New food
            </Button>
          </Stack>
        }
      >
        <Stack spacing={1}>
          <TextField
            size="small"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
          />
          {mine.length === 0 ? (
            <Typography color="text.secondary">
              No foods yet. Add your staples (dal, rotis, your protein shake…) with their portions, and they show up when you log.
            </Typography>
          ) : (
            <List dense disablePadding>
              {shown.map((f) => (
                <ListItemButton key={f.id} onClick={() => setEditing(f)} sx={{ borderRadius: '12px' }}>
                  <ListItemText
                    primary={`${f.barcode ? '📦 ' : ''}${f.diet ? `${DIET[f.diet].emoji} ` : ''}${f.name}${f.brand ? ` · ${f.brand}` : ''}`}
                    secondary={`${Math.round(f.kcal)} kcal · P ${f.protein} · C ${f.carbs} · F ${f.fat} ${f.basis === 'serving' ? 'per serving' : f.basis === '100ml' ? 'per 100 ml' : 'per 100 g'}${
                      f.portions.length ? ` · ${f.portions.map((p) => p.label).join(', ')}` : ''
                    }`}
                  />
                  {uses.get(f.id) ? <Chip size="small" variant="outlined" label={`${uses.get(f.id)}×`} /> : null}
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </Card>
      <Dialog open={scanning} onClose={() => setScanning(false)} fullWidth maxWidth="sm" aria-labelledby="scan-title">
        <DialogTitle id="scan-title">Add a packaged food</DialogTitle>
        <DialogContent>
          {scanning && (
            <BarcodeLookup
              onFood={(f) => {
                setScanning(false);
                toast(`📦 ${f.name} is in your foods`);
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScanning(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <FoodFormDialog
        open={editing !== null}
        food={editing === 'new' ? null : editing}
        onClose={(saved) => {
          if (saved) toast(editing === 'new' ? `🥘 ${saved.name} saved` : 'Food updated (past logs unchanged)');
          setEditing(null);
        }}
        onArchive={
          editing && editing !== 'new'
            ? async (f) => {
                if (!window.confirm(`Archive “${f.name}”? It disappears from search; days you logged keep their values.`)) return;
                try {
                  await archiveFood(f.id);
                  toast(`${f.name} archived`);
                  setEditing(null);
                } catch (e) {
                  toast(`Not archived: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
                }
              }
            : undefined
        }
      />
    </Stack>
  );
}
