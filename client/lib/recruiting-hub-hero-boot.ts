/**
 * Inline boot script for recruiting hub — paints hero from API before React bundle.
 * Injected as a server-rendered <script> in RecruitingHubHeroSsr.
 */
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export const RECRUITING_HUB_HERO_YEAR = ACTIVE_RECRUITING_CLASS_YEAR;

/** Minimal inline script — fetches hero, sets window.__GV_HERO__, updates DOM. */
export function recruitingHubHeroBootScript(year = RECRUITING_HUB_HERO_YEAR): string {
  const safeYear = Number.isFinite(year) ? year : RECRUITING_HUB_HERO_YEAR;
  return `(function(){
  try {
    var start = performance.now();
    window.__GV_HUB__ = window.__GV_HUB__ || {};
    window.__GV_HUB__.start = start;
    window.__GV_HUB__.year = ${safeYear};

    function paintHero(data) {
      if (!data) return;
      window.__GV_HERO__ = data;
      window.__GV_HUB__.heroRenderMs = Math.round(performance.now() - start);
      var root = document.querySelector('[data-hydrate="hero"]');
      if (!root) return;
      root.classList.remove('hero-skeleton');

      var title = root.querySelector('[data-hero-field="title"]');
      var subtitle = root.querySelector('[data-hero-field="subtitle"]');
      if (title && data.title) title.textContent = data.title;
      if (subtitle && data.subtitle) subtitle.textContent = data.subtitle;

      var years = data.classYears || [2026, 2027, 2028];
      var yearRow = root.querySelector('[data-hero-field="year-tabs"]');
      if (yearRow) {
        yearRow.innerHTML = years.map(function(y) {
          var active = y === (data.year || ${safeYear});
          return '<button type="button" class="rh-hero-year-tab' + (active ? ' is-active' : '') + '" data-year="' + y + '" disabled>' + y + '</button>';
        }).join('');
      }

      var metrics = data.classOverview || {};
      var fields = [
        ['classRank', 'class-rank'],
        ['blueChip', 'blue-chip'],
        ['commits', 'commits'],
        ['avgRating', 'avg-rating']
      ];
      fields.forEach(function(pair) {
        var node = root.querySelector('[data-hero-metric="' + pair[1] + '"]');
        if (node && metrics[pair[0]] != null) node.textContent = metrics[pair[0]];
      });

      var tickerTrack = root.querySelector('[data-hero-field="ticker-track"]');
      var items = (data.ticker && data.ticker.length) ? data.ticker : [];
      if (tickerTrack && items.length) {
        var html = items.map(function(item) {
          return '<span class="rh-hero-ticker-item">' + item + '<span class="rh-hero-ticker-sep">·</span></span>';
        }).join('');
        tickerTrack.innerHTML = html + html;
      }
    }

    var heroUrl = '/api/recruiting/hub/hero?year=${safeYear}';
    function loadHero(attempt) {
      fetch(heroUrl, { credentials: 'same-origin' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(body) { paintHero(body && body.ok !== false ? body : null); })
        .catch(function() {
          if (attempt < 1) setTimeout(function() { loadHero(attempt + 1); }, 1500);
        });
    }
    loadHero(0);
  } catch (e) {}
})();`;
}
