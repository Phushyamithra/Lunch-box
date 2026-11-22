import dayjs from 'dayjs';
import { useEffect, useRef } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { dayTotals } from '../nutrition/foodLog';
import { useNutrition } from '../nutrition/NutritionContext';
import { activeTarget } from '../nutrition/nutritionApi';
import { backfillDiet, type DietWrite } from './dietAuto';
import { useFitness } from './FitnessContext';

/**
 * Tags every past day from the food log when Fitness opens: days with food
 * logged and no tag of yours get On track / Below target / Slightly above /
 * Way off, and days the food log tagged before are brought up to date.
 * Days you tagged yourself (Event included) are never touched. Runs once per
 * visit and only writes what changed, so later visits are usually silent.
 *
 * Before migration 0019 the database only knows On plan / Partial / Event,
 * so the finer tags are saved as Partial for now (and the card says why).
 */
export function useDietBackfill() {
  const { data, setDietMany } = useFitness();
  const nutrition = useNutrition().data;
  const toast = useSnackbar();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !data || !nutrition) return;
    done.current = true;
    const today = dayjs().format('YYYY-MM-DD');
    const days = [...new Set(nutrition.entries.filter((e) => !e.deleted_at && e.day <= today).map((e) => e.day))].map((day) => {
      const { total } = dayTotals(nutrition.entries, day);
      return { day, kcal: total.kcal, protein: total.protein };
    });
    const s = data.settings;
    const targetFor = (day: string) => {
      const nt = activeTarget(nutrition.targets, day);
      return nt ? { kcal: nt.kcal, protein_min: nt.protein_min } : { kcal: s.kcal_target, protein_min: s.protein_min_g };
    };
    const rows = backfillDiet(days, targetFor, data.diet, today);
    if (rows.length === 0) return;
    const save = (list: DietWrite[] | (Omit<DietWrite, 'tag'> & { tag: 'on_plan' | 'partial' })[]) => setDietMany(list);
    void (async () => {
      try {
        const n = await save(rows);
        if (rows.some((r) => r.day < today)) toast(`Diet filled in for ${n} day${n === 1 ? '' : 's'} from your food log`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/diet_days_tag_check|check constraint/i.test(msg)) return toast(`Diet back-fill didn’t save: ${msg}`, { severity: 'error' });
        // Older database: keep the days tagged, as On plan / Partial, until 0019 is run.
        try {
          const n = await save(rows.map((r) => ({ ...r, tag: r.tag === 'on_plan' ? ('on_plan' as const) : ('partial' as const) })));
          toast(`Diet filled in for ${n} day${n === 1 ? '' : 's'} (as On plan / Partial). Run migration 0019 for Below / Slightly above / Way off.`, { severity: 'info' });
        } catch (e2) {
          toast(`Diet back-fill didn’t save: ${e2 instanceof Error ? e2.message : String(e2)}`, { severity: 'error' });
        }
      }
    })();
  }, [data, nutrition, setDietMany, toast]);
}
