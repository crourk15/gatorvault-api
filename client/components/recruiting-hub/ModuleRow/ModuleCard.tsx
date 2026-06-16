'use client';

import React from 'react';

type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
};

export function ModuleCard({ icon, title, description, href }: Props): React.ReactElement {
  return (
    <a href={href} className="rh-module-card">
      <span className="rh-module-card__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="rh-module-card__title">{title}</h3>
      <p className="rh-module-card__desc">{description}</p>
    </a>
  );
}
