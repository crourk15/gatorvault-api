/**
 * GatorVault — Team module (mobile + desktop): rich modals for History, Achievements,
 * Identity, Coaching Staff, Roster, and Depth Chart.
 */
(function (global) {
  'use strict';

  var BUILD = 'team-v3-20260605';
  var DEFAULT_HERO = '/og-image.jpg';
  var _interactionsWired = false;
  var _modalWired = false;
  var _currentModal = null;
  var _swipe = { startY: 0, active: false };
  var _touch = { x: 0, y: 0, moved: false, t: 0, suppressClick: false };
  var TAP_MOVE_THRESHOLD = 14;
  var TAP_MAX_MS = 450;

  var ICON = {
    winners: '🏆', players: '🏈', highlights: '⭐', games: '🏟️', timeline: '📅',
    achievements: '🎖️', culture: '🐊', staff: '👔', roster: '🧢', depth: '📋',
    sources: '✓', related: '🔗', identity: '🐊', trophy: '🏆', helmet: '⛑️'
  };

  var ERAS = [
    { id: 'era-70s80s', label: '70s–80s', title: 'Spurrier Era Foundations', hero: '🏟️', kicker: 'Program History', headerImage: '/og-image.jpg',
      summary: 'Florida established national relevance under Doug Dickey and Charley Pell before the program\'s breakthrough under Steve Spurrier.',
      winners: ['Emmitt Smith — all-time rushing legend', 'Wilber Marshall — defensive tone-setter'],
      players: [{ name: 'Emmitt Smith', role: 'RB · Heisman momentum' }, { name: 'Wilber Marshall', role: 'LB · SEC Defensive POY' }, { name: 'Kerwin Bell', role: 'QB · Air Raid pioneer' }],
      games: ['1980 vs LSU — first SEC title path', '1987 vs FSU — rivalry intensity'],
      highlights: ['First SEC Championship (1991)', 'Heisman: Emmitt Smith era momentum', 'The Swamp became a national destination'],
      achievements: ['SEC relevance established', 'Foundation for 90s title run'] },
    { id: 'era-90s', label: '90s', title: 'National Championship Decade', hero: '🏆', kicker: 'Program History', headerImage: '/og-image.jpg',
      summary: 'The Spurrier offense revolutionized college football. Florida won its first national title in 1996.',
      winners: ['Danny Wuerffel — 1996 Heisman', 'Fred Taylor — explosive run game'],
      players: [{ name: 'Danny Wuerffel', role: 'QB · 1996 Heisman' }, { name: 'Fred Taylor', role: 'RB · Breakaway speed' }, { name: 'Jevon Kearse', role: 'DE · Freak athlete' }],
      games: ['1996 vs FSU — national title run', '1997 vs FSU — Wuerffel Heisman season'],
      highlights: ['1996 National Championship', 'Fun & Gun offense legacy', 'Three SEC titles in six years'],
      achievements: ['1996 National Championship', 'Heisman: Danny Wuerffel (1996)'] },
    { id: 'era-2000s', label: '2000s', title: 'Urban Meyer Dynasty', hero: '🐊', kicker: 'Program History', headerImage: '/og-image.jpg',
      summary: 'Two national championships (2006, 2008) and the Tebow era cemented Florida among elite programs.',
      winners: ['Tim Tebow — 2007 Heisman', 'Percy Harvin — mismatch weapon'],
      players: [{ name: 'Tim Tebow', role: 'QB · 2007 Heisman' }, { name: 'Percy Harvin', role: 'WR · Jet sweep star' }, { name: 'Brandon Spikes', role: 'LB · Defensive leader' }],
      games: ['2006 vs Ohio State — BCS title', '2008 vs Oklahoma — Tebow\'s second ring'],
      highlights: ['2006 & 2008 National Championships', 'Spread-option evolution', 'Reloaded roster pipeline'],
      achievements: ['2006 & 2008 National Championships', 'Heisman: Tim Tebow (2007)'] },
    { id: 'era-2010s', label: '2010s', title: 'SEC East Dominance', hero: '⚡', kicker: 'Program History', headerImage: '/og-image.jpg',
      summary: 'Continued SEC contention with elite defenses and spread evolution under multiple coordinators.',
      winners: ['Kyle Pitts — generational TE', 'Vernon Hargreaves III — lockdown CB'],
      players: [{ name: 'Kyle Pitts', role: 'TE · TE1 legacy' }, { name: 'Vernon Hargreaves III', role: 'CB · First-round talent' }, { name: 'Feleipe Franks', role: 'QB · Dual-threat bridge' }],
      games: ['2012 vs LSU — Driskel era peak', '2019 vs Auburn — Trask emergence'],
      highlights: ['Multiple SEC East titles', 'Elite defensive recruiting', 'TE usage revolution with Pitts'],
      achievements: ['Multiple SEC East titles', 'Kyle Pitts TE1 legacy'] },
    { id: 'era-2020s', label: '2020s', title: 'Sumrall Era — New Chapter', hero: '🎯', kicker: 'Program History', headerImage: '/og-image.jpg',
      summary: 'Jon Sumrall arrives in 2026 with a rebuilt roster, 3-3-5 defensive identity, and a portal-powered roster reset.',
      winners: ['Jayden Woods — JACK centerpiece', 'Eric Singleton Jr. — WR1 vertical threat'],
      players: [{ name: 'Jayden Woods', role: 'JACK · 3-3-5 edge' }, { name: 'Eric Singleton Jr.', role: 'WR · Auburn transfer' }, { name: 'Aaron Philo', role: 'QB · Pro-style fit' }],
      games: ['2026 vs FAU — Sumrall debut', '2026 vs Georgia — Cocktail Party'],
      highlights: ['2026 portal class rebuild', 'Brad White 3-3-5 install', 'Culture-first Sumrall standard'],
      achievements: ['Portal-powered roster reset', 'Brad White 3-3-5 install'] }
  ];

  var ACHIEVEMENTS = [
    { id: 'ach-nc', icon: '🏆', stat: '3', label: 'National Championships', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['1996 — Danny Wuerffel & Steve Spurrier', '2006 — Urban Meyer & Chris Leak', '2008 — Tim Tebow & Percy Harvin'],
      note: 'Three consensus national titles — the standard Gator Nation expects every decade.',
      highlights: ['1996: First national title in program history', '2006–08: Back-to-back title window', 'CFP-era contention remains the goal'],
      winners: ['Steve Spurrier', 'Urban Meyer', 'Tim Tebow'] },
    { id: 'ach-sec', icon: '🥇', stat: '8', label: 'SEC Championships', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['1991', '1993', '1994', '1995', '1996', '2000', '2006', '2008'],
      note: 'Eight SEC titles — sustained dominance in the nation\'s toughest conference.',
      highlights: ['1990s: Spurrier SEC dynasty', '2000s: Meyer reload titles', 'SEC East crowns across eras'],
      winners: ['Spurrier era — 4 SEC titles', 'Meyer era — 2 SEC titles'] },
    { id: 'ach-heisman', icon: '⭐', stat: '3', label: 'Heisman Winners', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['1966 Steve Spurrier', '1996 Danny Wuerffel', '2007 Tim Tebow'],
      note: 'Three Heisman Trophy winners — quarterbacks who defined their eras in The Swamp.',
      highlights: ['Spurrier — first UF Heisman (1966)', 'Wuerffel — title + Heisman (1996)', 'Tebow — two-time national champion (2007)'],
      winners: ['Steve Spurrier', 'Danny Wuerffel', 'Tim Tebow'] },
    { id: 'ach-aam', icon: '🛡️', stat: '100+', label: 'All-Americans', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['100+ consensus selections program-wide'],
      note: 'Elite talent pipeline across every era — from Marshall to Pitts to Woods.',
      highlights: ['Defensive All-Americans in 3-3-5 era', 'WR/TE production in spread eras', 'NFL-caliber depth every cycle'],
      winners: ['Wilber Marshall', 'Kyle Pitts', 'Jayden Woods (2026 track)'] },
    { id: 'ach-nfl', icon: '🏈', stat: '500+', label: 'NFL Draft Picks', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['500+ all-time', '2020s: Pitts, Henderson, Richardson'],
      note: 'Consistent NFL production — Florida develops Sunday players at every position.',
      highlights: ['First-round pipeline at EDGE and CB', 'TE1 development track record', 'QB factory under multiple systems'],
      winners: ['Kyle Pitts — TE1', 'Anthony Richardson — dual-threat QB'] },
    { id: 'ach-bowl', icon: '🎖️', stat: '50+', label: 'Major Bowl Wins', kicker: 'Achievements', headerImage: '/og-image.jpg',
      years: ['Sugar Bowl', 'Orange Bowl', 'BCS/CFP appearances'],
      note: 'Postseason success across decades — Florida shows up on the biggest stages.',
      highlights: ['BCS National Championship Game wins', 'New Year\'s Six appearances', 'Bowl streaks in winning eras'],
      winners: ['Sugar Bowl champions', 'Orange Bowl champions'] }
  ];

  var TEAM_IDENTITY = {
    id: 'identity', title: 'Team Identity', kicker: 'Culture & Traditions', headerImage: '/og-image.jpg',
    summary: 'Orange and blue. The Swamp. Gator Nation.',
    body: 'Florida football is built on speed, physicality, and recruiting dominance in the Southeast. The program\'s brand centers on The Swamp\'s home-field advantage, the chomp tradition, and a standard of competing for SEC and national titles every season.\n\nUnder Jon Sumrall, the 2026 identity emphasizes culture-first leadership, defensive versatility in the 3-3-5, and an offense built for conflict players and explosive skill talent.',
    highlights: ['The Swamp — one of college football\'s loudest venues', 'Orange & Blue — iconic SEC brand', 'Gator Chomp — universal rally cry', '3-3-5 defensive identity under Brad White'],
    pillars: ['Speed and physicality in the SEC', 'Recruiting dominance in Florida, Georgia, and the Southeast', 'Culture-first leadership under Jon Sumrall', 'Conflict players on offense — RPO rhythm and vertical shots']
  };

  var COACHING_STAFF = [
    { id: 'sumrall', name: 'Jon Sumrall', title: 'Head Coach', unit: 'hc', headerImage: '/og-image.jpg',
      bio: 'First-year head coach after leading Tulane. Culture-driven leader installing a competitive standard across roster and staff.',
      highlights: ['Culture-first program builder', 'Portal-era roster architect', 'Defensive identity partner with Brad White'] },
    { id: 'faulkner', name: 'Buster Faulkner', title: 'Offensive Coordinator', unit: 'oc', headerImage: '/og-image.jpg',
      bio: 'Spread RPO architect. Builds rhythm passing, conflict reads, and vertical shots around Eric Singleton Jr. and the rebuilt offensive line.',
      highlights: ['Rhythm RPO quick game', 'Conflict-read QB development', 'Vertical shot menu with Singleton'] },
    { id: 'white', name: 'Brad White', title: 'Defensive Coordinator', unit: 'dc', headerImage: '/og-image.jpg',
      bio: '3-3-5 odd-front specialist. JACK and STAR roles define the defense — Jayden Woods and Kanye Clark are scheme centerpieces.',
      highlights: ['3-3-5 odd front install', 'JACK/STAR hybrid roles', 'Simulated pressure packages'] },
    { id: 'harris', name: 'Anthony Harris', title: 'Defensive Backs Coach', unit: 'db', headerImage: '/og-image.jpg',
      bio: 'Develops corners and safeties in a hybrid-heavy secondary. Critical for STAR/nickel fit in tempo offenses.', highlights: ['STAR/nickel development', 'Coverage match rules', 'Tempo offense answers'] },
    { id: 'gasparato', name: 'Greg Gasparato', title: 'Linebackers Coach', unit: 'lb', headerImage: '/og-image.jpg',
      bio: 'Linebacker development in the 3-3-5 — run fits, blitz packages, and communication in nickel personnel.', highlights: ['Run-fit mastery', 'Blitz timing', 'Nickel communication'] },
    { id: 'davis', name: 'Marcus Davis', title: 'Wide Receivers Coach', unit: 'wr', headerImage: '/og-image.jpg',
      bio: 'WR room coach — route running, separation, and vertical threat development for Singleton and the receiving corps.', highlights: ['Route-running detail', 'Vertical threat development', 'Singleton WR1 usage'] },
    { id: 'mcknight', name: 'Trent McKnight', title: 'Offensive Line Coach', unit: 'ol', headerImage: '/og-image.jpg',
      bio: 'Rebuilds the five-man front. Pass protection and run-game cohesion are the swing factors for the 2026 offense.', highlights: ['Pass-pro rebuild', 'Run-game cohesion', 'Portal OL integration'] },
    { id: 'st', name: 'Special Teams Coordinator', title: 'Special Teams Coordinator', unit: 'st', headerImage: '/og-image.jpg',
      bio: 'Coverage units, return game, and field position — critical in close SEC games and rivalry week.', highlights: ['Coverage units', 'Return game explosiveness', 'Field-position wins'] },
    { id: 'whitt', name: 'Rusty Whitt', title: 'Head Strength & Conditioning', unit: 'sc', headerImage: '/og-image.jpg',
      bio: 'Fourth-quarter football and availability. S&C sets the physical floor for Sumrall\'s culture.', highlights: ['Availability culture', 'Fourth-quarter edge', 'Summer development'] },
    { id: 'analyst-off', name: 'Offensive Analyst', title: 'Offensive Analyst', unit: 'analyst', headerImage: '/og-image.jpg',
      bio: 'Film breakdown, self-scout, and opponent tendency reports for the offensive staff.', highlights: ['Self-scout cut-ups', 'Opponent tendency reports', 'Weekly game-plan support'] },
    { id: 'analyst-def', name: 'Defensive Analyst', title: 'Defensive Analyst', unit: 'analyst', headerImage: '/og-image.jpg',
      bio: 'Defensive quality control — pressure tendencies, coverage rules, and weekly cut-ups.', highlights: ['Pressure tendency reports', 'Coverage rule QC', 'Weekly defensive cut-ups'] }
  ];

  var SUPPORT_STAFF = {
    id: 'support', title: 'Support Staff', kicker: 'Coaching Staff', headerImage: '/og-image.jpg',
    summary: 'Operations, video, equipment, and administrative staff supporting the 2026 program.',
    units: ['Director of Football Operations', 'Video & Quality Control', 'Equipment & Logistics', 'Player Development & Nutrition']
  };

  var ROSTER_FILTERS = ['All', 'QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'DB', 'ST'];
  var POS_GROUPS = {
    QB: ['QB'], RB: ['RB', 'FB'], WR: ['WR', 'TE'],
    OL: ['OL', 'OT', 'OG', 'C', 'IOL', 'LT', 'LG', 'RG', 'RT'],
    DL: ['DL', 'DT', 'DE', 'EDGE', 'NT', 'END', 'NOSE'],
    LB: ['LB', 'MIKE', 'WILL', 'SAM', 'JACK', 'OLB', 'ILB'],
    DB: ['DB', 'CB', 'S', 'SS', 'FS', 'NB', 'STAR'],
    ST: ['K', 'P', 'LS', 'KR', 'PR']
  };

  var TEAM_PREFIXES = ['mteam', 'team'];

  function esc(s) {
    if (typeof gvLiveEsc === 'function') return gvLiveEsc(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function slugify(name) {
    if (typeof gvSlugify === 'function') return gvSlugify(name);
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function headshotUrl(slug) {
    return slug ? '/headshots/' + encodeURIComponent(slug) + '.svg' : '';
  }

  function buildShareUrl(modal) {
    if (!modal) return global.location.href;
    var base = global.location.origin + global.location.pathname;
    var q = new URLSearchParams();
    q.set('team', modal.type);
    if (modal.id) q.set('id', modal.id);
    if (modal.slug) q.set('slug', modal.slug);
    if (modal.pos) q.set('pos', modal.pos);
    return base + '?' + q.toString();
  }

  function sectionHdr(iconKey, title) {
    return '<div class="gv-tm-section-hdr"><span class="gv-tm-section-icon">' + (ICON[iconKey] || '🐊') + '</span>'
      + '<h3 class="gv-tm-section-title">' + esc(title) + '</h3></div>';
  }

  function renderPhotoCard(item) {
    var slug = item.slug || slugify(item.name);
    var img = headshotUrl(slug);
    var av = item.name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2);
    return '<div class="gv-tm-photo-card">'
      + (img ? '<img src="' + esc(img) + '" alt="" onerror="this.outerHTML=\'<span class=\\\'gv-tm-photo-av\\\'>' + esc(av) + '</span>\'">' : '<span class="gv-tm-photo-av">' + esc(av) + '</span>')
      + '<span class="gv-tm-photo-name">' + esc(item.name) + '</span>'
      + (item.role ? '<span class="gv-tm-photo-sub">' + esc(item.role) + '</span>' : '')
      + '</div>';
  }

  function renderHighlights(items) {
    return (items || []).map(function (h) {
      return '<div class="gv-tm-highlight"><span class="gv-tm-highlight-icon">⭐</span><p class="gv-tm-highlight-text">' + esc(h) + '</p></div>';
    }).join('');
  }

  function renderTimeline(items) {
    return '<div class="gv-tm-timeline">' + (items || []).map(function (t) {
      return '<div class="gv-tm-timeline-item">' + esc(t) + '</div>';
    }).join('') + '</div>';
  }

  function renderChips(items) {
    return '<div class="gv-tm-chip-list">' + (items || []).map(function (c) {
      return '<span class="gv-tm-chip">' + esc(c) + '</span>';
    }).join('') + '</div>';
  }

  function renderRelated(items) {
    if (!items || !items.length) return '';
    var html = '<div class="gv-tm-section"><div class="gv-tm-section-hdr"><span class="gv-tm-section-icon">' + ICON.related + '</span>'
      + '<h3 class="gv-tm-section-title">Related Content</h3></div><div class="gv-tm-related">';
    items.forEach(function (r) {
      html += '<button type="button" class="gv-tm-related-card" data-related-type="' + esc(r.type) + '" data-related-id="' + esc(r.id || '') + '" data-related-slug="' + esc(r.slug || '') + '">'
        + '<span class="gv-tm-related-icon">' + esc(r.icon || '🔗') + '</span>'
        + '<span><p class="gv-tm-related-label">' + esc(r.label) + '</p>'
        + (r.sub ? '<p class="gv-tm-related-sub">' + esc(r.sub) + '</p>' : '') + '</span></button>';
    });
    return html + '</div></div>';
  }

  function buildModalHtml(sections, related) {
    var html = sections.join('');
    html += renderRelated(related);
    return html;
  }

  function relatedForEra(eraId) {
    var others = ERAS.filter(function (e) { return e.id !== eraId; }).slice(0, 2);
    return others.map(function (e) {
      return { type: 'era', id: e.id, icon: e.hero, label: e.title, sub: e.label + ' era' };
    }).concat([
      { type: 'achievement', id: 'ach-nc', icon: '🏆', label: 'National Championships', sub: 'Program achievements' },
      { type: 'identity', id: 'identity', icon: '🐊', label: 'Team Identity', sub: 'Culture & traditions' }
    ]);
  }

  function relatedForCoach(coachId) {
    var c = COACHING_STAFF.find(function (x) { return x.id === coachId; });
    var sameUnit = COACHING_STAFF.filter(function (x) { return x.id !== coachId && x.unit === (c && c.unit); }).slice(0, 1);
    var out = sameUnit.map(function (x) {
      return { type: 'coach', id: x.id, icon: '👔', label: x.name, sub: x.title };
    });
    out.push({ type: 'identity', id: 'identity', icon: '🐊', label: 'Team Identity', sub: 'Program culture' });
    if (c && c.unit === 'dc') out.push({ type: 'film', id: 'scheme', icon: '🎬', label: 'Film Room: 3-3-5', sub: 'Scheme library' });
    return out;
  }

  function openRichModal(cfg) {
    var ov = document.getElementById('gv-team-detail-modal');
    var panel = document.getElementById('gv-team-modal-panel');
    if (!ov || !panel) return;
    _currentModal = cfg;

    var heroEl = document.getElementById('gv-team-modal-hero');
    var heroImg = document.getElementById('gv-team-modal-hero-img');
    var kickerEl = document.getElementById('gv-team-modal-kicker');
    var titleEl = document.getElementById('gv-team-modal-title');
    var bodyEl = document.getElementById('gv-team-detail-body');

    if (heroEl) {
      heroEl.style.backgroundImage = 'url(' + (cfg.headerImage || DEFAULT_HERO) + ')';
      heroEl.style.backgroundSize = 'cover';
      heroEl.style.backgroundPosition = 'center 35%';
    }
    if (heroImg) {
      if (cfg.headerImage) {
        heroImg.src = cfg.headerImage;
        heroImg.classList.remove('hidden');
        heroImg.onerror = function () { heroImg.classList.add('hidden'); };
      } else {
        heroImg.classList.add('hidden');
      }
    }
    if (kickerEl) kickerEl.textContent = cfg.kicker || 'Team';
    if (titleEl) titleEl.textContent = cfg.title || 'Florida Gators';
    if (bodyEl) bodyEl.innerHTML = cfg.bodyHtml || '';

    panel.style.transform = '';
    ov.classList.remove('hidden');
    ov.style.display = 'flex';
    ov.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gv-team-modal-open');
    document.body.style.overflow = 'hidden';
    if (bodyEl) bodyEl.scrollTop = 0;
  }

  function closeTeamDetail() {
    var ov = document.getElementById('gv-team-detail-modal');
    var panel = document.getElementById('gv-team-modal-panel');
    if (!ov) return;
    if (panel) panel.style.transform = '';
    ov.classList.add('hidden');
    ov.style.display = '';
    ov.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gv-team-modal-open');
    document.body.style.overflow = '';
    _currentModal = null;
  }

  function openEraDetail(eraId) {
    var era = ERAS.find(function (e) { return e.id === eraId; });
    if (!era) return;
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(era.summary) + '</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('winners', 'Winners & Legends') + renderPhotoGridPlayers(era.players) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('highlights', 'Highlights') + renderHighlights(era.highlights) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('games', 'Key Games') + renderTimeline(era.games) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('achievements', 'Achievements') + renderChips(era.achievements) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('sources', 'Verified Sources') + '<p class="gv-tm-body">Era summaries sourced from GatorVault program history database — SEC archives, UF athletics records, and verified media reporting.</p></div>'
    ];
    openRichModal({
      type: 'era', id: era.id, kicker: era.kicker || 'Program History', title: era.title,
      headerImage: era.headerImage || DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, relatedForEra(era.id))
    });
  }

  function renderPhotoGridPlayers(players) {
    return '<div class="gv-tm-photo-grid">' + (players || []).map(function (p) {
      return renderPhotoCard(typeof p === 'string' ? { name: p, role: '' } : p);
    }).join('') + '</div>';
  }

  function openAchievementDetail(achId) {
    var ach = ACHIEVEMENTS.find(function (a) { return a.id === achId; });
    if (!ach) return;
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(ach.note) + '</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('winners', 'Winners') + renderChips(ach.winners || []) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('highlights', 'Highlights') + renderHighlights(ach.highlights) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('timeline', 'Timeline') + renderTimeline(ach.years) + '</div>'
    ];
    openRichModal({
      type: 'achievement', id: ach.id, kicker: ach.kicker || 'Achievements', title: ach.label,
      headerImage: ach.headerImage || DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, [
        { type: 'achievement', id: 'ach-heisman', icon: '⭐', label: 'Heisman Winners', sub: 'Program greats' },
        { type: 'era', id: 'era-2000s', icon: '🐊', label: 'Urban Meyer Dynasty', sub: '2000s era' },
        { type: 'identity', id: 'identity', icon: '🐊', label: 'Team Identity', sub: 'Gator Nation' }
      ])
    });
  }

  function openCoachDetail(coachId) {
    var c = COACHING_STAFF.find(function (x) { return x.id === coachId; });
    if (!c) return;
    var initials = (c.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2);
    var sections = [
      '<div class="gv-tm-section"><div class="gv-tm-coach-hero">'
      + '<span class="gv-tm-coach-photo">' + esc(initials) + '</span>'
      + '<div><p class="gv-tm-lead" style="margin:0">' + esc(c.title) + '</p><p class="gv-tm-body">' + esc(c.bio) + '</p></div></div></div>',
      '<div class="gv-tm-section">' + sectionHdr('highlights', 'Coaching Highlights') + renderHighlights(c.highlights || []) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('staff', 'Unit Focus') + renderChips([c.unit.toUpperCase() + ' coach · 2026 staff']) + '</div>'
    ];
    openRichModal({
      type: 'coach', id: c.id, kicker: 'Coaching Staff', title: c.name,
      headerImage: c.headerImage || DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, relatedForCoach(c.id))
    });
  }

  function openIdentityDetail() {
    var t = TEAM_IDENTITY;
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(t.summary) + '</p><p class="gv-tm-body">' + esc(t.body).replace(/\n/g, '<br>') + '</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('culture', 'Culture Pillars') + renderHighlights(t.pillars || []) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('highlights', 'Traditions & Highlights') + renderHighlights(t.highlights) + '</div>'
    ];
    openRichModal({
      type: 'identity', id: 'identity', kicker: t.kicker, title: t.title,
      headerImage: t.headerImage || DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, [
        { type: 'era', id: 'era-2020s', icon: '🎯', label: 'Sumrall Era', sub: '2020s chapter' },
        { type: 'coach', id: 'sumrall', icon: '👔', label: 'Jon Sumrall', sub: 'Head Coach' },
        { type: 'achievement', id: 'ach-nc', icon: '🏆', label: 'National Championships', sub: '3 titles' }
      ])
    });
  }

  function openSupportStaffDetail() {
    var s = SUPPORT_STAFF;
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(s.summary) + '</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('staff', 'Support Units') + renderTimeline(s.units) + '</div>'
    ];
    openRichModal({
      type: 'support', id: 'support', kicker: s.kicker, title: s.title,
      headerImage: s.headerImage || DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, COACHING_STAFF.slice(0, 3).map(function (c) {
        return { type: 'coach', id: c.id, icon: '👔', label: c.name, sub: c.title };
      }))
    });
  }

  function openPlayerModal(slug) {
    var profiles = global.playerProfiles || [];
    var p = profiles.find(function (x) { return x.slug === slug; });
    if (!p) {
      global.location.href = '/player/' + slug;
      return;
    }
    var rating = typeof playerDisplayRating === 'function' ? playerDisplayRating(p) : p.rating;
    var photoHtml = renderPhotoCard({ name: p.name, role: (p.pos || '') + (p.classYear ? ' · ' + p.classYear : ''), slug: p.slug });
    var sections = [
      '<div class="gv-tm-section"><div class="gv-tm-coach-hero">'
      + photoHtml.replace('class="gv-tm-photo-card"', 'class="gv-tm-photo-card" style="background:transparent;border:0;padding:0;max-width:88px"')
      + '<div><p class="gv-tm-lead" style="margin:0">' + esc(p.pos || 'Player') + (rating != null ? ' · Vault ' + Number(rating).toFixed(1) : '') + '</p>'
      + (p.bio ? '<p class="gv-tm-body">' + esc(String(p.bio).slice(0, 280)) + '</p>' : '<p class="gv-tm-body">Full measurables, film notes, and depth-chart context on the player profile.</p>')
      + '</div></div></div>',
      '<div class="gv-tm-section">' + sectionHdr('roster', 'Roster Intel') + renderChips([
        p.htWt || (p.height && p.weight ? p.height + ' / ' + p.weight : null),
        p.hometown, p.unit, p.depthChartTier
      ].filter(Boolean)) + '</div>'
    ];
    var html = buildModalHtml(sections, [
      { type: 'depth', id: 'scroll', icon: '📋', label: 'Depth Chart', sub: 'View two-deep' },
      { type: 'coach', id: unitCoachId(p.pos), icon: '👔', label: 'Position coach', sub: 'Staff bio' }
    ]);
    html += '<div class="gv-tm-cta"><a class="gv-tm-cta-primary" href="/player/' + esc(slug) + '">Full Player Profile →</a></div>';
    openRichModal({
      type: 'player', slug: slug, kicker: 'Roster', title: p.name,
      headerImage: headshotUrl(slug) || DEFAULT_HERO,
      bodyHtml: html
    });
  }

  function unitCoachId(pos) {
    var p = String(pos || '').toUpperCase();
    if (/QB|RB|WR|TE|OL|OT|OG|C/.test(p)) return 'faulkner';
    if (/DL|DE|DT|EDGE/.test(p)) return 'white';
    if (/LB|JACK/.test(p)) return 'gasparato';
    if (/DB|CB|S|STAR/.test(p)) return 'harris';
    return 'sumrall';
  }

  function openDepthChartModal(data) {
    var statusCls = data.status === 'locked' ? 'gv-tm-status-locked' : data.status === 'battle' ? 'gv-tm-status-battle' : 'gv-tm-status-watch';
    var statusLabel = data.status === 'locked' ? '🟢 Locked starter' : data.status === 'battle' ? '🟡 Position battle' : '🔴 Watch list';
    var sections = [
      '<div class="gv-tm-section"><span class="gv-tm-status-pill ' + statusCls + '">' + statusLabel + '</span>'
      + '<p class="gv-tm-lead" style="margin-top:12px">' + esc(data.pos) + ' — two-deep snapshot for the 2026 spring board.</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('depth', 'Depth Chart') + renderHighlights([
        '1st: ' + data.starter + (data.starterInfo ? ' (' + data.starterInfo + ')' : ''),
        data.backup && data.backup !== '—' ? '2nd: ' + data.backup + (data.backupInfo ? ' (' + data.backupInfo + ')' : '') : null,
        data.third ? '3rd: ' + data.third : null
      ].filter(Boolean)) + '</div>',
      data.analysis ? '<div class="gv-tm-section">' + sectionHdr('highlights', 'Analysis') + '<p class="gv-tm-body">' + esc(data.analysis) + '</p></div>' : ''
    ];
    openRichModal({
      type: 'depth', id: data.pos, pos: data.pos, kicker: 'Depth Chart', title: data.pos + ' Room',
      headerImage: DEFAULT_HERO,
      bodyHtml: buildModalHtml(sections, [
        { type: 'identity', id: 'identity', icon: '🐊', label: 'Team Identity', sub: 'Program context' },
        { type: 'coach', id: 'sumrall', icon: '👔', label: 'Coaching Staff', sub: 'Sumrall · Faulkner · White' }
      ]) + '<div class="gv-tm-cta"><button type="button" class="gv-tm-cta-secondary" data-related-type="depth" data-related-id="scroll">Jump to Depth Chart →</button></div>'
    });
  }

  function parseDepthCard(card) {
    var posEl = card.querySelector('.gv-dc-pos') || card.querySelector('.text-gator-orange, [class*="gator-orange"]');
    var pos = posEl ? posEl.textContent.trim() : 'Position';
    var rows = card.querySelectorAll('.gv-dc-depth-row');
    if (rows.length) {
      var starter = rows[0].querySelector('.gv-dc-depth-name');
      var starterMeta = rows[0].querySelector('.gv-dc-depth-meta');
      var backup = rows[1] ? rows[1].querySelector('.gv-dc-depth-name') : null;
      var backupMeta = rows[1] ? rows[1].querySelector('.gv-dc-depth-meta') : null;
      var third = rows[2] ? rows[2].querySelector('.gv-dc-depth-name') : null;
      var status = 'watch';
      if (card.querySelector('.gv-dc-status--locked')) status = 'locked';
      else if (card.querySelector('.gv-dc-status--battle')) status = 'battle';
      var detail = card.querySelector('.dc-detail');
      return {
        pos: pos,
        starter: starter ? starter.textContent.trim() : '',
        starterInfo: starterMeta ? starterMeta.textContent.trim() : '',
        backup: backup ? backup.textContent.trim() : '—',
        backupInfo: backupMeta ? backupMeta.textContent.trim() : '',
        third: third ? third.textContent.trim() : '',
        status: status,
        analysis: detail ? detail.textContent.trim() : ''
      };
    }
    var lines = card.querySelectorAll('.text-white, .text-sm');
    var starter = '';
    card.querySelectorAll('span').forEach(function (s) {
      if (s.textContent.indexOf('1st:') === 0) starter = s.textContent.replace('1st:', '').trim();
    });
    var text = card.textContent;
    var m1 = text.match(/1st:\s*([^\n]+)/);
    var m2 = text.match(/2nd:\s*([^\n]+)/);
    var m3 = text.match(/3rd:\s*([^\n]+)/);
    var status = 'watch';
    if (card.textContent.indexOf('LOCKED') >= 0) status = 'locked';
    else if (card.textContent.indexOf('BATTLE') >= 0) status = 'battle';
    var detail = card.querySelector('.dc-detail');
    return {
      pos: pos,
      starter: m1 ? m1[1].trim() : starter,
      backup: m2 ? m2[1].trim() : '—',
      third: m3 ? m3[1].trim() : '',
      status: status,
      analysis: detail ? detail.textContent.trim() : ''
    };
  }

  function shareCurrentModal() {
    if (!_currentModal) return;
    var url = buildShareUrl(_currentModal);
    var title = (_currentModal.title || 'GatorVault Team') + ' · GatorVault';
    if (global.navigator && global.navigator.share) {
      global.navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (global.navigator && global.navigator.clipboard) {
      global.navigator.clipboard.writeText(url).then(function () {
        var btn = document.getElementById('gv-team-modal-share');
        if (btn) { btn.textContent = '✓'; setTimeout(function () { btn.textContent = '⎘'; }, 1500); }
      });
      return;
    }
    global.prompt('Copy team link:', url);
  }

  function handleRelatedTap(btn) {
    var type = btn.getAttribute('data-related-type');
    var id = btn.getAttribute('data-related-id');
    var slug = btn.getAttribute('data-related-slug');
    if (type === 'era') openEraDetail(id);
    else if (type === 'achievement') openAchievementDetail(id);
    else if (type === 'coach') openCoachDetail(id);
    else if (type === 'identity') openIdentityDetail();
    else if (type === 'player' && slug) openPlayerModal(slug);
    else if (type === 'depth' && id === 'scroll') {
      closeTeamDetail();
      scrollToTeamSection('gv-team-dc-section');
      if (global.gvIsMobile && global.gvIsMobile()) scrollToTeamSection('gv-mteam-dc-section');
    }
    else if (type === 'film') {
      closeTeamDetail();
      if (typeof global.showVTab === 'function') global.showVTab('highlights');
    }
  }

  function isTeamPaneTarget(node) {
    if (!node || !node.closest) return false;
    var m = node.closest('#vpane-mteam');
    if (m && m.style.display !== 'none' && m.offsetParent !== null) return true;
    var t = node.closest('#vpane-team');
    if (t && t.style.display !== 'none' && t.offsetParent !== null) return true;
    return false;
  }

  function resetTeamTouch() {
    _touch.moved = false;
    _touch.t = 0;
  }

  function onTeamTouchStart(e) {
    if (!e.target || !isTeamPaneTarget(e.target) || !e.touches || !e.touches.length) return;
    _touch.x = e.touches[0].clientX;
    _touch.y = e.touches[0].clientY;
    _touch.moved = false;
    _touch.t = Date.now();
  }

  function onTeamTouchMove(e) {
    if (!_touch.t || !e.touches || !e.touches.length) return;
    if (!isTeamPaneTarget(e.target)) return;
    var dx = e.touches[0].clientX - _touch.x;
    var dy = e.touches[0].clientY - _touch.y;
    if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) {
      _touch.moved = true;
    }
  }

  function onTeamTouchEnd(e) {
    if (!e.target || !isTeamPaneTarget(e.target) || !_touch.t) return;
    var elapsed = Date.now() - _touch.t;
    var wasScroll = _touch.moved;
    resetTeamTouch();
    if (wasScroll || elapsed > TAP_MAX_MS) return;
    if (handleTeamTap(e.target)) {
      e.preventDefault();
      _touch.suppressClick = true;
      setTimeout(function () { _touch.suppressClick = false; }, 400);
    }
  }

  function handleTeamTap(target) {
    if (!target || !isTeamPaneTarget(target)) return false;

    var related = target.closest('.gv-tm-related-card[data-related-type]');
    if (related) {
      handleRelatedTap(related);
      return true;
    }

    var dcCard = target.closest('#vpane-mteam .dc-card, #vpane-team .dc-card, #vpane-mteam .gv-dc-premium, #vpane-team .gv-dc-premium');
    if (dcCard) {
      openDepthChartModal(parseDepthCard(dcCard));
      return true;
    }

    var eraBtn = target.closest('.gv-team-era-card[data-era-id]');
    if (eraBtn) { openEraDetail(eraBtn.getAttribute('data-era-id')); return true; }

    var achBtn = target.closest('.gv-team-ach-tile[data-ach-id]');
    if (achBtn) { openAchievementDetail(achBtn.getAttribute('data-ach-id')); return true; }

    var coachBtn = target.closest('.gv-coach-card[data-coach-id]');
    if (coachBtn) { openCoachDetail(coachBtn.getAttribute('data-coach-id')); return true; }

    if (target.closest('#gv-mteam-identity-btn, #gv-team-identity-btn, .gv-team-identity-card[data-identity]')) {
      openIdentityDetail();
      return true;
    }
    if (target.closest('#gv-mteam-support-btn, #gv-team-support-btn')) { openSupportStaffDetail(); return true; }

    var rosterCard = target.closest('.gv-mteam-roster-card[data-slug]');
    if (rosterCard) {
      var slug = rosterCard.getAttribute('data-slug');
      if (slug) openPlayerModal(slug);
      return true;
    }

    return false;
  }

  function wireSwipeClose() {
    var panel = document.getElementById('gv-team-modal-panel');
    if (!panel || panel._gvSwipeWired) return;
    panel._gvSwipeWired = true;
    panel.addEventListener('touchstart', function (e) {
      if (global.innerWidth >= 768) return;
      var body = document.getElementById('gv-team-detail-body');
      if (body && body.scrollTop > 8) return;
      _swipe.startY = e.touches[0].clientY;
      _swipe.active = true;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!_swipe.active || global.innerWidth >= 768) return;
      var dy = e.touches[0].clientY - _swipe.startY;
      if (dy > 0) {
        panel.classList.add('gv-team-modal-dragging');
        panel.style.transform = 'translateY(' + Math.min(dy, 120) + 'px)';
      }
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
      if (!_swipe.active) return;
      _swipe.active = false;
      panel.classList.remove('gv-team-modal-dragging');
      var dy = e.changedTouches[0].clientY - _swipe.startY;
      if (dy > 90) closeTeamDetail();
      else panel.style.transform = '';
    }, { passive: true });
  }

  function wireTeamInteractions() {
    if (_interactionsWired) return;
    _interactionsWired = true;
    document.addEventListener('touchstart', onTeamTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTeamTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', onTeamTouchEnd, { capture: true, passive: false });
    document.addEventListener('click', function (e) {
      if (_touch.suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.target.closest('#gv-team-detail-modal') && e.target.closest('.gv-tm-related-card')) {
        e.preventDefault();
        e.stopPropagation();
        handleRelatedTap(e.target.closest('.gv-tm-related-card'));
        return;
      }
      if (e.target.closest('#gv-team-detail-modal') && e.target.closest('[data-related-type]')) {
        e.preventDefault();
        handleRelatedTap(e.target.closest('[data-related-type]'));
        return;
      }
      if (handleTeamTap(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  function wireTeamDetailModal() {
    if (_modalWired) return;
    _modalWired = true;
    var closeBtn = document.getElementById('gv-team-detail-close');
    var shareBtn = document.getElementById('gv-team-modal-share');
    var ov = document.getElementById('gv-team-detail-modal');
    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeTeamDetail(); });
    if (shareBtn) shareBtn.addEventListener('click', function (e) { e.preventDefault(); shareCurrentModal(); });
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeTeamDetail(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeTeamDetail();
    });
    wireSwipeClose();
  }

  function renderEraCard(era, idx) {
    var img = era.headerImage || DEFAULT_HERO;
    return '<button type="button" class="gv-team-era-card" data-era-id="' + esc(era.id) + '" style="animation-delay:' + (idx * 0.04) + 's">'
      + '<div class="gv-team-era-media" style="background-image:url(' + esc(img) + ')">'
      + '<span class="gv-team-era-hero">' + era.hero + '</span></div>'
      + '<div class="gv-team-era-body">'
      + '<span class="gv-team-era-label">' + esc(era.label) + '</span>'
      + '<span class="gv-team-era-sub">' + esc(era.title) + '</span></div></button>';
  }

  function renderAchievementTile(a, idx) {
    return '<button type="button" class="gv-team-ach-tile" data-ach-id="' + esc(a.id) + '" style="animation-delay:' + (idx * 0.03) + 's">'
      + (a.stat ? '<span class="gv-team-ach-stat">' + esc(a.stat) + '</span>' : '')
      + '<span class="gv-team-ach-icon">' + a.icon + '</span>'
      + '<span class="gv-team-ach-label">' + esc(a.label) + '</span></button>';
  }

  function renderIdentityCard(prefix) {
    var t = TEAM_IDENTITY;
    var img = t.headerImage || DEFAULT_HERO;
    return '<button type="button" class="gv-team-identity-card" id="gv-' + prefix + '-identity-btn" data-identity="1">'
      + '<div class="gv-team-identity-banner" style="background-image:url(' + esc(img) + ')">'
      + '<h3 class="gv-team-identity-banner-title">' + esc(t.title) + '</h3></div>'
      + '<div class="gv-team-identity-pillars">'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🏟️</span><span class="gv-team-identity-pillar-label">The Swamp</span></div>'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🐊</span><span class="gv-team-identity-pillar-label">Culture</span></div>'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🧡</span><span class="gv-team-identity-pillar-label">Traditions</span></div>'
      + '</div></button>';
  }

  function renderCoachCard(c) {
    var initials = (c.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2);
    return '<button type="button" class="gv-coach-card" data-coach-id="' + esc(c.id) + '">'
      + '<span class="gv-coach-headshot">' + esc(initials) + '</span>'
      + '<span class="gv-coach-info"><span class="gv-coach-name">' + esc(c.name) + '</span>'
      + '<span class="gv-coach-title">' + esc(c.title) + '</span></span>'
      + '<span class="gv-coach-chevron">›</span></button>';
  }

  function renderRosterCard(p) {
    var slug = p.slug || '';
    var name = p.name || '';
    var pos = p.pos || '';
    var yr = p.classYear || p.year || '';
    var rating = typeof playerDisplayRating === 'function' ? playerDisplayRating(p) : (p.rating || null);
    var tier = typeof ratingTier === 'function' ? ratingTier(rating || 0) : 'rating-solid';
    var initials = typeof gvPlayerInitials === 'function' ? gvPlayerInitials(name) : name.charAt(0);
    var img = headshotUrl(slug);
    return '<div class="gv-mteam-roster-card" data-slug="' + esc(slug) + '" tabindex="0" role="button">'
      + (img ? '<img src="' + esc(img) + '" alt="" class="gv-mteam-roster-av" style="object-fit:cover" onerror="this.outerHTML=\'<span class=\\\'gv-mteam-roster-av\\\'>' + esc(initials) + '</span>\'">' : '<span class="gv-mteam-roster-av">' + esc(initials) + '</span>')
      + '<span class="gv-mteam-roster-meta"><span class="gv-mteam-roster-name">' + esc(name) + '</span>'
      + '<span class="gv-mteam-roster-sub">' + esc(pos) + (yr ? ' · ' + esc(String(yr)) : '') + '</span></span>'
      + '<span class="gv-top-gator-grade ' + tier + '">' + (rating != null ? Number(rating).toFixed(1) : '—') + '</span></div>';
  }

  function playerMatchesRosterFilter(p, filter) {
    if (!filter || filter === 'All') return true;
    var pos = String(p.pos || '').toUpperCase();
    var group = POS_GROUPS[filter];
    if (!group) return pos === filter;
    return group.some(function (g) { return pos === g || pos.indexOf(g) === 0; });
  }

  function renderRosterList(listEl, filter) {
    if (!listEl) return;
    var profiles = global.playerProfiles || [];
    var f = filter || global._gvTeamRosterFilter || 'All';
    var isDesktopGrid = listEl.id === 'gv-team-roster-list';
    var list = profiles.filter(function (p) { return playerMatchesRosterFilter(p, f); });
    list.sort(function (a, b) {
      var ra = typeof playerDisplayRating === 'function' ? (playerDisplayRating(b) || 0) : 0;
      var rb = typeof playerDisplayRating === 'function' ? (playerDisplayRating(a) || 0) : 0;
      return ra - rb;
    });
    listEl.className = isDesktopGrid ? 'gv-team-roster-grid' : 'gv-mteam-roster-list';
    listEl.innerHTML = list.length
      ? list.slice(0, isDesktopGrid ? 64 : 48).map(renderRosterCard).join('')
      : '<p class="gv-espn-card-body text-surface-200/60">Roster loading…</p>';
  }

  function wireRosterFilters(filtersEl) {
    if (!filtersEl || filtersEl._wired) return;
    filtersEl._wired = true;
    filtersEl.innerHTML = ROSTER_FILTERS.map(function (f) {
      return '<button type="button" class="gv-mteam-pos-chip' + (f === 'All' ? ' active' : '') + '" data-pos="' + f + '">' + f + '</button>';
    }).join('');
    filtersEl.querySelectorAll('.gv-mteam-pos-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#' + filtersEl.id + ' .gv-mteam-pos-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        global._gvTeamRosterFilter = chip.getAttribute('data-pos');
        TEAM_PREFIXES.forEach(function (pfx) {
          renderRosterList(document.getElementById('gv-' + pfx + '-roster-list'), global._gvTeamRosterFilter);
        });
      });
    });
  }

  function renderTeamPane(prefix) {
    var erasEl = document.getElementById('gv-' + prefix + '-eras-track');
    var achEl = document.getElementById('gv-' + prefix + '-achievements');
    var identityEl = document.getElementById('gv-' + prefix + '-identity-slot');
    var staffEl = document.getElementById('gv-' + prefix + '-staff');
    var filtersEl = document.getElementById('gv-' + prefix + '-roster-filters');
    var rosterEl = document.getElementById('gv-' + prefix + '-roster-list');
    if (erasEl) erasEl.innerHTML = ERAS.map(renderEraCard).join('');
    if (achEl) {
      achEl.className = prefix === 'team' ? 'gv-team-ach-grid' : 'gv-mteam-tile-grid';
      achEl.innerHTML = ACHIEVEMENTS.map(renderAchievementTile).join('');
    }
    if (identityEl) identityEl.innerHTML = renderIdentityCard(prefix);
    if (staffEl) {
      staffEl.innerHTML = COACHING_STAFF.map(renderCoachCard).join('')
        + '<button type="button" class="gv-team-support-link" id="gv-' + prefix + '-support-btn">Support Staff →</button>';
    }
    if (filtersEl) wireRosterFilters(filtersEl);
    if (rosterEl) renderRosterList(rosterEl, global._gvTeamRosterFilter || 'All');
  }

  function renderTeam() {
    wireTeamInteractions();
    wireTeamDetailModal();
    TEAM_PREFIXES.forEach(renderTeamPane);
    if (typeof global.renderDC === 'function') {
      try { global.renderDC(); } catch (e) { /* optional */ }
    }
  }

  function scrollToTeamSection(sectionId) {
    var el = document.getElementById(sectionId);
    if (!el && sectionId === 'gv-team-dc-section') el = document.getElementById('gv-mteam-dc-section');
    if (!el && sectionId === 'gv-mteam-dc-section') el = document.getElementById('gv-team-dc-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyTeamDeepLink() {
    var params = new URLSearchParams(global.location.search || '');
    var team = params.get('team');
    var id = params.get('id');
    var slug = params.get('slug');
    var hash = (global.location.hash || '').replace(/^#/, '');

    if (team === 'era' && id) openEraDetail(id);
    else if (team === 'achievement' && id) openAchievementDetail(id);
    else if (team === 'coach' && id) openCoachDetail(id);
    else if (team === 'player' && slug) openPlayerModal(slug);
    else if (team === 'identity') openIdentityDetail();
    else if (team === 'support') openSupportStaffDetail();
    else if (team === 'depth') scrollToTeamSection('gv-team-dc-section');
    else if (params.get('era') || hash.indexOf('era-') === 0) openEraDetail(params.get('era') || hash);
    else if (params.get('achievement') || hash.indexOf('ach-') === 0) openAchievementDetail(params.get('achievement') || hash);
    else if (params.get('coach')) openCoachDetail(params.get('coach'));
    else if (hash === 'identity') openIdentityDetail();
    else if (hash === 'dc' || hash === 'depth-chart') scrollToTeamSection('gv-team-dc-section');
  }

  function openTeamDetail(title, bodyHtml) {
    openRichModal({ type: 'custom', title: title, kicker: 'Team', bodyHtml: bodyHtml, headerImage: DEFAULT_HERO });
  }

  global.gvRenderTeam = renderTeam;
  global.gvRenderMobileTeam = renderTeam;
  global.gvOpenTeamDetail = openTeamDetail;
  global.gvCloseTeamDetail = closeTeamDetail;
  global.gvOpenTeamEra = openEraDetail;
  global.gvOpenTeamAchievement = openAchievementDetail;
  global.gvOpenPlayerModal = openPlayerModal;
  global.gvOpenDepthChartModal = openDepthChartModal;
  global.gvApplyTeamDeepLink = applyTeamDeepLink;
  global.gvScrollTeamSection = scrollToTeamSection;
  global.GV_TEAM_DATA = { ERAS: ERAS, ACHIEVEMENTS: ACHIEVEMENTS, TEAM_IDENTITY: TEAM_IDENTITY, COACHING_STAFF: COACHING_STAFF, BUILD: BUILD };
  global.GV_TEAM_MOBILE_BUILD = BUILD;

  wireTeamInteractions();
  wireTeamDetailModal();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { wireTeamInteractions(); wireTeamDetailModal(); });
  }
})(typeof window !== 'undefined' ? window : global);
