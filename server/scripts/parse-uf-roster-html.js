/**
 * Sync jersey numbers from UF Sidearm roster HTML into players.json.
 * Source: server/data/roster/uf-roster-2026.html (aria-label="Name jersey number N full bio")
 *
 * Usage: node server/scripts/parse-uf-roster-html.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'data', 'roster', 'uf-roster-2026.html');
const OUT = path.join(ROOT, 'data', 'roster', 'players.json');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function parseJerseysFromHtml(html) {
  const map = new Map();
  const ariaRe = /aria-label="([^"]+) jersey number (\d+) full bio"/g;
  let m;
  while ((m = ariaRe.exec(html))) {
    const name = decodeHtmlEntities(m[1]);
    map.set(slugify(name), { name, jersey: Number(m[2]) });
  }
  const linkRe = /href="\/sports\/football\/roster\/([^/]+)\/\d+"[^>]*aria-label="([^"]+) jersey number (\d+) full bio"/g;
  while ((m = linkRe.exec(html))) {
    map.set(m[1], { name: decodeHtmlEntities(m[2]), jersey: Number(m[3]) });
  }
  return map;
}

function main() {
  if (!fs.existsSync(HTML)) {
    console.error('Missing HTML source:', HTML);
    process.exit(1);
  }
  if (!fs.existsSync(OUT)) {
    console.error('Missing roster:', OUT);
    process.exit(1);
  }

  const jerseys = parseJerseysFromHtml(fs.readFileSync(HTML, 'utf8'));
  const players = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  if (!Array.isArray(players)) {
    console.error('players.json must be an array');
    process.exit(1);
  }

  let updated = 0;
  let matched = 0;
  const unmatched = [];

  for (const player of players) {
    const slug = player.slug || slugify(player.name);
    const hit = jerseys.get(slug);
    if (!hit) {
      unmatched.push(slug);
      continue;
    }
    matched += 1;
    if (player.jersey !== hit.jersey) {
      player.jersey = hit.jersey;
      updated += 1;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(players, null, 2) + '\n');

  const summary = {
    htmlJerseys: jerseys.size,
    rosterPlayers: players.length,
    matched,
    updated,
    unmatched: unmatched.length,
    sampleUnmatched: unmatched.slice(0, 8),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (matched < players.length * 0.5) {
    process.exit(1);
  }
}

main();
