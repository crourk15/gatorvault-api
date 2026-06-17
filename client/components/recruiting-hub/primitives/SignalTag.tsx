'use client';

import React from 'react';

export type SignalKind = 'hot' | 'cooling' | 'flip' | 'portal';

type Props = {
  kind: SignalKind;
  label: string;
  active?: boolean;
  count?: number;
};

const ICON: Record<SignalKind, string> = {
  hot: '🔥',
  cooling: '❄️',
  flip: '🚨',
  portal: '🌀',
};

export function SignalTag({ kind, label, active = false, count }: Props): React.ReactElement {
  const display = count != null && count > 0 ? `${label} ${count}` : label;
  return (
    <span
      className={`rh-signal-tag rh-signal-tag--${kind}${active ? ' rh-signal-tag--active' : ''}`}
      aria-current={active ? 'true' : undefined}
    >
      {ICON[kind]} {display}
    </span>
  );
}
