'use client';

import { useState } from 'react';
import { BlockProgress } from '@/components/block-progress';
import type { SerializedProgress } from '@/lib/serialize';
import type { ProviderId } from '@/lib/providers/types';

interface BlockSlot {
  source: ProviderId;
  label: string;
  /** Full CLI name for the empty-state hint ("Send a message in {cli}…"). */
  cliName: string;
  /** Pre-computed on the server so the client switcher is a pure render —
   *  no refetch when the user toggles between providers. */
  initial: SerializedProgress;
}

interface Props {
  slots: BlockSlot[];
  /** Which slot to render on first paint. Page-level code typically picks
   *  the provider with the heavier current block so the user lands on the
   *  more interesting number. */
  defaultSource: ProviderId;
  className?: string;
}

/** Single-card variant of the 5h-block panel for the All view.
 *
 *  Both providers' blocks are pre-serialised server-side; switching
 *  between tabs is a pure in-memory re-render. The tab control lives
 *  inside the card header (top-right slot of `<BlockProgress>`) — same
 *  spot the "live" pill normally occupies. We drop the live pill because
 *  the visible countdown already conveys liveness, and the switcher is
 *  the more useful affordance there. */
export function BlockProgressSwitcher({ slots, defaultSource, className }: Props) {
  const initialIdx = Math.max(
    0,
    slots.findIndex((s) => s.source === defaultSource),
  );
  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const active = slots[activeIdx] ?? slots[0];

  return (
    <BlockProgress
      initial={active.initial}
      // Keep the inline "· Claude / · Codex" tag in the title — it's a
      // redundant confirmation of the active tab but reads well when
      // skimming, and the tab control sits far to the right.
      sourceLabel={active.label}
      cliName={active.cliName}
      className={className}
      headerRight={
        <div
          role="tablist"
          aria-label="Active 5h block source"
          className="inline-flex items-center rounded-md border border-border bg-bg-surface p-0.5 gap-0.5"
        >
          {slots.map((slot, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={slot.source}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveIdx(i)}
                className={`px-2 h-5 text-[11px] inline-flex items-center rounded transition-all ${
                  isActive
                    ? 'bg-brand-strong text-white font-semibold shadow-sm'
                    : 'text-text-tertiary font-medium hover:text-text-primary hover:bg-bg-surface-hi'
                }`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      }
    />
  );
}
