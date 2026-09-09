/**
 * Film Desk packet — Beat Brief analog for weekly Florida tape.
 * Charles lock (What they ran / How it played / Do not say) is the brief.
 * Writer film (GNFP, Tengwall, DiRocco) is an INTERNAL seed — absorb, never name.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DESK_DIR = path.join(__dirname, '..', 'data', 'film-room', 'desk');
const GAMES_DIR = path.join(DESK_DIR, 'games');
const SOURCES_PATH = path.join(DESK_DIR, 'sources.json');

const FILM_BEAT_RE =
  /\b(film|tape|breakdown|scheme|all-?22|install|run game|odd front|coverage|offensive line|ol\b)\b/i;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadSources() {
  const doc = readJson(SOURCES_PATH, { sources: [] });
  return Array.isArray(doc.sources) ? doc.sources : [];
}

function loadGameCard(gameId) {
  const id = String(gameId || '').trim().toLowerCase();
  if (!id) return null;
  const file = path.join(GAMES_DIR, `${id}.json`);
  const card = readJson(file, null);
  if (!card || typeof card !== 'object') return null;
  return card;
}

function listGameCards() {
  try {
    return fs
      .readdirSync(GAMES_DIR)
      .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
      .map((name) => readJson(path.join(GAMES_DIR, name), null))
      .filter((card) => card && card.gameId);
  } catch {
    return [];
  }
}

function loadScheduleGames(year) {
  try {
    const schedule = require('./schedule-store');
    const season = Number(year) || 2026;
    const doc = schedule.getSeason ? schedule.getSeason(season) : null;
    if (doc && Array.isArray(doc.games)) return doc.games;
  } catch {
    /* fall through */
  }
  const file = path.join(__dirname, '..', 'data', 'schedule', `${year || 2026}-season.json`);
  const doc = readJson(file, { games: [] });
  return Array.isArray(doc.games) ? doc.games : [];
}

function catalogItems() {
  const items = [];
  try {
    const manual = readJson(path.join(__dirname, '..', 'data', 'film-room', 'manual.json'), {});
    if (Array.isArray(manual.items)) items.push(...manual.items);
  } catch {
    /* optional */
  }
  try {
    const { loadFilmRoomCache } = require('./film-room-cache-store');
    const cache = loadFilmRoomCache();
    const rows = cache?.items || cache?.videos || [];
    if (Array.isArray(rows)) items.push(...rows);
  } catch {
    /* optional */
  }
  return items;
}

function gameKeywords(game) {
  const bits = [game?.id, game?.opp, game?.label, game?.opponentShort]
    .map((s) => String(s || '').toLowerCase())
    .filter(Boolean);
  const extra = [];
  if (/\bfau\b|atlantic/i.test(bits.join(' '))) extra.push('fau', 'florida atlantic', 'owls');
  if (/campbell/i.test(bits.join(' '))) extra.push('campbell', 'camels');
  return [...new Set([...bits, ...extra])];
}

function textMatchesGame(text, keywords) {
  const hay = String(text || '').toLowerCase();
  if (!hay) return false;
  return keywords.some((k) => k && hay.includes(String(k).toLowerCase()));
}

function catalogForGame(game) {
  const keys = gameKeywords(game);
  return catalogItems()
    .filter((item) => {
      const blob = [item.title, item.dek, item.gameLine, item.slug, item.category, item.source]
        .filter(Boolean)
        .join(' ');
      return textMatchesGame(blob, keys);
    })
    .map((item) => ({
      label: item.title || item.slug || 'Film',
      source: item.source || item.category || '',
      url: item.videoUrl || item.url || (item.youtubeId ? `https://www.youtube.com/watch?v=${item.youtubeId}` : ''),
      youtubeId: item.youtubeId || null,
      category: item.category || '',
    }))
    .filter((row, idx, arr) => row.url && arr.findIndex((r) => r.url === row.url) === idx)
    .slice(0, 12);
}

