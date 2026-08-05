/**
 * Sync jersey numbers + newcomers from the official 2026 Florida roster
 * (On3 / floridagators.com fall camp release).
 *
 * Usage: node server/scripts/sync-uf-roster-2026-official.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'roster', 'players.json');

/** Official 2026 roster rows: jersey, name, position */
const OFFICIAL = `
No. 0 Jayden Woods, JACK
No. 1 Vernell Brown III, WR
No. 1 Bryce Thornton, S
No. 2 Lagonza Hayward, S
No. 2 Eric Singleton Jr., WR
No. 3 Onis Konanbanny, CB
No. 3 Bailey Stockton, WR
No. 4 TJ Abrams, WR
No. 5 Myles Graham, ILB
No. 5 Micah Mays, WR
No. 6 J'Vari Flowers, CB
No. 6 Dallas Wilson, WR
No. 7 Amir Jackson, TE
No. 7 Ty Jackson, ILB
No. 8 Aaron Chiles, ILB
No. 9 Tramell Jones Jr., QB
No. 9 Drake Stubbs, S
No. 10 Cam Dooley, DB
No. 10 Aaron Williams, QB
No. 11 Will Griffin, QB
No. 11 LJ McCray, DL
No. 12 Ben Hanks III, CB
No. 12 Aaron Philo, QB
No. 13 Jadan Baugh, RB
No. 13 Jordy Lowery, CB
No. 14 Kevin Ford, JACK
No. 14 Jaden Edgecombe, WR
No. 15 CJ Bronaugh, CB
No. 15 Luke Harpring, TE
No. 16 TJ Bullard, ILB
No. 16 Aidan Warner, QB
No. 17 Titus Bullard, JACK
No. 17 Lacota Dippre, TE
No. 18 Davian Groce, WR
No. 19 Jaylen Lloyd, WR
No. 20 Duke Clark, RB
No. 20 Kanye Clark, STAR
No. 21 CJ Hester, CB
No. 21 Evan Pryor, RB
No. 22 Kofi Asare, JACK
No. 22 Kahleil Jackson, WR
No. 23 Javier Jones, CB
No. 24 Kamran James, DL
No. 24 London Montgomery, RB
No. 25 Cormani McClain, CB
No. 25 Anthony Rubio, RB
No. 27 Dijon Johnson, CB
No. 27 Byron Louis, RB
No. 28 Elijah Owens, STAR
No. 29 Jaden Robinson, ILB
No. 30 Dylan Purter, STAR
No. 32 Eric Parks, S
No. 33 DJ Coleman, S
No. 33 Brian Case, RB
No. 34 Kaiden Hall, S
No. 34 Kelvin Jimenez, S
No. 35 Brayden Slade, S
No. 36 Vincent Brown Jr., CB
No. 37 Javion Toombs, CB
No. 38 Alec Clark, P
No. 39 Carter Milliron, LS
No. 40 Jayden Gross, DL
No. 40 Brandon Rabasco, K
No. 41 Liam Padron, K
No. 42 Matthew Kade, ILB
No. 43 Alfonzo Allen Jr., S
No. 44 Myles Johnson, ILB
No. 47 Miller Fealy, P
No. 48 Nicholas Inglis, P
No. 48 Erich Seager, JACK
No. 49 Jalen Wiggins, DL
No. 50 Malik Morris, ILB
No. 50 Jason Zandamela, OL
No. 51 Tyler Chukuyem, OL
No. 52 Harrison Moore, OL
No. 52 Dylan Leighton, ILB
No. 53 Bryce Lovett, OL
No. 54 Lincoln Anderson, LS
No. 54 Javarii Luckas, OL
No. 55 Tavaris Dice Jr., OL
No. 55 Charles Emanuel III, JACK
No. 56 Jahari Medlock, OL
No. 56 Stive-Bentley Keumajou, DL
No. 58 Hunter Solwold, LS
No. 59 Corey Brown, OL
No. 61 G'Nivre Carr, OL
No. 63 Caden Jones, OL
No. 64 Eagan Boyer, OL
No. 66 Emeka Ugorji, OL
No. 67 T.J. Shanahan, OL
No. 68 Fletcher Westphal, OL
No. 71 Roderick Kearney, OL
No. 73 Daniel Pierre Louis, OL
No. 77 Knijeah Harris, OL
No. 78 Desmond Green, OL
No. 79 Chancellor Campbell, OL
No. 80 Jaylen Jordan, TE
No. 81 Jordan Mason, WR
No. 82 Ace Ciongoli, WR
No. 83 Justin Williams, WR
No. 84 Micah Jones, TE
No. 85 Evan Chieca, TE
No. 86 Heze Kent, TE
No. 88 Marquez Daniel, WR
No. 89 Tripp Brown Jr., TE
No. 90 Brendan Bett, DL
No. 91 Patrick Durkin, K
No. 91 Jeramiah McCloud, DL
No. 92 Sebastian Scott, DL
No. 93 DK Kalu, DL
No. 94 Kendall Guervil, DL
No. 95 Jamari Lyons, DL
No. 96 JaReylan McCoy, DL
No. 97 Joseph Mbatchou, DL
No. 98 Mason Clinton, DL
No. 99 Emmanuel Oyebadejo, DL
`.trim();

