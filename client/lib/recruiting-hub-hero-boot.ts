/**
 * Inline boot script for recruiting hub — paints hero + class sections from API before React bundle.
 */
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export const RECRUITING_HUB_HERO_YEAR = ACTIVE_RECRUITING_CLASS_YEAR;

/** Minimal inline script — fetches hero + class metrics, sets window.__GV_HUB__, updates DOM. */
export function recruitingHubHeroBootScript(year = RECRUITING_HUB_HERO_YEAR): string {
  const safeYear = Number.isFinite(year) ? year : RECRUITING_HUB_HERO_YEAR;
  return `(function(){
  function run() {
    try {
      var start = performance.now();
      window.__GV_HUB__ = window.__GV_HUB__ || {};
      window.__GV_HUB__.start = start;
      window.__GV_HUB__.year = ${safeYear};
      window.__GV_HUB__.metricsByYear = window.__GV_HUB__.metricsByYear || {};

      function paintMetricFields(root, metrics) {
        if (!root || !metrics) return;
        var map = [
          ['classRank', 'class-rank'],
          ['blueChip', 'blue-chip'],
          ['commits', 'commits'],
          ['avgRating', 'avg-rating']
        ];
        map.forEach(function(pair) {
          var node = root.querySelector('[data-rh-field="' + pair[1] + '"]');
          if (node && metrics[pair[0]] != null) node.textContent = metrics[pair[0]];
        });
      }

      function paintClassSections() {
        var byYear = window.__GV_HUB__.metricsByYear || {};
        var activeYear = window.__GV_HUB__.year || ${safeYear};
        var overview = document.querySelector('[data-rh-boot="class-overview"]');
        if (overview && byYear[activeYear]) {
          paintMetricFields(overview, byYear[activeYear]);
          overview.classList.remove('rh-boot-loading');
          overview.setAttribute('data-rh-boot-painted', 'true');
        }
        [2026, 2027, 2028].forEach(function(y) {
          var card = document.querySelector('[data-rh-boot="class-card-' + y + '"]');
          var metrics = byYear[y];
          if (!card || !metrics) return;
          paintMetricFields(card, metrics);
          card.classList.remove('rh-boot-loading');
          card.setAttribute('data-rh-boot-painted', 'true');
        });
        window.dispatchEvent(new CustomEvent('gv-hub-boot'));
      }

      function storeMetrics(year, data) {
        if (!data) return;
        window.__GV_HUB__.metricsByYear[year] = data.classOverview || data;
      }

      function paintHero(data) {
        if (!data) return;
        window.__GV_HERO__ = data;
        window.__GV_HUB__.heroRenderMs = Math.round(performance.now() - start);
        if (data.classOverview) {
          storeMetrics(data.year || ${safeYear}, data.classOverview);
          paintClassSections();
        }
        var root = document.querySelector('[data-hydrate="hero"]');
        if (!root) return;
        root.classList.remove('hero-skeleton');
        var metricsWrap = root.querySelector('.rh-hero-metrics');
        if (metricsWrap) metricsWrap.classList.remove('hero-skeleton__metrics');

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
        if (tickerTrack) tickerTrack.remove();
        window.dispatchEvent(new CustomEvent('gv-hero-boot'));
      }

      function loadClassMetrics(years, attempt) {
        var pending = years.length;
        if (!pending) return;
        years.forEach(function(y) {
          fetch('/api/recruiting/class-metrics?year=' + y, { credentials: 'same-origin', cache: 'no-store' })
            .then(function(res) {
              if (!res.ok) throw new Error('metrics ' + res.status);
              return res.json();
            })
            .then(function(body) {
              if (body && body.status === 'building') throw new Error('building');
              storeMetrics(y, body);
            })
            .catch(function() {
              if (attempt < 6) {
                setTimeout(function() { loadClassMetrics([y], attempt + 1); }, 1200);
              }
            })
            .finally(function() {
              pending -= 1;
              if (pending === 0) paintClassSections();
            });
        });
      }

      var heroUrl = '/api/recruiting/hub/hero?year=${safeYear}';
      function loadHero(attempt) {
        fetch(heroUrl, { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) {
            if (!res.ok) throw new Error('hero ' + res.status);
            return res.json();
          })
          .then(function(body) {
            if (body && body.status === 'building') throw new Error('hero building');
            paintHero(body && body.ok !== false ? body : null);
          })
          .catch(function() {
            if (attempt < 8) setTimeout(function() { loadHero(attempt + 1); }, 1000);
          });
      }
      loadHero(0);
      loadClassMetrics([2026, 2027, 2028], 0);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();`;
}
