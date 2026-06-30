/**
 * Inline boot for vault home — paints recruiting snapshot + FutureCast preview before React.
 */
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export function homeWowBootScript(year = ACTIVE_RECRUITING_CLASS_YEAR): string {
  const safeYear = Number.isFinite(year) ? year : ACTIVE_RECRUITING_CLASS_YEAR;
  return `(function(){
  function run() {
    try {
      var year = ${safeYear};
      window.__GV_HOME_WOW__ = window.__GV_HOME_WOW__ || {};

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

      function paintMetrics(metrics) {
        if (!metrics) return;
        window.__GV_HOME_WOW__.metrics = metrics;
        var card = document.querySelector('[data-home-boot="recruiting-snapshot"]');
        if (!card) return;
        var fields = [
          ['classRank', 'class-rank'],
          ['blueChip', 'blue-chip'],
          ['commits', 'commits'],
          ['avgRating', 'avg-rating']
        ];
        fields.forEach(function(pair) {
          var node = card.querySelector('[data-home-metric="' + pair[1] + '"]');
          if (node && metrics[pair[0]] != null) node.textContent = metrics[pair[0]];
        });
        var skeleton = card.querySelector('[data-home-boot-skeleton]');
        if (skeleton) skeleton.style.display = 'none';
        var body = card.querySelector('[data-home-boot-body]');
        if (body) body.hidden = false;
        var row = card.querySelector('.home-wow-metrics-row');
        if (row) {
          row.style.removeProperty('display');
          row.hidden = false;
        }
        card.setAttribute('data-home-boot-painted', 'metrics');
      }

      function paintFutureCast(targets) {
        if (!targets || !targets.length) return;
        window.__GV_HOME_WOW__.futureCastTargets = targets;
        var card = document.querySelector('[data-home-boot="futurecast-preview"]');
        if (!card) return;
        var first = targets[0];
        var nameNode = card.querySelector('[data-fc-name]');
        var pctNode = card.querySelector('[data-fc-pct]');
        var posNode = card.querySelector('[data-fc-pos]');
        if (nameNode && first.name) nameNode.textContent = first.name;
        if (pctNode && first.ufPercent) pctNode.textContent = first.ufPercent;
        if (posNode && first.position) posNode.textContent = first.position;
        var skeleton = card.querySelector('[data-home-boot-skeleton]');
        if (skeleton) skeleton.style.display = 'none';
        var body = card.querySelector('[data-home-boot-body]');
        if (body) body.hidden = false;
        card.setAttribute('data-home-boot-painted', 'futurecast');
      }

      function paintBeat(items) {
        if (!items || !items.length) return;
        window.__GV_HOME_WOW__.beatItems = items;
        var section = document.querySelector('[data-home-boot="beat-highlights"]');
        if (!section) return;
        var cards = section.querySelectorAll('[data-beat-card]');
        items.slice(0, 3).forEach(function(item, idx) {
          var card = cards[idx];
          if (!card) return;
          var initials = (item.writerName || 'BW').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
          var nameNode = card.querySelector('[data-beat-name]');
          var outletNode = card.querySelector('[data-beat-outlet]');
          var textNode = card.querySelector('[data-beat-text]');
          var timeNode = card.querySelector('[data-beat-time]');
          var urlNode = card.querySelector('[data-beat-url]');
          var avatarNode = card.querySelector('[data-beat-avatar]');
          if (nameNode) nameNode.textContent = item.writerName || 'Beat Writer';
          if (outletNode) outletNode.textContent = item.source || 'UF Beat';
          if (textNode) textNode.textContent = item.text || '';
          if (timeNode) timeNode.textContent = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Recently';
          if (urlNode) urlNode.href = item.url || '#';
          if (avatarNode) avatarNode.textContent = initials;
          card.hidden = false;
        });
        var skeleton = section.querySelector('[data-home-boot-skeleton]');
        if (skeleton) skeleton.style.display = 'none';
        section.setAttribute('data-home-boot-painted', 'beat');
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

      Promise.all([
        fetchJson('/api/recruiting/class-metrics?year=' + year, 0).catch(function() { return null; }),
        fetchJson('/api/futurecast/home', 0).catch(function() { return null; }),
        fetchJson('/api/recruiting/intel/beat?limit=3', 0).catch(function() { return null; })
      ]).then(function(results) {
        var metrics = results[0];
        if (metrics && metrics.status !== 'building') {
          paintMetrics(metrics);
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
          paintFutureCast(targets);
        }
        var beat = results[2];
        if (beat && beat.items && beat.items.length) paintBeat(beat.items);
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
