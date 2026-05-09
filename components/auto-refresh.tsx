'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Refresh interval in ms. */
  intervalMs?: number;
}

/**
 * Silently re-runs the server render of the current route on a fixed cadence.
 *
 * Implementation notes:
 * - `router.refresh()` streams a fresh React tree; existing UI stays mounted
 *   while React reconciles, so there's no visible loading flash, no scroll
 *   reset, and no input/expand state churn (as long as those live in client
 *   state, which is the case for our usage table).
 * - We pause the timer when the tab is hidden — saves a useless server hop
 *   while the user isn't looking and avoids piling up requests on a stale tab.
 * - We avoid scheduling overlapping refreshes by gating with `running`.
 */
export function AutoRefresh({ intervalMs = 15_000 }: Props) {
  const router = useRouter();
  const running = useRef(false);

  useEffect(() => {
    if (intervalMs <= 0) return;

    let timer: number | null = null;

    function tick() {
      if (document.hidden || running.current) return;
      running.current = true;
      try {
        router.refresh();
      } finally {
        // router.refresh() returns void; clear the gate on the next tick so
        // we don't fire two refreshes back-to-back if React schedules one
        // during the same task.
        Promise.resolve().then(() => {
          running.current = false;
        });
      }
    }

    timer = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);

    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, intervalMs]);

  return null;
}
