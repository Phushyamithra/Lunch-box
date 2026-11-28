import { clearCache, measureNaturalWidth, prepare } from '@chenglou/pretext';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Text sized to fit its space, measured with Pretext (github.com/chenglou/pretext)
 * instead of trial renders: the browser's own font engine via canvas, no layout
 * reflow. Two jobs in this app:
 *
 * - 'line': a figure that must stay on one line (a balance, a metric) shrinks
 *   until it fits the width.
 * - 'words': a title may wrap between words, but never split one. The size
 *   comes down only as far as the longest word needs ("WEIGHT" stays whole on
 *   a narrow card instead of breaking "WEIGH / T").
 */
export interface FitFont {
  family: string;
  weight: number | string;
  /** Largest size, in px. */
  max: number;
  /** Smallest size it may go to, in px. */
  min: number;
  uppercase?: boolean;
  /** CSS letter-spacing in em (e.g. -0.01). */
  trackingEm?: number;
}

const fontAt = (f: FitFont, px: number) => `${f.weight} ${px}px ${f.family}`;

/** Width of `text` set at `px`, in px (letter spacing included). */
export function textWidth(text: string, f: FitFont, px: number): number {
  const shown = f.uppercase ? text.toUpperCase() : text;
  return measureNaturalWidth(prepare(shown, fontAt(f, px), f.trackingEm ? { letterSpacing: f.trackingEm * px } : undefined));
}

/** The largest size from max down to min (0.5px steps) at which the text fits `width`. */
export function fitSize(text: string, f: FitFont, width: number, mode: 'line' | 'words'): number {
  if (!(width > 0) || !text.trim()) return f.max;
  const pieces = mode === 'line' ? [text] : text.split(/\s+/).filter(Boolean);
  const widest = (px: number) => Math.max(...pieces.map((p) => textWidth(p, f, px)));
  // Width grows about linearly with size: start from the proportional guess, then step down until it fits.
  const atMax = widest(f.max);
  if (atMax <= width) return f.max;
  let px = Math.max(f.min, Math.floor(((f.max * width) / atMax) * 2) / 2);
  while (px > f.min && widest(px) > width) px -= 0.5;
  return px;
}

/**
 * Font size for an element so its text fits (in its width less `reserve` px,
 * e.g. room for a unit after a figure): watches the element's width
 * (ResizeObserver) and re-measures once web fonts finish loading (Pretext
 * caches measurements per font, so they're cleared then).
 */
export function useFitSize<T extends HTMLElement>(text: string, font: FitFont, mode: 'line' | 'words', reserve = 0): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(font.max);
  const key = `${font.family}|${font.weight}|${font.max}|${font.min}|${font.uppercase}|${font.trackingEm}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const update = () => {
      try {
        setSize(fitSize(text, font, width - reserve, mode));
      } catch {
        setSize(font.max); // no canvas (tests, very old browsers): plain CSS sizing
      }
    };
    update();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? width;
      if (Math.abs(w - width) >= 1) {
        width = w;
        update();
      }
    });
    ro.observe(el);
    const fonts = document.fonts;
    const onFonts = () => {
      clearCache();
      update();
    };
    fonts?.addEventListener?.('loadingdone', onFonts);
    void fonts?.ready.then(onFonts);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener?.('loadingdone', onFonts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, key, mode, reserve]);

  return [ref, size];
}
