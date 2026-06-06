/**
 * Generates SVG placeholder headshots + headshots.json mapping.
 * Replace any /headshots/{slug}.webp with real photos when available.
 */
const fs = require('fs');
const path = require('path');

const ROSTER_PATH = path.join(__dirname, '..', 'data', 'roster', 'players.json');
const HEADSHOTS_DIR = path.join(__dirname, '..', 'headshots');
const MAP_PATH = path.join(__dirname, '..', 'data', 'roster', 'headshots.json');

function initials(name) {
  const parts = String(name || '')
    .replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function svgFor(name, ini) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${name}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#001a4d"/><stop offset="100%" stop-color="#003087"/></linearGradient></defs>
  <rect width="400" height="400" fill="#030712"/>
  <circle cx="200" cy="200" r="168" fill="url(#g)" stroke="#FA4616" stroke-width="6"/>
  <text x="200" y="228" text-anchor="middle" fill="#FA4616" font-family="Oswald,Arial,sans-serif" font-size="96" font-weight="700">${ini}</text>
</svg>`;
}

const players = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

const map = {};
players.forEach((p) => {
  const slug = p.slug;
  const file = `${slug}.svg`;
  fs.writeFileSync(path.join(HEADSHOTS_DIR, file), svgFor(p.name, initials(p.name)));
  map[slug] = `/headshots/${file}`;
});

fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
console.log(`Generated ${players.length} headshots in headshots/ and headshots.json`);
