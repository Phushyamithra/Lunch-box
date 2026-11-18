import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../../src/models';
import { MOODS, type MoodColors, type MoodName } from './moods';

/**
 * Tracker's themes are Hallmark materials (github.com/nutlope/hallmark),
 * one per tracker, defined in moods.ts. This turns a mood into an MUI
 * theme: palette, faces, surfaces and controls. Shared across moods: the
 * Hallmark floor (visible focus, no tracked-capital labels, no gradients,
 * reduced-motion respected) and touch targets of 44–48px.
 */

/** Status colours, by whether the ground reads light or dark. */
const STATUS = {
  light: { error: '#B3261E', warning: '#8A5A00', success: '#2F6B2F' },
  dark: { error: '#F2B8B5', warning: '#E8C06A', success: '#9CD39C' },
} as const;

/** Sport's faces, kept for code that sets a display figure outside a theme lookup. */
export const FONT_DISPLAY = MOODS.sport.fonts.display;
export const FONT_BODY = MOODS.sport.fonts.body;
export const FONT_MONO = MOODS.sport.fonts.mono;

export function createTrackerTheme(mode: ResolvedThemeMode, moodName: MoodName = 'sport'): Theme {
  const appDark = mode === 'dark';
  const mood = MOODS[moodName];
  const c = appDark ? mood.colors.dark : mood.colors.light;
  const ground = appDark ? mood.ground.dark : mood.ground.light;
  const groundDark = ground === 'dark';
  const status = STATUS[ground];
  const display = {
    fontFamily: mood.fonts.display,
    fontWeight: mood.display.weight,
    textTransform: mood.display.uppercase ? ('uppercase' as const) : ('none' as const),
    letterSpacing: mood.display.tracking,
    lineHeight: mood.display.lineHeight,
  };
  const buttonFont = mood.button.font === 'display' ? mood.fonts.display : mood.fonts.body;
  const grain = mood.grain ? (appDark ? mood.grain.dark : mood.grain.light) : null;
  // Frosted glass for tracks, menus and pressed states: a see-through pane with a hairline edge.
  const glass = {
    fill: groundDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
    edge: groundDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)',
    press: groundDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)',
    shade: groundDark ? '0 8px 24px -12px rgba(0,0,0,0.7)' : `0 8px 24px -14px ${alpha(c.ink, 0.35)}`,
    blur: 'blur(14px) saturate(1.4)',
  };
  const glassTrack = {
    backgroundColor: groundDark ? glass.fill : alpha(c.paper3, 0.55),
    border: `1px solid ${glass.edge}`,
    boxShadow: `inset 0 1px 0 ${glass.edge}`,
    backdropFilter: glass.blur,
    WebkitBackdropFilter: glass.blur,
  };

  const theme = createTheme({
    palette: {
      mode: ground,
      primary: { main: c.ink, contrastText: c.paper },
      secondary: { main: c.focus, contrastText: c.onAccent },
      error: { main: status.error },
      warning: { main: status.warning },
      success: { main: status.success },
      info: { main: c.focus },
      background: { default: c.paper, paper: c.paper },
      text: { primary: c.ink, secondary: c.muted },
      divider: c.rule,
    },
    shape: { borderRadius: mood.radius.control > 24 ? 16 : mood.radius.control },
    typography: {
      fontFamily: mood.fonts.body,
      fontWeightRegular: groundDark && mood.bodyWeight <= 400 ? 350 : mood.bodyWeight,
      h1: display,
      h2: display,
      h3: display,
      h4: display,
      h5: { ...display, fontSize: '1.75rem' },
      h6: { ...display, fontSize: '1.4rem' },
      // Card and section titles.
      subtitle1: { ...display, fontSize: mood.display.uppercase ? '1.3rem' : '1.2rem' },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: '1rem' },
      button: {
        fontFamily: buttonFont,
        fontWeight: mood.button.weight,
        textTransform: mood.button.uppercase ? 'uppercase' : 'none',
        letterSpacing: 0,
        fontSize: mood.button.uppercase ? '1rem' : '0.95rem',
      },
      caption: { fontWeight: 500 },
    },
  });

  return createTheme(theme, {
    tracker: {
      tonal: c.paper3,
      onTonal: c.ink,
      glassFill: glass.fill,
      glassBorder: glass.edge,
      cta: c.accent,
      onCta: c.onAccent,
      minimal: appDark,
      appMode: mode,
      mood: c,
      moodName,
      fonts: mood.fonts,
      displayUppercase: mood.display.uppercase,
      grain,
      torn: !!mood.torn,
    },
    components: {
      MuiCssBaseline: { styleOverrides: globalStyles(c, groundDark, grain) },
      // Every tap: no square flash, a soft press, ripples clipped to the shape.
      MuiButtonBase: {
        styleOverrides: {
          root: {
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 140ms ease, background-color 160ms, box-shadow 160ms',
            '&:active': { transform: 'scale(0.97)' },
            '& .MuiTouchRipple-child': { backgroundColor: groundDark ? 'rgba(255,255,255,0.9)' : alpha(c.ink, 0.5) },
          },
        },
      },
      MuiBottomNavigationAction: {
        defaultProps: { disableRipple: true },
        styleOverrides: { root: { '&:active': { transform: 'none' }, '&:active .nav-pill': { transform: 'scale(0.92)' } } },
      },
      MuiTabs: {
        styleOverrides: {
          root: { ...glassTrack, borderRadius: 999, padding: 4, minHeight: 0 },
          indicator: { display: 'none' },
          scrollButtons: { borderRadius: 999, width: 36 },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 18, marginTop: 6, backgroundColor: alpha(groundDark ? c.paper2 : c.card, 0.86), border: `1px solid ${glass.edge}`, boxShadow: glass.shade, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur },
          list: { padding: 6 },
        },
      },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 18 } } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', backgroundColor: c.paper },
          rounded: { borderRadius: Math.min(mood.radius.surface, 24) },
          outlined: { ...mood.surface(c, appDark), ...(grain ? { backgroundImage: grain } : {}) },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 24, backgroundImage: grain ?? 'none', backgroundColor: groundDark ? c.paper2 : c.paper, borderTop: `4px solid ${moodName === 'squeeze' ? c.accent : c.ink}` },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { ...display, fontSize: '1.5rem' } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 16, border: `1px solid ${c.rule}` },
          standardInfo: { backgroundColor: c.paper2, color: c.ink },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundColor: c.band, color: c.onBand, borderRadius: 0, borderBottom: appDark ? `1px solid ${c.rule}` : 0 } },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 48, minHeight: 48, borderRadius: Math.min(mood.radius.control, 16) },
          sizeSmall: { minWidth: 44, minHeight: 44 },
        },
      },
      MuiCheckbox: { styleOverrides: { root: { padding: 12 } } },
      MuiMenuItem: { styleOverrides: { root: { minHeight: 48, borderRadius: 12 } } },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            minWidth: 0,
            paddingInline: 16,
            borderRadius: 999,
            fontFamily: mood.fonts.body,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.95rem',
            color: c.muted,
            '&.Mui-selected': { backgroundColor: c.accent, color: c.onAccent, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: mood.radius.control, paddingInline: 18, minHeight: 44, border: '2px solid transparent' },
          sizeSmall: { minHeight: 40, paddingInline: 12, fontSize: '0.9rem' },
          sizeLarge: { fontSize: '1.1rem' },
          containedPrimary: { ...mood.primary(c, appDark), '&.Mui-disabled': { backgroundColor: c.paper3, color: c.muted, boxShadow: 'none' } },
          containedSecondary: { backgroundColor: c.ink, color: c.paper, '&:hover': { backgroundColor: c.ink2 } },
          outlined: mood.secondary(c, appDark),
          outlinedError: { borderColor: status.error, color: status.error, '&:hover': { borderColor: status.error } },
          text: { '&:hover': { backgroundColor: groundDark ? c.paper3 : c.paper3 } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: mood.radius.chip, fontWeight: 500, height: 40 },
          sizeSmall: { height: 34 },
          outlined: { borderColor: c.rule2 === c.rule ? c.rule : c.rule },
          colorSecondary: { backgroundColor: c.accent, color: c.onAccent },
          colorPrimary: { backgroundColor: c.ink, color: c.paper },
          outlinedPrimary: { backgroundColor: 'transparent', borderColor: c.ink, color: c.ink },
          outlinedSecondary: { backgroundColor: 'transparent', borderColor: c.focus, color: c.ink },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { ...glassTrack, borderRadius: 999, gap: 4, padding: 4 } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            fontFamily: mood.fonts.body,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: 0,
            borderRadius: '999px !important',
            color: c.muted,
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.accent, color: c.onAccent, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: Math.min(mood.radius.control, 16),
            minHeight: 48,
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.accent, color: c.onAccent },
            '&.Mui-selected .MuiListItemIcon-root': { color: c.onAccent },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 10, borderRadius: mood.radius.chip > 4 ? 999 : 2, backgroundColor: groundDark ? c.paper3 : c.paper3 },
          bar: { borderRadius: mood.radius.chip > 4 ? 999 : 2 },
          barColorPrimary: { backgroundColor: c.ink },
          barColorSecondary: { backgroundColor: c.accent },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: moodName === 'solstice' ? 0 : Math.min(mood.radius.control, 14),
            backgroundColor: groundDark ? c.paper3 : moodName === 'solstice' ? c.paper2 : c.paper,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: c.focus },
          },
          notchedOutline: { borderColor: moodName === 'solstice' ? c.ink : c.rule2 },
        },
      },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: c.band, color: c.onBand, borderRadius: 10, fontSize: 13 } } },
      MuiSnackbarContent: {
        styleOverrides: { root: { backgroundColor: alpha(c.band, 0.9), color: c.onBand, borderRadius: 18, border: `1px solid ${alpha(c.onBand, 0.14)}`, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur } },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-checked + .MuiSwitch-track': { backgroundColor: c.focus, opacity: 1 } },
          track: { backgroundColor: c.rule2, opacity: 1 },
        },
      },
    },
  });
}

