'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

export function ScanRefresh() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function refresh() {
    setBusy(true);
    try {
      await fetch('/api/scan', { method: 'POST', cache: 'no-store' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={refresh} disabled={busy} className="btn">
      {busy ? t('settings.rescanning') : t('settings.rescan')}
    </button>
  );
}
