'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from '@/lib/use-pathname';
import { breadcrumbTrail } from '@/lib/site-routes';

export function Breadcrumbs(): React.ReactElement | null {
  const pathname = usePathname();
  const trail = breadcrumbTrail(pathname);

  if (trail.length <= 1) return null;

  return (
    <nav className="gv-breadcrumbs" aria-label="Breadcrumb">
      <ol className="gv-breadcrumbs__list">
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="gv-breadcrumbs__item">
              {i > 0 ? <span className="gv-breadcrumbs__sep" aria-hidden="true">/</span> : null}
              {isLast || !item.href ? (
                <span className="gv-breadcrumbs__current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="gv-breadcrumbs__link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
