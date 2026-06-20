'use client';

import React, { useCallback, useState } from 'react';
import { ComposableMap, Geographies } from 'react-simple-maps';
import {
  fetchRecruitingHubFootprint,
  type RhHubFootprintState,
} from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';
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

function FootprintTooltip({ state }: { state: RhHubFootprintState }): React.ReactElement {
  return (
    <div className="rh-footprint-tooltip">
      <div className="rh-footprint-tooltip__title">{state.state}</div>
      <dl className="rh-footprint-tooltip__stats">
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
        <div>
          <dt>Momentum</dt>
          <dd>{momentumLabel(state.momentum)}</dd>
        </div>
        <div>
          <dt>Pipeline</dt>
          <dd>{state.pipelineScore}</dd>
        </div>
        {state.ufScore != null ? (
          <div>
            <dt>UF Score</dt>
            <dd>{state.ufScore}</dd>
          </div>
        ) : null}
      </dl>
      {state.topPlayers.length > 0 ? (
        <ul className="rh-footprint-tooltip__players">
          {state.topPlayers.slice(0, 3).map((p) => (
            <li key={p.id}>
              {p.name} · {p.position}
              {p.ufScore != null ? ` · UF ${p.ufScore}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {state.staffActivity.length > 0 ? (
        <div className="rh-footprint-tooltip__staff">
          {state.staffActivity.slice(0, 2).map((s) => (
            <span key={s.staffId}>
              {s.name}: {s.assignedPlayers} assigned
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RecruitingFootprintMap(): React.ReactElement {
  const loadFootprint = useCallback(() => fetchRecruitingHubFootprint(), []);
  const { data, loading, error } = useRecruitingHubQuery(loadFootprint);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const states = data?.states ?? [];
  const pins = data?.pins ?? [];
  const activeState = hoveredState ? states.find((s) => s.state === hoveredState) : null;

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Recruiting Footprint Map</div>
        <div className="rh-section-subtitle">
          UF recruiting pipeline by state — real targets, commits, visits, and battles.
        </div>
      </div>

      {loading ? (
        <div className="rh-skeleton rh-footprint-skeleton" data-testid="rh-elite-footprint" aria-hidden="true" />
      ) : !data || error ? (
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
                        hoveredState={hoveredState}
                        onHover={setHoveredState}
                      />
                      <BattleDifficultyLayer geographies={geographies} states={states} />
                    </>
                  )}
                </Geographies>
                <TargetPinsLayer pins={pins} />
              </ComposableMap>
            </div>
            <aside className="rh-footprint-map__sidebar">
              {activeState ? (
                <FootprintTooltip state={activeState} />
              ) : (
                <div className="rh-footprint-legend">
                  <h3 className="rh-footprint-legend__title">Map Legend</h3>
                  <ul className="rh-footprint-legend__list">
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--blue" />
                      State fill — high pipeline activity
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--orange" />
                      State fill — moderate activity
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--gray" />
                      No recruiting activity
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--blue" />
                      Border — UF strong (score ≥70)
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--orange" />
                      Border — contested (40–69)
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--red" />
                      Border — trailing (&lt;40)
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--pin-commit" />
                      Pin — commit
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--pin-target" />
                      Pin — target / battle
                    </li>
                  </ul>
                  <p className="rh-footprint-legend__hint">
                    Hover a colored state for targets, commits, offers, visits, momentum, and pipeline score.
                  </p>
                  <div className="rh-footprint-summary">
                    <span>{states.length} active states</span>
                    <span>{pins.length} map pins</span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </>
  );
}
