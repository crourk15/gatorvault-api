'use client';

import React from 'react';

export type FilterOption = {
  id: string;
  label: string;
};

type Props = {
  options: FilterOption[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function Filters({
  options,
  active,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Filters',
}: Props): React.ReactElement {
  return (
    <div className={`gv-ds-filters${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`gv-ds-filter${active === opt.id ? ' is-active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
