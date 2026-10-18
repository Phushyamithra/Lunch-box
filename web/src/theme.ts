import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';

/**
 * Tracker palette: slate teal, butter cream, amber, brick and maroon, worn
 * two ways — iOS-style frosted glass for surfaces, and Material You tonal
 * "pop" for actions (pill buttons, tonal containers, pill nav indicators).
 *
 * Contrast is WCAG AA, checked against the worst case of each glass layer
 * over the background glow: body text ≥ 12:1, secondary text ≥ 6:1,
 * text on the amber CTA ≥ 6.4:1.
 */
export const PALETTE = {
  teal: '#335C67',
  cream: '#FFF3B0',
  amber: '#E09F3E',
  brick: '#9E2A2B',
  maroon: '#540B0E',
  // Derived tints/shades of the five above.
  creamLight: '#FFF8D4', // light-mode page
  amberLight: '#F0BE6E',
  amberDeep: '#C98330',
  night: '#1C0809', // dark-mode page (maroon, deepened)
  surface: '#2E1416', // dark-mode glass base
  /** Text on light fills (cream, amber, the CTA gradient). */
  ink: '#540B0E',
} as const;

/** Primary call-to-action fill; maroon text passes on every stop. */
export const CTA_GRADIENT = `linear-gradient(135deg, ${PALETTE.amberLight} 0%, ${PALETTE.amber} 100%)`;

export function createTrackerTheme(mode: ResolvedThemeMode): Theme {
  const dark = mode === 'dark';
  const glassFill = dark ? alpha(PALETTE.surface, 0.7) : alpha('#FFFFFF', 0.6);
  const glassBorder = dark ? alpha(PALETTE.cream, 0.1) : alpha('#FFFFFF', 0.8);
  const glassShadow = dark
    ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,243,176,0.06)'
    : '0 8px 32px rgba(84,11,14,0.08), inset 0 1px 0 rgba(255,255,255,0.9)';
  const tonal = dark ? alpha(PALETTE.brick, 0.45) : '#FBE3BC';
  const onTonal = dark ? PALETTE.cream : PALETTE.maroon;

  const theme = createTheme({
    palette: dark
      ? {
          mode,
          primary: { main: PALETTE.amber, contrastText: PALETTE.maroon },
          secondary: { main: '#E07A6E', contrastText: PALETTE.night },
          error: { main: '#F2A7A0' },
          warning: { main: PALETTE.amberLight },
          success: { main: '#9CC5A1' },
          info: { main: '#8FB8C2' },
          background: { default: PALETTE.night, paper: PALETTE.surface },
          text: { primary: PALETTE.cream, secondary: '#BBAC7E' },
          divider: alpha(PALETTE.cream, 0.1),
        }
      : {
          mode,
          primary: { main: PALETTE.teal, contrastText: PALETTE.cream },
          secondary: { main: PALETTE.brick, contrastText: '#FFFFFF' },
          error: { main: PALETTE.brick },
          warning: { main: '#8A5A12' },
          success: { main: '#3E6B4A' },
          info: { main: PALETTE.teal },
          background: { default: PALETTE.creamLight, paper: '#FFFBEA' },
          text: { primary: PALETTE.maroon, secondary: PALETTE.teal },
          divider: alpha(PALETTE.maroon, 0.1),
        },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      h5: { fontWeight: 700, letterSpacing: -0.3 },
      h6: { fontWeight: 700, letterSpacing: -0.2 },
      subtitle1: { fontWeight: 650 },
      subtitle2: { fontWeight: 650 },
      button: { textTransform: 'none', fontWeight: 650 },
    },
  });

  return createTheme(theme, {
    tracker: { tonal, onTonal, glassFill, glassBorder },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Soft colour glow behind the glass. A fixed layer (not
          // background-attachment) so it also stays put on iOS Safari.
          'body::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background: dark
              ? `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.teal, 0.45)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.brick, 0.35)}, transparent 60%),
                 ${PALETTE.night}`
              : `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.amber, 0.38)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.teal, 0.2)}, transparent 60%),
                 ${PALETTE.creamLight}`,
          },
          body: { backgroundColor: 'transparent' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: glassFill,
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            // Solid fallback where blur is unsupported or unwanted.
            '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
              backgroundColor: dark ? PALETTE.surface : '#FFFBEA',
            },
            '@media (prefers-reduced-transparency: reduce)': {
              backgroundColor: dark ? PALETTE.surface : '#FFFBEA',
              backdropFilter: 'none',
            },
          },
          rounded: { borderRadius: 22 },
          outlined: { borderColor: glassBorder, boxShadow: glassShadow },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 28 } },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 14, backdropFilter: 'none', WebkitBackdropFilter: 'none' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? alpha(PALETTE.night, 0.55) : alpha(PALETTE.creamLight, 0.55),
            borderRadius: 0,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 20 },
          containedPrimary: {
            background: CTA_GRADIENT,
            color: PALETTE.maroon,
            boxShadow: `0 6px 18px ${alpha(PALETTE.amber, dark ? 0.25 : 0.45)}`,
            '&:hover': { background: CTA_GRADIENT, filter: 'brightness(1.04)' },
            '&.Mui-disabled': { background: alpha(PALETTE.amber, 0.35), color: alpha(PALETTE.maroon, 0.6) },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 600 },
          colorSecondary: { backgroundColor: tonal, color: onTonal },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { borderRadius: 999, gap: 4, padding: 4, backgroundColor: alpha(dark ? '#000' : '#fff', 0.2) } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 650,
            border: 0,
            borderRadius: '999px !important',
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: tonal, color: onTonal },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: tonal, color: onTonal },
            '&.Mui-selected .MuiListItemIcon-root': { color: onTonal },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 10, borderRadius: 999, backgroundColor: alpha(dark ? PALETTE.cream : PALETTE.maroon, 0.1) },
          bar: { borderRadius: 999 },
          barColorSecondary: { background: CTA_GRADIENT },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 14, backgroundColor: alpha(dark ? '#000' : '#fff', dark ? 0.15 : 0.5) },
        },
      },
    },
  });
}

declare module '@mui/material/styles' {
  interface Theme {
    tracker: { tonal: string; onTonal: string; glassFill: string; glassBorder: string };
  }
  interface ThemeOptions {
    tracker?: { tonal: string; onTonal: string; glassFill: string; glassBorder: string };
  }
}
