'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './recruiting-hub.css';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { RecruitingClassYearProvider } from '@/components/recruiting-hub/elite/RecruitingClassYearProvider';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import {
  fetchHighPriorityTargets,
  type FlipWatchRow,
  type HighPriorityResponse,
} from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';

type Props = {
  year: number;
};

function ElsewhereCard({ row, rank }: { row: FlipWatchRow; rank: number }): React.ReactElement {
  const href = playerProfileRoute(row.slug, 'recruiting');
  const school = row.committedTo || row.committedShort || 'Elsewhere';
  const logo = schoolLogoUrl(school);
  const metaBits = [
    row.position ? String(row.position) : null,
    row.stars && row.stars > 0 ? `${row.stars}\u2605` : null,
  ].filter(Boolean);

  return (
    <a href={href} className="rh-elsewhere-card" data-testid={`rh-elsewhere-${row.slug}`}>
      <span className="rh-elsewhere-card__rank">#{rank}</span>
      <div className="rh-elsewhere-card__body">
        <strong className="rh-elsewhere-card__name">{row.name}</strong>
        {metaBits.length ? (
          <span className="rh-elsewhere-card__meta">{metaBits.join(' · ')}</span>
        ) : null}
        <span className="rh-elsewhere-card__commit">
          {logo ? (
            // ESPN CDN NCAA marks — same source as battle boards.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={28} height={28} loading="lazy" decoding="async" />
          ) : (
            <span className="rh-elsewhere-card__logo-fallback">{schoolLogoInitials(school)}</span>
          )}
          <span>
            Committed to <em>{school}</em>
          </span>
        </span>
      </div>
    </a>
  );
}

export function ClassTargetsPage({ year }: Props): React.ReactElement {
  const [data, setData] = useState<HighPriorityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchHighPriorityTargets(year)
      .then((payload) => {
        setData(payload);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load targets.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const narrativeBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.movementNarratives ?? []) {
      if (row.movementNarrative) map.set(row.slug, row.movementNarrative);
    }
    return map;
  }, [data?.movementNarratives]);

  const players = useMemo(() => {
    const list = [...(data?.players ?? [])];
    list.sort((a, b) => {
      const prio = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      if (prio !== 0) return prio;
      return (b.ufProbability ?? 0) - (a.ufProbability ?? 0);
    });
    return list;
  }, [data?.players]);

  const elsewhere = useMemo(() => {
    if (year < 2028) return [] as FlipWatchRow[];
    return [...(data?.flipWatch ?? [])];
  }, [data?.flipWatch, year]);

  return (
    <RecruitingClassYearProvider initialYear={year}>
      <div className="rh-page rh-page--elite mobile-app" data-testid={`rh-${year}-targets-board`}>
        <div className="rh-frame rh-elite-chrome">
          <RecruitingHeroStripInline />
          <p className="rh-elite-back-link">
            <a href="/vault/recruiting">← Recruiting</a>
          </p>

          <section>
            <h2 className="rh-panel-title">{year} priority chase board</h2>
            <p className="rh-muted">
              Who Florida is chasing hardest — ranked by GatorVault priority.
            </p>
          </section>

          {loading && <p className="gv-page-status">Loading targets…</p>}

          {error && !loading && (
            <UiError message={error} retry={load} backHref="/vault/recruiting" backLabel="← Recruiting" />
          )}

          {!loading && !error && players.length === 0 && (
            <UiEmpty message="No targets on the board yet." hint="Check back after the next intel refresh." />
          )}

          {!loading && !error && players.length > 0 && (
            <div className="gv-hp-board-grid">
              {players.map((player, idx) => (
                <HighPriorityTargetCard
                  key={player.slug}
                  player={player}
                  rank={idx + 1}
                  movementNarrative={narrativeBySlug.get(player.slug)}
                />
              ))}
            </div>
          )}

          {!loading && !error && elsewhere.length > 0 ? (
            <section className="rh-elsewhere-lane" data-testid={`rh-${year}-elsewhere-lane`}>
              <h2 className="rh-panel-title">Committed elsewhere</h2>
              <p className="rh-muted">
                Vault prospects already committed — kept in this room so they never look like open
                targets.
              </p>
              <div className="rh-elsewhere-grid">
                {elsewhere.map((row, idx) => (
                  <ElsewhereCard key={row.slug} row={row} rank={row.flipRank ?? idx + 1} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </RecruitingClassYearProvider>
  );
}
