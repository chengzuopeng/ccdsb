'use client';

import { MultiSelect } from '@/components/multi-select';
import { projectNameFromCwd } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export function ProjectFilter({ all, selected }: { all: string[]; selected: string[] }) {
  const t = useT();
  return (
    <MultiSelect
      paramKey="projects"
      all={all}
      selected={selected}
      render={projectNameFromCwd}
      labelAllKey="filter.projectAll"
      labelSingleKey="filter.projectSingle"
      labelMultiKey="filter.projectMulti"
      ariaLabel={t('filter.projectLabel')}
    />
  );
}
