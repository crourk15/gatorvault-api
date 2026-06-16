'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Chip, GridLayout, PageLayout, PageSection } from '@/components/brand';
import { fetchNilDashboard, type NilDashboard, type NilEvent, type NilProgramRow } from '@/lib/nil-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

function formatUpdated(iso?: string): string {
  if (!iso) return '';
  try {
    return `Updated ${new Date(iso).toLocaleString()}`;
  } catch {
    return '';
  }
}

function trendLabel(trend?: string, pct?: number): string {
  if (!trend) return '—';
  const sign = pct != null && pct > 0 ? '+' : '';
  return `${trend}${pct != null ? ` (${sign}${pct}%)` : ''}`;
}

export function VaultNilPage(): React.ReactElement {
  const [data, setData] = useState<NilDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchNilDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load NIL dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uf = data?.ufStanding;
  const rankings = data?.secRankings ?? [];
  const events = data?.recentEvents ?? [];
  const positions = data?.positionImpact ?? [];
  const trend = data?.trendHistory ?? [];

  return (
    <PageLayout
      theme="white"
      title="NIL Tracker"
      subtitle="SEC NIL standing — where Florida ranks, trend over time, position impact, and recruiting correlation."
      testId="vault-nil"
      accent={data?.updatedAt ? <Chip variant="neutral">{formatUpdated(data.updatedAt)}</Chip> : null}
    >

      {loading && <p className="gv-page-status">Loading NIL dashboard…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && data && (
        <>
          <PageSection title="Player Valuations">
            <GridLayout cols={3}>
              <Card variant="stat">
                <p className="gv-stat-card__value">#{uf?.secRank ?? '—'}</p>
                <p className="gv-stat-card__label">SEC Rank</p>
              </Card>
              <Card>
                <p className="gv-type-label">National Rank</p>
                <p className="gv-type-number" style={{ fontSize: '2rem', color: 'var(--gv-orange)' }}>
                  #{uf?.nationalRank ?? '—'}
                </p>
              </Card>
              <Card>
                <p className="gv-type-label">Est. Annual Pool</p>
                <p className="gv-type-number" style={{ fontSize: '2rem', color: 'var(--gv-orange)' }}>
                  {uf?.estimatedAnnualPoolM != null ? `$${uf.estimatedAnnualPoolM}M` : '—'}
                </p>
              </Card>
            </GridLayout>
          </PageSection>

          <div className="gv-nil__kpis">
            <div className="gv-recruit-stat">
              <span>SEC Rank</span>
              <strong>{uf?.secRank ?? '—'}</strong>
            </div>
            <div className="gv-recruit-stat">
              <span>National Rank</span>
              <strong>{uf?.nationalRank ?? '—'}</strong>
            </div>
            <div className="gv-recruit-stat">
              <span>Est. Annual Pool</span>
              <strong>{uf?.estimatedAnnualPoolM != null ? `$${uf.estimatedAnnualPoolM}M` : '—'}</strong>
            </div>
            <div className="gv-recruit-stat">
              <span>Collective</span>
              <strong>{uf?.collective ?? '—'}</strong>
            </div>
          </div>

          <div className="gv-nil__grid">
            <section className="gv-nil__panel">
              <h2 className="gv-vault-alerts__section-title">SEC NIL Rankings</h2>
              <div className="gv-nil__table-wrap">
                <table className="gv-nil__table">
                  <thead>
                    <tr>
                      <th>SEC</th>
                      <th>Program</th>
                      <th>Score</th>
                      <th>Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((row: NilProgramRow) => (
                      <tr
                        key={row.id}
                        className={row.name?.toLowerCase().includes('florida') ? 'is-uf' : ''}
                      >
                        <td>{row.ranking?.secRank ?? '—'}</td>
                        <td>{row.name}</td>
                        <td>{row.ranking?.score ?? '—'}</td>
                        <td>
                          {row.metrics?.estimatedAnnualPoolM != null
                            ? `$${row.metrics.estimatedAnnualPoolM}M`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rankings.length === 0 && <UiEmpty message="No SEC rankings available." />}
            </section>

            <section className="gv-nil__panel">
              <h2 className="gv-vault-alerts__section-title">UF Trend &amp; Position Impact</h2>
              {uf ? (
                <p className="gv-nil__trend">
                  UF trend: <strong>{trendLabel(uf.trend, uf.trendPct)}</strong>
                </p>
              ) : null}
              {trend.length > 0 && (
                <ul className="gv-nil__trend-list">
                  {trend.map((t) => (
                    <li key={t.period}>
                      {t.period}: {t.valueM != null ? `$${t.valueM}M` : '—'}{' '}
                      {t.trendPct != null ? `(${t.trendPct > 0 ? '+' : ''}${t.trendPct}%)` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {positions.length > 0 && (
                <ul className="gv-nil__position-list">
                  {positions.map((p) => (
                    <li key={p.position}>
                      <span>{p.position}</span>
                      <strong>{p.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {data.recruitingCorrelation?.note ? (
                <p className="gv-nil__corr">{data.recruitingCorrelation.note}</p>
              ) : null}
            </section>
          </div>

          <PageSection title="Deal Tracker">
            <section className="gv-nil__panel">
              <h2 className="gv-vault-alerts__section-title">Recent UF NIL Events</h2>
            <ul className="gv-nil__events">
              {events.map((ev: NilEvent, i) => (
                <li key={ev.id ?? i} className="gv-nil__event">
                  <p className="gv-nil__event-title">{ev.title}</p>
                  {ev.summary ? <p className="gv-nil__event-summary">{ev.summary}</p> : null}
                  <p className="gv-nil__event-meta">
                    {ev.date ? new Date(ev.date).toLocaleDateString() : ''}
                    {ev.impact ? ` · ${ev.impact}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            {events.length === 0 && <UiEmpty message="No recent NIL events." />}
            </section>
          </PageSection>

          <PageSection title="UF Collective Activity">
            <Card variant="accent">
              <Chip variant="blue">{uf?.collective ?? 'Gators Collective'}</Chip>
              {data.recruitingCorrelation?.note ? (
                <p className="gv-nil__corr" style={{ marginTop: '0.75rem' }}>{data.recruitingCorrelation.note}</p>
              ) : (
                <p style={{ marginTop: '0.75rem' }}>Collective activity tracked weekly.</p>
              )}
            </Card>
          </PageSection>

          <PageSection title="Top Earners">
            <GridLayout cols={3}>
              {rankings.slice(0, 3).map((row: NilProgramRow) => (
                <Card key={row.id}>
                  <strong>{row.name}</strong>
                  <p style={{ color: 'var(--gv-orange)', fontWeight: 800, margin: '0.35rem 0' }}>
                    {row.metrics?.estimatedAnnualPoolM != null ? `$${row.metrics.estimatedAnnualPoolM}M` : '—'}
                  </p>
                </Card>
              ))}
            </GridLayout>
          </PageSection>

          <p className="gv-nil__disclaimer">
            NIL estimates are directional — not audited financials. Rankings reflect modeled collective
            activity and public signals.
          </p>
        </>
      )}
    </PageLayout>
  );
}
