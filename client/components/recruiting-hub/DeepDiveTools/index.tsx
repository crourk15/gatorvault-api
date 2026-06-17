'use client';

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { isVaultAdmin } from '@/lib/admin-access';

const TOOLS = [
  {
    label: 'Depth Chart',
    desc: 'Roster layers, positional depth, and snap projections.',
    href: '/vault/depth-chart',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v2H8v-2zm0 3h5v2H8v-2z" />
      </svg>
    ),
  },
  {
    label: 'Scouting Reports',
    desc: 'Film grades, eval notes, and staff confidence scores.',
    href: '/vault/scouting',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h9l3 3v13H6V4zm2 2v10h8V8h-3V6H8zm1 3h6v2H9V9zm0 3h6v2H9v-2z" />
      </svg>
    ),
  },
  {
    label: 'Florida Recruiting Resources',
    desc: 'Board exports, visit calendar, and insider reference links.',
    href: '/vault/recruiting/board',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h14v2H4v-2z" />
      </svg>
    ),
  },
] as const;

export function DeepDiveTools(): React.ReactElement {
  const { user } = useUser();
  const warRoomHref = isVaultAdmin(user) ? '/vault/admin' : '/join?mode=signin&next=%2Fvault%2Fadmin';

  return (
    <section className="rh-deep-dive rh-frame" data-testid="rh-deep-dive">
      <div className="rh-section-head">
        <h2 className="rh-section-title">Deep-Dive Tools</h2>
        <p className="rh-section-sub">Command-center utilities — not just links.</p>
      </div>
      <div className="rh-deep-dive__grid">
        {TOOLS.map((tool) => (
          <a key={tool.label} href={tool.href} className="rh-deep-dive__tool">
            <span className="rh-deep-dive__icon">{tool.icon}</span>
            <div>
              <strong>{tool.label}</strong>
              <p>{tool.desc}</p>
            </div>
            <span className="rh-deep-dive__cta">Open →</span>
          </a>
        ))}
        <a href={warRoomHref} className="rh-deep-dive__tool rh-deep-dive__tool--war">
          <span className="rh-deep-dive__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4zm0 2.2 6 3v4.8c0 3.8-2.5 7.4-6 8.7-3.5-1.3-6-4.9-6-8.7V7.2l6-3z" />
            </svg>
          </span>
          <div>
            <strong>War Room</strong>
            <p>Admin-only ops dashboard — predictions, alerts, and staff intel.</p>
          </div>
          <span className="rh-deep-dive__cta">Enter →</span>
        </a>
      </div>
    </section>
  );
}