/** Map official report names → existing roster slugs when they differ. */
const SLUG_ALIASES = {
  'kevin-ford': 'kj-ford',
  'micah-mays': 'micah-mays-jr',
  'tavaris-dice-jr': 'tj-dice-jr',
  'tj-shanahan': 'tj-shanahan-jr',
  't-j-shanahan': 'tj-shanahan-jr',
  'cam-dooley': 'cameron-dooley',
  'jvari-flowers': 'jvari-flowers',
  "j'vari-flowers": 'jvari-flowers',
};

const NEWCOMER_META = {
  'javier-jones': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: '',
    unit: 'defense',
    bio: 'JUCO cornerback addition to the 2026 Florida roster.',
    depthChartTier: 'depth',
  },
  'jaylen-jordan': {
    year: 'Jr.',
    class: 'Jr.',
    hometown: '',
    unit: 'offense',
    bio: 'Tight end transfer added to the 2026 Florida roster.',
    depthChartTier: 'depth',
    transferInfo: 'Transfer',
  },
  'eric-parks': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: '',
    unit: 'defense',
    bio: 'Walk-on safety on the 2026 Florida roster.',
    depthChartTier: 'depth',
  },
  'jayden-gross': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: '',
    unit: 'defense',
    bio: 'Walk-on defensive lineman on the 2026 Florida roster.',
    depthChartTier: 'depth',
  },
  'jordan-mason': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: '',
    unit: 'offense',
    bio: 'Walk-on receiver on the 2026 Florida roster.',
    depthChartTier: 'depth',
  },
  'lincoln-anderson': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: '',
    unit: 'special',
    bio: 'Walk-on long snapper on the 2026 Florida roster.',
    depthChartTier: 'depth',
  },
  'stive-bentley-keumajou': {
    year: 'Fr.',
    class: 'Fr.',
    hometown: 'Miami, Fla. Coral Gables',
    height: '6-3',
    weight: '295',
    unit: 'defense',
    bio: 'Defensive lineman who reclassified from 2027 and joined Florida for fall camp 2026.',
    depthChartTier: 'depth',
  },
};

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseOfficial() {
  const rows = [];
  for (const line of OFFICIAL.split('\n')) {
    const m = line.match(/^No\.\s*(\d+)\s+(.+?),\s*([A-Z/]+)\s*$/i);
    if (!m) {
      console.warn('skip line:', line);
      continue;
    }
    const jersey = Number(m[1]);
    const name = m[2].trim();
    const pos = m[3].trim().toUpperCase();
    const slug = slugify(name);
    rows.push({ jersey, name, pos, slug });
  }
  return rows;
}

