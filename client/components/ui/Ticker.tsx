'use client';

import React from 'react';

type Props = {
  items: string[];
  className?: string;
  separator?: string;
};

/** GPU-accelerated horizontal ticker — pauses on hover. */
export function Ticker({ items, className = '', separator = ' • ' }: Props): React.ReactElement {
  const line = [...items, ...items].join(separator);

  return (
    <div className={`gv-ds-ticker${className ? ` ${className}` : ''}`} aria-hidden="true">
      <div className="gv-ds-ticker__track">{line}</div>
    </div>
  );
}
