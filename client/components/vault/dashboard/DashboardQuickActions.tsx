'use client';

import React from 'react';
import { QUICK_ACTIONS } from './dashboard-utils';

export function DashboardQuickActions(): React.ReactElement {
  return (
    <section className="gv-dash-actions gv-dash__section" aria-label="Quick actions" data-testid="dashboard-actions">
      <div className="gv-dash__frame">
        <h2 className="gv-dash-today__heading">Quick Actions</h2>
        <div className="gv-dash-actions__grid">
          {QUICK_ACTIONS.map((action) => (
            <a key={action.href} href={action.href} className="gv-dash-actions__tile">
              <span className="gv-dash-actions__icon" aria-hidden="true">
                {action.icon}
              </span>
              <span className="gv-dash-actions__label">{action.label}</span>
              <span className="gv-dash-actions__desc">{action.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
