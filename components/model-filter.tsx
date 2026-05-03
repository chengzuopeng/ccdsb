'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn, shortenModel } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export function ModelFilter({ all, selected }: { all: string[]; selected: string[] }) {
  return (
    <Filter
      labelKey="filter.modelLabel"
      labelAllKey="filter.modelAll"
      labelSingleKey="filter.modelSingle"
      labelMultiKey="filter.modelMulti"
      all={all}
      selected={selected}
      param="models"
      render={shortenModel}
    />
  );
}

interface FilterProps {
  labelKey: string;
  labelAllKey: string;
  labelSingleKey: string;
  labelMultiKey: string;
  all: string[];
  selected: string[];
  param: string;
  render?: (s: string) => string;
}

export function Filter(props: FilterProps) {
  const { labelAllKey, labelSingleKey, labelMultiKey, all, selected, param, render } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggle(v: string) {
    const next = new URLSearchParams(params.toString());
    const set = new Set(selected);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    if (set.size === 0) next.delete(param);
    else next.set(param, Array.from(set).join(','));
    router.push(`${pathname}?${next.toString()}`);
  }

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete(param);
    router.push(`${pathname}?${next.toString()}`);
  }

  let labelText: string;
  if (selected.length === 0) labelText = t(labelAllKey);
  else if (selected.length === 1) labelText = t(labelSingleKey, { value: render ? render(selected[0]) : selected[0] });
  else labelText = t(labelMultiKey, { count: selected.length });

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn">
        {labelText}
        <span className="text-text-tertiary ml-1">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 max-h-80 overflow-y-auto card border-border-hi shadow-lg p-2 z-20">
          {selected.length > 0 && (
            <button onClick={clear} className="w-full text-left text-xs text-text-secondary px-2 py-1 hover:bg-bg-surface-hi rounded">
              {t('filter.clearAll')}
            </button>
          )}
          {all.length === 0 && (
            <div className="text-xs text-text-tertiary px-2 py-3 text-center">{t('filter.noOptions')}</div>
          )}
          {all.map((v) => {
            const isSelected = selected.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggle(v)}
                className={cn(
                  'w-full text-left text-sm px-2 py-1.5 hover:bg-bg-surface-hi rounded flex items-center gap-2',
                  isSelected && 'text-text-primary',
                )}
              >
                <span
                  className={cn(
                    'w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] flex-shrink-0',
                    isSelected ? 'bg-brand border-brand text-white' : 'border-border-hi',
                  )}
                >
                  {isSelected ? '✓' : ''}
                </span>
                <span className="truncate">{render ? render(v) : v}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
