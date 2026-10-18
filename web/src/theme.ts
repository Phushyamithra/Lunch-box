import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';

/**
 * Tracker palette: cream, peach, rose and charcoal, worn two ways —
 * iOS-style frosted glass for surfaces, and Material You tonal "pop" for
 * actions (pill buttons, tonal containers, pill nav indicators).
 *
 * Contrast is WCAG AA, checked against the worst case of each glass layer
 * over the background glow: body text ≥ 7:1, secondary text ≥ 4.7:1.
 * Rose (#B46060) is never used for text on cream (4.0:1).
 */
export const PALETTE = {
  cream: '#FFF4E0',
  peach: '#FFBF9B',
  rose: '#B46060',
  charcoal: '#4D4D4D',
  ink: '#2E2C2B', // dark-mode page
  surface: '#3A3736', // dark-mode glass base
  coral: '#E89A86', // peach→rose midpoint for gradients (ink text 6.2:1)
  roseDeep: '#7A3434', // rose text on light tonal containers (7.2:1)
} as const;

/** Primary call-to-action fill; ink text passes on every stop. */
export const CTA_GRADIENT = `linear-gradient(135deg, ${PALETTE.peach} 0%, ${PALETTE.coral} 100%)`;

export function createTrackerTheme(mode: ResolvedThemeMode): Theme {
  const dark = mode === 'dark';
  const glassFill = dark ? alpha(PALETTE.surface, 0.7) : alpha('#FFFFFF', 0.6);
  const glassBorder = dark ? alpha(PALETTE.cream, 0.1) : alpha('#FFFFFF', 0.75);
  const glassShadow = dark
    ? '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,244,224,0.06)'
    : '0 8px 32px rgba(122,52,52,0.08), inset 0 1px 0 rgba(255,255,255,0.9)';
  const tonal = dark ? alpha(PALETTE.rose, 0.38) : '#FFE3D3';
  const onTonal = dark ? PALETTE.cream : PALETTE.roseDeep;

  const theme = createTheme({
    palette: dark
      ? {
          mode,
          primary: { main: PALETTE.peach, contrastText: PALETTE.ink },
          secondary: { main: '#D98A8A', contrastText: PALETTE.ink },
          error: { main: '#F2A7A0' },
          warning: { main: '#E8C07D' },
          success: { main: '#9CC5A1' },
          background: { default: PALETTE.ink, paper: PALETTE.surface },
          text: { primary: PALETTE.cream, secondary: '#BDB3A6' },
          divider: alpha(PALETTE.cream, 0.1),
        }
      : {
          mode,
          primary: { main: PALETTE.charcoal, contrastText: PALETTE.cream },
          secondary: { main: PALETTE.rose, contrastText: '#FFFFFF' },
          error: { main: '#9A3B3B' },
          warning: { main: '#9A6A1F' },
          success: { main: '#4F7A53' },
          background: { default: PALETTE.cream, paper: '#FFFBF4' },
          text: { primary: PALETTE.charcoal, secondary: '#6B6B6B' },
          divider: alpha(PALETTE.charcoal, 0.1),
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
              ? `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.rose, 0.35)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.peach, 0.16)}, transparent 60%),
                 ${PALETTE.ink}`
              : `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.peach, 0.55)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.rose, 0.18)}, transparent 60%),
                 ${PALETTE.cream}`,
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
              backgroundColor: dark ? PALETTE.surface : '#FFFBF4',
            },
            '@media (prefers-reduced-transparency: reduce)': {
              backgroundColor: dark ? PALETTE.surface : '#FFFBF4',
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
            backgroundColor: dark ? alpha(PALETTE.ink, 0.55) : alpha(PALETTE.cream, 0.55),
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
            color: PALETTE.ink,
            boxShadow: `0 6px 18px ${alpha(PALETTE.coral, dark ? 0.25 : 0.4)}`,
            '&:hover': { background: CTA_GRADIENT, filter: 'brightness(1.04)' },
            '&.Mui-disabled': { background: alpha(PALETTE.coral, 0.35), color: alpha(PALETTE.ink, 0.6) },
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
          root: { height: 10, borderRadius: 999, backgroundColor: alpha(dark ? PALETTE.cream : PALETTE.charcoal, 0.1) },
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
