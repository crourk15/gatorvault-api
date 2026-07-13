'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { LiveHubBundle, LiveTickerItem } from '@/lib/gatornation-live-api';
import {
  filterExcludedPortalClassItems,
  isEligiblePortalPulseItem,
} from '@/lib/portal-class-filter';
import {
  fetchBeatIntel,
  fetchHighPriorityIntel,
  type BeatIntelItem,
  type HighPriorityIntelItem,
} from '@/lib/recruiting-ui-api';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

type PulseCell = {
  label: string;
  text: string;
  source?: string;
  url?: string;
  embedHtml?: string | null;
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

function pickRecruitingFromIntel(items: HighPriorityIntelItem[]): PulseCell | null {
  const hit = items.find((item) => item.text?.trim());
  if (!hit) return null;
  return {
    label: 'Top Recruiting Movement',
    text: hit.text.trim(),
    source: hit.playerSlug ? `@${hit.playerSlug}` : 'Recruiting Intel',
  };
}

function pickRecruitingFallback(ticker: LiveTickerItem[], bundle: LiveHubBundle): PulseCell | null {
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

function pickBeatQuoteFromIntel(items: BeatIntelItem[]): PulseCell | null {
  const post = items.find((item) => item.text?.trim() || item.embedHtml);
  if (!post) return null;
  return {
    label: 'Top Beat Writer Quote',
    text: post.text?.trim() || 'Latest from the UF beat',
    source: post.writerName || post.source,
    url: post.url ?? undefined,
    embedHtml: post.embedHtml,
  };
}

function pickBeatQuoteFallback(bundle: LiveHubBundle): PulseCell | null {
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
  const portalItems = [
    ...bundle.panels.portalBuzz,
    ...(bundle.ticker ?? [])
      .filter((t) => t.type === 'PORTAL')
      .map((t) => ({ text: t.text, source: t.source, url: t.url })),
  ].filter((item) => isEligiblePortalPulseItem(item.text, { source: item.source }));

  const hit = portalItems.find((item) => item.text?.trim());
  if (!hit) return null;
  return {
    label: 'Top Portal Note',
    text: hit.text.trim(),
    source: hit.source,
    url: 'url' in hit ? hit.url : undefined,
  };
}

function PulseQuadrant({ label, cell }: { label: string; cell: PulseCell }): React.ReactElement {
  const body = cell.embedHtml ? (
    <div className="gv-gnl-pulse__embed" dangerouslySetInnerHTML={{ __html: cell.embedHtml }} />
  ) : cell.url ? (
    <a href={cell.url} className="gv-gnl-pulse__text gv-gnl-pulse__text--link" target="_blank" rel="noopener noreferrer">
      {cell.text}
    </a>
  ) : (
    <p className="gv-gnl-pulse__text">{cell.text}</p>
  );

  return (
    <div className="gv-gnl-pulse__cell">
      <p className="gv-gnl-pulse__label">{label}</p>
      {body}
      {cell.source ? <p className="gv-gnl-pulse__source">{cell.source}</p> : null}
    </div>
  );
}

/** Top-of-day pulse — only renders when at least one signal has real content. */
export function GNLPulseSummary({ bundle }: Props): React.ReactElement | null {
  const [highPriority, setHighPriority] = useState<HighPriorityIntelItem[]>([]);
  const [beatIntel, setBeatIntel] = useState<BeatIntelItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchHighPriorityIntel()
      .then((items) => {
        if (!cancelled) setHighPriority(items);
      })
      .catch(() => {});
    void fetchBeatIntel()
      .then((items) => {
        if (!cancelled) setBeatIntel(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ticker = bundle.ticker ?? [];

  const cells = useMemo(() => {
    const list = [
      pickStoryline(ticker),
      pickRecruitingFromIntel(highPriority) ?? pickRecruitingFallback(ticker, bundle),
      pickBeatQuoteFromIntel(beatIntel) ?? pickBeatQuoteFallback(bundle),
      pickPortalNote(bundle),
    ].filter((cell): cell is PulseCell => Boolean(cell?.text?.trim()));
    return list;
  }, [ticker, bundle, highPriority, beatIntel]);

  if (!cells.length) return null;

  return (
    <section
      className="gv-gnl-elite-card gv-gnl-pulse"
      aria-label="Today's UF Football Pulse"
      data-testid="gnl-pulse-summary"
    >
      <GNLModuleHead
        title="Top of day"
        subtitle="Signals that are actually moving right now"
        badge={<GNLDashBadge label="PULSE" tone="team" />}
      />
      <div className={`gv-gnl-pulse__grid gv-gnl-pulse__grid--${Math.min(cells.length, 4)}`}>
        {cells.map((cell) => (
          <PulseQuadrant key={cell.label} label={cell.label} cell={cell} />
        ))}
      </div>
    </section>
  );
}
