import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SectionProps {
  title?: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, desc, right, children, className }: SectionProps) {
  return (
    <section className={cn('card', className)}>
      {(title || right) && (
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-text-primary tracking-tight">{title}</h2>
            )}
            {desc && <p className="text-xs text-text-secondary mt-1">{desc}</p>}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </header>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function PageShell({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {desc && <p className="text-sm text-text-secondary mt-1">{desc}</p>}
        </div>
        {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="card card-pad text-center py-16">
      <div className="text-base font-medium text-text-secondary">{title}</div>
      {desc && <div className="text-sm text-text-tertiary mt-2">{desc}</div>}
    </div>
  );
}
