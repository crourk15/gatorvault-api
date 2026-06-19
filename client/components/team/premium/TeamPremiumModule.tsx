'use client';

import React from 'react';

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  stamp?: string;
  action?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function TeamPremiumModule({
  id,
  title,
  subtitle,
  stamp,
  action,
  compact,
  children,
  className = '',
}: Props): React.ReactElement {
  return (
    <section
      id={id}
      className={`rh-cc-module fc-premium-module team-premium-module${compact ? ' rh-cc-module--compact' : ''} ${className}`.trim()}
    >
      <div className="rh-cc-module__head">
        <div>
          <h2 className="rh-cc-module__title">{title}</h2>
          {subtitle ? <p className="rh-cc-module__sub">{subtitle}</p> : null}
        </div>
        {stamp ? <span className="rh-cc-module__stamp">{stamp}</span> : null}
        {action ? <div className="rh-cc-module__action">{action}</div> : null}
      </div>
      <div className="rh-cc-module__body">{children}</div>
    </section>
  );
}
