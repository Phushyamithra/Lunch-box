import { describe, expect, it } from 'vitest';
import type { CategoryRow } from './foodApi';
import { validateCategory } from './CategoriesPage';

const existing = [{ id: 'c1', name: 'Salad' }] as CategoryRow[];

describe('validateCategory', () => {
  it('trims input and defaults the emoji', () => {
    expect(validateCategory({ name: '  Ice Cream ', icon: ' ', color: '#F59E0B' }, existing)).toEqual({
      name: 'Ice Cream',
      icon: '🍽️',
      color: '#F59E0B',
    });
  });

  it('rejects blank and duplicate names (case-insensitive), but allows renaming itself', () => {
    expect(validateCategory({ name: '', icon: '', color: '#000' }, existing)).toMatch(/name/);
    expect(validateCategory({ name: 'salad', icon: '', color: '#000' }, existing)).toMatch(/already exists/);
    expect(typeof validateCategory({ name: 'SALAD', icon: '🥗', color: '#000' }, existing, 'c1')).toBe('object');
  });
});
