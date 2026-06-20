'use client';

import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  count?: string;
};

/** Premium section label — title, orange accent line, optional badge/count. */
export function GNLModuleHead({ title, subtitle, badge, count }: Props): React.ReactElement {
  return (
    <header className="gv-gnl-elite-card__head">
      <div className="gv-gnl-elite-card__title-row">
        <h2 className="gv-gnl-elite-card__title">{title}</h2>
        {(badge || count) && (
          <div className="gv-gnl-elite-card__head-badges">
            {badge}
            {count ? <span className="gv-gnl-elite-card__count">{count}</span> : null}
          </div>
        )}
      </div>
      <span className="gv-gnl-elite-card__underline" aria-hidden="true" />
      {subtitle ? <p className="gv-gnl-elite-card__sub">{subtitle}</p> : null}
    </header>
  );
}
