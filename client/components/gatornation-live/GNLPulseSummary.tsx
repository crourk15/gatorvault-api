'use client';

import React, { useMemo } from 'react';
import type { LiveHubBundle, LiveTickerItem } from '@/lib/gatornation-live-api';
import {
  filterExcludedPortalClassItems,
  isEligiblePortalPulseItem,
} from '@/lib/portal-class-filter';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

type PulseCell = {
  label: string;
  text: string;
  source?: string;
  url?: string;
};

type Props = {
  bundle: LiveHubBundle;
};

function pickStoryline(ticker: LiveTickerItem[]): PulseCell | null {
  const hit =
    ticker.find((t) => t.type === 'BREAKING' || t.type === 'TEAM') ??
    ticker.find((t) => t.type !== 'PORTAL') ??
    ticker[0];
  if (!hit?.text?.trim()) return null;
  return {
    label: 'Top Storyline',
    text: hit.text.trim(),
    source: hit.source,
    url: hit.url,
  };
}

function pickRecruiting(ticker: LiveTickerItem[], bundle: LiveHubBundle): PulseCell | null {
  const fromTicker = ticker.find(
    (t) => t.type === 'COMMIT' || t.type === 'VISIT' || t.type === 'RUMOR'
  );
  if (fromTicker?.text?.trim()) {
    return {
      label: 'Top Recruiting Movement',
      text: fromTicker.text.trim(),
      source: fromTicker.source,
      url: fromTicker.url,
    };
  }

  const visit = bundle.panels.visitsNow[0];
  if (visit?.text?.trim()) {
    return {
      label: 'Top Recruiting Movement',
      text: visit.text.trim(),
      source: visit.source,
    };
  }

  return null;
}

function pickBeatQuote(bundle: LiveHubBundle): PulseCell | null {
  const posts = filterExcludedPortalClassItems(
    bundle.panels.beatWriterHighlights,
    (item) => item.text,
    (item) => ({ source: item.source })
  );
  const post = posts[0];
  if (!post?.text?.trim()) return null;
  return {
    label: 'Top Beat Writer Quote',
    text: post.text.trim(),
    source: post.writerName || post.source,
    url: post.url,
  };
}

function pickPortalNote(bundle: LiveHubBundle): PulseCell | null {
  type PortalCandidate = {
    text: string;
    source?: string;
    url?: string;
    metadata: { type: string; source?: string };
  };

  const candidates: PortalCandidate[] = [
    ...bundle.panels.portalBuzz.map((item) => ({
      text: item.text,
      source: item.source,
      metadata: { type: 'PORTAL', source: item.source },
    })),
    ...bundle.ticker
      .filter((t) => t.type === 'PORTAL')
      .map((t) => ({
        text: t.text,
        source: t.source,
        url: t.url,
        metadata: { type: t.type, source: t.source },
      })),
  ];

  const hit = candidates.find((item) =>
    isEligiblePortalPulseItem(item.text, item.metadata)
  );
  if (!hit?.text?.trim()) return null;

  return {
    label: 'Top Portal Note',
    text: hit.text.trim(),
    source: hit.source,
    url: hit.url,
  };
}

function PulseQuadrant({ label, cell }: { label: string; cell: PulseCell | null }): React.ReactElement {
  if (!cell) {
    return (
      <div className="gv-gnl-pulse__quadrant gv-gnl-pulse__quadrant--empty">
        <p className="gv-gnl-pulse__label">{label}</p>
        <p className="gv-gnl-pulse__empty">Nothing active right now.</p>
      </div>
    );
  }

  const body = cell.url ? (
    <a href={cell.url} className="gv-gnl-pulse__text gv-gnl-pulse__text--link">
      {cell.text}
    </a>
  ) : (
    <p className="gv-gnl-pulse__text">{cell.text}</p>
  );

  return (
    <div className="gv-gnl-pulse__quadrant">
      <p className="gv-gnl-pulse__label">{label}</p>
      {body}
      {cell.source ? <p className="gv-gnl-pulse__source">{cell.source}</p> : null}
    </div>
  );
}

/** Today's UF Football Pulse — four-quadrant summary from live bundle data. */
export function GNLPulseSummary({ bundle }: Props): React.ReactElement {
  const ticker = useMemo(
    () =>
      filterExcludedPortalClassItems(
        bundle.ticker,
        (item) => item.text,
        (item) => ({ type: item.type, source: item.source })
      ),
    [bundle.ticker]
  );

  const cells = useMemo(
    () => ({
      storyline: pickStoryline(ticker),
      recruiting: pickRecruiting(ticker, bundle),
      beatQuote: pickBeatQuote(bundle),
      portalNote: pickPortalNote(bundle),
    }),
    [ticker, bundle]
  );

  return (
    <section
      className="gv-gnl-elite-card gv-gnl-pulse"
      aria-label="Today's UF Football Pulse"
      data-testid="gnl-pulse-summary"
    >
      <GNLModuleHead
        title="Today's UF Football Pulse"
        subtitle="The four signals driving the day across storylines, recruiting, the beat, and portal"
        badge={<GNLDashBadge label="PULSE" tone="team" />}
      />
      <div className="gv-gnl-pulse__grid">
        <PulseQuadrant label="Top Storyline" cell={cells.storyline} />
        <PulseQuadrant label="Top Recruiting Movement" cell={cells.recruiting} />
        <PulseQuadrant label="Top Beat Writer Quote" cell={cells.beatQuote} />
        <PulseQuadrant label="Top Portal Note" cell={cells.portalNote} />
      </div>
    </section>
  );
}
