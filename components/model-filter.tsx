'use client';

import { MultiSelect } from '@/components/multi-select';
import { shortenModel } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export function ModelFilter({ all, selected }: { all: string[]; selected: string[] }) {
  const t = useT();
  return (
    <MultiSelect
      paramKey="models"
      all={all}
      selected={selected}
      render={shortenModel}
      labelAllKey="filter.modelAll"
      labelSingleKey="filter.modelSingle"
      labelMultiKey="filter.modelMulti"
      ariaLabel={t('filter.modelLabel')}
    />
  );
}
