import { createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';

/**
 * Tracker in Hallmark's "Sport" material (github.com/nutlope/hallmark,
 * themes/sport.md): a results sheet. Cool concrete paper, blue-black ink,
 * Saira Condensed 800 capitals over an Albert Sans body, big condensed
 * figures, JetBrains Mono for times, hairlines and one heavier bar rule,
 * square 4px corners, and volt as the only colour: a fill with ink on it
 * (the primary action, the active tab, one highlighted figure), never type.
 * No gradients, no glass, no shadows: depth is paper steps and rules.
 *
 * Dark mode is the same system re-derived (Hallmark dark-mode.md): paper
 * L 15%, ink L 94%, elevation lighter by paper step, volt eased in chroma.
 * Contrast (WCAG): light ink/paper 18.5, muted/paper 5.7, ink on volt 14.1;
 * dark ink/paper 16.5, muted/paper 7.4, ink on volt 15.4.
 */
export const SPORT = {
  light: {
    paper: '#F6F9FC',
    paper2: '#EBEFF2',
    paper3: '#DFE3E7',
    ink: '#00082E',
    ink2: '#071A36',
    muted: '#5B646F',
    rule: '#B4B8BC',
    rule2: '#273E5C',
    accent: '#C8E928',
    accentDeep: '#678802',
    /** The ink band (header, tab bar, quick actions) and the type on it. */
    band: '#00082E',
    onBand: '#F6F9FC',
    error: '#B3261E',
    warning: '#8A5A00',
    success: '#2F6B2F',
  },
  dark: {
    paper: '#080C10',
    paper2: '#0D1217',
    paper3: '#13191F',
    ink: '#E6ECF3',
    ink2: '#C8D2DE',
    muted: '#95A0AB',
    rule: '#292E34',
    rule2: '#5E738F',
    accent: '#D3F163',
    accentDeep: '#A0C849',
    // Dark keeps the band dark: one paper step up, light type, never a pale strip.
    band: '#141B24',
    onBand: '#E6ECF3',
    error: '#F2B8B5',
    warning: '#E8C06A',
    success: '#9CD39C',
  },
} as const;

/** Ink on volt in both modes (the light ink reads on both volts). */
const ON_VOLT = SPORT.light.ink;

export const FONT_DISPLAY = "'Saira Condensed', 'Arial Narrow', sans-serif";
export const FONT_BODY = "'Albert Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace";

/** Display heads: upright condensed capitals, never slanted or loosely tracked. */
const display = { fontFamily: FONT_DISPLAY, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '-0.01em', lineHeight: 1.02 };

export function createTrackerTheme(mode: ResolvedThemeMode): Theme {
  const dark = mode === 'dark';
  const c = dark ? SPORT.dark : SPORT.light;

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: c.ink, contrastText: c.paper },
      secondary: { main: c.accentDeep, contrastText: ON_VOLT },
      error: { main: c.error },
      warning: { main: c.warning },
      success: { main: c.success },
      info: { main: c.rule2 },
      background: { default: c.paper, paper: c.paper },
      text: { primary: c.ink, secondary: c.muted },
      divider: c.rule,
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: FONT_BODY,
      fontWeightRegular: dark ? 350 : 400,
      h1: display,
      h2: display,
      h3: display,
      h4: display,
      h5: { ...display, fontSize: '1.75rem' },
      h6: { ...display, fontSize: '1.4rem' },
      // Card and section titles.
      subtitle1: { ...display, fontSize: '1.3rem' },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: '1rem' },
      button: { fontFamily: FONT_DISPLAY, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0, fontSize: '1rem' },
      caption: { fontWeight: 500 },
    },
  });

  return createTheme(theme, {
    tracker: {
      tonal: c.paper3,
      onTonal: c.ink,
      glassFill: c.paper,
      glassBorder: c.rule,
      cta: c.accent,
      onCta: ON_VOLT,
      minimal: dark,
      sport: c,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: dark ? 'dark' : 'light' },
          'html, body': { overflowX: 'clip' },
          body: { backgroundColor: c.paper, fontVariantNumeric: 'tabular-nums' },
          '::selection': { background: c.accent, color: ON_VOLT },
          // Every control shows focus at once, in the deep volt.
          ':focus-visible': { outline: `2px solid ${c.accentDeep}`, outlineOffset: 2 },
          a: { color: 'inherit', textDecorationColor: c.rule, textUnderlineOffset: 3 },
          'a:hover': { textDecorationColor: c.accentDeep },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', backgroundColor: c.paper },
          rounded: { borderRadius: 4 },
          // A "well": a paper step under a bar rule, never a boxed card or a shadow.
          outlined: { backgroundColor: c.paper2, border: 0, borderTop: `2px solid ${c.rule2}`, borderRadius: '0 0 4px 4px' },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 4, backgroundColor: c.paper, borderTop: `4px solid ${c.ink}` } },
      },
      MuiDialogTitle: { styleOverrides: { root: { ...display, fontSize: '1.5rem' } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 4, border: `1px solid ${c.rule}` },
          standardInfo: { backgroundColor: c.paper2, color: c.ink },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundColor: c.band, color: c.onBand, borderRadius: 0, borderBottom: dark ? `1px solid ${c.rule}` : 0 } },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 48, minHeight: 48, borderRadius: 4 },
          sizeSmall: { minWidth: 44, minHeight: 44 },
        },
      },
      MuiCheckbox: { styleOverrides: { root: { padding: 12 } } },
      MuiMenuItem: { styleOverrides: { root: { minHeight: 48 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 48, fontFamily: FONT_BODY, fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 4, paddingInline: 18, minHeight: 44, border: '2px solid transparent' },
          sizeSmall: { minHeight: 40, paddingInline: 12, fontSize: '0.9rem' },
          sizeLarge: { fontSize: '1.15rem' },
          // The primary control: a volt block with ink capitals.
          containedPrimary: {
            backgroundColor: c.accent,
            color: ON_VOLT,
            '&:hover': { backgroundColor: c.accent, borderColor: ON_VOLT },
            '&.Mui-disabled': { backgroundColor: c.paper3, color: c.muted },
          },
          containedSecondary: { backgroundColor: c.ink, color: c.paper, '&:hover': { backgroundColor: c.ink2 } },
          // Its partner: 2px ink border, same capitals.
          outlined: { borderWidth: 2, borderColor: c.ink, color: c.ink, '&:hover': { borderWidth: 2, borderColor: c.ink, backgroundColor: c.paper2 } },
          outlinedError: { borderColor: c.error, color: c.error, '&:hover': { borderColor: c.error } },
          text: { '&:hover': { backgroundColor: c.paper3 } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 500, height: 40 },
          sizeSmall: { height: 34 },
          outlined: { borderColor: c.rule },
          colorSecondary: { backgroundColor: c.accent, color: ON_VOLT },
          colorPrimary: { backgroundColor: c.ink, color: c.paper },
          outlinedPrimary: { backgroundColor: 'transparent', borderColor: c.ink, color: c.ink },
          outlinedSecondary: { backgroundColor: 'transparent', borderColor: c.accentDeep, color: c.ink },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { borderRadius: 4, gap: 4, padding: 4, backgroundColor: c.paper2 } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            fontFamily: FONT_BODY,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: 0,
            borderRadius: '4px !important',
            color: c.muted,
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.accent, color: ON_VOLT },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            minHeight: 48,
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.accent, color: ON_VOLT },
            '&.Mui-selected .MuiListItemIcon-root': { color: ON_VOLT },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 10, borderRadius: 2, backgroundColor: c.paper3 },
          bar: { borderRadius: 2 },
          barColorPrimary: { backgroundColor: c.ink },
          barColorSecondary: { backgroundColor: c.accent },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 4, backgroundColor: c.paper, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: c.accentDeep } },
          notchedOutline: { borderColor: c.rule },
        },
      },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: c.band, color: c.onBand, borderRadius: 4, fontSize: 13 } } },
      MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: c.band, color: c.onBand, borderRadius: 4 } } },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-checked + .MuiSwitch-track': { backgroundColor: c.accentDeep, opacity: 1 } },
          track: { backgroundColor: c.rule, opacity: 1 },
        },
      },
    },
  });
}

export interface TrackerTokens {
  /** A paper step for selected or tinted areas, and the ink on it. */
  tonal: string;
  onTonal: string;
  glassFill: string;
  glassBorder: string;
  /** Volt: the primary action's fill, and the ink on it. */
  cta: string;
  onCta: string;
  /** Dark mode. */
  minimal: boolean;
  /** The full Sport palette for the current mode. */
  sport: (typeof SPORT)['light' | 'dark'];
}

declare module '@mui/material/styles' {
  interface Theme {
    tracker: TrackerTokens;
  }
  interface ThemeOptions {
    tracker?: TrackerTokens;
  }
}
