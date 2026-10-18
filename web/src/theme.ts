import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';

/**
 * Tracker palette: cream, peach, rose and charcoal. Contrast is checked
 * against WCAG AA. Rose (#B46060) is only 4.0:1 on cream, so it is used
 * as an accent fill, never for body text; charcoal carries primary
 * actions in light mode and peach in dark mode.
 */
export const PALETTE = {
  cream: '#FFF4E0',
  peach: '#FFBF9B',
  rose: '#B46060',
  charcoal: '#4D4D4D',
  /** Darker warm charcoal for the dark-mode page background. */
  ink: '#2E2C2B',
  /** Dark-mode surface, between ink and charcoal. */
  surface: '#3A3736',
} as const;

export function createTrackerTheme(mode: ResolvedThemeMode): Theme {
  const dark = mode === 'dark';
  return createTheme({
    palette: dark
      ? {
          mode,
          primary: { main: PALETTE.peach, contrastText: PALETTE.ink }, // 8.7:1
          secondary: { main: '#D98A8A', contrastText: PALETTE.ink }, // rose, lifted for dark
          error: { main: '#F2A7A0' },
          warning: { main: '#E8C07D' },
          success: { main: '#9CC5A1' },
          background: { default: PALETTE.ink, paper: PALETTE.surface },
          text: { primary: PALETTE.cream, secondary: '#BDB3A6' }, // 12.8:1 / 6.7:1
          divider: alpha(PALETTE.cream, 0.12),
        }
      : {
          mode,
          primary: { main: PALETTE.charcoal, contrastText: PALETTE.cream }, // 7.8:1
          secondary: { main: PALETTE.rose, contrastText: '#FFFFFF' },
          error: { main: '#9A3B3B' },
          warning: { main: '#9A6A1F' },
          success: { main: '#4F7A53' },
          background: { default: PALETTE.cream, paper: '#FFFBF4' },
          text: { primary: PALETTE.charcoal, secondary: '#6B6B6B' }, // 7.8:1 / 4.9:1
          divider: alpha(PALETTE.charcoal, 0.14),
        },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10 } },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 10,
            '&.Mui-selected': {
              backgroundColor: alpha(theme.palette.secondary.main, dark ? 0.22 : 0.14),
            },
          }),
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&.Mui-selected': { color: dark ? theme.palette.primary.main : theme.palette.secondary.dark },
          }),
        },
      },
    },
  });
}
