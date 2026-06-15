'use client';

import React from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  'aria-label': ariaLabel = 'Search',
}: Props): React.ReactElement {
  return (
    <label className={`gv-ds-search${className ? ` ${className}` : ''}`}>
      <span className="gv-ds-search__icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        className="gv-ds-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </label>
  );
}
