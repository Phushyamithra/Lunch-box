import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FitTitle } from './Fit';

/** One part of a tracker, reached from a tile on the tracker's home. */
export interface Section {
  path: string;
  label: string;
  hint: string;
}

/**
 * The row above a tracker's screen: on a section, a back button named for
 * it (to the tracker's home); on the home, `homeLabel` if given. `aside`
 * sits at the right (e.g. a sync chip).
 */
export function SectionBar({ home, sections, pathname, homeLabel, aside }: { home: string; sections: Section[]; pathname: string; homeLabel?: ReactNode; aside?: ReactNode }) {
  const navigate = useNavigate();
  const section = sections.find((s) => s.path === pathname);
  if (!section && !homeLabel && !aside) return null;
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5, minHeight: 48 }}>
      {section ? (
        <Button startIcon={<ChevronLeftRoundedIcon />} color="inherit" onClick={() => navigate(home)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 16, ml: -1 }}>
          {section.label}
        </Button>
      ) : (
        homeLabel
      )}
      <Box sx={{ flexGrow: 1 }} />
      {aside}
    </Stack>
  );
}

/** A tracker's sections as tiles: title and a one-line hint, two across on a phone. */
export function SectionTiles({ sections, title }: { sections: Section[]; title?: string }) {
  const navigate = useNavigate();
  return (
    <Box component="nav" aria-label={title ?? 'Sections'}>
      {title && (
        <Typography variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {sections.map((s) => (
          <Paper key={s.path} variant="outlined" component="button" onClick={() => navigate(s.path)} sx={{ p: 2, minHeight: 88, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
            <FitTitle text={s.label} component="span" sx={{ display: 'block', width: '100%', flexGrow: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {s.hint}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
