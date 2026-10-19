import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, buildBackup, entriesToCsv, foodsToCsv, parseBackup, parseCsv, parseCsvImport, parseImportFile, planImport, type ParsedImport } from './backup';
import { LEAN_BULK_PRESET } from './engine';
import type { Entry, Food } from './foodLog';
import type { NutritionData, TargetRow } from './nutritionApi';

const food = (over: Partial<Food>): Food => ({
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u',
  name: 'Paneer bhurji',
  brand: null,
  diet: 'veg',
  basis: '100g',
  serving_g: 150,
  portions: [{ label: '1 katori', grams: 150 }],
  kcal: 250,
  protein: 14,
  carbs: 6,
  fat: 19,
  fibre: 1,
  sugar: null,
  sodium_mg: 300,
  source: 'user',
  verification: 'user',
  parent_food_id: null,
  source_url: null,
  archived_at: null,
  barcode: null,
  ...over,
});
const entry = (over: Partial<Entry>): Entry => ({
  id: '22222222-2222-4222-8222-222222222222',
  day: '2026-10-18',
  meal: 'lunch',
  food_id: null,
  meal_log_id: null,
  source: 'quick',
  name: 'Dal, rice',
  quantity: 1,
  unit: 'serving',
  grams: null,
  verification: 'user',
  logged_at: '2026-10-18T07:30:00.000Z',
  deleted_at: null,
  kcal: 520,
  protein: 18,
  carbs: 90,
  fat: 9,
  fibre: 7,
  sugar: null,
  sodium_mg: null,
  ...over,
});
const target: TargetRow = {
  ...LEAN_BULK_PRESET,
  id: '33333333-3333-4333-8333-333333333333',
  effective_from: '2026-10-01',
  mode: 'lean_bulk',
  rate_kg_month: 0.4,
  reason: 'Preset',
  inputs: {},
  created_at: '2026-10-01T00:00:00Z',
};
const shared = food({ id: '44444444-4444-4444-8444-444444444444', user_id: null, name: 'Idli', ref_code: 'D001' });

const data = (over: Partial<NutritionData> = {}): NutritionData => ({
  profile: { sex: 'male', birth_year: 1998, height_cm: 175, activity: 'moderate' },
  targets: [target],
  foods: [food({}), shared],
  entries: [entry({}), entry({ id: '55555555-5555-4555-8555-555555555555', name: 'Idli', food_id: shared.id, deleted_at: '2026-10-18T09:00:00Z' })],
  ...over,
});

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const ok = (p: ParsedImport | { fatal: string }): ParsedImport => {
  if ('fatal' in p) throw new Error(p.fatal);
  return p;
};

describe('JSON backup', () => {
  it('holds your data only, versioned', () => {
    const b = buildBackup(data(), new Date('2026-10-19T10:00:00Z'));
    expect(b).toMatchObject({ schema: 'tracker.nutrition', version: BACKUP_VERSION, exported_at: '2026-10-19T10:00:00.000Z' });
    expect(b.foods.map((f) => f.name)).toEqual(['Paneer bhurji']); // shared catalog not copied
    expect(b.entries).toHaveLength(1); // deleted entry left out
    expect(b.targets).toHaveLength(1);
  });

  it('round-trips without loss', () => {
    const b = buildBackup(data());
    const back = ok(parseBackup(JSON.stringify(b)));
    expect(back.errors).toEqual([]);
    expect(back.foods[0]).toMatchObject({ name: 'Paneer bhurji', portions: [{ label: '1 katori', grams: 150 }], sodium_mg: 300 });
    expect(back.entries[0]).toMatchObject({ day: '2026-10-18', kcal: 520, logged_at: '2026-10-18T07:30:00.000Z' });
    expect(back.profile).toEqual(data().profile);
  });

  it('restoring into the same account adds nothing', () => {
    const plan = planImport(data(), ok(parseBackup(JSON.stringify(buildBackup(data())))), newId);
    expect(plan.foods).toEqual([]);
    expect(plan.entries).toEqual([]);
    expect(plan.targets).toEqual([]);
    expect(plan.profile).toBeNull();
    expect(plan.duplicates).toEqual({ foods: 1, entries: 1, targets: 1 });
  });

  it('restoring into an empty account recreates everything with fresh ids and links', () => {
    const src = data({
      foods: [food({}), food({ id: '66666666-6666-4666-8666-666666666666', name: 'Paneer bhurji (less oil)', parent_food_id: '11111111-1111-4111-8111-111111111111', kcal: 210 }), shared],
      entries: [entry({ food_id: '66666666-6666-4666-8666-666666666666', source: 'food' }), entry({ id: '77777777-7777-4777-8777-777777777777', meal: 'dinner', name: 'Idli', food_id: shared.id })],
    });
    const empty: NutritionData = { profile: null, targets: [], foods: [shared], entries: [] };
    const plan = planImport(empty, ok(parseBackup(JSON.stringify(buildBackup(src)))), newId);
    expect(plan.foods).toHaveLength(2);
    const [orig, copy] = plan.foods;
    expect(orig.name).toBe('Paneer bhurji'); // parent first
    expect(copy.parent_food_id).toBe(orig.id);
    expect(plan.entries[0].food_id).toBe(copy.id);
    expect(plan.entries[1].food_id).toBe(shared.id); // shared food still exists → kept
    expect(plan.profile).toEqual(src.profile);
    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].id).not.toBe(target.id);
  });

  it('drops links it cannot keep, but never the logged nutrients', () => {
    const src = data({ foods: [shared], entries: [entry({ food_id: shared.id, meal_log_id: '88888888-8888-4888-8888-888888888888', source: 'meal_prep' })] });
    const plan = planImport({ profile: null, targets: [], foods: [], entries: [] }, ok(parseBackup(JSON.stringify(buildBackup(src)))), newId);
    expect(plan.entries[0]).toMatchObject({ food_id: null, meal_log_id: null, kcal: 520 });
    expect(plan.notes.join(' ')).toMatch(/keeps its logged nutrients/);
    expect(plan.notes.join(' ')).toMatch(/meal-prep/);
  });

  it('keeps your profile when the file has a different one', () => {
    const b = { ...buildBackup(data()), profile: { sex: 'male', birth_year: 1998, height_cm: 180, activity: 'light' } };
    const plan = planImport(data(), ok(parseBackup(JSON.stringify(b))), newId);
    expect(plan.profile).toBeNull();
    expect(plan.profileKept).toBe(true);
  });

  it('refuses other files and newer formats clearly', () => {
    expect(parseBackup('not json')).toEqual({ fatal: 'This file isn’t valid JSON.' });
    expect(parseBackup('{"a":1}')).toMatchObject({ fatal: expect.stringContaining('isn’t a Tracker') });
    expect(parseBackup(JSON.stringify({ schema: 'tracker.nutrition', version: 99 }))).toMatchObject({ fatal: expect.stringContaining('newer version') });
  });

  it('lists bad rows and keeps the good ones', () => {
    const b = buildBackup(data());
    const bad = { ...b, entries: [...b.entries, { ...b.entries[0], day: '2026-02-30' }, { ...b.entries[0], kcal: -5 }] };
    const p = ok(parseBackup(JSON.stringify(bad)));
    expect(p.entries).toHaveLength(1);
    expect(p.errors.map((e) => e.where)).toEqual(['Log entry 2', 'Log entry 3']);
    expect(p.errors[1].message).toMatch(/negative/);
  });
});

