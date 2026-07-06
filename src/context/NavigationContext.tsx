import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Page = 'dashboard' | 'meals' | 'settings';

interface NavigationValue {
  page: Page;
  navigate: (page: Page) => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

/**
 * Tiny in-memory router — three pages don't warrant react-router, and a
 * MemoryRouter-style approach keeps the extension bundle lean. Swap for a
 * real router if the page count grows.
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('dashboard');
  const navigate = useCallback((next: Page) => setPage(next), []);
  const value = useMemo(() => ({ page, navigate }), [page, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
