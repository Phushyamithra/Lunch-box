import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SectionBar, SectionTiles } from '../layout/SectionNav';
import { useFitness } from './FitnessContext';
import { useDietBackfill } from './useDietBackfill';

/** A leading emoji isn't an icon in this material: the condensed title carries it alone. */
const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u;
export const plainTitle = (title: string) => title.replace(LEADING_EMOJI, '');

/** A section of a screen: a paper well under a bar rule, its title in condensed capitals. */
export function Card({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <Paper variant="outlined" id={id} sx={{ p: { xs: 2.5, sm: 3 }, scrollMarginTop: 96 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'break-word' }}>
          {plainTitle(title)}
        </Typography>
        {aside}
      </Box>
      {children}
    </Paper>
  );
}

/** Big number with a small caption, for headline metrics. */
export function Metric({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return (
    <Box>
      <Typography component="p" sx={(t) => ({ fontFamily: t.tracker.fonts.display, fontSize: 34, fontWeight: t.typography.h1.fontWeight, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' })}>
        {value}
        {unit && (
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 600, ml: 0.5 }} color="text.secondary">
            {unit}
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {caption}
      </Typography>
    </Box>
  );
}

/** 2520 → "42 min"; 3900 → "1 h 5 min". */
export const minutes = (sec: number): string => {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
export const kg = (v: number | null | undefined, digits = 1): string => (v === null || v === undefined ? '–' : v.toFixed(digits));
export const signed = (v: number, digits = 2): string => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

/** Fitness's sections, shown as tiles under Today. */
const SECTIONS = [
  { path: '/fitness/dashboard', label: 'Dashboard', hint: 'Weight, waist and muscles' },
  { path: '/fitness/training', label: 'Training', hint: 'Sessions and history' },
  { path: '/fitness/program', label: 'Program', hint: 'Your splits and days' },
  { path: '/fitness/review', label: 'Review', hint: 'Weekly check-in' },
  { path: '/fitness/settings', label: 'Targets & away', hint: 'Goals and time off' },
  { path: '/templates', label: 'Bulk add', hint: 'Templates and upload' },
];

/** Frame for every fitness screen: section tabs plus load/error states. */
export function FitnessLayout() {
  const { pathname } = useLocation();
  const { loading, error, data, reload } = useFitness();
  // Tag past days' diet from the food log (only what changed).
  useDietBackfill();

  return (
    <Box>
      <SectionBar home="/fitness" sections={SECTIONS} pathname={pathname} />
      {error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void reload()}>Retry</Button>}>
          {error}
        </Alert>
      ) : loading && !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading fitness data" />
        </Box>
      ) : (
        <div key={pathname}>
          <Outlet />
          {pathname === '/fitness' && (
            <Box sx={{ mt: 4 }}>
              <SectionTiles sections={SECTIONS} title="More in Fitness" />
            </Box>
          )}
        </div>
      )}
    </Box>
  );
}
