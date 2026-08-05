#!/usr/bin/env node
/**
 * Bake slim Team hub roster + staff seed for first paint.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/team-hub-seed.json');

function normalizeClassYear(player) {
  const raw = String(player.year ?? player.class ?? '').trim();
  if (!raw) return '—';
  if (/^(R-)?(Fr|So|Jr|Sr)\.?$/i.test(raw)) {
    const redshirt = raw.toLowerCase().startsWith('r-');
    const abbr = raw.replace(/^r-/i, '').replace(/\.$/, '');
    const map = { fr: 'Fr.', so: 'So.', jr: 'Jr.', sr: 'Sr.' };
    const base = map[abbr.toLowerCase()] ?? abbr;
    return redshirt ? `R-${base.replace('.', '')}.` : base;
  }
  return raw;
}

function coachInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function mapPlayer(p) {
  const pos = String(p.pos ?? p.position ?? '—').toUpperCase();
  const hometown = p.hometown?.trim();
  const stateMatch = hometown?.match(/,\s*([A-Z]{2})$/);
  const tags = [];
  if (p.depthChartTier === 'starter') tags.push('starter');
  if (String(p.transferInfo || '').toLowerCase().includes('portal')) tags.push('portal');
  return {
    id: p.id || p.slug,
    name: p.name,
    position: pos,
    positionGroup: p.positionGroup ?? null,
    classYear: normalizeClassYear(p),
    hometown,
    state: stateMatch?.[1],
    tags,
    slug: p.slug,
    jersey: p.jersey != null && Number.isFinite(Number(p.jersey)) ? Number(p.jersey) : null,
  };
}

function main() {
  const playersRaw = require(path.join(ROOT, 'server/data/roster/players.json'));
  const players = Array.isArray(playersRaw) ? playersRaw : playersRaw.players || [];
  const meta = require(path.join(ROOT, 'server/data/roster/depth-chart-meta.json'));
  const staff = require(path.join(ROOT, 'server/data/coaching-staff.json'));

  const roster = players
    .filter((p) => p && p.name && (p.slug || p.id))
    .map(mapPlayer)
    .sort((a, b) => a.name.localeCompare(b.name));

  const coaches = (staff.coaches || []).map((c) => ({
    id: c.id,
    initials: coachInitials(c.name),
    name: c.name,
    title: c.title,
    group: 'coaching',
    bio: c.bio,
    highlights: c.highlights,
  }));

  if (roster.length < 80) {
    console.error('[generate-team-hub-seed] FAIL — roster too small:', roster.length);
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    roster,
    coaches,
    meta: {
      updatedAt: meta.updatedAt || null,
      playerCount: meta.playerCount || roster.length,
      units: meta.units || null,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  console.log(
    '[generate-team-hub-seed] OK — roster',
    roster.length,
    'coaches',
    coaches.length
  );
}

main();
