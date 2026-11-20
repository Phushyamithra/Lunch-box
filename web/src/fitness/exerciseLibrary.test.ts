import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, LIBRARY_EXERCISES } from './exerciseLibrary';
import { guessMuscle, swapGroups } from './muscles';

describe('exercise library', () => {
  it('maps every library exercise to its own muscle', () => {
    for (const [muscle, names] of Object.entries(EXERCISE_LIBRARY)) for (const n of names) expect(guessMuscle(n), n).toBe(muscle);
  });

  it('beats misleading keywords', () => {
    expect(guessMuscle('Reverse Pec Deck')).toBe('Shoulders');
    expect(guessMuscle('Nordic Curl')).toBe('Hamstrings');
    expect(guessMuscle('Hammer Strength High Row')).toBe('Back');
    expect(guessMuscle('machine cable crunch')).toBe('Abs');
    expect(guessMuscle('Pendulum Squat')).toBe('Quads');
  });

  it('has no duplicates and is offered A–Z', () => {
    expect(new Set(LIBRARY_EXERCISES.map((n) => n.toLowerCase())).size).toBe(LIBRARY_EXERCISES.length);
    expect(LIBRARY_EXERCISES).toEqual([...LIBRARY_EXERCISES].sort((a, b) => a.localeCompare(b)));
  });

  it('offers same-muscle machines as swaps', () => {
    const groups = swapGroups('Upper Chest', ['Incline DB Press', 'Incline Barbell'], [], [], new Map());
    const more = groups.find((g) => g.label === 'More Chest exercises');
    expect(more?.options).toContain('Incline Machine Chest Press');
    expect(more?.options).toContain('Decline Machine Chest Press');
    // Already offered as today's option, so not repeated.
    expect(more?.options).not.toContain('Incline DB Press');
  });
});
