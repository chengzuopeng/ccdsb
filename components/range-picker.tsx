'use client';

import { SegmentedPicker } from '@/components/segmented-picker';
import { useT } from '@/lib/i18n/context';

const PRESETS = [
  { value: '1d', tk: 'range.today' },
  { value: '7d', tk: 'range.7d' },
  { value: '30d', tk: 'range.30d' },
  { value: '90d', tk: 'range.90d' },
  { value: 'all', tk: 'range.all' },
];

export function RangePicker({ defaultValue = '7d' }: { defaultValue?: string }) {
  const t = useT();
  return (
    <SegmentedPicker
      paramKey="range"
      defaultValue={defaultValue}
      options={PRESETS}
      ariaLabel={t('range.label')}
    />
  );
}