function resolveSlug(officialSlug, playersBySlug) {
  if (playersBySlug.has(officialSlug)) return officialSlug;
  if (SLUG_ALIASES[officialSlug] && playersBySlug.has(SLUG_ALIASES[officialSlug])) {
    return SLUG_ALIASES[officialSlug];
  }
  // Soft match: official slug is prefix of existing (Micah Mays → micah-mays-jr)
  for (const slug of playersBySlug.keys()) {
    if (slug === officialSlug || slug.startsWith(officialSlug + '-')) return slug;
  }
  return null;
}

function unitForPos(pos) {
  const p = String(pos || '').toUpperCase();
  if (['QB', 'RB', 'WR', 'TE', 'OL'].includes(p)) return 'offense';
  if (['P', 'K', 'LS'].includes(p)) return 'special';
  return 'defense';
}

function main() {
  const official = parseOfficial();
  const players = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  if (!Array.isArray(players)) {
    console.error('players.json must be an array');
    process.exit(1);
  }

  const bySlug = new Map(players.map((p) => [p.slug || slugify(p.name), p]));
  let updated = 0;
  let added = 0;
  const unmatchedOfficial = [];
  const matchedSlugs = new Set();

  for (const row of official) {
    const existingSlug = resolveSlug(row.slug, bySlug);
    if (existingSlug) {
      const player = bySlug.get(existingSlug);
      matchedSlugs.add(existingSlug);
      let dirty = false;
      if (player.jersey !== row.jersey) {
        player.jersey = row.jersey;
        dirty = true;
      }
      if (row.pos && String(player.pos || '').toUpperCase() !== row.pos) {
        // Keep STAR/DB nuances when close; only overwrite when empty or clear mismatch for newcomers aliases
        if (!player.pos) {
          player.pos = row.pos;
          player.position = row.pos;
          dirty = true;
        } else if (existingSlug === 'kj-ford' && row.pos === 'JACK') {
          // ok
        } else if (row.pos === 'DB' && /^(CB|S|STAR)$/i.test(player.pos)) {
          // keep specialized DB label
        } else if (row.pos !== String(player.pos).toUpperCase() && !['ILB', 'JACK', 'STAR'].includes(String(player.pos).toUpperCase())) {
          // Prefer official when current is generic
        }
      }
      if (dirty) {
        player.updatedAt = new Date().toISOString();
        updated += 1;
      }
      continue;
    }

    const meta = NEWCOMER_META[row.slug] || {};
    const newbie = {
      slug: row.slug,
      name: row.name,
      pos: row.pos,
      position: row.pos,
      year: meta.year || 'Fr.',
      class: meta.class || 'Fr.',
      height: meta.height || '',
      weight: meta.weight || '',
      hometown: meta.hometown || '',
      jersey: row.jersey,
      unit: meta.unit || unitForPos(row.pos),
      transferInfo: meta.transferInfo || null,
      depthChartTier: meta.depthChartTier || 'depth',
      stars: null,
      rank: null,
      rating: null,
      ratingOverride: null,
      headshotUrl: null,
      bio: meta.bio || `Added to the official 2026 Florida football roster (#${row.jersey}).`,
      stats: '',
      injury: 'green',
      warRoomFeatured: false,
      strengths: null,
      weaknesses: null,
      projection: null,
      schemeFit: null,
      updatedAt: new Date().toISOString(),
    };
    players.push(newbie);
    bySlug.set(row.slug, newbie);
    matchedSlugs.add(row.slug);
    added += 1;
  }

  for (const row of official) {
    const hit = resolveSlug(row.slug, bySlug);
    if (!hit) unmatchedOfficial.push(row);
  }

  // Sort: jersey asc, then name
  players.sort((a, b) => {
    const ja = a.jersey == null ? 999 : Number(a.jersey);
    const jb = b.jersey == null ? 999 : Number(b.jersey);
    if (ja !== jb) return ja - jb;
    return String(a.name).localeCompare(String(b.name));
  });

  fs.writeFileSync(OUT, JSON.stringify(players, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        officialRows: official.length,
        rosterCount: players.length,
        jerseyUpdated: updated,
        added,
        unmatchedOfficial: unmatchedOfficial.map((r) => r.name),
      },
      null,
      2
    )
  );
}

main();
