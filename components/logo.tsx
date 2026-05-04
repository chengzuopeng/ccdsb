import { cn } from '@/lib/utils';

export function Logo({ className, withBackground = true }: { className?: string; withBackground?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={cn('block', className)}
    >
      {withBackground && <rect width="64" height="64" rx="14" className="fill-brand" />}
      <path
        d="M14 41 A18 18 0 0 1 50 41"
        stroke="currentColor"
        strokeOpacity={withBackground ? 0.32 : 0.25}
        strokeWidth="4.5"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : ''}
      />
      <path
        d="M14 41 A18 18 0 0 1 43.2 25.4"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : 'text-brand'}
      />
      <line
        x1="32"
        y1="41"
        x2="42"
        y2="27"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={withBackground ? 'text-white' : 'text-brand'}
      />
      <circle cx="32" cy="41" r="3" className={withBackground ? 'fill-white' : 'fill-brand'} />
    </svg>
  );
}
