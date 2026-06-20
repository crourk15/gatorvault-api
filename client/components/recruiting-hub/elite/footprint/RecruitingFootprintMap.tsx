'use client';

import React, { useCallback, useState } from 'react';
import {
  fetchRecruitingHubFootprint,
  type RhHubFootprintState,
} from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';
import { momentumSymbol } from '@/lib/recruiting-hub-scoring';
import { StateHeatLayer } from './StateHeatLayer';
import { TargetPinsLayer } from './TargetPinsLayer';
import { BattleDifficultyLayer } from './BattleDifficultyLayer';
import { MomentumLayer } from './MomentumLayer';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 520;

function FootprintTooltip({ state }: { state: RhHubFootprintState }): React.ReactElement {
  return (
    <div className="rh-footprint-tooltip">
      <div className="rh-footprint-tooltip__title">
        {state.state} {momentumSymbol(state.momentum)}
      </div>
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
          <dt>UF Score</dt>
          <dd>{state.ufScore}</dd>
        </div>
        <div>
          <dt>Pipeline</dt>
          <dd>{state.pipelineScore}</dd>
        </div>
      </dl>
      {state.topPlayers.length > 0 ? (
        <ul className="rh-footprint-tooltip__players">
          {state.topPlayers.slice(0, 3).map((p) => (
            <li key={p.id}>
              {p.name} · {p.position} · UF {p.ufScore}
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
          Geographic pipeline intelligence — targets, commits, battles, and momentum by state.
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
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                className="rh-footprint-map__svg"
                role="img"
                aria-label="United States recruiting footprint map"
              >
                <rect
                  x={0}
                  y={0}
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  className="rh-footprint-map__bg"
                />
                <StateHeatLayer
                  states={states}
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  hoveredState={hoveredState}
                  onHover={setHoveredState}
                />
                <BattleDifficultyLayer states={states} width={MAP_WIDTH} height={MAP_HEIGHT} />
                <TargetPinsLayer pins={pins} width={MAP_WIDTH} height={MAP_HEIGHT} />
                <MomentumLayer states={states} width={MAP_WIDTH} height={MAP_HEIGHT} />
              </svg>
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
                      Commit / UF strong (≥70)
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--orange" />
                      UF lean / contested
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--red" />
                      Trailing (&lt;40)
                    </li>
                    <li>
                      <span className="rh-footprint-legend__swatch rh-footprint-legend__swatch--purple" />
                      Flip watch / battle
                    </li>
                  </ul>
                  <p className="rh-footprint-legend__hint">Hover a state for targets, commits, and pipeline stats.</p>
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
