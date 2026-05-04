'use client';

import { SegmentedPicker } from '@/components/segmented-picker';
import { useT } from '@/lib/i18n/context';

const GRANS = [
  { value: 'hour', tk: 'gran.hour' },
  { value: 'day', tk: 'gran.day' },
  { value: 'week', tk: 'gran.week' },
  { value: 'month', tk: 'gran.month' },
];

export function GranularityPicker({ defaultValue = 'day' }: { defaultValue?: string }) {
  const t = useT();
  return (
    <SegmentedPicker
      paramKey="gran"
      defaultValue={defaultValue}
      options={GRANS}
      ariaLabel={t('gran.label')}
    />
  );
}
