/**
 * Markdown report for analysis. Pure.
 *
 * Laid out like the daily reference file: a snapshot, then eating,
 * training and measurements, then the weekly and monthly log templates
 * filled in from recorded data. Only what was logged is reported; blanks
 * stay blank. Nothing from Finance is ever included.
 */
import dayjs from 'dayjs';
import type { FitnessData, SessionRow } from '../fitness/fitnessApi';
import { programDayOf } from '../fitness/dayPlan';
import { addDays, assessGain, baselineWeight, gainRate, isAway, isoWeekday, weekAdherence, weeklyAverages, weekStart, type WeekAverage } from '../fitness/rules';
import { MEALS, type Entry } from '../nutrition/foodLog';
import { activeTarget, type NutritionData } from '../nutrition/nutritionApi';
import { MODES } from '../nutrition/engine';
import { periodStats, summariseDays, type DaySummary } from '../nutrition/trends';

export interface ReportSections {
  food: boolean;
  measurements: boolean;
  workouts: boolean;
}

export interface ReportInput {
  fitness: FitnessData;
  nutrition: NutritionData | null;
  from: string;
  to: string;
  today: string;
  sections: ReportSections;
  now: Date;
}

const WEEKDAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const d = (day: string) => dayjs(day).format('D MMM YYYY');
const dShort = (day: string) => `${WEEKDAY[isoWeekday(day)]} ${dayjs(day).format('D MMM')}`;
const n0 = (v: number) => Math.round(v).toLocaleString('en-IN');
const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const kg = (v: number | null | undefined) => (v === null || v === undefined ? '______' : `${v.toFixed(1)} kg`);
const signed = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
/** Pipes and newlines would break a table cell. */
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ');
const table = (header: string[], rows: (string | number)[][], align?: ('l' | 'r')[]) =>
  [
    `| ${header.join(' | ')} |`,
    `|${header.map((_, i) => (align?.[i] === 'r' ? '---:' : '---')).join('|')}|`,
    ...rows.map((r) => `| ${r.map((c) => cell(String(c))).join(' | ')} |`),
  ].join('\n');

/** Heaviest set of each key-lift group in a range: "Barbell Bench 60 kg × 8". */
function bestLifts(f: FitnessData, from: string, to: string): Map<string, { exercise: string; weight: number; reps: number; day: string } | null> {
  const sessionDay = new Map(f.sessions.map((s) => [s.id, s.day]));
  const out = new Map<string, { exercise: string; weight: number; reps: number; day: string } | null>();
  for (const g of f.settings.key_lifts) {
    const names = new Set(g.exercises.map((e) => e.trim().toLowerCase()));
    let best: { exercise: string; weight: number; reps: number; day: string } | null = null;
    for (const s of f.sets) {
      const day = sessionDay.get(s.session_id);
      if (!day || day < from || day > to || s.reps <= 0 || !names.has(s.exercise.trim().toLowerCase())) continue;
      const w = Number(s.weight_kg);
      if (!best || w > best.weight || (w === best.weight && s.reps > best.reps)) best = { exercise: s.exercise, weight: w, reps: s.reps, day };
    }
    out.set(g.label, best);
  }
  return out;
}

const sessionTitle = (f: FitnessData, s: SessionRow) => {
  const custom = s.custom_workout_id ? f.workouts.find((w) => w.id === s.custom_workout_id) : undefined;
  if (custom) return `⭐ ${custom.name}`;
  const pd = programDayOf(s);
  const focus = f.settings.day_focus[String(pd)] ?? `Day ${pd}`;
  const own = pd === isoWeekday(s.day) ? '' : ` (${WEEKDAY[pd]}'s)`;
  const mixed = Object.values(s.slot_variants).some((v) => v !== s.variant_index);
  return `${focus}${own} · V${s.variant_index + 1}${mixed ? ' mixed' : ''}`;
};

