import { cn } from '@/lib/utils';

/**
 * ccgauge brand mark.
 *
 * Geometry (viewBox 0 0 64 64):
 *   - Dial centred at (32, 41), radius 18 (the rim).
 *   - Dial track is the full 180° arc at the rim.
 *   - Progress arc fills from the leftmost rim point to a "60° elevation"
 *     point (41, 25.4) — same point the needle reaches.
 *   - Needle runs from the pivot (32, 41) to that rim point so the tip
 *     and the progress arc end coincide visually (rounded caps overlap).
 *   - Pivot is a "donut": white outer ring + Indigo-600 core (only when
 *     `withBackground=true`; without the background the core would be
 *     invisible against a transparent canvas, so we drop it).
 *
 * Color strategy:
 *   - With background: vertical gradient Indigo-400 (#818CF8) → Indigo-600
 *     (#4F46E5). Reads as the brand square at any size.
 *   - Without background: strokes inherit `text-brand` via `currentColor`,
 *     so the same mark blends into any container that sets a brand color.
 *
 * Keep `public/favicon.svg` in sync with this file when you change geometry.
 */

const BG_GRADIENT_ID = 'ccg-logo-bg';

export function Logo({
  className,
  withBackground = true,
}: {
  className?: string;
  withBackground?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={cn('block', className)}>
      {withBackground && (
        <>
          <defs>
            <linearGradient
              id={BG_GRADIENT_ID}
              x1="0"
              y1="0"
              x2="0"
              y2="64"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill={`url(#${BG_GRADIENT_ID})`} />
        </>
      )}

      {/* Dial track — dim full arc */}
      <path
        d="M14 41 A18 18 0 0 1 50 41"
        stroke="currentColor"
        strokeOpacity={withBackground ? 0.3 : 0.25}
        strokeWidth="4.5"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : 'text-brand'}
      />

      {/* Progress arc — bright, ends on the dial rim at 60° elevation */}
      <path
        d="M14 41 A18 18 0 0 1 41 25.4"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : 'text-brand'}
      />

      {/* Needle — pivot → progress-arc tip */}
      <line
        x1="32"
        y1="41"
        x2="41"
        y2="25.4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : 'text-brand'}
      />

      {/* Donut pivot — white ring + Indigo-600 core. The inner dot only
          renders with a background; against transparency it'd disappear. */}
      <circle cx="32" cy="41" r="4" className={withBackground ? 'fill-white' : 'fill-brand'} />
      {withBackground && <circle cx="32" cy="41" r="1.6" fill="#4F46E5" />}
    </svg>
  );
}
