'use client';

import React from 'react';

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
      </div>
    </section>
  );
}