/** Page-level styles for a mood (also applied when a section switches mood). */
export function globalStyles(c: MoodColors, groundDark: boolean, grain: string | null = null) {
  return {
    ':root': { colorScheme: groundDark ? 'dark' : 'light' },
    // No square tap flash anywhere; tappable tiles and rows press in with a glass sheen that follows their curve.
    '*': { WebkitTapHighlightColor: 'transparent' },
    'button:not(.MuiButtonBase-root)': { transition: 'transform 140ms ease, box-shadow 160ms' },
    'button:not(.MuiButtonBase-root):active': {
      transform: 'scale(0.97)',
      boxShadow: `inset 0 0 0 999px ${groundDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)'}, inset 0 1px 0 rgba(255,255,255,0.5)`,
    },
    'html, body': { overflowX: 'clip', backgroundColor: c.paper },
    // The mood's paper grain, if it has one (Finance's cotton stock).
    body: { color: c.ink, fontVariantNumeric: 'tabular-nums', backgroundImage: grain ?? 'none' },
    '::selection': { background: c.accent, color: c.onAccent },
    // Every control shows focus at once.
    ':focus-visible': { outline: `2px solid ${c.focus}`, outlineOffset: 2 },
    a: { color: 'inherit', textDecorationColor: c.rule2, textUnderlineOffset: 3 },
    'a:hover': { textDecorationColor: c.focus },
    '@media (prefers-reduced-motion: reduce)': {
      '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
    },
  };
}

export interface TrackerTokens {
  /** A paper step for selected or tinted areas, and the ink on it. */
  tonal: string;
  onTonal: string;
  glassFill: string;
  glassBorder: string;
  /** The mood's signal fill (primary action, active tab), and the ink on it. */
  cta: string;
  onCta: string;
  /** Dark mode is on. */
  minimal: boolean;
  /** The app's light/dark setting (a mood's ground can differ, e.g. Nutrition's green). */
  appMode: ResolvedThemeMode;
  /** The current mood's full palette. */
  mood: MoodColors;
  moodName: MoodName;
  fonts: { display: string; body: string; mono: string };
  displayUppercase: boolean;
  /** The mood's paper grain (a CSS background image), or null. */
  grain: string | null;
  /** The mood tears its paper edges (header band, tab bar, hero cards). */
  torn: boolean;
}

declare module '@mui/material/styles' {
  interface Theme {
    tracker: TrackerTokens;
  }
  interface ThemeOptions {
    tracker?: TrackerTokens;
  }
}
