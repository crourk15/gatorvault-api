/**
 * GatorVault — mobile Team tab (Overview, Staff, Roster, Depth Chart).
 */
(function (global) {
  'use strict';

  var BUILD = 'mhome-v3-20260611';

  var ERAS = [
    {
      id: 'era-70s80s',
      label: '70s–80s',
      title: 'Spurrier Era Foundations',
      hero: '🏟️',
      summary: 'Florida established national relevance under Doug Dickey and Charley Pell before the program\'s breakthrough under Steve Spurrier.',
      players: ['Emmitt Smith', 'Wilber Marshall', 'Kerwin Bell'],
      games: ['1980 vs LSU — first SEC title path', '1987 vs FSU — rivalry intensity'],
      achievements: ['First SEC Championship (1991)', 'Heisman: Emmitt Smith era momentum']
    },
    {
      id: 'era-90s',
      label: '90s',
      title: 'National Championship Decade',
      hero: '🏆',
      summary: 'The Spurrier offense revolutionized college football. Florida won its first national title in 1996.',
      players: ['Danny Wuerffel', 'Fred Taylor', 'Jevon Kearse'],
      games: ['1996 vs FSU — national title run', '1997 vs FSU — Wuerffel Heisman season'],
      achievements: ['1996 National Championship', 'Heisman: Danny Wuerffel (1996)']
    },
    {
      id: 'era-2000s',
      label: '2000s',
      title: 'Urban Meyer Dynasty',
      hero: '🐊',
      summary: 'Two national championships (2006, 2008) and the Tebow era cemented Florida among elite programs.',
      players: ['Tim Tebow', 'Percy Harvin', 'Brandon Spikes'],
      games: ['2006 vs Ohio State — BCS title', '2008 vs Oklahoma — Tebow\'s second ring'],
      achievements: ['2006 & 2008 National Championships', 'Heisman: Tim Tebow (2007)']
    },
    {
      id: 'era-2010s',
      label: '2010s',
      title: 'SEC East Dominance',
      hero: '⚡',
      summary: 'Continued SEC contention with elite defenses and spread evolution under multiple coordinators.',
      players: ['Kyle Pitts', 'Vernon Hargreaves III', 'Feleipe Franks'],
      games: ['2012 vs LSU — Driskel era peak', '2019 vs Auburn — Trask emergence'],
      achievements: ['Multiple SEC East titles', 'Kyle Pitts TE1 legacy']
    },
    {
      id: 'era-2020s',
      label: '2020s',
      title: 'Sumrall Era — New Chapter',
      hero: '🎯',
      summary: 'Jon Sumrall arrives in 2026 with a rebuilt roster, 3-3-5 defensive identity, and a portal-powered roster reset.',
      players: ['Jayden Woods', 'Eric Singleton Jr.', 'Aaron Philo'],
      games: ['2026 vs FAU — Sumrall debut', '2026 vs Georgia — Cocktail Party'],
      achievements: ['2026 portal class rebuild', 'Brad White 3-3-5 install']
    }
  ];

  var ACHIEVEMENTS = [
    { id: 'ach-nc', icon: '🏆', label: 'National Championships', years: ['1996', '2006', '2008'], note: 'Three consensus national titles' },
    { id: 'ach-sec', icon: '🥇', label: 'SEC Championships', years: ['1991', '1993', '1994', '1995', '1996', '2000', '2006', '2008'], note: 'Eight SEC titles' },
    { id: 'ach-heisman', icon: '⭐', label: 'Heisman Winners', years: ['1966 Steve Spurrier', '1996 Danny Wuerffel', '2007 Tim Tebow'], note: 'Three Heisman Trophy winners' },
    { id: 'ach-aam', icon: '🛡️', label: 'All-Americans', years: ['100+ consensus selections program-wide'], note: 'Elite talent pipeline across eras' },
    { id: 'ach-nfl', icon: '🏈', label: 'NFL Draft Picks', years: ['500+ all-time', '2020s: Pitts, Henderson, Richardson'], note: 'Consistent NFL production' },
    { id: 'ach-bowl', icon: '🎖️', label: 'Major Bowl Wins', years: ['Sugar Bowl', 'Orange Bowl', 'BCS/CFP appearances'], note: 'Postseason success across decades' }
  ];

  var TEAM_IDENTITY = {
    title: 'Team Identity',
    summary: 'Orange and blue. The Swamp. Gator Nation.',
    body: 'Florida football is built on speed, physicality, and recruiting dominance in the Southeast. The program\'s brand centers on The Swamp\'s home-field advantage, the chomp tradition, and a standard of competing for SEC and national titles every season.\n\nUnder Jon Sumrall, the 2026 identity emphasizes culture-first leadership, defensive versatility in the 3-3-5, and an offense built for conflict players and explosive skill talent.'
  };

  var COACHING_STAFF = [
    { id: 'sumrall', name: 'Jon Sumrall', title: 'Head Coach', unit: 'hc', bio: 'First-year head coach after leading Tulane. Culture-driven leader installing a competitive standard across roster and staff.' },
    { id: 'faulkner', name: 'Buster Faulkner', title: 'Offensive Coordinator', unit: 'oc', bio: 'Spread RPO architect. Builds rhythm passing, conflict reads, and vertical shots around Eric Singleton Jr. and the rebuilt offensive line.' },
    { id: 'white', name: 'Brad White', title: 'Defensive Coordinator', unit: 'dc', bio: '3-3-5 odd-front specialist. JACK and STAR roles define the defense — Jayden Woods and Kanye Clark are scheme centerpieces.' },
    { id: 'harris', name: 'Anthony Harris', title: 'Defensive Backs Coach', unit: 'db', bio: 'Develops corners and safeties in a hybrid-heavy secondary. Critical for STAR/nickel fit in tempo offenses.' },
    { id: 'gasparato', name: 'Greg Gasparato', title: 'Linebackers Coach', unit: 'lb', bio: 'Linebacker development in the 3-3-5 — run fits, blitz packages, and communication in nickel personnel.' },
    { id: 'davis', name: 'Marcus Davis', title: 'Wide Receivers Coach', unit: 'wr', bio: 'WR room coach — route running, separation, and vertical threat development for Singleton and the receiving corps.' },
    { id: 'mcknight', name: 'Trent McKnight', title: 'Offensive Line Coach', unit: 'ol', bio: 'Rebuilds the five-man front. Pass protection and run-game cohesion are the swing factors for the 2026 offense.' },
    { id: 'st', name: 'Special Teams Coordinator', title: 'Special Teams Coordinator', unit: 'st', bio: 'Coverage units, return game, and field position — critical in close SEC games and rivalry week.' },
    { id: 'whitt', name: 'Rusty Whitt', title: 'Head Strength & Conditioning', unit: 'sc', bio: 'Fourth-quarter football and availability. S&C sets the physical floor for Sumrall\'s culture.' },
    { id: 'analyst-off', name: 'Offensive Analyst', title: 'Offensive Analyst', unit: 'analyst', bio: 'Film breakdown, self-scout, and opponent tendency reports for the offensive staff.' },
    { id: 'analyst-def', name: 'Defensive Analyst', title: 'Defensive Analyst', unit: 'analyst', bio: 'Defensive quality control — pressure tendencies, coverage rules, and weekly cut-ups.' }
  ];

  var ROSTER_FILTERS = ['All', 'QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'DB', 'ST'];

  var POS_GROUPS = {
    QB: ['QB'],
    RB: ['RB', 'FB'],
    WR: ['WR', 'TE'],
    OL: ['OL', 'OT', 'OG', 'C', 'IOL', 'LT', 'LG', 'RG', 'RT'],
    DL: ['DL', 'DT', 'DE', 'EDGE', 'NT', 'END', 'NOSE'],
    LB: ['LB', 'MIKE', 'WILL', 'SAM', 'JACK', 'OLB', 'ILB'],
    DB: ['DB', 'CB', 'S', 'SS', 'FS', 'NB', 'STAR'],
    ST: ['K', 'P', 'LS', 'KR', 'PR']
  };

  function esc(s) {
    if (typeof gvLiveEsc === 'function') return gvLiveEsc(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function openTeamDetail(title, bodyHtml) {
    var ov = document.getElementById('gv-team-detail-modal');
    if (!ov) return;
    var t = document.getElementById('gv-team-detail-title');
    var b = document.getElementById('gv-team-detail-body');
    if (t) t.textContent = title || 'Team';
    if (b) b.innerHTML = bodyHtml || '';
    ov.classList.remove('hidden');
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeTeamDetail() {
    var ov = document.getElementById('gv-team-detail-modal');
    if (!ov) return;
    ov.classList.add('hidden');
    ov.style.display = '';
    document.body.style.overflow = '';
  }

  function renderEraCard(era, idx) {
    return '<button type="button" class="gv-team-era-card" data-era-id="' + esc(era.id) + '" style="animation-delay:' + (idx * 0.04) + 's">'
      + '<span class="gv-team-era-hero">' + era.hero + '</span>'
      + '<span class="gv-team-era-label">' + esc(era.label) + '</span>'
      + '<span class="gv-team-era-sub">' + esc(era.title) + '</span>'
      + '</button>';
  }

  function renderAchievementTile(a, idx) {
    return '<button type="button" class="gv-team-ach-tile" data-ach-id="' + esc(a.id) + '" style="animation-delay:' + (idx * 0.03) + 's">'
      + '<span class="gv-team-ach-icon">' + a.icon + '</span>'
      + '<span class="gv-team-ach-label">' + esc(a.label) + '</span>'
      + '</button>';
  }

  function renderCoachCard(c) {
    var initials = (c.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2);
    return '<button type="button" class="gv-coach-card" data-coach-id="' + esc(c.id) + '">'
      + '<span class="gv-coach-headshot">' + esc(initials) + '</span>'
      + '<span class="gv-coach-info"><span class="gv-coach-name">' + esc(c.name) + '</span>'
      + '<span class="gv-coach-title">' + esc(c.title) + '</span></span>'
      + '<span class="gv-coach-chevron">›</span>'
      + '</button>';
  }

  function renderRosterCard(p) {
    var slug = p.slug || '';
    var name = p.name || '';
    var pos = p.pos || '';
    var yr = p.classYear || p.year || '';
    var rating = typeof playerDisplayRating === 'function' ? playerDisplayRating(p) : (p.rating || null);
    var tier = typeof ratingTier === 'function' ? ratingTier(rating || 0) : 'rating-solid';
    var initials = typeof gvPlayerInitials === 'function' ? gvPlayerInitials(name) : name.charAt(0);
    return '<div class="gv-mteam-roster-card" data-slug="' + esc(slug) + '" tabindex="0" role="button">'
      + '<span class="gv-mteam-roster-av">' + esc(initials) + '</span>'
      + '<span class="gv-mteam-roster-meta"><span class="gv-mteam-roster-name">' + esc(name) + '</span>'
      + '<span class="gv-mteam-roster-sub">' + esc(pos) + (yr ? ' · ' + esc(String(yr)) : '') + '</span></span>'
      + '<span class="gv-top-gator-grade ' + tier + '">' + (rating != null ? Number(rating).toFixed(1) : '—') + '</span>'
      + '</div>';
  }

  function playerMatchesRosterFilter(p, filter) {
    if (!filter || filter === 'All') return true;
    var pos = String(p.pos || '').toUpperCase();
    var group = POS_GROUPS[filter];
    if (!group) return pos === filter;
    return group.some(function (g) { return pos === g || pos.indexOf(g) === 0; });
  }

  function wireTeamDetailModal() {
    var closeBtn = document.getElementById('gv-team-detail-close');
    var ov = document.getElementById('gv-team-detail-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeTeamDetail);
    if (ov) {
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closeTeamDetail();
      });
    }
  }

  function wireEraCards(root) {
    if (!root) return;
    root.querySelectorAll('.gv-team-era-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-era-id');
        var era = ERAS.find(function (e) { return e.id === id; });
        if (!era) return;
        var html = '<p class="gv-team-detail-lead">' + esc(era.summary) + '</p>'
          + '<h4 class="gv-team-detail-h">Key Players</h4><ul class="gv-team-detail-list">' + era.players.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
          + '<h4 class="gv-team-detail-h">Key Games</h4><ul class="gv-team-detail-list">' + era.games.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>'
          + '<h4 class="gv-team-detail-h">Achievements</h4><ul class="gv-team-detail-list">' + era.achievements.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
        openTeamDetail(era.title, html);
      });
    });
  }

  function wireAchievementTiles(root) {
    if (!root) return;
    root.querySelectorAll('.gv-team-ach-tile').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-ach-id');
        var ach = ACHIEVEMENTS.find(function (a) { return a.id === id; });
        if (!ach) return;
        var html = '<p class="gv-team-detail-lead">' + esc(ach.note) + '</p>'
          + '<ul class="gv-team-detail-list">' + ach.years.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul>';
        openTeamDetail(ach.label, html);
      });
    });
  }

  function wireCoachCards(root) {
    if (!root) return;
    root.querySelectorAll('.gv-coach-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-coach-id');
        var c = COACHING_STAFF.find(function (x) { return x.id === id; });
        if (!c) return;
        openTeamDetail(c.name, '<p class="gv-team-detail-lead"><strong>' + esc(c.title) + '</strong></p><p>' + esc(c.bio) + '</p>');
      });
    });
  }

  function renderMobileRoster(filter) {
    var el = document.getElementById('gv-mteam-roster-list');
    if (!el) return;
    var profiles = global.playerProfiles || [];
    var f = filter || global._gvMteamRosterFilter || 'All';
    var list = profiles.filter(function (p) { return playerMatchesRosterFilter(p, f); });
    list.sort(function (a, b) {
      var ra = typeof playerDisplayRating === 'function' ? (playerDisplayRating(b) || 0) : 0;
      var rb = typeof playerDisplayRating === 'function' ? (playerDisplayRating(a) || 0) : 0;
      return ra - rb;
    });
    el.innerHTML = list.length
      ? list.slice(0, 48).map(renderRosterCard).join('')
      : '<p class="gv-espn-card-body text-surface-200/60">Roster loading…</p>';
    el.querySelectorAll('.gv-mteam-roster-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var slug = card.getAttribute('data-slug');
        if (slug) global.location.href = '/player/' + slug;
      });
    });
  }

  function renderMobileTeam() {
    if (typeof gvIsMobile === 'function' && !gvIsMobile()) return;

    var erasEl = document.getElementById('gv-mteam-eras-track');
    var achEl = document.getElementById('gv-mteam-achievements');
    var staffEl = document.getElementById('gv-mteam-staff');
    var filtersEl = document.getElementById('gv-mteam-roster-filters');

    if (erasEl) {
      erasEl.innerHTML = ERAS.map(renderEraCard).join('');
      wireEraCards(erasEl);
    }
    if (achEl) {
      achEl.innerHTML = ACHIEVEMENTS.map(renderAchievementTile).join('');
      wireAchievementTiles(achEl);
    }

    var identityBtn = document.getElementById('gv-mteam-identity-btn');
    if (identityBtn && !identityBtn._wired) {
      identityBtn._wired = true;
      identityBtn.addEventListener('click', function () {
        openTeamDetail(TEAM_IDENTITY.title, '<p class="gv-team-detail-lead">' + esc(TEAM_IDENTITY.summary) + '</p><p>' + esc(TEAM_IDENTITY.body).replace(/\n/g, '<br>') + '</p>');
      });
    }

    if (staffEl) {
      staffEl.innerHTML = COACHING_STAFF.map(renderCoachCard).join('')
        + '<button type="button" class="gv-team-support-link" id="gv-mteam-support-btn">Support Staff →</button>';
      wireCoachCards(staffEl);
      var supportBtn = document.getElementById('gv-mteam-support-btn');
      if (supportBtn && !supportBtn._wired) {
        supportBtn._wired = true;
        supportBtn.addEventListener('click', function () {
          openTeamDetail('Support Staff', '<p class="gv-team-detail-lead">Operations, video, equipment, and administrative staff supporting the 2026 program.</p><ul class="gv-team-detail-list"><li>Director of Football Operations</li><li>Video & Quality Control</li><li>Equipment & Logistics</li><li>Player Development & Nutrition</li></ul>');
        });
      }
    }

    if (filtersEl && !filtersEl._wired) {
      filtersEl._wired = true;
      filtersEl.innerHTML = ROSTER_FILTERS.map(function (f) {
        return '<button type="button" class="gv-mteam-pos-chip' + (f === 'All' ? ' active' : '') + '" data-pos="' + f + '">' + f + '</button>';
      }).join('');
      filtersEl.querySelectorAll('.gv-mteam-pos-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          filtersEl.querySelectorAll('.gv-mteam-pos-chip').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          global._gvMteamRosterFilter = chip.getAttribute('data-pos');
          renderMobileRoster(global._gvMteamRosterFilter);
        });
      });
    }

    var dcBtn = document.getElementById('gv-mteam-dc-open');
    if (dcBtn && !dcBtn._wired) {
      dcBtn._wired = true;
      dcBtn.addEventListener('click', function () {
        if (typeof global.showVTab === 'function') global.showVTab('dc');
      });
    }

    renderMobileRoster(global._gvMteamRosterFilter || 'All');
    wireTeamDetailModal();
  }

  global.gvRenderMobileTeam = renderMobileTeam;
  global.gvCloseTeamDetail = closeTeamDetail;
  global.GV_TEAM_MOBILE_BUILD = BUILD;
})(typeof window !== 'undefined' ? window : global);