function gatherDiRoccoSeeds(game) {
  const keys = gameKeywords(game);
  try {
    const intel = require('./recruiting-intel-store');
    const rows = intel.listIntel({ limit: 80 }) || [];
    return rows
      .filter((row) => {
        const who = [row.source, row.writer, row.author, row.handle, row.outlet]
          .map((s) => String(s || '').toLowerCase())
          .join(' ');
        if (!/dirocco/.test(who)) return false;
        const text = String(row.text || row.body || row.title || '');
        if (!FILM_BEAT_RE.test(text)) return false;
        return textMatchesGame(text, keys) || keys.includes('fau');
      })
      .slice(0, 5)
      .map((row) => ({
        sourceId: 'dirocco',
        title: String(row.title || 'DiRocco film note').slice(0, 140),
        url: row.articleUrl || row.url || row.sourceUrl || '',
        claim: String(row.text || row.body || '').replace(/\s+/g, ' ').trim().slice(0, 280),
        postedAt: row.reportedAt || row.createdAt || null,
      }));
  } catch {
    return [];
  }
}

function mergeSeeds(card, game) {
  const fromCard = Array.isArray(card?.intelSeeds) ? card.intelSeeds : [];
  const fromBeat = gatherDiRoccoSeeds(game);
  const seen = new Set();
  const out = [];
  for (const seed of [...fromCard, ...fromBeat]) {
    const key = `${seed.sourceId || ''}|${seed.url || seed.title || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      sourceId: String(seed.sourceId || '').trim(),
      title: String(seed.title || '').trim(),
      url: String(seed.url || '').trim(),
      claim: String(seed.claim || '').trim(),
      postedAt: seed.postedAt || null,
    });
  }
  return out;
}

function sourceName(id, registry) {
  const hit = (registry || []).find((s) => s.id === id);
  return hit?.name || id || 'source';
}

function formatPaste(packet) {
  const g = packet.game || {};
  const card = packet.card || {};
  const lines = [];
  lines.push('GATORVAULT FILM DESK BRIEF');
  lines.push('==========================');
  lines.push(`Game: Florida vs ${g.opp || g.opponent || packet.gameId}`);
  lines.push(`Slug: ${packet.gameId}`);
  lines.push(`When: ${g.date || g.dateLabel || '—'}`);
  lines.push(`Venue: ${g.venue || '—'}`);
  if (g.finalUF != null && g.finalOpp != null) {
    lines.push(`Final: Florida ${g.finalUF} · ${g.opp || 'Opp'} ${g.finalOpp}`);
  }
  lines.push(`Lock: ${card.locked ? 'CHARLES LOCKED' : 'UNLOCKED — sit tape before treating as Review copy'}`);
  lines.push(`Review status: ${card.reviewStatus || 'desk-only'} (fan Review stays off until Charles says go)`);
  lines.push('');
  lines.push('WHAT THEY RAN (Charles lock — do not invent past this)');
  lines.push('-----------------------------------------------------');
  const ran = card.whatTheyRan || [];
  lines.push(ran.length ? ran.map((s) => `- ${s}`).join('\n') : '(empty — Charles has not locked this game yet)');
  lines.push('');
  lines.push('HOW IT PLAYED (Charles lock)');
  lines.push('----------------------------');
  const played = card.howItPlayed || [];
  lines.push(played.length ? played.map((s) => `- ${s}`).join('\n') : '(empty — lock after the sit)');
  lines.push('');
  lines.push('DO NOT SAY');
  lines.push('----------');
  lines.push((card.doNotSay || []).map((s) => `- ${s}`).join('\n') || '- (none on file)');
  lines.push('');
  if (card.jerseys && Object.keys(card.jerseys).length) {
    lines.push('JERSEYS');
    lines.push('-------');
    lines.push(
      Object.entries(card.jerseys)
        .map(([name, num]) => `${name} ${num}`)
        .join(' · ')
    );
    lines.push('');
  }
  lines.push('SNAP LOCKS (only snaps we sat)');
  lines.push('------------------------------');
  const snaps = card.snapLocks || [];
  lines.push(snaps.length ? snaps.map((s) => `- ${s}`).join('\n') : '(none yet)');
  lines.push('');
  lines.push('INTERNAL INTEL SEED (absorb into Vault voice — NEVER name writers, never say beat/report/according to)');
  lines.push('----------------------------------------------------------------------------------------------------');
  const seeds = packet.intelSeeds || [];
  if (!seeds.length) {
    lines.push('(no writer film seed on file yet)');
  } else {
    for (const seed of seeds) {
      const who = sourceName(seed.sourceId, packet.sources);
      lines.push(`- [${who}] ${seed.title || 'Film note'}${seed.url ? ` · ${seed.url}` : ''}`);
      if (seed.claim) lines.push(`  ${seed.claim}`);
    }
  }
  lines.push('');
  lines.push('TAPE LINKS (open before drafting)');
  lines.push('---------------------------------');
  const links = [...(card.tapeLinks || []), ...(packet.catalog || [])];
  const seenUrl = new Set();
  for (const link of links) {
    const url = link.url || '';
    if (!url || seenUrl.has(url)) continue;
    seenUrl.add(url);
    lines.push(`- ${link.label || link.source || 'Tape'}: ${url}`);
  }
  if (!seenUrl.size) lines.push('(no links yet)');
  lines.push('');
  lines.push('INSTRUCTIONS FOR AI');
  lines.push('-------------------');
  lines.push(
    'Write one GatorVault Film Review draft from the LOCK + tape you actually sit. Target a tight board (offense / defense / specials), not a 50-chunk dump.'
  );
  lines.push('Charles tape wins when a writer seed contradicts the lock.');
  lines.push('Absorb intel-seed FACTS in Vault voice. Forbidden in fan copy: writer names; GNFP/Patreon wording; "according to"; box-score walk; leftover hats you did not sit.');
  lines.push('Use What they ran / How it played. Areas of opportunity — never "leak." Never personnel codes. Never "every snap."');
  lines.push('Do NOT publish live Review (filmWatched true) unless Charles confirms. Persist drafts with filmWatched:false + watchNote containing PROVISIONAL.');
  lines.push(
    'PERSIST (when Charles says go): node server/scripts/upsert-vault-film-review.js --file=server/data/film-room/reviews/<id>.json'
  );
  if (card.notes) {
    lines.push('');
    lines.push(`DESK NOTE: ${card.notes}`);
  }
  return lines.join('\n');
}

function buildInbox({ year = 2026 } = {}) {
  const games = loadScheduleGames(year);
  const cards = new Map(listGameCards().map((c) => [String(c.gameId).toLowerCase(), c]));
  const sources = loadSources();
  const items = games.map((game) => {
    const id = String(game.id || '').toLowerCase();
    const card = cards.get(id) || { gameId: id, locked: false, intelSeeds: [], reviewStatus: 'none' };
    const seeds = mergeSeeds(card, game);
    const catalog = catalogForGame(game);
    const played = game.finalUF != null && game.finalOpp != null;
    return {
      gameId: id,
      opponent: game.opp || game.opponent || id,
      label: game.label || id,
      date: game.date || '',
      venue: game.venue || '',
      finalUF: game.finalUF ?? null,
      finalOpp: game.finalOpp ?? null,
      played,
      locked: card.locked === true,
      reviewStatus: card.reviewStatus || (played ? 'desk-only' : 'pregame'),
      intelCount: seeds.length,
      tapeCount: catalog.length + (Array.isArray(card.tapeLinks) ? card.tapeLinks.length : 0),
      sourceIds: [...new Set(seeds.map((s) => s.sourceId).filter(Boolean))],
    };
  });
  return {
    ok: true,
    year,
    sources: sources.map((s) => ({ id: s.id, name: s.name, role: s.role, kind: s.kind })),
    items,
    updatedAt: new Date().toISOString(),
  };
}

function buildFilmDeskBrief(gameId, { year = 2026 } = {}) {
  const id = String(gameId || '').trim().toLowerCase();
  if (!id) return { ok: false, error: 'game_required' };
  const games = loadScheduleGames(year);
  const game = games.find((g) => String(g.id || '').toLowerCase() === id) || { id };
  const card = loadGameCard(id) || {
    gameId: id,
    locked: false,
    whatTheyRan: [],
    howItPlayed: [],
    doNotSay: [],
    snapLocks: [],
    intelSeeds: [],
    tapeLinks: [],
    reviewStatus: 'none',
  };
  const sources = loadSources();
  const intelSeeds = mergeSeeds(card, game);
  const catalog = catalogForGame(game);
  const packet = {
    ok: true,
    gameId: id,
    game,
    card,
    sources,
    intelSeeds,
    catalog,
  };
  packet.pasteText = formatPaste(packet);
  return packet;
}

module.exports = {
  loadSources,
  loadGameCard,
  listGameCards,
  buildInbox,
  buildFilmDeskBrief,
  formatPaste,
  catalogForGame,
  gatherDiRoccoSeeds,
};
