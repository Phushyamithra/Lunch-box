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
  { path: '/', label: 'Home', icon: <HomeRoundedIcon />, tint: { from: '#FFF4E0', to: '#FFBF9B', ink: '#2E2C2B' } },
  { path: '/food', label: 'Food', icon: <RestaurantRoundedIcon />, tint: { from: '#FFBF9B', to: '#E89A86', ink: '#2E2C2B' } },
  { path: '/fitness', label: 'Fitness', icon: <FitnessCenterRoundedIcon />, tint: { from: '#B46060', to: '#8F4545', ink: '#FFFFFF' } },
  { path: '/finance', label: 'Finance', icon: <AccountBalanceWalletRoundedIcon />, tint: { from: '#6B6B6B', to: '#4D4D4D', ink: '#FFF4E0' } },
  { path: '/goals', label: 'Goals', icon: <EmojiEventsRoundedIcon />, tint: { from: '#FFE3D3', to: '#E89A86', ink: '#2E2C2B' } },
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
