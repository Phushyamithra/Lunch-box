import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, IconButton } from '@mui/material';
import { Children, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

export interface SwipeRowHandle {
  scrollTo: (index: number) => void;
}

interface SwipeRowProps {
  label: string;
  children: ReactNode;
  /** Card width on phones (CSS); wider screens use `desktopWidth`. */
  cardWidth?: string;
  desktopWidth?: number;
  /** Index to bring into view on first render. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

/**
 * Horizontal, swipeable card row using native scroll-snap (smooth, works
 * with touch, trackpad and keyboard). Dots show position; arrows for mouse.
 */
export const SwipeRow = forwardRef<SwipeRowHandle, SwipeRowProps>(function SwipeRow(
  { label, children, cardWidth = '86%', desktopWidth = 320, initialIndex = 0, onIndexChange },
  ref,
) {
  const track = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [index, setIndex] = useState(initialIndex);

  const scrollTo = useCallback((i: number, smooth = true) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    if (!el || !track.current) return;
    track.current.scrollTo({ left: el.offsetLeft - track.current.offsetLeft - 4, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  useImperativeHandle(ref, () => ({ scrollTo }), [scrollTo]);

  useEffect(() => {
    scrollTo(initialIndex, false);
    // Only on mount: later changes are the user's own swipes.
  }, []);

  const onScroll = () => {
    const t = track.current;
    if (!t) return;
    const kids = [...t.children] as HTMLElement[];
    const centre = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    kids.forEach((k, i) => {
      const kc = k.offsetLeft - t.offsetLeft + k.clientWidth / 2;
      if (Math.abs(kc - centre) < Math.abs((kids[best].offsetLeft - t.offsetLeft + kids[best].clientWidth / 2) - centre)) best = i;
    });
    if (best !== index) {
      setIndex(best);
      onIndexChange?.(best);
    }
  };

  return (
    <Box role="region" aria-label={label} aria-roledescription="carousel">
      <Box
        ref={track}
        onScroll={onScroll}
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingInline: '4px',
          px: 0.5,
          pb: 1,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > *': { flex: { xs: `0 0 ${cardWidth}`, sm: `0 0 ${desktopWidth}px` }, scrollSnapAlign: 'start', minWidth: 0 },
        }}
      >
        {items}
      </Box>
      {items.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton size="small" aria-label="Previous" disabled={index === 0} onClick={() => scrollTo(index - 1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <ChevronLeftRoundedIcon fontSize="small" />
          </IconButton>
          {items.map((_, i) => (
            <Box
              key={i}
              component="button"
              aria-label={`Go to card ${i + 1} of ${items.length}`}
              aria-current={i === index}
              onClick={() => scrollTo(i)}
              sx={{
                width: i === index ? 18 : 7,
                height: 7,
                p: 0,
                border: 0,
                borderRadius: 999,
                cursor: 'pointer',
                bgcolor: i === index ? 'secondary.main' : 'action.disabled',
                transition: 'width 200ms ease, background-color 200ms ease',
              }}
            />
          ))}
          <IconButton
            size="small"
            aria-label="Next"
            disabled={index === items.length - 1}
            onClick={() => scrollTo(index + 1)}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <ChevronRightRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
});
