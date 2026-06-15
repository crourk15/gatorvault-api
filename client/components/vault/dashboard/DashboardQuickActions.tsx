'use client';

import React from 'react';
import { QUICK_ACTIONS } from './dashboard-utils';

export function DashboardQuickActions(): React.ReactElement {
  return (
    <section className="gv-dash-actions gv-dash__section" aria-label="Quick actions" data-testid="dashboard-actions">
      <div className="gv-dash__frame">
        <p className="gv-dash__section-title">Quick Actions</p>
        <div className="gv-dash-actions__grid">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-dash-actions__btn">
            <span className="gv-dash-actions__icon" aria-hidden="true">
              {action.icon}
            </span>
            {action.label}
          </a>
        ))}
        </div>
      </div>
    </section>
  );
}
