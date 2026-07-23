'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies } from 'react-simple-maps';
import type { RhHubFootprintResponse, RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubFootprint } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { StateHeatLayer } from './StateHeatLayer';
import { TargetPinsLayer } from './TargetPinsLayer';
import { BattleDifficultyLayer } from './BattleDifficultyLayer';
import { US_MAP_GEO_URL } from './state-geo-utils';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 520;

function momentumLabel(momentum: RhHubFootprintState['momentum']): string {
  if (momentum === 'up') return 'Gaining';
  if (momentum === 'down') return 'Slipping';
  return 'Holding';
}

function classStory(year: number): { kicker: string; subtitle: string } {
  if (year >= 2028) {
    return {
      kicker: 'Early discovery',
      subtitle: 'Building the next Florida pipeline — early targets, visits, and state heat.',
    };
  }
  return {
    kicker: 'Active board',
    subtitle: 'UF recruiting pipeline by state — commits, targets, visits, and battles.',
  };
}

function FootprintIntel({
  state,
  year,
}: {
  state: RhHubFootprintState;
  year: number;
}): React.ReactElement {
  return (
    <div className="rh-footprint-intel">
      <div className="rh-footprint-intel__head">
        <p className="rh-footprint-intel__kicker">{year} · State room</p>
        <h3 className="rh-footprint-intel__title">{state.state}</h3>
        <p className={`rh-footprint-intel__momentum rh-footprint-intel__momentum--${state.momentum}`}>
          {momentumLabel(state.momentum)}
          {state.pipelineScore > 0 ? ` · Pipeline ${state.pipelineScore}` : ''}
        </p>
      </div>
      <dl className="rh-footprint-intel__stats">
        <div>
          <dt>Targets</dt>
          <dd>{state.targets}</dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>{state.commits}</dd>
        </div>
        <div>
          <dt>Offers</dt>
          <dd>{state.offers}</dd>
        </div>
        <div>
          <dt>Visits</dt>
          <dd>{state.visits}</dd>
        </div>
        {state.ufScore != null ? (
          <div>
            <dt>UF lean</dt>
            <dd>{state.ufScore}</dd>
          </div>
        ) : null}
        {state.competitorPressure != null && state.competitorPressure > 0 ? (
          <div>
            <dt>Pressure</dt>
            <dd>{state.competitorPressure}</dd>
          </div>
        ) : null}
      </dl>
      {state.topPlayers.length > 0 ? (
        <div className="rh-footprint-intel__players">
          <h4 className="rh-footprint-intel__label">Top names</h4>
          <ul>
            {state.topPlayers.slice(0, 4).map((p) => (
              <li key={p.id}>
                <span className="rh-footprint-intel__name">{p.name}</span>
                <span className="rh-footprint-intel__meta">
                  {p.position}
                  {p.status === 'commit' ? ' · Commit' : ' · Target'}
                  {p.ufScore != null ? ` · UF ${p.ufScore}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.staffActivity.length > 0 ? (
        <div className="rh-footprint-intel__staff">
          <h4 className="rh-footprint-intel__label">Staff activity</h4>
          {state.staffActivity.slice(0, 3).map((s) => (
            <p key={s.staffId}>
              {s.name} · {s.role} · {s.assignedPlayers} assigned
              {s.wins + s.losses > 0 ? ` · ${s.wins}W/${s.losses}L` : ''}
            </p>
          ))}
        </div>
      ) : null}
      <a className="rh-footprint-intel__cta" href={`/vault/recruiting/${year}/targets/`}>
        Open {year} targets →
      </a>
    </div>
  );
}

export function RecruitingFootprintMap(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const selectFootprint = useCallback((b: { footprint: RhHubFootprintResponse }) => b.footprint, []);
  const fetchFootprint = useCallback(
    (year: number) => fetchRecruitingHubFootprint(year),
    []
  );
  const { data: footprint, loading, error } = useHubBundleSection({
    select: selectFootprint,
    fetchFallback: fetchFootprint,
  });
  const [activeStateCode, setActiveStateCode] = useState<string | null>(null);

  useEffect(() => {
    setActiveStateCode(null);
  }, [activeYear]);

  const states = footprint?.states ?? [];
  const pins = footprint?.pins ?? [];
  const story = classStory(activeYear);
  const activeState = activeStateCode ? states.find((s) => s.state === activeStateCode) : null;

  const scoreboard = useMemo(() => {
    const commits = states.reduce((n, s) => n + (s.commits || 0), 0);
    const targets = states.reduce((n, s) => n + (s.targets || 0), 0);
    const visits = states.reduce((n, s) => n + (s.visits || 0), 0);
    const battles = pins.filter((p) => p.pinType === 'battle').length;
    return {
      commits,
      targets,
      visits,
      battles,
      states: states.filter((s) => s.pipelineScore > 0).length,
      pins: pins.length,
    };
  }, [states, pins]);

  return (
    <div className="rh-footprint-stage" data-year={activeYear}>
      <div className="rh-section-header rh-footprint-stage__header">
        <div>
          <p className="rh-footprint-stage__kicker">{story.kicker}</p>
          <div className="rh-section-title">Recruiting Footprint</div>
          <div className="rh-section-subtitle">{story.subtitle}</div>
        </div>
        <div className="rh-footprint-year-chip" aria-label={`Class ${activeYear}`}>
          Class {activeYear}
        </div>
      </div>

      <div className="rh-footprint-scoreboard" aria-label={`${activeYear} footprint scoreboard`}>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{scoreboard.commits}</span>
          <span className="rh-footprint-scoreboard__label">Commits</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{scoreboard.targets}</span>
          <span className="rh-footprint-scoreboard__label">Targets</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{scoreboard.visits}</span>
          <span className="rh-footprint-scoreboard__label">Visits</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">
            {scoreboard.battles || scoreboard.states}
          </span>
          <span className="rh-footprint-scoreboard__label">
            {scoreboard.battles ? 'Battles' : 'States'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rh-skeleton rh-footprint-skeleton" data-testid="rh-elite-footprint" aria-hidden="true" />
      ) : !footprint || error ? (
        <section className="rh-card" data-testid="rh-elite-footprint">
          <p className="rh-empty">Could not load recruiting footprint map.</p>
        </section>
      ) : !states.length ? (
        <section className="rh-card" data-testid="rh-elite-footprint">
          <p className="rh-empty">No state-level recruiting data available yet.</p>
        </section>
      ) : (
        <section className="rh-card rh-footprint-map" data-testid="rh-elite-footprint">
          <div className="rh-footprint-map__layout">
            <div className="rh-footprint-map__canvas-wrap">
              <div className="rh-footprint-map__canvas-glow" aria-hidden="true" />
              <ComposableMap
                projection="geoAlbersUsa"
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                className="rh-footprint-map__svg"
              >
                <Geographies geography={US_MAP_GEO_URL}>
                  {({ geographies }) => (
                    <>
                      <StateHeatLayer
                        geographies={geographies}
                        states={states}
                        activeState={activeStateCode}
                        onActivate={setActiveStateCode}
                      />
                      <BattleDifficultyLayer geographies={geographies} states={states} />
                    </>
                  )}
                </Geographies>
                <TargetPinsLayer pins={pins} />
              </ComposableMap>
              <div className="rh-footprint-map__pin-legend" aria-hidden="true">
                <span>
                  <i className="rh-footprint-dot rh-footprint-dot--commit" /> Commit
                </span>
                <span>
                  <i className="rh-footprint-dot rh-footprint-dot--target" /> Target
                </span>
                <span>
                  <i className="rh-footprint-dot rh-footprint-dot--battle" /> Battle
                </span>
              </div>
            </div>
            <aside className="rh-footprint-map__sidebar">
              {activeState ? (
                <FootprintIntel state={activeState} year={activeYear} />
              ) : (
                <div className="rh-footprint-legend">
                  <h3 className="rh-footprint-legend__title">Read the map</h3>
                  <ul className="rh-footprint-legend__list">
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--blue" />
                      Hotter fill = stronger pipeline
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--orange" />
                      Orange border = selected state
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--pin-commit" />
                      Orange pin = commit
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--pin-target" />
                      Blue pin = target
                    </li>
                  </ul>
                  <p className="rh-footprint-legend__hint">
                    Tap a lit state for names, visits, momentum, and staff activity. Switch class year
                    above to flip between the 2027 board and 2028 discovery map.
                  </p>
                  <div className="rh-footprint-summary">
                    <span>{scoreboard.states} active states</span>
                    <span>{scoreboard.pins} map pins</span>
                  </div>
                  <a className="rh-footprint-intel__cta" href={`/vault/recruiting/${activeYear}/targets/`}>
                    Open {activeYear} targets →
                  </a>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
