/**
 * One Hallmark material per tracker, so moving between them changes the
 * mood (github.com/nutlope/hallmark, references/themes/<slug>.md):
 *
 * - Home, Fitness, Settings: Sport. A results sheet: concrete paper, ink,
 *   condensed capitals, one volt fill.
 * - Nutrition: Squeeze. A cheerful food box: forest-green paper, warm white
 *   ink, Gabarito over Manrope, soft rounded tiles, juicy peach controls.
 * - Finance: Coral. A calm money desk: warm grey paper, cotton cards lit
 *   from the left, one coral; the primary control is the ink board.
 * - Goals: Hum. Daily habits: pear-tinted cream, rounded card stock that
 *   presses down, a pear primary, blue for links and focus.
 * - Meal prep: Solstice. A harvest calendar: cream paper, brown ink,
 *   Yeseva One over Archivo, square wells with a hard paper shadow, one
 *   vermilion pill.
 *
 * Each has a dark rendering re-derived by Hallmark's dark-mode recipe
 * (Solstice uses its own "dusk" light). Fonts are Hallmark's except where
 * the theme's face isn't on Google Fonts: Onest stands in for General Sans
 * (Coral) and Nunito for Chillax (Hum). All pairs below were checked for
 * contrast: text ≥ 4.5:1, controls and bands ≥ 4:1.
 */
import type { CSSObject } from '@mui/material/styles';

export type MoodName = 'sport' | 'squeeze' | 'coral' | 'hum' | 'solstice';

export interface MoodColors {
  paper: string;
  paper2: string;
  paper3: string;
  ink: string;
  ink2: string;
  muted: string;
  rule: string;
  rule2: string;
  /** The theme's one signal, as a fill, and the type on it. */
  accent: string;
  onAccent: string;
  accentDeep: string;
  /** Focus ring and links. */
  focus: string;
  /** The header and tab bar band, and the type on it. */
  band: string;
  onBand: string;
  /** The raised surface, and the type on it. */
  card: string;
  onCard: string;
}