describe('CSV', () => {
  it('parses quotes, commas, newlines and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('food log round-trips, and guards against spreadsheet formulas', () => {
    const csv = entriesToCsv([entry({ name: '=HYPERLINK("x")' }), entry({ id: '99999999-9999-4999-8999-999999999999', name: 'Chai, 1 cup', day: '2026-10-17' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    const p = ok(parseCsvImport(csv));
    expect(p.kind).toBe('log_csv');
    expect(p.entries.map((e) => [e.day, e.name])).toEqual([
      ['2026-10-17', 'Chai, 1 cup'],
      ['2026-10-18', '=HYPERLINK("x")'],
    ]);
  });

  it('foods round-trip with portions', () => {
    const p = ok(parseCsvImport(foodsToCsv([food({}), shared])));
    expect(p.kind).toBe('foods_csv');
    expect(p.foods).toHaveLength(1);
    expect(p.foods[0]).toMatchObject({ name: 'Paneer bhurji', portions: [{ label: '1 katori', grams: 150 }], serving_g: 150 });
  });

  it('reads a hand-made sheet with friendly headers', () => {
    const p = ok(parseImportFile('my log.csv', 'Date,Meal,Food,Qty,Calories,Protein (g),Carbs,Fat,Fiber\n2026-10-19,Breakfast,Poha,1,270,5,48,7,2\n2026-10-19,brunch,Upma,1,250,6,40,8,3\n19/10/2026,lunch,Rice,1,200,4,44,0,1\n'));
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ meal: 'breakfast', name: 'Poha', kcal: 270, protein: 5, fibre: 2, unit: 'serving', source: 'quick' });
    expect(p.errors).toEqual([
      { where: 'Row 3', message: expect.stringContaining('meal must be one of') },
      { where: 'Row 4', message: expect.stringContaining('day must be a date') },
    ]);
  });

  it('skips rows already in your log and repeats within the file', () => {
    const csv = entriesToCsv([entry({}), entry({ id: '' })]).replace(/22222222-2222-4222-8222-222222222222/g, '');
    const plan = planImport(data(), ok(parseCsvImport(csv)), newId);
    expect(plan.entries).toHaveLength(0);
    expect(plan.duplicates.entries).toBe(2);
  });

  it('says what it can’t read', () => {
    expect(parseCsvImport('x,y\n1,2')).toMatchObject({ fatal: expect.stringContaining('Couldn’t tell') });
    expect(parseCsvImport('day,meal,name,kcal\n')).toMatchObject({ fatal: expect.stringContaining('no rows') });
  });

  it('checks foods with the same rules as the food form', () => {
    const p = ok(parseCsvImport('name,basis,kcal,protein,carbs,fat\nOil,100g,900,0,0,100\nWeird,100g,100,60,60,0\n'));
    expect(p.foods.map((f) => f.name)).toEqual(['Oil']);
    expect(p.errors[0]).toMatchObject({ where: 'Row 3 (Weird)', message: expect.stringContaining('can’t exceed 100 g') });
  });
});