/** "V3", "mixed" or "custom" for a week's sessions. */
function variantRunning(sessions: SessionRow[]): string {
  if (!sessions.length) return '___';
  const vs = new Set(sessions.filter((s) => !s.custom_workout_id).map((s) => s.variant_index + 1));
  if (vs.size === 1 && !sessions.some((s) => Object.values(s.slot_variants).some((v) => v !== s.variant_index))) return String([...vs][0]);
  return vs.size ? `${[...vs].sort().join('/')} (mixed)` : 'custom cards';
}

export function buildMarkdownReport(input: ReportInput): string {
  const { fitness: f, nutrition: nut, from, to, today, sections } = input;
  const s = f.settings;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

  const end = to < today ? addDays(to, 1) : today;
  const allWeeks = weeklyAverages(f.weighIns, f.away, end, s.weigh_time);
  const rate = gainRate(allWeeks, f.away, end);
  const verdict = assessGain(rate, s);
  const baseline = baselineWeight(f.weighIns, s.phase_start, s.weigh_time);
  const target = nut ? activeTarget(nut.targets, to < today ? to : today) : null;
  const isEvent = (day: string) => f.diet.some((x) => x.day === day && x.tag === 'event');
  const days: DaySummary[] = nut
    ? summariseDays({ from, to, entries: nut.entries, targetFor: (day) => activeTarget(nut.targets, day), isAway: (day) => isAway(day, f.away), isEvent })
    : [];
  const sessions = f.sessions.filter((x) => x.day >= from && x.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  const stepsBy = new Map(f.steps.map((x) => [x.day, x.steps]));

  push(`# TRACKER REPORT — ${d(from)} to ${d(to)}`);
  push(`*Exported ${dayjs(input.now).format('D MMM YYYY, HH:mm')} from Tracker. Only recorded data; blanks mean nothing was logged. Weight trend uses ${s.weigh_time === 'any' ? 'all' : s.weigh_time} weigh-ins.*`, '', '---', '');

  // ---------- snapshot ----------
  const phaseEnd = dayjs(s.phase_start).add(s.phase_months, 'month').format('YYYY-MM-DD');
  push('## 60-SECOND SNAPSHOT', '', '| | |', '|---|---|');
  push(`| **Phase** | ${target ? MODES[target.mode]?.label ?? 'Custom' : 'Lean bulk'} — ${d(s.phase_start)} to ~${d(phaseEnd)} (${s.phase_months} months) |`);
  if (target) {
    push(
      `| **Calories** | ${n0(target.kcal)} (in force since ${d(target.effective_from)}) |`,
      `| **Protein** | ${target.protein_min}–${target.protein_max} g (aim ${target.protein_g} g) |`,
      `| **Fat** | ${target.fat_min}–${target.fat_max} g (aim ${target.fat_g} g) |`,
      `| **Carbs** | ${target.carbs_g} g |`,
      `| **Fibre** | ${target.fibre_g} g |`,
    );
  } else {
    push(`| **Calories** | ${n0(s.kcal_target)} |`, `| **Protein** | ${s.protein_min_g}–${s.protein_max_g} g |`, `| **Fat** | ${s.fat_min_g}–${s.fat_max_g} g |`, `| **Carbs** | ${s.carbs_target_g} g |`);
  }
  push(
    `| **Target gain** | ${s.gain_target_kg_month} kg/month (flag above ${s.gain_high_kg_month}, below ${s.gain_low_kg_month}) |`,
    `| **Steps** | ${n0(s.steps_target)} daily |`,
    `| **Cardio** | ${s.cardio_per_week}×/week |`,
    `| **Baseline** | ${baseline ? `${Number(baseline.weight_kg).toFixed(1)} kg on ${d(baseline.day)} (${baseline.time_of_day})` : 'not recorded yet'} |`,
    `| **Measured rate** | ${rate ? `${signed(rate.kgPerMonth, 2)} kg/month (weeks of ${d(rate.from.weekStart)} → ${d(rate.to.weekStart)})${rate.spansAway ? ', spans an away period' : ''}` : 'not enough weigh-ins yet'} |`,
    `| **Reading** | ${verdict.message} |`,
  );
  push('', '---', '');

  // ---------- eating ----------
  if (sections.food) {
    push('# PART 1 — EATING', '');
    if (!nut) {
      push('*Nutrition data not loaded.*', '');
    } else {
      const st = periodStats(days);
      push('## Period summary', '');
      push(
        table(
          ['Measure', 'Value'],
          [
            ['Days in period', st.days],
            ['Fully logged days', st.tracked],
            ['Partly logged (under half the target)', st.partial],
            ['Not logged', st.empty],
            ['Away / event days (kept apart)', `${st.away} / ${st.event}`],
            ['Average kcal (fully logged days)', st.avgKcal === null ? '—' : n0(st.avgKcal)],
            ['Average protein / carbs / fat / fibre (g)', st.avgProtein === null ? '—' : `${n1(st.avgProtein)} / ${n1(st.avgCarbs ?? 0)} / ${n1(st.avgFat ?? 0)} / ${n1(st.avgFibre ?? 0)}`],
            ['Average gap to calorie target', st.avgKcalGap === null ? '—' : `${st.avgKcalGap >= 0 ? '+' : ''}${st.avgKcalGap} kcal`],
            ['Days within ±10% of calories', `${st.kcalOnTarget} / ${st.tracked}`],
            ['Days at or above protein minimum', `${st.proteinOk} / ${st.tracked}`],
          ],
          ['l', 'r'],
        ),
        '',
      );
      push('## Daily totals', '');
      const statusLabel: Record<DaySummary['status'], string> = { tracked: 'logged', partial: 'partial', empty: '—', away: 'away', event: 'event' };
      push(
        table(
          ['Day', 'Status', 'Kcal', 'Target', 'Protein', 'Carbs', 'Fat', 'Fibre', 'Steps'],
          days.map((x) => [
            dShort(x.day),
            statusLabel[x.status],
            x.status === 'empty' ? '' : n0(x.total.kcal),
            x.target ? n0(x.target.kcal) : '',
            x.status === 'empty' ? '' : n1(x.total.protein),
            x.status === 'empty' ? '' : n1(x.total.carbs),
            x.status === 'empty' ? '' : n1(x.total.fat),
            x.status === 'empty' ? '' : n1(x.total.fibre),
            stepsBy.has(x.day) ? n0(stepsBy.get(x.day) as number) : '',
          ]),
          ['l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
        ),
        '',
      );
      push('## Food log', '');
      const byDay = new Map<string, Entry[]>();
      for (const e of nut.entries) if (!e.deleted_at && e.day >= from && e.day <= to) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
      const mealOrder = new Map(MEALS.map((m, i) => [m.key, i]));
      for (const x of days) {
        const rows = (byDay.get(x.day) ?? []).sort((a, b) => (mealOrder.get(a.meal) ?? 0) - (mealOrder.get(b.meal) ?? 0) || a.logged_at.localeCompare(b.logged_at));
        if (!rows.length) continue;
        push(`### ${dShort(x.day)} — ${n0(x.total.kcal)} kcal · P ${n1(x.total.protein)} g · C ${n1(x.total.carbs)} g · F ${n1(x.total.fat)} g`, '');
        push(
          table(
            ['Meal', 'Food', 'Amount', 'Kcal', 'P', 'C', 'F', 'Source'],
            rows.map((e) => [
              MEALS.find((m) => m.key === e.meal)?.label ?? e.meal,
              e.name,
              `${n1(e.quantity)} ${e.unit}${e.grams ? ` (${n0(e.grams)} g)` : ''}`,
              n0(e.kcal),
              n1(e.protein),
              n1(e.carbs),
              n1(e.fat),
              e.verification === 'official' ? 'official' : e.verification === 'estimated' ? 'estimate' : 'own',
            ]),
            ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'l'],
          ),
          '',
        );
      }
      if (!byDay.size) push('*No food logged in this period.*', '');
    }
    push('---', '');
  }

  // ---------- training ----------
  if (sections.workouts) {
    push('# PART 2 — TRAINING', '');
    const sessionIds = new Set(sessions.map((x) => x.id));
    const sets = f.sets.filter((x) => sessionIds.has(x.session_id));
    push('## Sessions', '');
    push(
      sessions.length
        ? table(
            ['Day', 'Workout', 'Status', 'Working sets', 'Cardio'],
            sessions.map((x) => [
              dShort(x.day),
              sessionTitle(f, x),
              x.completed ? 'done' : `${x.slots_completed} exercises`,
              sets.filter((y) => y.session_id === x.id).length,
              x.cardio_done ? 'yes' : '',
            ]),
            ['l', 'l', 'l', 'r', 'l'],
          )
        : '*No sessions in this period.*',
      '',
    );
    for (const x of sessions) {
      const mine = sets.filter((y) => y.session_id === x.id).sort((a, b) => a.slot - b.slot || a.set_number - b.set_number);
      if (!mine.length) continue;
      push(`### ${dShort(x.day)} — ${sessionTitle(f, x)}`, '');
      const byExercise = new Map<string, string[]>();
      for (const y of mine) byExercise.set(y.exercise, [...(byExercise.get(y.exercise) ?? []), `${n1(Number(y.weight_kg))}×${y.reps}`]);
      push(table(['Exercise', 'Sets (kg × reps)'], [...byExercise].map(([ex, list]) => [ex, list.join(', ')])), '');
      if (x.notes) push(`*Notes: ${cell(x.notes)}*`, '');
    }
    push('## Key lifts — best working set', '');
    const now = bestLifts(f, from, to);
    const span = dayjs(to).diff(dayjs(from), 'day') + 1;
    const before = bestLifts(f, addDays(from, -span), addDays(from, -1));
    push(
      table(
        ['Lift', 'This period', 'Previous period of same length', 'Change'],
        s.key_lifts.map((g) => {
          const a = now.get(g.label);
          const b = before.get(g.label);
          return [
            g.label,
            a ? `${a.exercise} ${n1(a.weight)} kg × ${a.reps} (${dShort(a.day)})` : '—',
            b ? `${b.exercise} ${n1(b.weight)} kg × ${b.reps}` : '—',
            a && b ? (a.exercise === b.exercise ? `${signed(a.weight - b.weight)} kg` : 'different exercise') : '',
          ];
        }),
      ),
      '',
      '---',
      '',
    );
  }

  // ---------- measurements ----------
  if (sections.measurements) {
    push('# PART 3 — MEASUREMENTS', '');
    const weighIns = live(f.weighIns)
      .filter((w) => w.day >= from && w.day <= to)
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    push('## Weigh-ins', '');
    push(
      weighIns.length
        ? table(
            ['Day', 'Time', 'Weight', 'Counts for trend'],
            weighIns.map((w) => [
              dShort(w.day),
              `${w.time_of_day} ${dayjs(w.measured_at).format('HH:mm')}`,
              `${Number(w.weight_kg).toFixed(1)} kg`,
              isAway(w.day, f.away) ? 'no (away)' : s.weigh_time === 'any' || w.time_of_day === s.weigh_time ? 'yes' : 'no (other time of day)',
            ]),
          )
        : '*No weigh-ins in this period.*',
      '',
    );
    const weeks = allWeeks.filter((w) => addDays(w.weekStart, 6) >= from && w.weekStart <= to);
    push('## Weekly averages', '');
    push(
      weeks.length
        ? table(
            ['Week of', 'Average', 'Weighed days', 'Change from last week', 'Change from baseline'],
            weeks.map((w) => {
              const prev = [...allWeeks].reverse().find((p) => p.weekStart < w.weekStart && p.average !== null);
              return [
                d(w.weekStart),
                w.average === null ? '—' : `${w.average.toFixed(2)} kg${w.sufficient ? '' : ' (under 3 days)'}`,
                `${w.days}${w.awayDays ? ` (+${w.awayDays} away)` : ''}`,
                w.average !== null && prev?.average ? `${signed(w.average - prev.average, 2)} kg` : '',
                w.average !== null && baseline ? `${signed(w.average - Number(baseline.weight_kg), 2)} kg` : '',
              ];
            }),
          )
        : '*No weekly averages yet.*',
      '',
    );
    const waists = live(f.waists).sort((a, b) => a.day.localeCompare(b.day));
    const inRange = waists.filter((w) => w.day >= from && w.day <= to);
    push('## Waist (navel, relaxed)', '');
    push(
      inRange.length
        ? table(
            ['Day', 'Waist', 'Change from previous'],
            inRange.map((w) => {
              const prev = [...waists].reverse().find((p) => p.day < w.day);
              return [dShort(w.day), `${Number(w.waist_cm).toFixed(1)} cm`, prev ? `${signed(Number(w.waist_cm) - Number(prev.waist_cm))} cm` : 'first'];
            }),
          )
        : '*No waist measurements in this period.*',
      '',
    );
    const steps = f.steps.filter((x) => x.day >= from && x.day <= to);
    push('## Steps', '', steps.length ? `Average ${n0(steps.reduce((a, x) => a + x.steps, 0) / steps.length)} on ${steps.length} recorded days (target ${n0(s.steps_target)}).` : '*No steps recorded.*', '');
    const away = f.away.filter((p) => p.ends_on >= from && p.starts_on <= to);
    if (away.length) push('## Away periods', '', ...away.map((p) => `- ${d(p.starts_on)} to ${d(p.ends_on)}${p.label ? ` — ${p.label}` : ''}`), '');
    push('---', '');
  }

  // ---------- filled templates ----------
  push('# PART 4 — LOG TEMPLATES (filled from data)', '', '## Weekly', '');
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) push(weeklyBlock(input, ws, allWeeks, days), '');
  push('## Monthly', '');
  for (let m = dayjs(from).startOf('month'); m.format('YYYY-MM-DD') <= to; m = m.add(1, 'month')) push(monthlyBlock(input, m.format('YYYY-MM-DD'), allWeeks, baseline ? Number(baseline.weight_kg) : null, baseline?.day ?? null), '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function weeklyBlock(input: ReportInput, ws: string, allWeeks: WeekAverage[], days: DaySummary[]): string {
  const f = input.fitness;
  const s = f.settings;
  const we = addDays(ws, 6);
  const sessions = f.sessions.filter((x) => x.day >= ws && x.day <= we);
  const time = s.weigh_time;
  const readings = f.weighIns
    .filter((w) => !w.deleted_at && w.day >= ws && w.day <= we && (time === 'any' || w.time_of_day === time))
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const week = allWeeks.find((w) => w.weekStart === ws);
  const prev = [...allWeeks].reverse().find((w) => w.weekStart < ws && w.average !== null);
  const waistsAll = f.waists.filter((w) => !w.deleted_at).sort((a, b) => a.day.localeCompare(b.day));
  const waist = [...waistsAll].reverse().find((w) => w.day >= ws && w.day <= we);
  const waistPrev = waist ? [...waistsAll].reverse().find((w) => w.day < waist.day) : undefined;
  const adherence = weekAdherence(ws, f.sessions, f.away);
  const lifts = bestLifts(f, ws, we);
  const steps = f.steps.filter((x) => x.day >= ws && x.day <= we);
  const weekDays = days.filter((x) => x.day >= ws && x.day <= we);
  const st = weekDays.length ? periodStats(weekDays) : null;
  const notes = [
    ...sessions.filter((x) => x.notes).map((x) => `${WEEKDAY[isoWeekday(x.day)]}: ${x.notes}`),
    ...f.weighIns.filter((w) => !w.deleted_at && w.notes && w.day >= ws && w.day <= we).map((w) => `${WEEKDAY[isoWeekday(w.day)]} weigh-in: ${w.notes}`),
    ...f.away.filter((p) => p.ends_on >= ws && p.starts_on <= we).map((p) => `Away ${dayjs(p.starts_on).format('D MMM')}–${dayjs(p.ends_on).format('D MMM')}${p.label ? ` (${p.label})` : ''}`),
    ...f.diet.filter((x) => x.day >= ws && x.day <= we && x.tag === 'event').map((x) => `${WEEKDAY[isoWeekday(x.day)]}: event / eating out`),
  ];
  const pad = (label: string) => `${label}:`.padEnd(22);
  const lines = [
    `WEEK OF: ${d(ws)}          VARIANT RUNNING: V${variantRunning(sessions)}`,
    '',
    `WEIGHT (${readings.length} ${time === 'any' ? '' : `${time} `}reading${readings.length === 1 ? '' : 's'})`,
    `  ${readings.length ? readings.map((w) => `${WEEKDAY[isoWeekday(w.day)]}: ${Number(w.weight_kg).toFixed(1)}`).join('   ') : 'Day 1: ______   Day 2: ______   Day 3: ______'}`,
    `  Weekly average: ${week?.average != null ? `${week.average.toFixed(2)} kg${week.sufficient ? '' : ' (under 3 days)'}` : '______'}   Change from last week: ${week?.average != null && prev?.average ? `${signed(week.average - prev.average, 2)} kg` : '______'}`,
    '',
    'WAIST (fortnightly, navel, morning, relaxed)',
    `  ${waist ? `${Number(waist.waist_cm).toFixed(1)} cm (${dShort(waist.day)})` : '______ cm'}    Change: ${waist && waistPrev ? `${signed(Number(waist.waist_cm) - Number(waistPrev.waist_cm))} cm` : '______'}`,
    '',
    `TRAINING — sessions completed: ${adherence.completed} / ${adherence.eligible}${adherence.awayDays ? ` (${adherence.awayDays} away days)` : ''}`,
    '',
    'KEY LIFTS (working weight × reps)',
    ...s.key_lifts.map((g) => {
      const b = lifts.get(g.label);
      return `  ${pad(g.label)} ${b ? `${b.exercise} ${n1(b.weight)} kg × ${b.reps}` : '______'}`;
    }),
    '',
    'CARDIO',
    `  Incline sessions: ${sessions.filter((x) => x.cardio_done).length} / ${s.cardio_per_week}     Avg daily steps: ${steps.length ? n0(steps.reduce((a, x) => a + x.steps, 0) / steps.length) : '______'}`,
  ];
  if (input.sections.food && st) {
    lines.push(
      '',
      'NUTRITION (fully logged days)',
      `  Logged: ${st.tracked} / ${st.days - st.away - st.event} days   Avg: ${st.avgKcal === null ? '______' : `${n0(st.avgKcal)} kcal`}   Protein: ${st.avgProtein === null ? '______' : `${n1(st.avgProtein)} g`}`,
      `  Calories within ±10%: ${st.kcalOnTarget} / ${st.tracked}   Protein at minimum: ${st.proteinOk} / ${st.tracked}`,
    );
  }
  lines.push('', 'NOTES (energy, sleep, appetite, anything off)', ...(notes.length ? notes.map((x) => `  ${cell(x)}`) : ['  _________________________________']));
  return ['```', ...lines, '```'].join('\n');
}

function monthlyBlock(input: ReportInput, first: string, allWeeks: WeekAverage[], baseline: number | null, baselineDay: string | null): string {
  const f = input.fitness;
  const s = f.settings;
  const last = dayjs(first).endOf('month').format('YYYY-MM-DD');
  const asOf = last < input.today ? addDays(last, 1) : input.today;
  const weeks = allWeeks.filter((w) => w.weekStart >= first && w.weekStart <= last && w.average !== null);
  const avg = weeks.length ? weeks.reduce((a, w) => a + (w.average as number), 0) / weeks.length : null;
  const sufficient = weeks.filter((w) => w.sufficient && addDays(w.weekStart, 6) < asOf);
  const change = sufficient.length >= 2 ? (sufficient[sufficient.length - 1].average as number) - (sufficient[0].average as number) : null;
  const rate = gainRate(allWeeks.filter((w) => w.weekStart <= last), f.away, asOf);
  const waists = f.waists.filter((w) => !w.deleted_at && w.day >= first && w.day <= last).sort((a, b) => a.day.localeCompare(b.day));
  const r = rate?.kgPerMonth ?? null;
  const box = (on: boolean) => (on ? '[x]' : '[ ]');
  const lifts = bestLifts(f, first, last);
  const prevFirst = dayjs(first).subtract(1, 'month').format('YYYY-MM-DD');
  const before = bestLifts(f, prevFirst, addDays(first, -1));
  let up = 0;
  let compared = 0;
  for (const g of s.key_lifts) {
    const a = lifts.get(g.label);
    const b = before.get(g.label);
    if (!a || !b || a.exercise !== b.exercise) continue;
    compared++;
    if (a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps)) up++;
  }
  let completed = 0;
  let eligible = 0;
  for (let ws = weekStart(first); ws <= last; ws = addDays(ws, 7)) {
    for (let i = 0; i < 6; i++) {
      const day = addDays(ws, i);
      if (day < first || day > last || day > input.today) continue;
      if (isAway(day, f.away)) continue;
      eligible++;
      if (f.sessions.some((x) => x.day === day && x.completed)) completed++;
    }
  }
  const nut = input.nutrition;
  const monthDays = nut
    ? summariseDays({
        from: first,
        to: last < input.today ? last : input.today,
        entries: nut.entries,
        targetFor: (day) => activeTarget(nut.targets, day),
        isAway: (day) => isAway(day, f.away),
        isEvent: (day) => f.diet.some((x) => x.day === day && x.tag === 'event'),
      })
    : [];
  const st = monthDays.length ? periodStats(monthDays) : null;
  const lines = [
    `MONTH: ${dayjs(first).format('MMMM YYYY')}${last > input.today ? ` (to ${d(input.today)})` : ''}`,
    '',
    `BASELINE (${baselineDay ? d(baselineDay) : '______'}): ${kg(baseline)}`,
    `This month's avg weight:  ${avg === null ? '______' : `${avg.toFixed(2)} kg`}`,
    `Total change from baseline: ${avg !== null && baseline !== null ? `${signed(avg - baseline, 2)} kg` : '______'}`,
    `Change within the month (first → last full week): ${change === null ? '______' : `${signed(change, 2)} kg`}`,
    `Waist at start: ${waists.length ? `${Number(waists[0].waist_cm).toFixed(1)} cm` : '______'}    Waist now: ${waists.length ? `${Number(waists[waists.length - 1].waist_cm).toFixed(1)} cm` : '______'}`,
    '',
    `RATE CHECK${r === null ? ' (not enough weigh-ins for a rate)' : ` — measured ${signed(r, 2)} kg/month`}`,
    `  ${box(r !== null && r >= s.gain_low_kg_month && r <= s.gain_high_kg_month)} ~${s.gain_target_kg_month} kg gained → on track, change nothing`,
    `  ${box(r !== null && r > s.gain_high_kg_month)} >${s.gain_high_kg_month} kg gained → drop 100 kcal (fat first)`,
    `  ${box(r !== null && r < s.gain_low_kg_month)} <${s.gain_low_kg_month} kg gained → add 100 kcal (carbs)`,
    '',
    `STRENGTH — did key lifts increase?${compared ? ` (${up} of ${compared} comparable lifts up vs last month)` : ' (no comparable lifts logged in both months)'}`,
    `  ${box(compared > 0 && up * 2 > compared)} Yes, most lifts up → surplus is working`,
    `  ${box(compared > 0 && up * 2 <= compared)} Flat → check sleep, adherence, recovery`,
    '',
    'PHOTOS TAKEN IN NATURAL LIGHT?  [ ] Yes  [ ] No   (not tracked in the app)',
    '',
    'ADHERENCE',
    `  Sessions hit: ${completed} / ${eligible}    Days near target calories: ${st ? `${st.kcalOnTarget} / ${st.days}` : '___ / ___'}`,
  ];
  if (st) lines.push(`  Fully logged days: ${st.tracked}   Avg intake: ${st.avgKcal === null ? '______' : `${n0(st.avgKcal)} kcal, P ${n1(st.avgProtein ?? 0)} g`}`);
  return ['```', ...lines, '```'].join('\n');
}

/** "tracker-report-2026-10-01_to_2026-10-31.md" */
export const reportFileName = (from: string, to: string) => `tracker-report-${from}_to_${to}.md`;
