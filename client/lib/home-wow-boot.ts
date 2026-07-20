/**
 * Inline boot for vault home — cache-only (no DOM mutation) so React hydrate stays clean.
 * Elite first paint comes from React seeds in HomePremiumPage.
 */
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';
import { RECRUITING_HUB_HERO_SEED } from '@/lib/recruiting-hub-hero-seed';
import { GNL_HUB_SEED } from '@/lib/gnl-hub-seed';

export function homeWowBootScript(year = ACTIVE_RECRUITING_CLASS_YEAR): string {
  const safeYear = Number.isFinite(year) ? year : ACTIVE_RECRUITING_CLASS_YEAR;
  const seedLiteral = JSON.stringify(RECRUITING_HUB_HERO_SEED);
  const beatSeed = (GNL_HUB_SEED.panels?.beatWriterHighlights ?? [])
    .filter((row) => String(row.text || '').trim())
    .slice(0, 3)
    .map((row, idx) => ({
      id: `seed-beat-${idx}`,
      text: String(row.text || '').trim(),
      writerName: row.writerName || row.handle || 'Beat Writer',
      source: row.source || 'UF Beat',
      url: row.url || null,
      timestamp: row.timestamp || new Date().toISOString(),
    }));
  const beatSeedLiteral = JSON.stringify(beatSeed);
  return `(function(){
  function run() {
    try {
      var year = ${safeYear};
      var SEED = ${seedLiteral};
      var BEAT_SEED = ${beatSeedLiteral};
      window.__GV_HOME_WOW__ = window.__GV_HOME_WOW__ || {};

      // Wake Render before heavier hub fetches (cold-start softener).
      try { fetch('/api/ping', { credentials: 'same-origin', cache: 'no-store' }).catch(function(){}); } catch (e) {}

      function fetchJson(url, attempt) {
        return fetch(url, { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) {
            if (!res.ok) throw new Error(String(res.status));
            return res.json();
          })
          .catch(function(err) {
            if (attempt >= 8) throw err;
            return new Promise(function(resolve) {
              setTimeout(function() { resolve(fetchJson(url, attempt + 1)); }, 2500);
            });
          });
      }

      function mapFcTarget(row) {
        var pct = row.ufProbability != null ? row.ufProbability : row.confidence;
        if (pct == null) return null;
        var num = pct <= 1 ? Math.round(pct * 100) : Math.round(pct);
        if (num <= 0) return null;
        return {
          name: row.fullName || row.name || 'Target',
          position: row.position || '—',
          ufPercent: num + '%'
        };
      }

      // Cache-only seeds — React owns first paint (avoids #418/#423 hydration mismatch).
      if (SEED && SEED.classOverview) {
        window.__GV_HOME_WOW__.metrics = SEED.classOverview;
      }
      if (BEAT_SEED && BEAT_SEED.length) {
        window.__GV_HOME_WOW__.beatItems = BEAT_SEED;
      }

      Promise.all([
        fetchJson('/api/recruiting/hub/bundle?year=' + year, 0).catch(function() { return null; }),
        fetchJson('/api/futurecast/home', 0).catch(function() { return null; }),
        fetchJson('/api/recruiting/intel/beat?limit=3', 0).catch(function() { return null; })
      ]).then(function(results) {
        var bundle = results[0];
        var metrics = bundle && bundle.classOverview ? bundle.classOverview : null;
        if (metrics) {
          window.__GV_HOME_WOW__.metrics = metrics;
          try {
            sessionStorage.setItem(
              'gv_class_metrics_v1:' + year,
              JSON.stringify({ at: Date.now(), data: metrics })
            );
          } catch (e) {}
        }
        var home = results[1];
        if (home) {
          var pool = [].concat(home.topTargets || [], home.trendingUp || [], home.trendingDown || []);
          var targets = [];
          var seen = {};
          for (var i = 0; i < pool.length; i += 1) {
            var mapped = mapFcTarget(pool[i]);
            if (!mapped) continue;
            var key = pool[i].playerSlug || pool[i].playerId || pool[i].id || mapped.name;
            if (seen[key]) continue;
            seen[key] = true;
            targets.push(mapped);
            if (targets.length >= 3) break;
          }
          window.__GV_HOME_WOW__.futureCastTargets = targets;
        }
        var beat = results[2];
        if (beat && beat.items && beat.items.length) {
          window.__GV_HOME_WOW__.beatItems = beat.items;
        }
        window.dispatchEvent(new CustomEvent('gv-home-wow-boot'));
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();`;
}
