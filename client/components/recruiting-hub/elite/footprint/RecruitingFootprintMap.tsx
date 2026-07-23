'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ComposableMap, Geographies } from 'react-simple-maps';
import type { RhHubFootprintResponse, RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubFootprint } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import type { RecruitingClassYear } from '@/lib/recruiting-cycle';
import { StateHeatLayer } from './StateHeatLayer';
import { TargetPinsLayer } from './TargetPinsLayer';
import { BattleDifficultyLayer } from './BattleDifficultyLayer';
import { US_MAP_GEO_URL } from './state-geo-utils';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 560;
const FOOTPRINT_YEARS = [2027, 2028] as const;
/** Keep footprint locked in the viewport while hub sections above reflow on year change. */
const YEAR_SCROLL_PIN_MS = 2400;

function momentumLabel(momentum: RhHubFootprintState['momentum']): string {
  if (momentum === 'up') return 'Gaining';
  if (momentum === 'down') return 'Slipping';
  return 'Holding';
}

function classStory(year: number): { kicker: string; subtitle: string } {
  if (year >= 2028) {
    return {
      kicker: 'Early discovery',
      subtitle: 'Where Florida is planting the next class — early targets and state heat.',
    };
  }
  return {
    kicker: 'Active board',
    subtitle: 'Where Florida is winning and fighting right now — commits, targets, visits.',
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
        <p className="rh-footprint-intel__kicker">Class {year} · State room</p>
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
  const { activeYear, setActiveYear } = useRecruitingClassYear();
  const footprintYear = (FOOTPRINT_YEARS as readonly number[]).includes(activeYear)
    ? activeYear
    : 2027;
  const stageRef = useRef<HTMLDivElement>(null);
  const pinViewportTopRef = useRef<number | null>(null);
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

  const selectFootprintYear = useCallback(
    (year: RecruitingClassYear) => {
      if (year === footprintYear) return;
      // Capture before setState — hub sections above collapse while the new class loads.
      pinViewportTopRef.current = stageRef.current?.getBoundingClientRect().top ?? null;
      setActiveYear(year);
    },
    [footprintYear, setActiveYear]
  );

  useLayoutEffect(() => {
    const pinnedTop = pinViewportTopRef.current;
    const el = stageRef.current;
    if (pinnedTop == null || !el) return;

    let alive = true;
    const adjust = () => {
      if (!alive || pinViewportTopRef.current == null) return;
      const delta = el.getBoundingClientRect().top - pinViewportTopRef.current;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy(0, delta);
      }
    };

    adjust();
    const root = el.closest('.rh-elite-chrome') ?? document.body;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(adjust) : null;
    ro?.observe(root);

    let rafId = 0;
    const tick = () => {
      if (!alive) return;
      adjust();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    const stopId = window.setTimeout(() => {
      alive = false;
      pinViewportTopRef.current = null;
      ro?.disconnect();
      window.cancelAnimationFrame(rafId);
    }, YEAR_SCROLL_PIN_MS);

    return () => {
      alive = false;
      ro?.disconnect();
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(stopId);
    };
  }, [footprintYear, loading]);

  const states = footprint?.states ?? [];
  const pins = footprint?.pins ?? [];
  const story = classStory(footprintYear);
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
    <div ref={stageRef} className="rh-footprint-stage" data-year={footprintYear}>
      <div className="rh-footprint-stage__top">
        <p className="rh-footprint-stage__kicker">{story.kicker}</p>
        <h2 className="rh-footprint-stage__title">Recruiting Footprint</h2>
        <p className="rh-footprint-stage__sub">{story.subtitle}</p>

        <div className="rh-footprint-year-tabs" role="tablist" aria-label="Footprint class year">
          {FOOTPRINT_YEARS.map((year) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={footprintYear === year}
              className={`rh-footprint-year-tab${footprintYear === year ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectFootprintYear(year as RecruitingClassYear)}
            >
              Class {year}
            </button>
          ))}
        </div>
      </div>

      <div className="rh-footprint-scoreboard" aria-label={`Class ${footprintYear} footprint scoreboard`}>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{loading ? '—' : scoreboard.commits}</span>
          <span className="rh-footprint-scoreboard__label">Commits</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{loading ? '—' : scoreboard.targets}</span>
          <span className="rh-footprint-scoreboard__label">Targets</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">{loading ? '—' : scoreboard.visits}</span>
          <span className="rh-footprint-scoreboard__label">Visits</span>
        </div>
        <div className="rh-footprint-scoreboard__cell">
          <span className="rh-footprint-scoreboard__value">
            {loading ? '—' : scoreboard.battles || scoreboard.states}
          </span>
          <span className="rh-footprint-scoreboard__label">
            {scoreboard.battles ? 'Battles' : 'States'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rh-skeleton rh-footprint-skeleton" data-testid="rh-elite-footprint" aria-hidden="true" />
      ) : !footprint || error ? (
        <section className="rh-card rh-footprint-map" data-testid="rh-elite-footprint">
          <p className="rh-empty">Could not load recruiting footprint map.</p>
        </section>
      ) : !states.length ? (
        <section className="rh-card rh-footprint-map" data-testid="rh-elite-footprint">
          <p className="rh-empty">No state-level recruiting data available yet.</p>
        </section>
      ) : (
        <section className="rh-card rh-footprint-map" data-testid="rh-elite-footprint">
          <div className="rh-footprint-map__stack">
            <div className="rh-footprint-map__canvas-wrap">
              <div className="rh-footprint-map__canvas-glow" aria-hidden="true" />
              <ComposableMap
                projection="geoAlbersUsa"
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                className="rh-footprint-map__svg"
                {...({ projectionConfig: { scale: 1070 } } as Record<string, unknown>)}
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
                <FootprintIntel state={activeState} year={footprintYear} />
              ) : (
                <div className="rh-footprint-legend">
                  <h3 className="rh-footprint-legend__title">Tap a lit state</h3>
                  <p className="rh-footprint-legend__hint">
                    Hotter blue = more Florida activity. Orange pins are commits. Blue pins are
                    targets. Gold pins are battles.
                  </p>
                  <div className="rh-footprint-summary">
                    <span>{scoreboard.states} active states</span>
                    <span>{scoreboard.pins} map pins</span>
                  </div>
                  <a
                    className="rh-footprint-intel__cta"
                    href={`/vault/recruiting/${footprintYear}/targets/`}
                  >
                    Open Class {footprintYear} targets →
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
