'use client';

import React from 'react';
import Link from 'next/link';
import { HeadingM, BodyM } from './Typography';

type Props = {
  icon: string;
  title: string;
  description: string;
  href?: string;
  className?: string;
};

export function FeatureCard({ icon, title, description, href, className = '' }: Props): React.ReactElement {
  const inner = (
    <>
      <span className="gv-ds-feature-card__icon" aria-hidden="true">
        {icon}
      </span>
      <HeadingM>{title}</HeadingM>
      <BodyM>{description}</BodyM>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`gv-ds-card gv-ds-feature-card${className ? ` ${className}` : ''}`}>
        {inner}
      </Link>
    );
  }

  return <article className={`gv-ds-card gv-ds-feature-card${className ? ` ${className}` : ''}`}>{inner}</article>;
}
