#!/usr/bin/env node
/** Build lean slug → share fields map for Netlify OG cards (no live API required). */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../data/recruiting/players.json');
const dest = path.join(__dirname, '../data/share/og-players.json');
const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
const out = {};
for (const row of Array.isArray(rows) ? rows : []) {
  const slug = String(row.slug || row.id || '').toLowerCase();
  if (!slug) continue;
  out[slug] = {
    slug,
    name: row.name || null,
    pos: row.pos || row.position || 'ATH',
    classYear: row.classYear || null,
    stars: row.stars ?? null,
    hometownCity: row.hometownCity || null,
    hometownState: row.hometownState || row.state || null,
    committedTo: row.committedTo || null,
    status: row.status || null,
    rating: row.rating ?? row.compositeRating ?? null,
    natlRank: row.natlRank ?? row.rankingNational ?? null,
    fitScore: row.fitScore ?? row.ufFitScore ?? null,
  };
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log('[generate-og-players]', Object.keys(out).length, 'players →', dest);
