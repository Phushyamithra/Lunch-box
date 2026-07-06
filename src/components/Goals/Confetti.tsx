import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

const COLORS = ['#6750A4', '#EC4899', '#F59E0B', '#22C55E', '#38BDF8', '#FDE047'];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  size: number;
  color: string;
  round: boolean;
}

/**
 * Lightweight dependency-free confetti burst. Renders once on mount and
 * fades out — parents unmount it with the celebration it decorates.
 */
export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.6 + Math.random() * 1.2,
        rotate: 360 + Math.random() * 540,
        drift: (Math.random() - 0.5) * 80,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.5,
      })),
    [count],
  );

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: -24, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 480, x: p.drift, opacity: [1, 1, 0.9, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.55),
            borderRadius: p.round ? '50%' : 2,
            background: p.color,
          }}
        />
      ))}
    </Box>
  );
}
