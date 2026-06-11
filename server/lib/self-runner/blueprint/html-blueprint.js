/**
 * Self-Runner 2.0 — canonical HTML structure blueprint (index.html + key layouts).
 */

const HTML_HOOKS = {
  'gv-team-overview-layout': {
    id: 'gv-team-overview-layout',
    className: 'gv-team-overview-layout',
    anchor: 'id="vpane-team"',
    anchorType: 'after-opening-tag',
    regionId: 'vpane-team',
    description: 'Team overview grid layout shell',
    snippet: `<div class="gv-team-overview-layout" data-gv-hook="team-overview">\n  <!-- Team overview content rendered by gv-team-mobile.js -->\n</div>`
  },
  'gv-coaching-staff': {
    id: 'gv-coaching-staff',
    marker: 'gv-coaching-staff',
    anchor: 'id="vpane-team"',
    anchorType: 'inside-region',
    regionId: 'vpane-team',
    description: 'Coaching staff section container',
    snippet: `<section id="gv-coaching-staff" class="gv-team-section" data-gv-section="coaching-staff" aria-label="Coaching Staff">\n  <h3 class="gv-team-h3">Coaching Staff</h3>\n  <div id="gv-coaching-staff-grid" class="gv-team-coach-grid"></div>\n</section>`
  },
  'gv-section-identity': {
    id: 'gv-section-identity',
    marker: 'gv-section-identity',
    anchor: 'id="vpane-team"',
    anchorType: 'inside-region',
    regionId: 'vpane-team',
    description: 'Team Identity banner section',
    snippet: `<section id="gv-section-identity" class="gv-team-section gv-team-identity-banner" data-gv-section="identity" aria-label="Team Identity">\n  <div id="gv-team-identity-banner" class="gv-team-identity-inner"></div>\n</section>`
  },
  'gv-section-recruiting': {
    id: 'gv-section-recruiting',
    marker: 'gv-section-recruiting',
    anchor: 'id="vpane-recruit"',
    anchorType: 'inside-region',
    regionId: 'vpane-recruit',
    description: 'Recruiting board section hooks',
    snippet: `<div id="gv-section-recruiting" class="gv-section-recruiting" data-gv-section="recruiting" data-gv-autoposter-zone="recruiting"></div>`
  },
  'gv-section-portal': {
    id: 'gv-section-portal',
    marker: 'gv-section-portal',
    anchor: 'id="vpane-portal"',
    anchorType: 'inside-region',
    regionId: 'vpane-portal',
    description: 'Transfer portal section hooks',
    snippet: `<div id="gv-section-portal" class="gv-section-portal" data-gv-section="portal" data-gv-autoposter-zone="portal"></div>`
  },
  'gv-section-news': {
    id: 'gv-section-news',
    marker: 'gv-section-news',
    anchor: 'id="vpane-live"',
    anchorType: 'inside-region',
    regionId: 'vpane-live',
    description: 'Latest Updates / news feed section',
    snippet: `<div id="gv-section-news" class="gv-section-news" data-gv-section="news" data-gv-autoposter-zone="news"></div>`
  },
  'gv-section-film': {
    id: 'gv-section-film',
    marker: 'gv-section-film',
    anchor: 'film-room-hub-landing',
    anchorType: 'insert-before-marker',
    description: 'Film Room hub section',
    snippet: `<section id="gv-section-film" class="gv-section-film" data-gv-section="film" aria-label="Film Room"></section>\n`
  },
  'war-room-panel': {
    marker: 'war-room-panel',
    anchor: 'id="vpane-scouting"',
    anchorType: 'inside-region',
    regionId: 'vpane-scouting',
    description: 'War Room scouting tab container',
    snippet: `<div id="gv-war-room-root" class="war-room-panel" data-gv-section="war-room" data-gv-autoposter-zone="war-room">\n  <div id="scouting-database-content"></div>\n</div>`
  },
  'gvOpenTeamDetail': {
    marker: 'gvOpenTeamDetail',
    anchor: '</body>',
    anchorType: 'insert-before',
    file: 'index.html',
    description: 'Team detail modal opener',
    snippet: `<script src="/js/gv-team-mobile.js?v=team-v3" defer></script>\n`
  },
  'gvOpenVerifiedSource': {
    marker: 'gvOpenVerifiedSource',
    anchor: '</body>',
    anchorType: 'insert-before',
    file: 'index.html',
    description: 'Film Room verified source modal',
    snippet: `<script src="/js/gv-film-sources.js?v=film-v2" defer></script>\n`
  },
  'film-room-hub-landing': {
    marker: 'film-room-hub-landing',
    anchor: 'id="vpane-highlights"',
    anchorType: 'inside-region',
    regionId: 'vpane-highlights',
    description: 'Film Room hub landing drill-down',
    snippet: `<div id="film-room-hub-landing" class="film-room-hub-landing" data-gv-section="film-hub"></div>`
  },
  'gv-gm-rerun-controls': {
    id: 'gv-gm-rerun-controls',
    marker: 'gv-gm-rerun-controls',
    anchor: 'id="vpane-recruit"',
    anchorType: 'inside-region',
    regionId: 'vpane-recruit',
    description: 'GM rerun controls for recruiting pipeline',
    snippet: `<div id="gv-gm-rerun-controls" class="gv-gm-rerun-controls hidden" data-gv-admin-only="true" aria-hidden="true"></div>`
  }
};

const REQUIRED_HOOKS = [
  'gv-team-overview-layout',
  'gv-coaching-staff',
  'gv-section-identity',
  'gv-section-recruiting',
  'gv-section-portal',
  'gv-section-news',
  'gv-section-film',
  'war-room-panel',
  'gvOpenTeamDetail',
  'film-room-hub-landing'
];

const AUTOPOSTER_INJECTION_ZONES = [
  'gv-section-recruiting',
  'gv-section-portal',
  'gv-section-news',
  'gv-war-room-root',
  'gv-section-identity'
];

const PROTECTED_HOOKS = new Set([
  ...REQUIRED_HOOKS,
  'gvOpenVerifiedSource',
  'gv-gm-rerun-controls',
  'gv-war-room-root'
]);

function hookByMarker(marker) {
  return Object.values(HTML_HOOKS).find((h) => h.id === marker || h.marker === marker) || null;
}

module.exports = {
  HTML_HOOKS,
  REQUIRED_HOOKS,
  AUTOPOSTER_INJECTION_ZONES,
  PROTECTED_HOOKS,
  hookByMarker
};
