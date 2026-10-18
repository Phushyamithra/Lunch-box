import { describe, expect, it } from 'vitest';
import { activeNavPath } from './navItems';

describe('activeNavPath', () => {
  it('maps module routes, including nested ones, to their nav item', () => {
    expect(activeNavPath('/')).toBe('/');
    expect(activeNavPath('/food')).toBe('/food');
    expect(activeNavPath('/fitness/history')).toBe('/fitness');
  });

  it('highlights nothing for pages outside the main nav', () => {
    expect(activeNavPath('/settings')).toBeNull();
    expect(activeNavPath('/foodie')).toBeNull();
  });
});
