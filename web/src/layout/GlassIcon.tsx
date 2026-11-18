import { Box, useTheme } from '@mui/material';
import type { ReactElement } from 'react';

export interface IconTint {
  /** Gradient stops, top-left → bottom-right. */
  from: string;
  to: string;
  /** Glyph colour; chosen for ≥ 4.5:1 against both stops. */
  ink: string;
}

/**
 * A module's icon tile, flat in the Sport material: a 4px square of paper
 * step with the glyph in ink. No gradient, gloss or shadow. Decorative: the
 * label beside it carries the meaning. (`tint` is kept for callers; the
 * material has one colour, so tiles are all the same.)
 */
export function GlassIcon({ icon, size = 44 }: { icon: ReactElement; tint?: IconTint; size?: number }) {
  const theme = useTheme();
  const c = theme.tracker.mood;
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '4px',
        display: 'grid',
        placeItems: 'center',
        color: c.ink,
        backgroundColor: c.paper3,
        '& .MuiSvgIcon-root': { fontSize: size * 0.58 },
      }}
    >
      {icon}
    </Box>
  );
}
