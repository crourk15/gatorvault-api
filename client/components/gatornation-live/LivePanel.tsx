'use client';

import React from 'react';
import type { LivePanelProps } from '@/lib/gatornation-live-types';

export function LivePanel({ title, description, items, insider }: LivePanelProps): React.ReactElement {
  return (
    <section
      className={`gv-gnl-panel${insider ? ' gv-gnl-panel--insider' : ''}`}
      data-testid={`gnl-panel-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <h3 className="gv-gnl-panel__title">{title}</h3>
      {description && <p className="gv-gnl-panel__desc">{description}</p>}
      <ul className="gv-gnl-panel__list">
        {items.length === 0 && (
          <li className="gv-gnl-panel__row">
            <p className="gv-gnl-panel__secondary">Nothing active right now.</p>
          </li>
        )}
        {items.map((item, idx) => (
          <li key={`${title}_${idx}`} className="gv-gnl-panel__row">
            <p className="gv-gnl-panel__primary">{item.text}</p>
            {(item.source || item.timestamp) && (
              <p className="gv-gnl-panel__secondary">
                {[item.timestamp, item.source].filter(Boolean).join(' • ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
