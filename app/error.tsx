'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n/context';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error('[ccgauge] page error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="card card-pad text-center">
        <div className="text-base font-semibold text-text-primary">{t('common.error.title')}</div>
        <p className="text-sm text-text-secondary mt-2">{t('common.error.desc')}</p>
        {error.message && (
          <pre className="mt-4 text-xs text-text-tertiary text-left bg-bg-surface-hi rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
            {error.message}
            {error.digest ? `\n\n#${error.digest}` : ''}
          </pre>
        )}
        <button onClick={() => reset()} className="btn mt-4">
          {t('common.error.retry')}
        </button>
      </div>
    </div>
  );
}
