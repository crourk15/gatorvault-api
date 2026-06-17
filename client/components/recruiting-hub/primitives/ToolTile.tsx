'use client';

import React from 'react';

type Props = {
  title: string;
  description: string;
  href: string;
  cta?: string;
  locked?: boolean;
  icon: React.ReactNode;
};

export function ToolTile({ title, description, href, cta = 'Open →', locked, icon }: Props): React.ReactElement {
  return (
    <a
      href={href}
      className={`rh-tool-tile${locked ? ' rh-tool-tile--locked' : ''}`}
      data-testid={`rh-tool-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="rh-tool-tile__icon">{icon}</span>
      <div className="rh-tool-tile__body">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span className="rh-tool-tile__cta">{locked ? 'Locked' : cta}</span>
    </a>
  );
}
