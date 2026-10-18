import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import type { ReactElement } from 'react';

export interface NavItem {
  path: string;
  label: string;
  icon: ReactElement;
}

/** Primary destinations — bottom bar on phones, side rail on laptops. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeRoundedIcon /> },
  { path: '/food', label: 'Food', icon: <RestaurantRoundedIcon /> },
  { path: '/fitness', label: 'Fitness', icon: <FitnessCenterRoundedIcon /> },
  { path: '/finance', label: 'Finance', icon: <AccountBalanceWalletRoundedIcon /> },
  { path: '/goals', label: 'Goals', icon: <EmojiEventsRoundedIcon /> },
];

/**
 * The nav item that owns a URL path (nested routes map to their module);
 * null for pages outside the primary nav, such as Settings.
 */
export function activeNavPath(pathname: string): string | null {
  if (pathname === '/') return '/';
  const match = NAV_ITEMS.filter((item) => item.path !== '/').find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  return match?.path ?? null;
}
