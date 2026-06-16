'use client';

import React from 'react';

type Direction = 'up' | 'down' | 'flat';

type Props = {
  direction: Direction;
  delta?: number | string;
  className?: string;
};

const ARROWS: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

export function MovementArrow({ direction, delta, className = '' }: Props): React.ReactElement {
  return (
    <span className={`gv-ds-movement gv-ds-movement--${direction}${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true">{ARROWS[direction]}</span>
      {delta != null ? <span>{typeof delta === 'number' ? Math.abs(delta) : delta}</span> : null}
    </span>
  );
}
