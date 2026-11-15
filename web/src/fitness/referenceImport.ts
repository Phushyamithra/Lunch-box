/**
 * Parses the "Daily Reference" markdown (training split, variant banks,
 * finishers, snapshot) into program data. Pure and forgiving: anything it
 * can't read is reported, never guessed.
 */

export interface ParsedSlot {
  weekday: number; // Mon = 1 … Sat = 6, or the cycle day (Upper = 1 … Legs = 5)
  slot: number; // 1–6
  label: string; // target, e.g. "Mid Chest"
  sets: number;
  variants: string[]; // 7 entries, "Default / Fallback"
}

export interface ParsedFinisher {
  name: string; // "Abs"
  days: number[];
  exercises: { name: string; sets: number; reps: string }[];
}

export interface ParsedReference {
  dayFocus: Record<string, string>;
  slots: ParsedSlot[];
  finishers: ParsedFinisher[];
  baselineDate: string | null; // YYYY-MM-DD
  stepsTarget: number | null;
  phaseMonths: number | null;
  /** "DAY 1 — UPPER" headings: days run in order, not on weekdays. */
  cycle: boolean;
  warnings: string[];
}

const WEEKDAYS: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const SHORT_DAYS: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const CYCLE_NAMES: Record<string, number> = { upper: 1, lower: 2, push: 3, pull: 4, legs: 5 };
/** "(8–12 reps, technique focus …)" is a note, not part of the name; "(bench-rigged)" stays. */
const tidyVariant = (s: string): string => s.replace(/\s*\(([^)]*\d[^)]*|[^)]{24,})\)/g, '').trim();
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const stripMd = (s: string): string => s.replace(/\*\*|__|\*|`/g, '').trim();
const cells = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(stripMd);
const isTableRow = (line: string): boolean => /^\s*\|/.test(line) && !/^\s*\|[\s|:-]+\|\s*$/.test(line);
const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s+(/—-])(\w)/g, (_, p: string, c: string) => p + c.toUpperCase());

function parseDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function parseReference(markdown: string): ParsedReference {
  const lines = markdown.split(/\r?\n/);
  const warnings: string[] = [];
  const dayFocus: Record<string, string> = {};
  const slotMap = new Map<string, ParsedSlot>();
  const finishers: ParsedFinisher[] = [];
  let baselineDate: string | null = null;
  let stepsTarget: number | null = null;
  let phaseMonths: number | null = null;
  let cycle = false;

  let day: number | null = null;
  let mode: 'slots' | 'variants' | 'finisher' | 'rotation' | null = null;
  let finisher: ParsedFinisher | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    // Snapshot rows: "| **Baseline** | 17 Sept 2026 morning weight …"
    if (isTableRow(line)) {
      const [key = '', value = ''] = cells(line);
      const k = key.toLowerCase();
      if (k === 'baseline' && !baselineDate) baselineDate = parseDate(value);
      if (k === 'steps' && stepsTarget === null) {
        const m = value.match(/(\d+(?:\.\d+)?)\s*(k)?/i);
        if (m) stepsTarget = Math.round(Number(m[1]) * (m[2] ? 1000 : 1));
      }
      if (k === 'phase' && phaseMonths === null) {
        const m = value.match(/(\d+)\s*[–-]\s*(\d+)\s*months?/i) ?? value.match(/(\d+)\s*months?/i);
        if (m) phaseMonths = Math.round(m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]));
      }
    }

    // "## DAY 1 — UPPER": a rotating cycle.
    const cycleHead = line.match(/^##\s+DAY\s+(\d)\s*[—–-]\s*(.+)$/i);
    if (cycleHead && Number(cycleHead[1]) >= 1 && Number(cycleHead[1]) <= 5) {
      cycle = true;
      day = Number(cycleHead[1]);
      if (!dayFocus[String(day)]) dayFocus[String(day)] = titleCase(stripMd(cycleHead[2]));
      mode = null;
      finisher = null;
      continue;
    }
    // "## MONDAY — CHEST + TRICEPS"
    const dayHead = line.match(/^##\s+([A-Za-z]+)\s*[—–-]\s*(.+)$/);
    if (dayHead && WEEKDAYS[dayHead[1].toLowerCase()]) {
      day = WEEKDAYS[dayHead[1].toLowerCase()];
      dayFocus[String(day)] = titleCase(stripMd(dayHead[2]).replace(/^legs:\s*/i, 'Legs — '));
      mode = null;
      finisher = null;
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      // Any other top-level heading ends a day or finisher block.
      day = null;
      mode = null;
      finisher = null;
      continue;
    }
    // Prose after a finisher's table ends that finisher.
    if (mode === 'finisher' && finisher?.exercises.length && line && !isTableRow(line) && !/^\|/.test(line)) {
      mode = null;
      finisher = null;
    }

    // "### Abs — Mon / Wed / Fri (~8 sets…)"
    const finHead = line.match(/^###\s+([^—–-]+?)\s*[—–-]\s*([A-Za-z /,]+)/);
    if (finHead) {
      const days = finHead[2]
        .split(/[\s/,]+/)
        .map((d) => CYCLE_NAMES[d.toLowerCase()] ?? SHORT_DAYS[d.toLowerCase().slice(0, 3)])
        .filter((d): d is number => Boolean(d) && d <= 6);
      if (days.length) {
        finisher = { name: titleCase(stripMd(finHead[1])), days, exercises: [] };
        finishers.push(finisher);
        mode = 'finisher';
        day = null;
        continue;
      }
    }

    if (!isTableRow(line)) continue;
    const row = cells(line);
    const header = row.map((c) => c.toLowerCase());

    if (header[0] === '#' && header[1] === 'target') {
      mode = 'slots';
      continue;
    }
    if (header[0] === '#' && header[1] === 'v1') {
      mode = 'variants';
      continue;
    }
    if (mode === 'finisher' && header[0] === 'exercise') continue;
    // "| Order | Day | Focus | Sets | Finisher |": names the cycle days.
    if (header[0] === 'order' && header[1] === 'day') {
      mode = 'rotation';
      continue;
    }
    if (mode === 'rotation' && !day && /^\d$/.test(row[0])) {
      const n = Number(row[0]);
      const name = (row[1] ?? '').trim();
      const focus = (row[2] ?? '').replace(/\s*\([^)]*\)/g, '').trim();
      if (n >= 1 && n <= 5 && name) dayFocus[String(n)] = focus ? `${name} — ${focus}` : name;
      continue;
    }

    if (day && (mode === 'slots' || mode === 'variants') && /^\d$/.test(row[0])) {
      const slot = Number(row[0]);
      if (slot < 1 || slot > 6) continue;
      const key = `${day}-${slot}`;
      const current = slotMap.get(key) ?? { weekday: day, slot, label: '', sets: 3, variants: ['', '', '', '', '', '', ''] };
      if (mode === 'slots') {
        current.label = row[1] ?? '';
        const sets = Number(row[2]);
        if (Number.isFinite(sets) && sets >= 1 && sets <= 6) current.sets = sets;
      } else {
        current.variants = Array.from({ length: 7 }, (_, i) => tidyVariant(row[i + 1] ?? ''));
        if (row.length < 7) warnings.push(`Day ${day} slot ${slot}: fewer than 6 variants found.`);
      }
      slotMap.set(key, current);
      continue;
    }

    if (mode === 'finisher' && finisher && row.length >= 3 && row[0] && !/^-+$/.test(row[0])) {
      const sets = Number(row[1]);
      finisher.exercises.push({ name: row[0].replace(/\s*\(.*\)\s*$/, ''), sets: Number.isFinite(sets) && sets > 0 ? sets : 2, reps: row[2] });
    }
  }

  const slots = [...slotMap.values()].sort((a, b) => a.weekday - b.weekday || a.slot - b.slot);
  for (let d = 1; d <= (cycle ? 5 : 6); d += 1) {
    const count = slots.filter((s) => s.weekday === d).length;
    if (count && count < 5) warnings.push(`Day ${d}: only ${count} slot${count === 1 ? '' : 's'} found.`);
    if (!count) warnings.push(`No slots found for day ${d}.`);
  }
  for (const s of slots) if (s.variants.every((v) => !v)) warnings.push(`Day ${s.weekday} slot ${s.slot}: no variants found.`);

  return { dayFocus, slots, finishers, baselineDate, stepsTarget, phaseMonths, cycle, warnings };
}

/** "Barbell Bench / DB Bench" → ["Barbell Bench", "DB Bench"]: default first, then fallbacks. */
export function exerciseOptions(variant: string): string[] {
  return variant
    .split(/\s+\/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Key-lift groups from the reference brief, matched against your own exercise names. */
const KEY_LIFT_RULES: { label: string; include: RegExp; exclude?: RegExp }[] = [
  { label: 'Bench / chest press', include: /bench|chest press|flat barbell|flat db press/i, exclude: /incline|decline|close-grip|dips/i },
  // Main heavy pulls only; accessory rows would crowd the chart.
  { label: 'Row / pulldown', include: /barbell row|bent-over|t-bar|lat pulldown/i, exclude: /close-grip|db bent/i },
  { label: 'Squat / leg press', include: /squat|leg press/i, exclude: /goblet|sumo|split|smith/i },
  { label: 'Shoulder press', include: /shoulder press|military|arnold/i },
  { label: 'Romanian deadlift', include: /romanian/i, exclude: /single-leg/i },
];

export function deriveKeyLifts(slots: ParsedSlot[]): { label: string; exercises: string[] }[] {
  const names = [...new Set(slots.flatMap((s) => s.variants.flatMap(exerciseOptions)))];
  return KEY_LIFT_RULES.map((rule) => ({
    label: rule.label,
    exercises: names.filter((n) => rule.include.test(n) && !(rule.exclude?.test(n) ?? false)).sort(),
  })).filter((g) => g.exercises.length > 0);
}
