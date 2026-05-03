'use client';

import { Filter } from './model-filter';
import { projectNameFromCwd } from '@/lib/utils';

export function ProjectFilter({ all, selected }: { all: string[]; selected: string[] }) {
  return (
    <Filter
      labelKey="filter.projectLabel"
      labelAllKey="filter.projectAll"
      labelSingleKey="filter.projectSingle"
      labelMultiKey="filter.projectMulti"
      all={all}
      selected={selected}
      param="projects"
      render={projectNameFromCwd}
    />
  );
}
