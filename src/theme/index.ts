import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../models';

/**
 * Material You–inspired theme: expressive rounded shapes, tonal
 * surfaces, pill buttons and soft elevation in both color schemes.
 */
export function createAppTheme(mode: ResolvedThemeMode): Theme {
  const isDark = mode === 'dark';

  const primary = isDark ? '#D0BCFF' : '#6750A4';
  const secondary = isDark ? '#CCC2DC' : '#625B71';

  return createTheme({
    palette: {
      mode,
      primary: { main: primary },
      secondary: { main: secondary },
      success: { main: isDark ? '#7DD491' : '#2E7D32' },
      error: { main: isDark ? '#F2B8B5' : '#B3261E' },
      background: isDark
        ? { default: '#141218', paper: '#1D1B20' }
        : { default: '#FDF7FF', paper: '#FFFFFF' },
      divider: isDark ? alpha('#CAC4D0', 0.16) : alpha('#79747E', 0.16),
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily:
        "'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      h5: { fontWeight: 800, letterSpacing: -0.4 },
      h6: { fontWeight: 700, letterSpacing: -0.2 },
      subtitle2: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 20 },
        },
        defaultProps: { disableElevation: true },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 18, // M3 FABs are rounded squares
            boxShadow: isDark
              ? '0 6px 18px rgba(0,0,0,0.45)'
              : '0 6px 18px rgba(103,80,164,0.35)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: { rounded: { borderRadius: 20 } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 28,
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, borderRadius: 10 } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 } },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { borderRadius: 8 } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 14 } },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 14 } },
      },
    },
  });
}
