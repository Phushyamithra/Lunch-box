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
 * iOS-style app-icon tile: rounded square, tinted gradient, a glossy top
 * highlight and a soft drop shadow. Decorative — the label beside it
 * carries the meaning.
 */
export function GlassIcon({ icon, tint: colour, size = 44 }: { icon: ReactElement; tint: IconTint; size?: number }) {
  const theme = useTheme();
  // Minimal dark mode: one graphite tile style with the soft-teal glyph.
  const tint: IconTint = theme.tracker.minimal ? { from: '#2A3134', to: '#20262A', ink: '#8CC2CC' } : colour;
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: `${Math.round(size * 0.3)}px`,
        display: 'grid',
        placeItems: 'center',
        color: tint.ink,
        background: `linear-gradient(135deg, ${tint.from}, ${tint.to})`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: theme.tracker.minimal
          ? '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
          : `0 6px 16px ${tint.to}55, inset 0 1px 0 rgba(255,255,255,0.45)`,
        '&::after': {
          // Glass sheen across the top half.
          content: '""',
          position: 'absolute',
          inset: '0 0 50% 0',
          background: `linear-gradient(180deg, rgba(255,255,255,${theme.tracker.minimal ? 0.06 : 0.35}), rgba(255,255,255,0))`,
        },
        '& .MuiSvgIcon-root': { fontSize: size * 0.55, position: 'relative', zIndex: 1 },
      }}
    >
      {icon}
    </Box>
  );
}
