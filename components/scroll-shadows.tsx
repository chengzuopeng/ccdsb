'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function ScrollShadows({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 4);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
    }

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="overflow-x-auto">
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-surface to-transparent transition-opacity duration-150',
          showLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-surface to-transparent transition-opacity duration-150',
          showRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
