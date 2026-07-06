/** Collision-safe id with a readable prefix, e.g. "meal_9f3a2c1b". */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
}
