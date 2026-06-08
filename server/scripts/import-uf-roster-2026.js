/**
 * Import UF 2026 Spring Football roster into server/data/roster/players.json
 * Source: server/data/roster/uf-spring-2026-source.md (from floridagators.com)
 *
 * Usage: node server/scripts/import-uf-roster-2026.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'roster', 'uf-spring-2026-source.md');
const OUT = path.join(ROOT, 'data', 'roster', 'players.json');

const OVERRIDES = {
  'jayden-woods': 90, 'cormani-mcclain': 89, 'jadan-baugh': 88, 'eric-singleton-jr': 87,
  'vernell-brown-iii': 86, 'dallas-wilson': 86, 'tramell-jones-jr': 85, 'dijon-johnson': 86,
  'myles-graham': 86, 'lacota-dippre': 84, 'aaron-philo': 84, 'jaden-robinson': 85,
  'bryce-thornton': 85, 'kanye-clark': 83, 'cam-dooley': 82, 'evan-pryor': 81,
  'tj-shanahan-jr': 80, 'eagan-boyer': 79, 'harrison-moore': 79, 'brendan-bett': 82,
  'lj-mccray': 80, 'jeramiah-mccloud': 78, 'patrick-durkin': 74
};

const ENRICHED = require('./roster-enriched-overrides.json');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function posUnit(pos) {
  if (['QB', 'RB', 'WR', 'TE', 'OL'].includes(pos)) return 'offense';
  if (['P', 'K', 'LS'].includes(pos)) return 'special';
  return 'defense';
}

function heightNorm(h) {
  const m = String(h).match(/(\d+)'\s*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : h;
}

function depthTier(rating) {
  if (rating >= 84) return 'starter';
  if (rating >= 76) return 'rotation';
  return 'developmental';
}

function estimateRating(pos, cls, transfer, name) {
  const slug = slugify(name);
  if (OVERRIDES[slug] != null) return OVERRIDES[slug];
  let base = 68;
  if (/^R-Sr|^Gr/.test(cls)) base += 6;
  else if (/^Sr/.test(cls)) base += 8;
  else if (/^Jr/.test(cls)) base += 6;
  else if (/^So/.test(cls)) base += 4;
  else if (/^Fr/.test(cls)) base += 2;
  if (transfer) base += 3;
  if (['QB', 'JACK', 'ILB', 'WR', 'CB', 'STAR'].includes(pos)) base += 2;
  return Math.min(88, Math.max(62, base));
}

function estimateStars(rating, transfer, slug) {
  const e = ENRICHED[slug];
  if (e && e.stars) return e.stars;
  if (rating >= 88) return 4;
  if (rating >= 82) return transfer ? 4 : 3;
  if (rating >= 76) return 3;
  return null;
}

function roleSummary(pos, cls, transferInfo, slug) {
  const e = ENRICHED[slug];
  if (e && e.stats) return e.stats;
  const posLabel = { JACK: 'hybrid edge', STAR: 'STAR/nickel', ILB: 'linebacker' }[pos] || pos.toLowerCase();
  if (transferInfo) return `${transferInfo} — ${posLabel} on the 2026 spring roster.`;
  return `${posLabel} · ${cls} on the 2026 spring roster.`;
}

function bioText(name, pos, cls, hometown, transferInfo, slug) {
  const e = ENRICHED[slug];
  if (e && e.bio) return e.bio;
  const ht = hometown ? ` from ${hometown}` : '';
  const tr = transferInfo ? ` ${transferInfo}.` : '';
  return `${name} is a ${cls} ${pos}${ht}.${tr} Spring roster profile for the 2026 Gators.`;
}

const DETAIL_RE = /^([A-Z-]+)\s+(R-Fr\.|R-So\.|R-Jr\.|R-Sr\.|Fr\.|So\.|Jr\.|Sr\.|Gr\.)\s+(\d+'\s+\d+'')\s+(\d+)\s*lbs/;

function parseSource(md) {
  const lines = md.split(/\r?\n/);
  const players = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'Coaching Staff') break;
    const nameMatch = line.match(/^### (.+)$/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const detail = (lines[i + 2] || '').trim();
    const locLine = (lines[i + 4] || '').trim();
    const m = detail.match(DETAIL_RE);
    if (!m) continue;

    const pos = m[1];
    const cls = m[2];
    const height = heightNorm(m[3]);
    const weight = m[4];
    let hometown = locLine;
    let transferInfo = null;
    if (locLine.includes(' Previous School: ')) {
      const parts = locLine.split(' Previous School: ');
      hometown = parts[0].trim();
      transferInfo = `Transfer from ${parts[1].trim()}`;
    }

    const slug = slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);

    const rating = estimateRating(pos, cls, !!transferInfo, name);
    const player = {
      slug,
      name,
      pos,
      year: cls,
      class: cls,
      height,
      weight,
      hometown,
      jersey: null,
      unit: posUnit(pos),
      transferInfo,
      stars: estimateStars(rating, !!transferInfo, slug),
      rank: null,
      rating,
      ratingOverride: null,
      headshotUrl: null,
      bio: bioText(name, pos, cls, hometown, transferInfo, slug),
      stats: roleSummary(pos, cls, transferInfo, slug),
      injury: 'green',
      depthChartTier: depthTier(rating)
    };

    const e = ENRICHED[slug];
    if (e) {
      ['strengths', 'weaknesses', 'projection', 'schemeFit'].forEach((k) => {
        if (e[k]) player[k] = e[k];
      });
    }
    players.push(player);
  }

  return players.sort((a, b) => (b.rating - a.rating) || a.name.localeCompare(b.name));
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing source:', SRC);
    process.exit(1);
  }
  const md = fs.readFileSync(SRC, 'utf8');
  const players = parseSource(md);
  fs.writeFileSync(OUT, JSON.stringify(players, null, 2) + '\n');
  console.log(`Wrote ${players.length} players to ${OUT}`);
}

main();
