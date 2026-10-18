import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';

/**
 * Tracker palette. Light mode: slate teal, butter and amber, with brick
 * and maroon as minor accents. Dark mode is deliberately minimal: neutral
 * graphite with one soft-teal accent and no gold. Worn two ways —
 * iOS-style frosted glass for surfaces, and Material You tonal "pop" for
 * actions (pill buttons, tonal containers, pill nav indicators).
 *
 * Contrast is WCAG AA, checked against the worst case of each glass layer
 * over the background glow. Light: body ≥ 10:1, secondary ≥ 5.8:1, CTA
 * text ≥ 5.3:1. Dark: body ≥ 14:1, secondary ≥ 6.6:1, CTA text ≥ 7.6:1.
 */
export const PALETTE = {
  teal: '#335C67',
  butter: '#FFF3B0',
  amber: '#E09F3E',
  brick: '#9E2A2B',
  maroon: '#540B0E',
  // Derived tints/shades of the five above.
  butterLight: '#FFF8D4', // light-mode page
  amberLight: '#F0BE6E',
  amberDeep: '#9A6A1F', // amber that reads on butter (4.5:1+)
  tealDeep: '#1F3A41', // light-mode text; text on amber/butter fills
  tealLight: '#4A7A86',
  // Minimal dark mode: graphite neutrals + one soft teal (from #335C67).
  night: '#101314', // dark-mode page
  surface: '#1A1E20', // dark-mode glass base
  mist: '#E8ECEC', // dark-mode text
  mistMuted: '#9BA6A8', // dark-mode secondary text
  tealSoft: '#8CC2CC', // dark-mode accent
  tealSoftDeep: '#7DB3BE',
  onTealSoft: '#0F1A1D',
  /** Text on light fills (butter, amber, the CTA gradient). */
  ink: '#1F3A41',
} as const;

/** Primary call-to-action fill per mode; its text colour passes on every stop. */
export const CTA = {
  light: { fill: `linear-gradient(135deg, ${PALETTE.amberLight} 0%, ${PALETTE.amber} 100%)`, text: PALETTE.ink },
  dark: { fill: `linear-gradient(135deg, ${PALETTE.tealSoft} 0%, ${PALETTE.tealSoftDeep} 100%)`, text: PALETTE.onTealSoft },
} as const;

export function createTrackerTheme(mode: ResolvedThemeMode): Theme {
  const dark = mode === 'dark';
  const glassFill = dark ? alpha(PALETTE.surface, 0.72) : alpha('#FFFFFF', 0.6);
  const glassBorder = dark ? alpha(PALETTE.mist, 0.08) : alpha('#FFFFFF', 0.8);
  const glassShadow = dark
    ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(232,236,236,0.05)'
    : '0 8px 32px rgba(31,58,65,0.1), inset 0 1px 0 rgba(255,255,255,0.9)';
  const tonal = dark ? '#1F3237' : '#D5E5E7'; // teal containers
  const onTonal = dark ? PALETTE.mist : PALETTE.tealDeep;
  const cta = dark ? CTA.dark : CTA.light;

  const theme = createTheme({
    palette: dark
      ? {
          mode,
          primary: { main: PALETTE.tealSoft, contrastText: PALETTE.onTealSoft },
          secondary: { main: PALETTE.tealSoft, contrastText: PALETTE.onTealSoft },
          error: { main: '#F2A7A0' },
          warning: { main: '#D9B26F' },
          success: { main: '#9CC5A1' },
          info: { main: PALETTE.tealSoft },
          background: { default: PALETTE.night, paper: PALETTE.surface },
          text: { primary: PALETTE.mist, secondary: PALETTE.mistMuted },
          divider: alpha(PALETTE.mist, 0.08),
        }
      : {
          mode,
          primary: { main: PALETTE.teal, contrastText: PALETTE.butter },
          secondary: { main: PALETTE.amberDeep, contrastText: '#FFFFFF' },
          error: { main: PALETTE.brick },
          warning: { main: PALETTE.amberDeep },
          success: { main: '#3E6B4A' },
          info: { main: PALETTE.teal },
          background: { default: PALETTE.butterLight, paper: '#FFFBEA' },
          text: { primary: PALETTE.tealDeep, secondary: PALETTE.teal },
          divider: alpha(PALETTE.tealDeep, 0.1),
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
    tracker: { tonal, onTonal, glassFill, glassBorder, cta: cta.fill, onCta: cta.text, minimal: dark },
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
              ? `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.teal, 0.28)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.teal, 0.12)}, transparent 60%),
                 ${PALETTE.night}`
              : `radial-gradient(60vmax 45vmax at 0% 0%, ${alpha(PALETTE.amber, 0.32)}, transparent 60%),
                 radial-gradient(55vmax 40vmax at 100% 100%, ${alpha(PALETTE.teal, 0.25)}, transparent 60%),
                 ${PALETTE.butterLight}`,
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
            backgroundColor: dark ? alpha(PALETTE.night, 0.55) : alpha(PALETTE.butterLight, 0.55),
            borderRadius: 0,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 20 },
          containedPrimary: {
            background: cta.fill,
            color: cta.text,
            boxShadow: dark ? '0 6px 18px rgba(0,0,0,0.35)' : `0 6px 18px ${alpha(PALETTE.amber, 0.45)}`,
            '&:hover': { background: cta.fill, filter: 'brightness(1.04)' },
            '&.Mui-disabled': { background: alpha(dark ? PALETTE.tealSoft : PALETTE.amber, 0.3), color: alpha(cta.text, 0.6) },
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
          root: { height: 10, borderRadius: 999, backgroundColor: alpha(dark ? PALETTE.mist : PALETTE.tealDeep, 0.1) },
          bar: { borderRadius: 999 },
          barColorSecondary: { background: cta.fill },
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

export interface TrackerTokens {
  tonal: string;
  onTonal: string;
  glassFill: string;
  glassBorder: string;
  /** Call-to-action fill and its text colour (mode-specific). */
  cta: string;
  onCta: string;
  /** Dark mode: monochrome icon tiles, no decorative colour. */
  minimal: boolean;
}

declare module '@mui/material/styles' {
  interface Theme {
    tracker: TrackerTokens;
  }
  interface ThemeOptions {
    tracker?: TrackerTokens;
  }
}
