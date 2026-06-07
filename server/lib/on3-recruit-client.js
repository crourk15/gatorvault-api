const fetch = require('node-fetch');
const { slugify } = require('./slug');

const SITE = process.env.ON3_SITE_BASE || 'https://www.on3.com';
const ORG = process.env.ON3_ORG_SLUG || 'florida-gators';
const SPORT = process.env.ON3_SPORT || 'football';

const COMMIT_STATUSES = new Set(['Committed', 'Enrolled', 'Signed']);
const UF_MATCH = /florida|\bgators\b|\buf\b/i;

function nameFromSlug(recruitSlug) {
  const base = String(recruitSlug || '').replace(/-\d+$/, '');
  if (!base) return recruitSlug;
  return base
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function pageUrl(path) {
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
}

function defaultHeaders(classYear) {
  return {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      process.env.ON3_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: pageUrl(`/college/${ORG}/${SPORT}/${classYear || 2027}/commits/`)
  };
}

async function fetchNextPageProps(url, classYear) {
  const res = await fetch(url, { headers: defaultHeaders(classYear), timeout: 45000 });
  const html = await res.text();
  if (!res.ok) throw new Error(`On3 HTTP ${res.status} for ${url}`);
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('On3 page missing __NEXT_DATA__');
  return JSON.parse(match[1])?.props?.pageProps || null;
}

function flattenVisits(pageProps) {
  const days = pageProps?.visitsList?.list?.list || pageProps?.visitsList?.list || [];
  const out = [];
  for (const day of days) {
    for (const v of day.list || []) {
      if (!v?.player?.slug) continue;
      out.push({
        player: v.player,
        official: v.official,
        visitDate: day.relatedModel?.date,
        visitStatus: day.relatedModel?.status
      });
    }
  }
  return out;
}

async function fetchTeamVisits(classYear) {
  const year = parseInt(classYear, 10);
  const url = pageUrl(`/college/${ORG}/${SPORT}/${year}/visits/`);
  const pp = await fetchNextPageProps(url, year);
  return flattenVisits(pp);
}

async function fetchRecruitProfile(recruitSlug) {
  if (!recruitSlug) return null;
  const url = pageUrl(`/rivals/${recruitSlug.replace(/^\//, '')}/`);
  let pp;
  try {
    pp = await fetchNextPageProps(url);
  } catch (e) {
    return { slug: recruitSlug, error: e.message };
  }
  if (!pp) return null;

  const recruitment =
    (pp.recruitments || []).find((r) => r.year === 2027 || r.year === 2026) ||
    (pp.recruitments || [])[0];

  return {
    slug: recruitSlug,
    name: pp.player?.fullName || nameFromSlug(recruitSlug) || recruitSlug,
    pos:
      pp.player?.positionAbbr ||
      recruitment?.positionAbbreviation ||
      pp.personSports?.[0]?.position?.abbr ||
      '',
    classYear: recruitment?.year || 2027,
    topTeams: pp.topTeams?.list || [],
    visits: pp.visits?.list || pp.visits || [],
    recruitments: pp.recruitments || [],
    rankingsPlayer: pp.rankingsPlayer || null,
    fetchedAt: new Date().toISOString()
  };
}

function isHighSchoolOrg(team) {
  const name = (team?.fullName || team?.name || '').toLowerCase();
  const slug = (team?.slug || '').toLowerCase();
  if (/high school| academy| prep school/.test(name)) return true;
  if (/falcons|raiders|tigers/.test(slug) && !/(ole-miss|clemson|auburn|memphis)/.test(slug)) {
    if (!/(gators|bulldogs|seminoles|sooners|rebels|volunteers|crimson|longhorns|buckeyes)/.test(slug)) {
      return name.split(' ').length <= 3 && !team?.abbreviation?.match(/^[A-Z]{2,5}$/);
    }
  }
  return false;
}

function getYearTopTeams(topTeams, classYear) {
  return (topTeams || []).filter((t) => !t.year || t.year === classYear);
}

function getCollegeCommit(topTeams, classYear) {
  return getYearTopTeams(topTeams, classYear).find((t) => {
    if (!COMMIT_STATUSES.has(t.status)) return false;
    if (t.committedDate) return true;
    const slug = (t.team?.slug || '').toLowerCase();
    return /-(gators|bulldogs|tigers|sooners|rebels|seminoles|volunteers|longhorns|buckeyes|crimson-tide|gamecocks|hurricanes|cowboys|razorbacks|wildcats|commodores|panthers|tar-heels|orange|fighting-irish|trojans|bruins|ducks|huskies|badgers|spartans|wolverines|hoosiers|boilermakers|yellow-jackets|hokies|blue-devils|bearcats|cougars|horned-frogs|cyclones|jayhawks|aggies|black-knights|cardinal|sun-devils|buffaloes|mean-green|roadrunners|miners|razorbacks)/.test(
      slug
    );
  });
}

function getFloridaTeam(topTeams, classYear) {
  return getYearTopTeams(topTeams, classYear).find((t) => UF_MATCH.test(t.team?.name || t.team?.fullName || ''));
}

function isFloridaTeam(team) {
  return UF_MATCH.test(team?.team?.name || team?.team?.fullName || '');
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

function resolveRecruitSlug(player, visitsByName) {
  if (player.on3RecruitSlug) return player.on3RecruitSlug;
  if (player.on3Id) return `${slugify(player.name)}-${player.on3Id}`;
  const key = String(player.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return visitsByName.get(key) || null;
}

module.exports = {
  SITE,
  ORG,
  SPORT,
  COMMIT_STATUSES,
  UF_MATCH,
  fetchTeamVisits,
  fetchRecruitProfile,
  flattenVisits,
  getCollegeCommit,
  getFloridaTeam,
  getYearTopTeams,
  isFloridaTeam,
  isHighSchoolOrg,
  mapPool,
  resolveRecruitSlug,
  slugify
};
