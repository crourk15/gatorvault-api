'use client';

import React from 'react';

type Props = {
  icon: React.ReactNode;
  label: string;
  href: string;
};

export function ToolButton({ icon, label, href }: Props): React.ReactElement {
  return (
    <a href={href} className="rh-tool-button">
      <span className="rh-tool-button__icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </a>
  );
}