export interface Mood {
  name: MoodName;
  /** Hallmark theme it comes from. */
  hallmark: string;
  colors: { light: MoodColors; dark: MoodColors };
  /** Whether the ground reads dark (for MUI's own control colours), per app mode. */
  ground: { light: 'light' | 'dark'; dark: 'light' | 'dark' };
  fonts: { display: string; body: string; mono: string };
  display: { weight: number; uppercase: boolean; tracking: string; lineHeight: number };
  bodyWeight: number;
  button: { font: 'display' | 'body'; weight: number; uppercase: boolean };
  radius: { surface: number; control: number; chip: number };
  /** Paper grain laid over the page and cards (a CSS background image), per app mode. */
  grain?: { light: string; dark: string };
  /** Torn paper edges on the header band, the tab bar and hero cards. */
  torn?: boolean;
  /** A section of a screen (an outlined Paper). */
  surface: (c: MoodColors, dark: boolean) => CSSObject;
  /** The primary control (a contained primary Button). */
  primary: (c: MoodColors, dark: boolean) => CSSObject;
  /** Its partner (an outlined Button). */
  secondary: (c: MoodColors, dark: boolean) => CSSObject;
}

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Fine paper grain: fractal noise tinted to the paper's fibre colour, tiled. */
function grain(r: number, g: number, b: number, alpha: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A 120×10 strip of torn edge (filled = paper kept), torn along its bottom. */
const TORN_PATH = 'M0 0H120V6L115 8.5 109 5.5 103 9 97 6 90 9.5 84 5 78 8 71 4.5 65 8.5 58 6 52 9.5 45 5.5 39 8 32 4.5 26 9 19 6 13 8.5 7 5 0 6Z';
const tornStrip = (flip: boolean) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='10'><path d='${TORN_PATH}'${flip ? " transform='matrix(1 0 0 -1 0 10)'" : ''}/></svg>`,
  )}")`;

/**
 * A CSS mask that tears an element's top or bottom edge (10px deep). Masks
 * clip shadows too, so put any shadow on a wrapper as a drop-shadow filter.
 */
export function tornMask(edge: 'top' | 'bottom'): CSSObject {
  const solid = `linear-gradient(#000 0 0) ${edge === 'top' ? 'bottom' : 'top'} / 100% calc(100% - 9px) no-repeat`;
  const mask = `${solid}, ${tornStrip(edge === 'top')} ${edge} / 120px 10px repeat-x`;
  return { WebkitMask: mask, mask };
}

export const MOODS: Record<MoodName, Mood> = {
  sport: {
    name: 'sport',
    hallmark: 'sport',
    colors: {
      light: { paper: '#F6F9FC', paper2: '#EBEFF2', paper3: '#DFE3E7', ink: '#00082E', ink2: '#071A36', muted: '#5B646F', rule: '#B4B8BC', rule2: '#273E5C', accent: '#C8E928', onAccent: '#00082E', accentDeep: '#678802', focus: '#678802', band: '#00082E', onBand: '#F6F9FC', card: '#F6F9FC', onCard: '#00082E' },
      dark: { paper: '#080C10', paper2: '#0D1217', paper3: '#13191F', ink: '#E6ECF3', ink2: '#C8D2DE', muted: '#95A0AB', rule: '#292E34', rule2: '#5E738F', accent: '#D3F163', onAccent: '#00082E', accentDeep: '#A0C849', focus: '#A0C849', band: '#141B24', onBand: '#E6ECF3', card: '#0D1217', onCard: '#E6ECF3' },
    },
    ground: { light: 'light', dark: 'dark' },
    fonts: { display: `'Saira Condensed', 'Arial Narrow', ${SANS}`, body: `'Albert Sans', ${SANS}`, mono: "'JetBrains Mono', ui-monospace, monospace" },
    display: { weight: 800, uppercase: true, tracking: '-0.01em', lineHeight: 1.02 },
    bodyWeight: 400,
    button: { font: 'display', weight: 800, uppercase: true },
    radius: { surface: 20, control: 14, chip: 999 },
    // A well: a paper step with the bar rule drawn inside its rounded top.
    surface: (c) => ({ backgroundColor: c.paper2, border: 0, borderRadius: 20, boxShadow: `inset 0 3px 0 ${c.rule2}` }),
    primary: (c) => ({ backgroundColor: c.accent, color: c.onAccent, '&:hover': { backgroundColor: c.accent, borderColor: c.onAccent } }),
    secondary: (c) => ({ borderWidth: 2, borderColor: c.ink, color: c.ink, '&:hover': { borderWidth: 2, borderColor: c.ink, backgroundColor: c.paper2 } }),
  },

  squeeze: {
    name: 'squeeze',
    hallmark: 'squeeze',
    colors: {
      light: { paper: '#075930', paper2: '#1B6B3E', paper3: '#004523', ink: '#FDFCF8', ink2: '#E9EDDF', muted: '#D1E4D4', rule: '#3C8256', rule2: '#58966D', accent: '#FFB37C', onAccent: '#4A2010', accentDeep: '#F68953', focus: '#FFD060', band: '#003A1A', onBand: '#FDFCF8', card: '#F9F5EC', onCard: '#032617' },
      dark: { paper: '#002A14', paper2: '#03381E', paper3: '#001D0C', ink: '#F7F5F1', ink2: '#E3E7D8', muted: '#C4D7C7', rule: '#255336', rule2: '#3C694B', accent: '#F0AD7E', onAccent: '#451A0B', accentDeep: '#E08355', focus: '#F8CA65', band: '#001809', onBand: '#F7F5F1', card: '#EFEBE2', onCard: '#032617' },
    },
    // The green is the page in both modes.
    ground: { light: 'dark', dark: 'dark' },
    fonts: { display: `'Gabarito', ${SANS}`, body: `'Manrope', ${SANS}`, mono: "'Geist Mono', ui-monospace, monospace" },
    display: { weight: 800, uppercase: false, tracking: '-0.025em', lineHeight: 1.0 },
    bodyWeight: 500,
    button: { font: 'body', weight: 700, uppercase: false },
    radius: { surface: 24, control: 16, chip: 999 },
    // Tiles, not cards: the ground one step lighter, round, no border or shadow.
    surface: (c) => ({ backgroundColor: c.paper2, border: 0, borderRadius: 24 }),
    primary: (c) => ({ backgroundColor: c.accent, color: c.onAccent, '&:hover': { backgroundColor: c.accentDeep } }),
    secondary: (c) => ({ borderWidth: 2, borderColor: c.ink, color: c.ink, '&:hover': { borderWidth: 2, borderColor: c.ink, backgroundColor: c.paper3 } }),
  },

  coral: {
    name: 'coral',
    hallmark: 'coral',
    colors: {
      light: { paper: '#F8F4F1', paper2: '#F1ECE8', paper3: '#E8E1DD', ink: '#1D1614', ink2: '#312926', muted: '#615955', rule: '#D9D3CF', rule2: '#C7BFBA', accent: '#EF8B7B', onAccent: '#1D1614', accentDeep: '#BB3D31', focus: '#BD3A2B', band: '#1F1917', onBand: '#F6F3EF', card: '#FDFBF8', onCard: '#221B19' },
      dark: { paper: '#130E0C', paper2: '#1A1512', paper3: '#221B18', ink: '#EEEAE7', ink2: '#DCD6D2', muted: '#ABA39E', rule: '#322C29', rule2: '#433B38', accent: '#EF9687', onAccent: '#1D1614', accentDeep: '#E87A69', focus: '#EF806F', band: '#0A0605', onBand: '#EEEAE7', card: '#221B19', onCard: '#EEEAE7' },
    },
    ground: { light: 'light', dark: 'dark' },
    fonts: { display: `'Onest', ${SANS}`, body: `'Onest', ${SANS}`, mono: "'Geist Mono', ui-monospace, monospace" },
    display: { weight: 600, uppercase: false, tracking: '-0.03em', lineHeight: 1.05 },
    bodyWeight: 400,
    button: { font: 'body', weight: 600, uppercase: false },
    radius: { surface: 20, control: 14, chip: 999 },
    grain: { light: grain(0.31, 0.23, 0.18, 0.2), dark: grain(0.93, 0.9, 0.88, 0.07) },
    torn: true,
    // Cotton stationery lit from the left: a lit edge top-left, a cast falling right.
    surface: (c, dark) => ({
      backgroundColor: c.card,
      border: 0,
      borderRadius: 20,
      boxShadow: dark
        ? `0 0 0 1px ${c.rule}, 6px 5px 14px -8px rgba(0,0,0,0.6)`
        : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 0.5px rgba(80,58,46,0.22), 0 1px 0 rgba(80,58,46,0.12), 6px 5px 10px -6px rgba(80,58,46,0.3)',
    }),
    // The primary is the ink board, the label pressed into it.
    primary: (c, dark) => ({
      backgroundColor: c.band,
      color: c.onBand,
      boxShadow: dark ? `0 0 0 1px ${c.rule2}` : '6px 5px 10px -6px rgba(80,58,46,0.35)',
      '&:hover': { backgroundColor: c.band, transform: 'translateY(-1px)' },
      '&:active': { transform: 'translateY(1px)' },
    }),
    secondary: (c, dark) => ({
      backgroundColor: c.card,
      border: 0,
      color: c.ink,
      boxShadow: dark ? `0 0 0 1px ${c.rule2}` : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 0.5px rgba(80,58,46,0.22), 0 1px 0 rgba(80,58,46,0.12), 6px 5px 10px -6px rgba(80,58,46,0.3)',
      '&:hover': { border: 0, backgroundColor: c.card, transform: 'translateY(-1px)' },
    }),
  },

  hum: {
    name: 'hum',
    hallmark: 'hum',
    colors: {
      light: { paper: '#F7F5EC', paper2: '#F0EDE0', paper3: '#E6E1D1', ink: '#12161C', ink2: '#272C32', muted: '#565B63', rule: '#D7D4C9', rule2: '#D2C6AA', accent: '#F7D21A', onAccent: '#12161C', accentDeep: '#C9A000', focus: '#0064BE', band: '#12161C', onBand: '#F7F5EC', card: '#FCFBF6', onCard: '#12161C' },
      dark: { paper: '#0B1016', paper2: '#131920', paper3: '#1C222A', ink: '#F1EFE6', ink2: '#DAD8CD', muted: '#ADABA1', rule: '#2B3138', rule2: '#03060B', accent: '#EDCC37', onAccent: '#12161C', accentDeep: '#B38D00', focus: '#67B0F9', band: '#04080D', onBand: '#F1EFE6', card: '#161B22', onCard: '#F1EFE6' },
    },
    ground: { light: 'light', dark: 'dark' },
    fonts: { display: `'Nunito', ui-rounded, ${SANS}`, body: `'Nunito', ui-rounded, ${SANS}`, mono: "'Geist Mono', ui-monospace, monospace" },
    display: { weight: 800, uppercase: false, tracking: '-0.02em', lineHeight: 1.05 },
    bodyWeight: 500,
    button: { font: 'body', weight: 800, uppercase: false },
    radius: { surface: 24, control: 16, chip: 999 },
    // Rounded card stock with a soft drop from the top-left light.
    surface: (c, dark) => ({
      backgroundColor: c.card,
      border: 0,
      borderRadius: 24,
      boxShadow: dark ? `0 0 0 1px ${c.rule}` : '0 1px 2px rgba(18,22,28,0.06), 0 12px 28px -14px rgba(18,22,28,0.22)',
    }),
    // Card stock that presses down: a solid edge below, raised on hover, pressed on tap.
    primary: (c) => ({
      backgroundColor: c.accent,
      color: c.onAccent,
      minHeight: 52,
      boxShadow: `0 5px 0 ${c.accentDeep}`,
      marginBottom: 5,
      transition: 'transform 120ms, box-shadow 120ms',
      '&:hover': { backgroundColor: c.accent, transform: 'translateY(-2px)', boxShadow: `0 7px 0 ${c.accentDeep}` },
      '&:active': { transform: 'translateY(4px)', boxShadow: `0 1px 0 ${c.accentDeep}` },
    }),
    secondary: (c) => ({
      backgroundColor: c.card,
      border: `1px solid ${c.rule}`,
      color: c.ink,
      boxShadow: `0 4px 0 ${c.rule2}`,
      marginBottom: 4,
      '&:hover': { backgroundColor: c.card, border: `1px solid ${c.rule}` },
      '&:active': { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${c.rule2}` },
    }),
  },

  solstice: {
    name: 'solstice',
    hallmark: 'solstice',
    colors: {
      light: { paper: '#F6E9D5', paper2: '#FBF4E6', paper3: '#ECD8B6', ink: '#3A1E0E', ink2: '#523525', muted: '#78553C', rule: '#E0C69F', rule2: '#DE9C31', accent: '#C9212E', onAccent: '#FBF4E6', accentDeep: '#C9212E', focus: '#C9212E', band: '#3A1E0E', onBand: '#F6E9D5', card: '#FBF4E6', onCard: '#3A1E0E' },
      dark: { paper: '#3B1D13', paper2: '#46271C', paper3: '#2E150C', ink: '#F6E9D5', ink2: '#E2D6C2', muted: '#CFBAA3', rule: '#5F3F31', rule2: '#E6AC3D', accent: '#DB4144', onAccent: '#FBF4E6', accentDeep: '#F66E5C', focus: '#F87966', band: '#250F07', onBand: '#F6E9D5', card: '#46271C', onCard: '#F6E9D5' },
    },
    ground: { light: 'light', dark: 'dark' },
    fonts: { display: "'Yeseva One', ui-serif, Georgia, serif", body: `'Archivo', ${SANS}`, mono: `'Archivo Narrow', ${SANS}` },
    display: { weight: 400, uppercase: false, tracking: '-0.005em', lineHeight: 1.05 },
    bodyWeight: 400,
    button: { font: 'body', weight: 600, uppercase: false },
    radius: { surface: 22, control: 999, chip: 999 },
    // A raised well: a 2px ink border and a hard paper shadow, no blur, with rounded corners.
    surface: (c) => ({ backgroundColor: c.paper2, border: `2px solid ${c.ink}`, borderRadius: 22, boxShadow: `6px 6px 0 ${c.paper3}` }),
    primary: (c) => ({
      backgroundColor: c.accent,
      color: c.onAccent,
      fontFamily: `'Archivo Narrow', ${SANS}`,
      '&:hover': { backgroundColor: c.accent, filter: 'brightness(1.06)' },
    }),
    // The plain partner: ink over a 2px ink underline, no box.
    secondary: (c) => ({
      border: 0,
      borderRadius: 0,
      borderBottom: `2px solid ${c.ink}`,
      color: c.ink,
      paddingInline: 4,
      '&:hover': { border: 0, borderBottom: `2px solid ${c.accent}`, backgroundColor: 'transparent' },
    }),
  },
};

/** Which mood a screen wears, from its path. */
export function moodFor(pathname: string): MoodName {
  if (pathname.startsWith('/nutrition')) return 'squeeze';
  if (pathname.startsWith('/finance')) return 'coral';
  if (pathname.startsWith('/goals')) return 'hum';
  if (pathname.startsWith('/food')) return 'solstice';
  return 'sport';
}
