/**
 * Section-level QA — Team, Film Room, Recruiting, Latest Updates, Depth Chart, Roster, etc.
 * Scans local repo (source of truth) and optionally production HTML for drift.
 */
const fs = require('fs');
const path = require('path');
const config = require('./qa-config');
const { check, fetchSiteBundleText, moduleResult } = require('./qa-utils');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function readLocal(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

function loadJsonLocal(rel) {
  try {
    return JSON.parse(readLocal(rel));
  } catch {
    return null;
  }
}

function missingMarkers(text, markers) {
  return (markers || []).filter((m) => {
    const needle = m.startsWith('#') ? `id="${m.slice(1)}"` : m;
    return !text.includes(needle);
  });
}

/** Required UI sections — desktop + mobile Team hub, Film Room, Recruiting, Live feed */
const SECTION_MARKERS = {
  teamOverview: [
    'gv-team-overview-layout',
    'gv-team-overview-main',
    'id="gv-team-eras-track"',
    'id="gv-team-achievements"',
    'id="gv-team-identity-slot"'
  ],
  programHistory: [
    'id="gv-team-eras-track"',
    'id="gv-team-detail-modal"',
    'gv-team-detail-body'
  ],
  teamIdentity: ['gv-team-identity-banner', 'gv-team-identity-pillars', 'gv-team-identity-card'],
  filmRoom: [
    'id="vpane-highlights"',
    'film-room-hub-shell',
    'film-room-hub-landing',
    'GV_FILM_HUB_DESC',
    'gvOpenFilmRoomHub',
    'gvOpenVerifiedSource'
  ],
  recruiting: ['id="vpane-recruit"'],
  latestUpdates: ['gvLoadLiveDashboard', 'live-feed-list', 'gv-mhome-new-banner'],
  depthChart: ['id="gv-team-dc-section"', 'id="gv-team-dc-off"', 'id="gv-team-dc-def"'],
  roster: ['id="gv-team-roster-list"', 'id="gv-team-roster-filters"'],
  highlights: ['id="highlight-modal-ov"', 'openHighlightPlayer', 'highlight-card']
};

const REQUIRED_COACHES = ['Jon Sumrall', 'Buster Faulkner', 'Brad White'];
const REQUIRED_ERAS = ['era-70s80s', 'era-90s', 'era-2000s', 'era-2010s', 'era-2020s'];
const ERA_REQUIRED_FIELDS = ['coaching', 'milestones', 'schemes', 'recruiting', 'culture', 'summary'];
const FILM_HUB_KEYS = [
  'Offensive Scheme',
  'Defensive Scheme',
  'Film Breakdown',
  'UF Press Conferences',
  'Highlights'
];

async function runSectionChecks() {
  const checks = [];
  const indexHtml = readLocal('index.html');
  const teamCss = readLocal('css/gv-team.css');
  const teamJs = readLocal('js/gv-team-mobile.js');
  const coachingJson = loadJsonLocal('data/coaching-staff.json');

  let prodHtml = '';
  if (config.SCAN_PRODUCTION !== false) {
    try {
      prodHtml = await fetchSiteBundleText(config.SITE_URL, '/');
    } catch {
      prodHtml = '';
    }
  }

  // ---- integrity:missing-content ----
  checks.push(
    await check('integrity:missing-content', 'integrity', 'Section content & markers', async () => {
      const issues = [];
      Object.entries(SECTION_MARKERS).forEach(([section, markers]) => {
        const bundle =
          section === 'teamIdentity' || section === 'programHistory'
            ? indexHtml + '\n' + teamJs + '\n' + teamCss
            : indexHtml;
        const missLocal = missingMarkers(bundle, markers);
        if (missLocal.length) {
          issues.push({ section, source: 'local', missing: missLocal });
        }
        if (prodHtml && section !== 'teamIdentity' && section !== 'programHistory') {
          const missProd = missingMarkers(prodHtml, markers);
          if (missProd.length) {
            issues.push({ section, source: 'production', missing: missProd });
          }
        }
      });

      if (coachingJson) {
        const names = (coachingJson.coaches || []).map((c) => c.name);
        REQUIRED_COACHES.forEach((name) => {
          if (!names.some((n) => n && n.includes(name.split(' ')[1] || name))) {
            issues.push({ section: 'coachingStaff', missing: name, source: 'coaching-staff.json' });
          }
        });
      } else {
        issues.push({ section: 'coachingStaff', missing: 'data/coaching-staff.json', source: 'local' });
      }

      if (!teamJs.includes('var ERAS =') && !teamJs.includes('ERAS = [')) {
        issues.push({ section: 'programHistory', missing: 'ERAS array in gv-team-mobile.js', source: 'local' });
      }
      if (!teamJs.includes('gvOpenTeamEra') && !teamJs.includes('openEraDetail')) {
        issues.push({ section: 'programHistory', missing: 'gvOpenTeamEra / openEraDetail in gv-team-mobile.js', source: 'local' });
      }

      if (issues.length) {
        const err = new Error(`${issues.length} missing content marker(s) across site sections`);
        err.details = issues.slice(0, 12);
        err.repro = 'Open Team, Film Room, Recruiting, Latest Updates — verify section hooks in index.html + data files';
        throw err;
      }
      return { sections: Object.keys(SECTION_MARKERS).length, coaches: coachingJson?.coaches?.length || 0 };
    })
  );

  // ---- integrity:layout-overflow ----
  checks.push(
    await check('integrity:layout-overflow', 'integrity', 'Modal / panel overflow CSS', async () => {
      const issues = [];
      const requiredCss = [
        { sel: '.gv-team-modal-body', props: ['min-height: 0', 'overflow-y: auto'] },
        { sel: '.gv-team-modal-panel', props: ['overflow: hidden'] },
        { sel: '.gv-tm-highlight-text', props: ['min-width: 0', 'overflow-wrap'] },
        { sel: '.gv-tm-lead', props: ['overflow-wrap'] }
      ];
      requiredCss.forEach(({ sel, props }) => {
        const block = teamCss.includes(sel) ? teamCss.slice(teamCss.indexOf(sel), teamCss.indexOf(sel) + 600) : '';
        if (!block) {
          issues.push({ selector: sel, issue: 'rule_missing' });
          return;
        }
        props.forEach((p) => {
          const key = p.split(':')[0].trim();
          if (!block.includes(key)) {
            issues.push({ selector: sel, issue: `missing_${key}`, expected: p });
          }
        });
      });

      if (indexHtml.includes('gv-team-detail-modal') && !teamCss.includes('min-height: 0')) {
        issues.push({ selector: '.gv-team-modal-body', issue: 'flex_scroll_broken', expected: 'min-height: 0 for vertical scroll' });
      }

      if (issues.length) {
        const err = new Error(`${issues.length} layout overflow CSS issue(s) — modals may clip content`);
        err.details = issues;
        err.repro = 'Team → Program History modal: ensure gv-team.css has min-height:0 + overflow-y:auto on modal body';
        throw err;
      }
      return { cssRulesOk: true };
    })
  );

  // ---- integrity:panel-clipping ----
  checks.push(
    await check('integrity:panel-clipping', 'integrity', 'Panel / text clipping guards', async () => {
      const issues = [];
      const guards = [
        '.gv-tm-lead',
        '.gv-tm-body',
        '.gv-tm-highlight-text',
        '.gv-tm-timeline-item',
        '.gv-team-overview-main',
        'minmax(0, 1fr)'
      ];
      guards.forEach((g) => {
        if (!teamCss.includes(g)) {
          issues.push({ missing: g, file: 'css/gv-team.css' });
        }
      });

      if (!teamCss.includes('z-index: 3') && teamCss.includes('.gv-team-modal-body')) {
        issues.push({ missing: 'z-index on .gv-team-modal-body', file: 'css/gv-team.css' });
      }

      if (issues.length) {
        const err = new Error(`${issues.length} panel clipping guard(s) missing — text may truncate on desktop`);
        err.details = issues;
        err.repro = 'Desktop Program History modal clips right edge without min-width:0 + overflow-wrap on text blocks';
        throw err;
      }
      return { guardsOk: true };
    })
  );

  // ---- integrity:wrong-background ----
  checks.push(
    await check('integrity:wrong-background', 'integrity', 'Team Identity / era backgrounds', async () => {
      const issues = [];
      const identityChunk = [teamJs, teamCss].join('\n');
      const teamRegions = ['vpane-team', 'vpane-mteam', 'gv-team-identity'];
      let teamRegionHtml = '';
      teamRegions.forEach((id) => {
        const marker = id.startsWith('gv-') ? id : `id="${id}"`;
        const idx = indexHtml.indexOf(marker);
        if (idx >= 0) teamRegionHtml += indexHtml.slice(idx, idx + 40000);
      });

      if (identityChunk.includes('og-image.jpg') || /backgroundImage.*og-image/i.test(identityChunk)) {
        issues.push({ pattern: 'og-image.jpg', issue: 'team_identity_uses_og_image', source: 'team-module' });
      }
      ['trial-expired-ov', 'pricing-sec'].forEach((pat) => {
        if (teamRegionHtml.includes(pat)) {
          issues.push({ pattern: pat, issue: 'forbidden_in_team_pane', source: 'index.html team region' });
        }
      });

      const eraClasses = ['era-70s', 'era-90s', 'era-2000s', 'era-2010s', 'era-2020s'];
      eraClasses.forEach((cls) => {
        if (!teamCss.includes(`.gv-team-identity-banner.${cls}`) && !teamCss.includes(`.gv-team-modal-hero.${cls}`)) {
          issues.push({ pattern: cls, issue: 'missing_era_gradient_class', file: 'css/gv-team.css' });
        }
      });

      if (prodHtml) {
        const prodTeam = prodHtml.slice(prodHtml.indexOf('vpane-mteam'), prodHtml.indexOf('vpane-mteam') + 50000);
        if (/gv-team-identity[\s\S]{0,800}og-image\.jpg/i.test(prodTeam)) {
          issues.push({ pattern: 'og-image.jpg', issue: 'production_team_identity_wrong_bg', source: 'production' });
        }
      }

      if (issues.length) {
        const err = new Error(`${issues.length} wrong background / theme issue(s)`);
        err.details = issues;
        err.repro = 'Team Identity should use era gradient classes — not og-image.jpg or trial/pricing backgrounds';
        throw err;
      }
      return { eraGradientsOk: true };
    })
  );

  // ---- integrity:team-history-structure ----
  checks.push(
    await check('integrity:team-history-structure', 'integrity', 'Program History era structure', async () => {
      const issues = [];

      REQUIRED_ERAS.forEach((eraId) => {
        if (!teamJs.includes(`id: '${eraId}'`) && !teamJs.includes(`id:"${eraId}"`)) {
          issues.push({ eraId, issue: 'era_missing' });
        }
      });

      // Spurrier must NOT appear in 70s–80s era block
      const era70Match = teamJs.match(/id:\s*['"]era-70s80s['"][\s\S]*?(?=id:\s*['"]era-90s['"])/);
      if (era70Match && /Spurrier/i.test(era70Match[0])) {
        issues.push({ eraId: 'era-70s80s', issue: 'spurrier_in_70s_era', message: 'Spurrier belongs in era-90s only (1990–2001)' });
      }

      // Each era should have required content fields
      REQUIRED_ERAS.forEach((eraId) => {
        const blockRe = new RegExp(`id:\\s*['"]${eraId}['"][\\s\\S]*?(?=\\{\\s*id:|\\];\\s*var ACHIEVEMENTS)`);
        const block = teamJs.match(blockRe);
        if (!block) return;
        const chunk = block[0];
        ERA_REQUIRED_FIELDS.forEach((field) => {
          if (!chunk.includes(`${field}:`)) {
            issues.push({ eraId, issue: 'missing_field', field });
          }
        });
        if (chunk.includes('coaching: []') || chunk.includes('coaching:[]')) {
          issues.push({ eraId, issue: 'empty_coaching' });
        }
      });

      if (issues.length) {
        const err = new Error(`${issues.length} Program History structure issue(s)`);
        err.details = issues.slice(0, 10);
        err.repro = 'Review ERAS in gv-team-mobile.js — all 5 eras need coaching, milestones, schemes, recruiting, culture';
        throw err;
      }
      return { eras: REQUIRED_ERAS.length };
    })
  );

  // ---- integrity:filmroom-structure ----
  checks.push(
    await check('integrity:filmroom-structure', 'integrity', 'Film Room hub structure', async () => {
      const issues = [];
      FILM_HUB_KEYS.forEach((hub) => {
        if (!indexHtml.includes(`'${hub}'`) && !indexHtml.includes(`"${hub}"`)) {
          issues.push({ hub, issue: 'hub_key_missing_in_index' });
        }
      });

      const requiredHooks = [
        'gvOpenFilmRoomHub',
        'gvRenderFilmRoomHubLanding',
        'gvOpenVerifiedSource',
        'gv-verified-source-modal',
        'gvWireFilmSources',
        'openHighlightPlayer'
      ];
      requiredHooks.forEach((hook) => {
        if (!indexHtml.includes(hook)) {
          issues.push({ hook, issue: 'film_hook_missing' });
        }
      });

      if (!indexHtml.includes('film-room-hub-landing') && !indexHtml.includes('GV_FILM_HUB_DESC')) {
        issues.push({ issue: 'film_room_drill_down_missing' });
      }

      if (prodHtml) {
        FILM_HUB_KEYS.forEach((hub) => {
          if (!prodHtml.includes(hub)) {
            issues.push({ hub, issue: 'hub_missing_on_production', source: 'production' });
          }
        });
      }

      if (issues.length) {
        const err = new Error(`${issues.length} Film Room structure issue(s)`);
        err.details = issues;
        err.repro = 'Film Room needs drill-down hub categories (scheme, breakdown, press, highlights) + verified source hooks';
        throw err;
      }
      return { hubs: FILM_HUB_KEYS.length };
    })
  );

  // ---- integrity:autoposter-dedup (extends feed dedup with text patterns) ----
  checks.push(
    await check('integrity:autoposter-dedup', 'integrity', 'Autoposter duplication patterns', async () => {
      const feedPath = path.join(SERVER_ROOT, 'data', 'live', 'feed-items.json');
      let items = [];
      try {
        const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        items = raw.items || raw.feed || (Array.isArray(raw) ? raw : []);
      } catch {
        return { skipped: true, reason: 'no_local_feed_file' };
      }

      const issues = [];
      const seenUrl = new Map();
      const seenTitle = new Map();

      items.forEach((item, idx) => {
        const url = String(item.url || item.link || '').trim();
        const title = String(item.title || item.headline || item.text || '')
          .trim()
          .slice(0, 80)
          .toLowerCase();
        if (url) {
          if (seenUrl.has(url)) {
            issues.push({ type: 'duplicate_url', url, indices: [seenUrl.get(url), idx] });
          } else seenUrl.set(url, idx);
        }
        if (title.length > 12) {
          if (seenTitle.has(title)) {
            issues.push({ type: 'duplicate_title', title, indices: [seenTitle.get(title), idx] });
          } else seenTitle.set(title, idx);
        }
        if (/…$|\.\.\.$/.test(String(item.text || item.title || ''))) {
          issues.push({ type: 'truncated_copy', index: idx, sample: String(item.text || item.title).slice(0, 60) });
        }
      });

      if (issues.length) {
        const err = new Error(`${issues.length} autoposter duplication / truncation issue(s)`);
        err.details = issues.slice(0, 8);
        err.repro = 'Latest Updates feed has duplicate URLs, titles, or truncated autoposter copy';
        throw err;
      }
      return { feedItems: items.length };
    })
  );

  return moduleResult('integrity', checks);
}

module.exports = { runSectionChecks, SECTION_MARKERS, readLocal };
