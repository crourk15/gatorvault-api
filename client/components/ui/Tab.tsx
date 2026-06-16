'use client';

import React from 'react';

export type TabOption = {
  id: string;
  label: string;
};

type TabProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

type TabsProps = {
  options: TabOption[];
  active: string;
  onChange: (id: string) => void;
  tone?: 'dark' | 'light';
  className?: string;
  'aria-label'?: string;
};

export function Tab({
  label,
  active = false,
  onClick,
  className = '',
}: TabProps): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`gv-tab${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function Tabs({
  options,
  active,
  onChange,
  tone = 'dark',
  className = '',
  'aria-label': ariaLabel = 'Tabs',
}: TabsProps): React.ReactElement {
  const toneClass = tone === 'light' ? ' gv-tabs--light' : '';
  return (
    <div
      className={`gv-tabs${toneClass}${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <Tab
          key={opt.id}
          label={opt.label}
          active={active === opt.id}
          onClick={() => onChange(opt.id)}
        />
      ))}
    </div>
  );
}
