import { Typography, useTheme, type SxProps, type Theme, type TypographyProps } from '@mui/material';
import type { ElementType, ReactNode } from 'react';
import { textWidth, useFitSize, type FitFont } from './fitText';

const px = (v: unknown, base = 16): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '');
  if (s.endsWith('rem')) return parseFloat(s) * base;
  if (s.endsWith('px')) return parseFloat(s);
  return parseFloat(s) || base;
};
const em = (v: unknown): number => {
  const s = String(v ?? '');
  return s.endsWith('em') ? parseFloat(s) : 0;
};

/**
 * A section title in the mood's display face that wraps between words but
 * never inside one: on a narrow card the size steps down just enough for the
 * longest word to fit (measured with Pretext, no reflow).
 */
export function FitTitle({ text, component = 'h2', sx, holdFull }: { text: string; component?: ElementType; sx?: SxProps<Theme>; holdFull?: boolean }) {
  const t = useTheme();
  const v = t.typography.subtitle1;
  const max = px(v.fontSize);
  const font: FitFont = {
    family: t.tracker.fonts.display,
    weight: (v.fontWeight as number) ?? 700,
    max,
    min: Math.round(max * 0.7),
    uppercase: v.textTransform === 'uppercase',
    trackingEm: em(v.letterSpacing),
  };
  const [ref, size] = useFitSize<HTMLHeadingElement>(text, font, 'words');
  // holdFull: claim the longest word's width at full size (measured by Pretext), so
  // whatever sits beside the title wraps first and the title keeps its size.
  let hold = 0;
  if (holdFull) {
    try {
      hold = Math.ceil(Math.max(...text.split(/\s+/).filter(Boolean).map((word) => textWidth(word, font, font.max))));
    } catch {
      hold = 0;
    }
  }
  return (
    <Typography ref={ref} variant="subtitle1" component={component} sx={[{ flexGrow: 1, minWidth: hold ? `min(${hold}px, 100%)` : 0, fontSize: `${size}px` }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {text}
    </Typography>
  );
}

/**
 * A headline figure kept on one line: it shrinks (down to 60%) rather than
 * wrapping or spilling out of a narrow column. `unit` sits after it, small.
 */
export function FitFigure({
  value,
  unit,
  max,
  weight,
  family,
  trackingEm = -0.02,
  sx,
  color,
}: {
  value: string;
  unit?: ReactNode;
  max: number;
  weight?: number;
  family?: string;
  trackingEm?: number;
  sx?: SxProps<Theme>;
  color?: TypographyProps['color'];
}) {
  const t = useTheme();
  const font: FitFont = { family: family ?? t.tracker.fonts.display, weight: weight ?? ((t.typography.h1.fontWeight as number) || 700), max, min: Math.round(max * 0.6), trackingEm };
  // Leave room for a short text unit ("kg", "kcal") set at 16px in the body face.
  const unitText = typeof unit === 'string' ? unit : '';
  let unitW = 0;
  try {
    unitW = unitText ? textWidth(unitText, { family: t.tracker.fonts.body, weight: 600, max: 16, min: 16 }, 16) + 6 : 0;
  } catch {
    unitW = unitText.length * 9;
  }
  const [ref, size] = useFitSize<HTMLParagraphElement>(value, font, 'line', Math.ceil(unitW));
  return (
    <Typography
      ref={ref}
      component="p"
      color={color}
      sx={[
        { fontFamily: font.family, fontWeight: font.weight, fontSize: `${size}px`, lineHeight: 1.1, letterSpacing: `${trackingEm}em`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {value}
      {unit && (
        <Typography component="span" sx={{ fontSize: 16, fontWeight: 600, ml: 0.5, letterSpacing: 0 }} color="text.secondary">
          {unit}
        </Typography>
      )}
    </Typography>
  );
}
