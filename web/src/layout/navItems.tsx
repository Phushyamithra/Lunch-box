import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import type { ReactElement } from 'react';
import type { IconTint } from './GlassIcon';

export interface NavItem {
  path: string;
  label: string;
  icon: ReactElement;
  /** Module colour for its glass icon tile (glyph ≥ 3:1 on both stops). */
  tint: IconTint;
}

/** Primary destinations — bottom bar on phones, side rail on laptops. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeRoundedIcon />, tint: { from: '#FFF3B0', to: '#F0BE6E', ink: '#540B0E' } },
  { path: '/food', label: 'Food', icon: <RestaurantRoundedIcon />, tint: { from: '#E09F3E', to: '#C98330', ink: '#540B0E' } },
  { path: '/fitness', label: 'Fitness', icon: <FitnessCenterRoundedIcon />, tint: { from: '#9E2A2B', to: '#540B0E', ink: '#FFF3B0' } },
  { path: '/finance', label: 'Finance', icon: <AccountBalanceWalletRoundedIcon />, tint: { from: '#4A7A86', to: '#335C67', ink: '#FFF3B0' } },
  { path: '/goals', label: 'Goals', icon: <EmojiEventsRoundedIcon />, tint: { from: '#335C67', to: '#540B0E', ink: '#FFF3B0' } },
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
