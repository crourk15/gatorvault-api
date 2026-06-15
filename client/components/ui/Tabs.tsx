'use client';

import React from 'react';

export type TabOption = {
  id: string;
  label: string;
};

type Props = {
  options: TabOption[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function Tabs({
  options,
  active,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Tabs',
}: Props): React.ReactElement {
  return (
    <div className={`gv-ds-tabs${className ? ` ${className}` : ''}`} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={active === opt.id}
          className={`gv-ds-tab${active === opt.id ? ' is-active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
