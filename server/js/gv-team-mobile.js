/**
 * GatorVault — Team module (mobile + desktop): rich modals for History, Achievements,
 * Identity, Coaching Staff, Roster, and Depth Chart.
 */
(function (global) {
  'use strict';

  var BUILD = 'team-v4-20260605';
  var DEFAULT_HERO = null;
  var ERA_BG_CLASS = 'gv-team-era-bg';
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
    { id: 'era-70s80s', label: '1970–1989', title: 'Building The Swamp Standard', hero: '🏟️', kicker: 'Program History', eraClass: 'era-70s',
      summary: 'Doug Dickey and Charley Pell transformed Florida from a regional program into an SEC contender. The Swamp opened in 1990, but the cultural and recruiting foundation was laid across two decades of rising expectations, elite talent acquisition, and bowl-era credibility.',
      coaching: ['1970–1978 · Doug Dickey — modernized recruiting and facilities', '1979–1984 · Charley Pell — SEC competitiveness and bowl momentum', '1984–1989 · Galen Hall / transition years — Emmitt Smith era peak'],
      milestones: ['1976 · First bowl win under Dickey', '1980 · 8–4 season — SEC relevance signal', '1983 · 9–2–1 — top-10 finish and Citrus Bowl win', '1987–89 · Emmitt Smith rushes into national spotlight'],
      schemes: ['Pro-style power run game under Dickey', 'Pell-era I-formation and balanced attack', 'Evolution toward speed-in-space before the spread revolution'],
      recruiting: ['In-state Florida pipeline established as priority', 'National reach into Georgia and the Carolinas', 'Facilities arms race begins — precursor to The Swamp mystique'],
      culture: ['Orange & Blue identity sharpened across the SEC', 'Home-field intimidation culture seeded pre-Swamp', 'Expectation shift: Florida expects to win, not just compete'],
      winners: ['Emmitt Smith — all-time rushing legend', 'Wilber Marshall — defensive tone-setter', 'Kerwin Bell — record-setting passer'],
      players: [{ name: 'Emmitt Smith', role: 'RB · All-American, NFL record-setter' }, { name: 'Wilber Marshall', role: 'LB · Butkus Award winner' }, { name: 'Kerwin Bell', role: 'QB · SEC passing pioneer' }, { name: 'Cris Collinsworth', role: 'WR · All-SEC star' }],
      games: ['1980 vs LSU — Pell-era breakthrough', '1983 vs Miami — program-defining rivalry win', '1987 vs FSU — Emmitt\'s Heisman campaign peak', '1989 vs Washington (Freedom Bowl) — closing the decade strong'],
      highlights: ['First sustained SEC winning culture', 'Emmitt Smith Heisman runner-up momentum (1989)', 'Defensive identity with Wilber Marshall', 'Foundation for 1990s national title window'],
      achievements: ['Multiple top-10 finishes', 'Bowl streak established', 'All-American pipeline at RB and LB'] },
    { id: 'era-90s', label: '1990–2001', title: 'The Steve Spurrier Era', hero: '🏆', kicker: 'Program History', eraClass: 'era-90s',
      summary: 'Steve Spurrier returned to Gainesville and revolutionized college football with the Fun & Gun offense. Florida won its first national championship in 1996, claimed four SEC titles in six years, and established the modern Gator standard: score fast, recruit elite quarterbacks, and dominate the SEC East.',
      coaching: ['1990–2001 · Steve Spurrier — HC/OC, Fun & Gun architect', 'Bob Stoops (1995–98) — defensive renaissance before Oklahoma', 'Ron Zook — DC during 1996 title run'],
      milestones: ['1991 · First SEC Championship in program history', '1996 · First consensus national championship', '1996 · Danny Wuerffel Heisman Trophy', '2000 · Spurrier\'s final SEC title before NFL departure'],
      schemes: ['Fun & Gun — wide-open passing attack', 'No-huddle tempo and vertical shot concepts', 'Spread principles a decade before the spread era label'],
      recruiting: ['Elite QB pipeline: Wuerffel, Grossman, Brantley era seeds', 'Florida-first speed — WR/RB skill talent as identity', 'National championship recruiting cycles 1991–1996'],
      culture: ['Scoreboard pressure — 50-point games normalized', 'The Swamp as loudest venue in college football', 'Confidence, flair, and offensive arrogance as brand'],
      winners: ['Danny Wuerffel — 1996 Heisman & national champion', 'Fred Taylor — explosive run game complement', 'Jevon Kearse — "The Freak" pass rusher'],
      players: [{ name: 'Danny Wuerffel', role: 'QB · 1996 Heisman' }, { name: 'Fred Taylor', role: 'RB · 1,000-yard seasons' }, { name: 'Jevon Kearse', role: 'DE · First-round talent' }, { name: 'Ike Hilliard', role: 'WR · Biletnikoff finalist' }],
      games: ['1994 vs FSU — "Choke at Doak" / "Fifth Quarter"', '1996 vs FSU — national title path secured', '1997 vs FSU — Wuerffel Heisman season finale', '2001 vs Maryland — Orange Bowl, Spurrier\'s last game'],
      highlights: ['1996 National Championship', 'Four SEC titles (1991, 1993, 1994, 1995, 1996, 2000)', 'Fun & Gun legacy across college football', 'First sustained SEC East dynasty'],
      achievements: ['1996 National Championship', 'Heisman: Danny Wuerffel (1996)', 'Six SEC Championship Game appearances'] },
    { id: 'era-2000s', label: '2002–2009', title: 'Zook Transition & Meyer Dynasty', hero: '🐊', kicker: 'Program History', eraClass: 'era-2000s',
      summary: 'Ron Zook bridged the Spurrier exit before Urban Meyer arrived in 2005 and built a two-time national champion. The spread-option with Tim Tebow, Percy Harvin, and elite defenses redefined Florida\'s second golden age.',
      coaching: ['2002–2004 · Ron Zook — stabilizing transition', '2005–2009 · Urban Meyer — spread-option dynasty', 'Dan Mullen — OC during Tebow era (2005–08)'],
      milestones: ['2006 · Second national championship (BCS)', '2008 · Third national championship', '2007 · Tim Tebow Heisman Trophy', '2009 · Meyer\'s final season — 12–1, Sugar Bowl'],
      schemes: ['Spread-option with Tebow as dual-threat engine', 'Percy Harvin jet sweeps and mismatch packages', 'Elite defensive lines — Jarvis Moss, Carlos Dunlap era'],
      recruiting: ['Top-5 national classes 2006–2008', 'Florida speed at WR/RB/DB as roster identity', 'In-state dominance: Miami, Tampa, Jacksonville pipelines'],
      culture: ['"Row the Boat" mentality under Meyer', 'Championship-or-bust expectations restored', 'The Swamp night games as national events'],
      winners: ['Tim Tebow — 2007 Heisman, two-time champion', 'Percy Harvin — mismatch weapon', 'Brandon Spikes — defensive leader'],
      players: [{ name: 'Tim Tebow', role: 'QB · 2007 Heisman' }, { name: 'Percy Harvin', role: 'WR · All-American' }, { name: 'Brandon Spikes', role: 'LB · Two-time All-American' }, { name: 'Joe Haden', role: 'CB · First-round NFL talent' }],
      games: ['2006 vs Ohio State — BCS National Championship', '2008 vs Oklahoma — Tebow\'s second ring', '2008 vs Alabama — SEC Championship classic', '2009 vs FSU — Meyer\'s Swamp finale'],
      highlights: ['2006 & 2008 National Championships', 'Spread-option evolution with Tebow', 'SEC Championship Game dominance', 'Reloaded roster pipeline under Meyer'],
      achievements: ['2006 & 2008 National Championships', 'Heisman: Tim Tebow (2007)', '2006 & 2008 SEC Championships'] },
    { id: 'era-2010s', label: '2010–2019', title: 'SEC East Dominance & Transition', hero: '⚡', kicker: 'Program History', eraClass: 'era-2010s',
      summary: 'Will Muschamp, Jim McElwain, and Dan Mullen each left marks across a turbulent but talent-rich decade. Elite defenses, Kyle Pitts\' TE revolution, and SEC East titles kept Florida in national conversation despite coaching turnover.',
      coaching: ['2011–2014 · Will Muschamp — defensive identity first', '2015–2017 · Jim McElwain — SEC East titles', '2018–2019 · Dan Mullen — offensive resurgence with Trask/Emory'],
      milestones: ['2012 · Sugar Bowl appearance under Muschamp', '2015–2016 · Back-to-back SEC East titles (McElwain)', '2019 · Kyle Pitts breakout — TE1 legacy begins', '2019 · 11-win season under Mullen'],
      schemes: ['Muschamp 3-4 / aggressive defensive fronts', 'Mullen spread-RPO with Feleipe Franks → Kyle Trask arc', 'TE11 and 12 personnel revolution with Kyle Pitts'],
      recruiting: ['Defensive line and CB pipeline peaks (2010–2013)', 'Mullen-era offensive skill reload (2018–2019)', 'Transfer portal seeds before portal era label'],
      culture: ['Defensive toughness under Muschamp', 'SEC East crown expectations under McElwain', 'Offensive excitement restored under Mullen'],
      winners: ['Kyle Pitts — generational TE', 'Vernon Hargreaves III — lockdown CB', 'Marco Wilson — All-SEC corner'],
      players: [{ name: 'Kyle Pitts', role: 'TE · TE1, top-5 draft pick' }, { name: 'Vernon Hargreaves III', role: 'CB · First-round talent' }, { name: 'Kyle Trask', role: 'QB · 2020 Heisman finalist (built in 2019)' }, { name: 'Marco Wilson', role: 'CB · All-SEC' }],
      games: ['2012 vs LSU — Driskel-led peak', '2015 vs Alabama — SEC Championship', '2019 vs Auburn — Trask emergence (4 TD)', '2019 vs Virginia — Orange Bowl'],
      highlights: ['Multiple SEC East titles', 'Elite defensive recruiting classes', 'Kyle Pitts TE1 revolution', '11-win 2019 season under Mullen'],
      achievements: ['2015 & 2016 SEC East Championships', 'Kyle Pitts unanimous All-American (2020)', 'Top-10 finishes under Mullen'] },
    { id: 'era-2020s', label: '2020–Present', title: 'Portal Era & Sumrall Reset', hero: '🎯', kicker: 'Program History', eraClass: 'era-2020s',
      summary: 'Dan Mullen\'s peak gave way to Billy Napier\'s rebuild and Jon Sumrall\'s 2026 culture-first reset. The portal, NIL, and the 3-3-5 defensive identity under Brad White define modern Florida — a roster rebuilt for SEC contention with conflict players on offense and hybrid defenders on defense.',
      coaching: ['2020–2021 · Dan Mullen — Trask Heisman finalist era', '2022–2025 · Billy Napier — rebuild and development', '2026–present · Jon Sumrall — culture-first reset with Tulane staff'],
      milestones: ['2020 · Kyle Trask Heisman finalist, 9-win COVID season', '2023 · Anthony Richardson top-5 NFL draft pick', '2026 · Sumrall hire + portal-powered roster reset', '2026 · Brad White 3-3-5 defensive install'],
      schemes: ['Napier pro-spread RPO foundation', 'Sumrall/Faulkner conflict-read offense with vertical shots', 'Brad White 3-3-5 odd front — JACK/STAR hybrid roles'],
      recruiting: ['Portal as primary roster construction tool (2024–2026)', 'SEC battleground: Georgia, FSU, Miami competition', '2026 portal class: Singleton, Woods, Philo headline additions'],
      culture: ['Culture-first accountability under Sumrall', 'Portal-era roster management as new normal', 'Return to defensive physicality in 3-3-5'],
      winners: ['Jayden Woods — JACK centerpiece', 'Eric Singleton Jr. — WR1 vertical threat', 'Anthony Richardson — dual-threat QB prototype'],
      players: [{ name: 'Jayden Woods', role: 'JACK · 3-3-5 edge star' }, { name: 'Eric Singleton Jr.', role: 'WR · Auburn transfer WR1' }, { name: 'Aaron Philo', role: 'QB · Pro-style fit' }, { name: 'Anthony Richardson', role: 'QB · 2023 top-5 pick' }],
      games: ['2020 vs Alabama — SEC Championship (Trask era peak)', '2026 vs FAU — Sumrall debut', '2026 Orange & Blue Spring Game — roster reveal', '2026 vs Georgia — Cocktail Party'],
      highlights: ['2026 portal-powered roster reset', 'Brad White 3-3-5 install', 'Sumrall culture-first standard', 'Spring Game 2026 roster preview'],
      achievements: ['Top portal classes 2024–2026', '3-3-5 defensive identity established', 'Sumrall staff continuity from Tulane'] }
  ];

  var ACHIEVEMENTS = [
    { id: 'ach-nc', icon: '🏆', stat: '3', label: 'National Championships', kicker: 'Program Achievements',
      years: ['1966 · Steve Spurrier Heisman (player era)', '1996 · Danny Wuerffel & Steve Spurrier (HC)', '2006 · Urban Meyer & Chris Leak', '2008 · Urban Meyer & Tim Tebow'],
      note: 'Three consensus national championships — 1996, 2006, and 2008 — plus the program\'s first Heisman as a player (Spurrier, 1966). The standard Gator Nation expects every decade.',
      highlights: ['1996: First national title — Fun & Gun peak', '2006–08: Back-to-back title window under Meyer', 'CFP-era contention remains the 2020s goal under Sumrall'],
      winners: ['Steve Spurrier (HC & player)', 'Urban Meyer', 'Tim Tebow'] },
    { id: 'ach-sec', icon: '🥇', stat: '8', label: 'SEC Championships', kicker: 'Program Achievements',
      years: ['1991', '1993', '1994', '1995', '1996', '2000', '2006', '2008'],
      note: 'Eight SEC championships — four under Spurrier, two under Meyer, and sustained SEC East crowns across every coaching era since 1991.',
      highlights: ['1990s: Spurrier SEC dynasty — four titles in six years', '2000s: Meyer reload titles in 2006 and 2008', '2015–16: McElwain SEC East crowns', 'SEC Championship Game regular since 1992'],
      winners: ['Spurrier era — 4 SEC titles', 'Meyer era — 2 SEC titles', 'McElwain — 2 SEC East titles'] },
    { id: 'ach-heisman', icon: '⭐', stat: '3', label: 'Heisman Winners', kicker: 'Program Achievements',
      years: ['1966 · Steve Spurrier (QB)', '1996 · Danny Wuerffel (QB)', '2007 · Tim Tebow (QB)'],
      note: 'Three Heisman Trophy winners — all quarterbacks who defined their eras. Tim Tebow also won the 2008 national championship; Wuerffel won in 1996.',
      highlights: ['Spurrier — first UF Heisman as player-coach lineage (1966)', 'Wuerffel — title + Heisman same season (1996)', 'Tebow — first sophomore Heisman winner (2007)', 'Trask — Heisman finalist (2020)'],
      winners: ['Steve Spurrier', 'Danny Wuerffel', 'Tim Tebow'] },
    { id: 'ach-aam', icon: '🛡️', stat: '100+', label: 'All-Americans', kicker: 'Program Achievements',
      years: ['100+ consensus and first-team selections program-wide', 'Notable: Marshall, Emmitt, Wuerffel, Tebow, Pitts, Haden, Spikes'],
      note: 'Elite talent pipeline across every era — from Wilber Marshall to Kyle Pitts to Jayden Woods. Florida produces All-Americans on both sides of the ball.',
      highlights: ['Defensive All-Americans in every era', 'WR/TE/QB production in spread eras', 'NFL-caliber depth at CB, EDGE, and TE', '2026 track: Woods, Singleton on watch lists'],
      winners: ['Wilber Marshall', 'Kyle Pitts', 'Tim Tebow', 'Jayden Woods (2026 track)'] },
    { id: 'ach-nfl', icon: '🏈', stat: '500+', label: 'NFL Draft Picks', kicker: 'Program Achievements',
      years: ['500+ all-time NFL draft selections', '2020s: Pitts (#4), Henderson, Richardson (#4), Hines Ward lineage'],
      note: 'Consistent NFL production — Florida develops Sunday players at every position group, especially CB, EDGE, TE, and QB.',
      highlights: ['First-round pipeline at EDGE and CB', 'TE1 development track record (Pitts, Aaron Hernandez era)', 'QB factory: Spurrier, Wuerffel, Tebow, Richardson', 'Most first-round picks of any SEC program historically'],
      winners: ['Kyle Pitts — TE1 (#4 overall)', 'Anthony Richardson — dual-threat QB (#4 overall)', 'Joe Haden — CB cornerstone'] },
    { id: 'ach-bowl', icon: '🎖️', stat: '50+', label: 'Major Bowl Wins', kicker: 'Program Achievements',
      years: ['Sugar Bowl', 'Orange Bowl', 'BCS/CFP appearances', '50+ all-time bowl victories'],
      note: 'Postseason success across decades — Florida shows up on the biggest stages with Sugar Bowl, Orange Bowl, and BCS/CFP appearances.',
      highlights: ['BCS National Championship Game wins (2006, 2008)', 'New Year\'s Six / major bowl regular', 'Bowl streaks in every winning era', '1996 Orange Bowl — first national title clincher'],
      winners: ['Sugar Bowl champions', 'Orange Bowl champions', 'BCS title game winners'] },
    { id: 'ach-streak', icon: '🔥', stat: '20', label: 'Win Streak Record', kicker: 'Program Achievements',
      years: ['2008–2009 · 20-game win streak (Meyer/Tebow)', '1995–1996 · 17-game win streak (Spurrier/Wuerffel)'],
      note: 'Historic win streaks under Meyer (20) and Spurrier (17) rank among the longest in SEC history — proof of sustained dominance, not one-year spikes.',
      highlights: ['2008–09: 20 straight — back-to-back title window', '1995–96: 17 straight — first national title run', 'The Swamp as streak amplifier'],
      winners: ['Urban Meyer 2008–09', 'Steve Spurrier 1995–96'] },
    { id: 'ach-rivalry', icon: '🤝', stat: '2', label: 'Rivalry Dynasties', kicker: 'Program Achievements',
      years: ['Florida vs FSU — annual state championship since 1958', 'Florida vs Georgia — Cocktail Party since 1915'],
      note: 'Two defining rivalries shape every Gator season. The FSU series and the Georgia Cocktail Party in Jacksonville are program-defining benchmarks.',
      highlights: ['FSU: 1990s dominance — 7 straight (1986–93 window)', 'Georgia: 1990s Cocktail Party run under Spurrier', '2008: Both rivals beaten en route to title', 'The Swamp vs Doak Campbell — state bragging rights'],
      winners: ['1996 FSU win — title path', '2008 Georgia + FSU — championship season', 'Cocktail Party all-time series'] },
    { id: 'ach-records', icon: '📊', stat: 'Elite', label: 'Statistical Records', kicker: 'Program Achievements',
      years: ['Emmitt Smith — NCAA rushing records (1989)', 'Wuerffel — SEC passing TD records (1990s)', 'Tebow — NCAA TD responsibility records (2007–08)'],
      note: 'Program statistical records span rushing (Emmitt), passing (Wuerffel, Trask), and total offense (Tebow) — proof of scheme diversity across eras.',
      highlights: ['Emmitt Smith — 3,928 career rush yards at UF', 'Danny Wuerffel — 10,875 career pass yards', 'Tim Tebow — 57 total TDs in 2007 (record pace)', 'Kyle Pitts — TE receiving records (2020)'],
      winners: ['Emmitt Smith', 'Danny Wuerffel', 'Tim Tebow', 'Kyle Pitts'] }
  ];

  var TEAM_IDENTITY = {
    id: 'identity', title: 'Team Identity', kicker: 'Culture & Traditions', eraClass: 'era-2020s',
    summary: 'Orange and blue. The Swamp. Gator Nation.',
    body: 'Florida football is built on speed, physicality, and recruiting dominance in the Southeast. The program\'s brand centers on The Swamp\'s home-field advantage — one of the loudest venues in college football — the Gator Chomp tradition, and a standard of competing for SEC and national titles every season.\n\nAcross eras, identity has evolved: Spurrier\'s Fun & Gun arrogance, Meyer\'s spread-option championship grit, and now Jon Sumrall\'s culture-first reset with a 3-3-5 defensive backbone and conflict-player offense built for RPO rhythm and vertical shots.\n\nThe 2026 identity: portal-powered roster construction, hybrid defenders in Brad White\'s 3-3-5, and skill talent that wins one-on-one matchups on the perimeter.',
    highlights: ['The Swamp — decibel-level home-field advantage since 1990', 'Orange & Blue — iconic SEC brand recognized nationally', 'Gator Chomp — universal rally cry across Gator Nation', '3-3-5 defensive identity under Brad White (2026)', 'Conflict players on offense — RPO rhythm and vertical shots', 'Portal-era roster building under Sumrall'],
    pillars: ['Speed and physicality in the SEC trenches', 'Recruiting dominance in Florida, Georgia, and the Southeast', 'Culture-first leadership under Jon Sumrall', 'Hybrid defense — JACK/STAR roles in the 3-3-5', 'Championship standard — three national titles, eight SEC crowns']
  };

  var COACHING_STAFF = [];
  var ANALYST_STAFF = [];
  var SUPPORT_STAFF = {
    id: 'support', title: 'Support Staff', kicker: 'Coaching Staff',
    summary: 'Operations, video, equipment, and administrative staff supporting the 2026 program.',
    units: []
  };
  var _staffLoaded = false;

  function applyStaffData(data) {
    if (!data) return;
    COACHING_STAFF = (data.coaches || []).map(function (c) {
      return Object.assign({ headerImage: null, noBio: false }, c);
    });
    ANALYST_STAFF = (data.analysts || []).map(function (a) {
      return Object.assign({ headerImage: null, noBio: true }, a);
    });
    SUPPORT_STAFF.units = (data.supportStaff || []).map(function (u) {
      return u.role + (u.name ? ' — ' + u.name : '');
    });
    SUPPORT_STAFF.supportRows = data.supportStaff || [];
    _staffLoaded = true;
    TEAM_PREFIXES.forEach(function (pfx) {
      var staffEl = document.getElementById('gv-' + pfx + '-staff');
      if (staffEl) renderStaffBlock(staffEl, pfx);
    });
  }

  function loadStaffData() {
    if (_staffLoaded) return Promise.resolve();
    var apiBase = typeof global.gvLiveApiBase === 'function' ? global.gvLiveApiBase() : '';
    var url = apiBase ? (apiBase + '/api/team/coaching-staff') : '/data/coaching-staff.json';
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (j) { applyStaffData(j); })
      .catch(function () {
        return fetch('/data/coaching-staff.json')
          .then(function (r) { return r.json(); })
          .then(function (j) { applyStaffData(j); })
          .catch(function () {});
      });
  }

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
      heroEl.className = 'gv-team-modal-hero' + (cfg.eraClass ? ' ' + cfg.eraClass : '');
      if (cfg.headerImage) {
        heroEl.style.backgroundImage = 'url(' + cfg.headerImage + ')';
        heroEl.style.backgroundSize = 'cover';
        heroEl.style.backgroundPosition = 'center 35%';
      } else {
        heroEl.style.backgroundImage = '';
        if (!cfg.eraClass) heroEl.classList.add('era-2020s');
      }
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
    if (typeof global.gvPushModalHistory === 'function') {
      global.gvPushModalHistory('team-detail', { type: cfg.type || '', id: cfg.id || '' });
    }
  }

  function closeTeamDetail(fromPopState) {
    var ov = document.getElementById('gv-team-detail-modal');
    var panel = document.getElementById('gv-team-modal-panel');
    if (!ov) return;
    if (panel) panel.style.transform = '';
    ov.classList.add('hidden');
    ov.style.display = '';
    ov.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gv-team-modal-open');
    if (typeof global.gvModalIsOpen === 'function' && !global.gvModalIsOpen()) {
      document.body.style.overflow = '';
    } else if (typeof global.gvModalIsOpen !== 'function') {
      document.body.style.overflow = '';
    }
    _currentModal = null;
    if (typeof global.gvPopModalHistory === 'function') {
      global.gvPopModalHistory('team-detail', !!fromPopState);
    }
  }

  function openEraDetail(eraId) {
    var era = ERAS.find(function (e) { return e.id === eraId; });
    if (!era) return;
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(era.summary) + '</p></div>'
    ];
    if (era.coaching && era.coaching.length) {
      sections.push('<div class="gv-tm-section">' + sectionHdr('staff', 'Coaching Transitions') + renderTimeline(era.coaching) + '</div>');
    }
    if (era.milestones && era.milestones.length) {
      sections.push('<div class="gv-tm-section">' + sectionHdr('timeline', 'Program Milestones') + renderTimeline(era.milestones) + '</div>');
    }
    if (era.schemes && era.schemes.length) {
      sections.push('<div class="gv-tm-section">' + sectionHdr('games', 'Scheme Evolution') + renderHighlights(era.schemes) + '</div>');
    }
    if (era.recruiting && era.recruiting.length) {
      sections.push('<div class="gv-tm-section">' + sectionHdr('roster', 'Recruiting Eras') + renderHighlights(era.recruiting) + '</div>');
    }
    if (era.culture && era.culture.length) {
      sections.push('<div class="gv-tm-section">' + sectionHdr('culture', 'Cultural Identity') + renderHighlights(era.culture) + '</div>');
    }
    sections.push(
      '<div class="gv-tm-section">' + sectionHdr('winners', 'Winners & Legends') + renderPhotoGridPlayers(era.players) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('highlights', 'Key Seasons & Highlights') + renderHighlights(era.highlights) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('games', 'Key Games') + renderTimeline(era.games) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('achievements', 'Achievements') + renderChips(era.achievements) + '</div>',
      '<div class="gv-tm-section">' + sectionHdr('sources', 'Verified Sources') + '<p class="gv-tm-body">Era summaries sourced from GatorVault program history database — SEC archives, UF athletics records, and verified media reporting.</p></div>'
    );
    openRichModal({
      type: 'era', id: era.id, kicker: era.kicker || 'Program History', title: era.title,
      eraClass: 'gv-team-era-media ' + (era.eraClass || 'era-90s'),
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
      type: 'achievement', id: ach.id, kicker: ach.kicker || 'Program Achievements', title: ach.label,
      eraClass: 'gv-team-era-media era-90s',
      bodyHtml: buildModalHtml(sections, [
        { type: 'achievement', id: 'ach-heisman', icon: '⭐', label: 'Heisman Winners', sub: 'Program greats' },
        { type: 'era', id: 'era-2000s', icon: '🐊', label: 'Urban Meyer Dynasty', sub: '2000s era' },
        { type: 'identity', id: 'identity', icon: '🐊', label: 'Team Identity', sub: 'Gator Nation' }
      ])
    });
  }

  function openCoachDetail(coachId) {
    var c = COACHING_STAFF.concat(ANALYST_STAFF).find(function (x) { return x.id === coachId; });
    if (!c) return;
    if (c.noBio) return;
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
      eraClass: 'gv-team-era-media ' + (t.eraClass || 'era-2020s'),
      bodyHtml: buildModalHtml(sections, [
        { type: 'era', id: 'era-2020s', icon: '🎯', label: 'Sumrall Era', sub: '2020s chapter' },
        { type: 'coach', id: 'sumrall', icon: '👔', label: 'Jon Sumrall', sub: 'Head Coach' },
        { type: 'achievement', id: 'ach-nc', icon: '🏆', label: 'National Championships', sub: '3 titles' }
      ])
    });
  }

  function openSupportStaffDetail() {
    var s = SUPPORT_STAFF;
    var rows = (s.supportRows || []).map(function (u) {
      return u.role + (u.name ? ' — ' + u.name : '');
    });
    var sections = [
      '<div class="gv-tm-section"><p class="gv-tm-lead">' + esc(s.summary) + '</p></div>',
      '<div class="gv-tm-section">' + sectionHdr('staff', 'Support Staff') + renderTimeline(rows.length ? rows : s.units) + '</div>'
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
    if (coachBtn && !coachBtn.getAttribute('data-no-bio')) { openCoachDetail(coachBtn.getAttribute('data-coach-id')); return true; }

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
    var eraCls = era.eraClass || 'era-default';
    return '<button type="button" class="gv-team-era-card" data-era-id="' + esc(era.id) + '" style="animation-delay:' + (idx * 0.04) + 's">'
      + '<div class="gv-team-era-media ' + esc(eraCls) + '">'
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
    var eraCls = t.eraClass || 'era-2020s';
    return '<button type="button" class="gv-team-identity-card" id="gv-' + prefix + '-identity-btn" data-identity="1">'
      + '<div class="gv-team-identity-banner ' + esc(eraCls) + '">'
      + '<h3 class="gv-team-identity-banner-title">' + esc(t.title) + '</h3></div>'
      + '<div class="gv-team-identity-pillars">'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🏟️</span><span class="gv-team-identity-pillar-label">The Swamp</span></div>'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🐊</span><span class="gv-team-identity-pillar-label">Culture</span></div>'
      + '<div class="gv-team-identity-pillar"><span class="gv-team-identity-pillar-icon">🧡</span><span class="gv-team-identity-pillar-label">Traditions</span></div>'
      + '</div></button>';
  }

  function renderCoachCard(c) {
    var initials = (c.name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2);
    var noBio = !!c.noBio;
    return '<button type="button" class="gv-coach-card' + (noBio ? ' gv-coach-card--name-only' : '') + '" data-coach-id="' + esc(c.id) + '"' + (noBio ? ' data-no-bio="1"' : '') + '>'
      + '<span class="gv-coach-headshot">' + esc(initials) + '</span>'
      + '<span class="gv-coach-info"><span class="gv-coach-name">' + esc(c.name) + '</span>'
      + '<span class="gv-coach-title">' + esc(c.title) + '</span></span>'
      + (noBio ? '' : '<span class="gv-coach-chevron">›</span>') + '</button>';
  }

  function renderSupportStaffRows(rows) {
    return (rows || []).map(function (u) {
      return '<div class="gv-support-staff-row"><span class="gv-support-staff-role">' + esc(u.role) + '</span>'
        + '<span class="gv-support-staff-name">' + esc(u.name || '—') + '</span></div>';
    }).join('');
  }

  function renderStaffBlock(staffEl, prefix) {
    if (!staffEl) return;
    var coaches = COACHING_STAFF.length ? COACHING_STAFF : [];
    var analysts = ANALYST_STAFF.length ? ANALYST_STAFF : [];
    var supportRows = SUPPORT_STAFF.supportRows || [];
    staffEl.innerHTML = coaches.map(renderCoachCard).join('')
      + (analysts.length ? '<div class="gv-team-analyst-block">' + analysts.map(renderCoachCard).join('') + '</div>' : '')
      + (supportRows.length
        ? '<div class="gv-team-support-block"><h4 class="gv-team-support-hdr">Support Staff</h4>' + renderSupportStaffRows(supportRows) + '</div>'
        : '')
      + '<button type="button" class="gv-team-support-link" id="gv-' + prefix + '-support-btn">Full Support Staff →</button>';
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
    if (staffEl) renderStaffBlock(staffEl, prefix);
    if (filtersEl) wireRosterFilters(filtersEl);
    if (rosterEl) renderRosterList(rosterEl, global._gvTeamRosterFilter || 'All');
  }

  function renderTeam() {
    wireTeamInteractions();
    wireTeamDetailModal();
    TEAM_PREFIXES.forEach(renderTeamPane);
    loadStaffData();
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
