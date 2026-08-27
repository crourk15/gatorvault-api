/**
 * Hard denylist for known-bad player↔school rows that must never surface on
 * profiles, Home NOW, hub ticker/movement/battle, or intel — even if On3 /
 * seed / durable disk re-introduces them.
 *
 * Tranard Roberts × Auburn: false unofficial-visit stone + any residual
 * Auburn competitor/offer paint. Wipe forever so live iOS updates without
 * waiting on a binary bake.
 */

'use strict';

/** @type {Array<{ slug: string, nameRe: RegExp, schoolRe: RegExp }>} */
const DENIED_VISITS = [
  { slug: 'tranard-roberts', nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i },
];

function rulesForSlug(slug) {
  const s = String(slug || '').toLowerCase().trim();
  return DENIED_VISITS.filter((r) => r.slug === s);
}

function schoolFromUnknown(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return String(value || '').trim();
  const nestedTeam =
    value.team && typeof value.team === 'object'
      ? value.team.name || value.team.fullName || value.team.slug || ''
      : typeof value.team === 'string'
        ? value.team
        : '';
  return String(
    value.school ||
      value.schoolName ||
      value.visitSchool ||
      value.host ||
      nestedTeam ||
      value.name ||
      value.fullName ||
      value.competitorName ||
      value.slug ||
      ''
  ).trim();
}

function isDeniedVisit(slug, school) {
  const schoolStr = schoolFromUnknown(school);
  if (!schoolStr) return false;
  return rulesForSlug(slug).some((r) => r.schoolRe.test(schoolStr));
}

function isDeniedPlayerSchool(slug, school) {
  return isDeniedVisit(slug, school);
}

/** Home NOW / hub ticker line: "Tranard Roberts — unofficial visit · Auburn Tigers" */
function isDeniedVisitTickerLine(line) {
  const text = String(line || '');
  if (!text.trim()) return false;
  // Any Tranard + Auburn ticker/movement line — visit or otherwise.
  return DENIED_VISITS.some((r) => r.nameRe.test(text) && r.schoolRe.test(text));
}

function scrubHubTickerLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return Array.isArray(lines) ? lines : [];
  return lines.filter((line) => !isDeniedVisitTickerLine(line));
}

function scrubMovementFeedItems(items) {
  if (!Array.isArray(items) || !items.length) return Array.isArray(items) ? items : [];
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    const name = String(item.name || item.player || item.playerName || '');
    const summary = String(item.summary || item.detail || '');
    const school = String(item.school || '');
    const blob = `${name} ${summary} ${school}`;
    return !DENIED_VISITS.some((r) => r.nameRe.test(blob) && r.schoolRe.test(blob));
  });
}

function scrubCompetitorList(slug, competitors) {
  if (!Array.isArray(competitors) || !competitors.length) {
    return Array.isArray(competitors) ? competitors : [];
  }
  const rules = rulesForSlug(slug);
  if (!rules.length) return competitors;
  return competitors.filter((c) => {
    const school = schoolFromUnknown(c);
    if (!school) return true;
    return !rules.some((r) => r.schoolRe.test(school));
  });
}

function scrubTopTeamsList(slug, teams) {
  if (!Array.isArray(teams) || !teams.length) return Array.isArray(teams) ? teams : [];
  const rules = rulesForSlug(slug);
  if (!rules.length) return teams;
  return teams.filter((t) => {
    const school = schoolFromUnknown(t);
    if (!school) return true;
    return !rules.some((r) => r.schoolRe.test(school));
  });
}

function scrubOfferList(slug, offers) {
  if (!Array.isArray(offers) || !offers.length) return Array.isArray(offers) ? offers : [];
  const rules = rulesForSlug(slug);
  if (!rules.length) return offers;
  return offers.filter((o) => {
    const school = schoolFromUnknown(o);
    if (!school) return true;
    return !rules.some((r) => r.schoolRe.test(school));
  });
}

function scrubHeatOrBattleRow(row) {
  if (!row || typeof row !== 'object') return row;
  const id = String(row.id || row.slug || '');
  const name = String(row.name || '');
  const rules = DENIED_VISITS.filter((r) => r.slug === id.toLowerCase() || r.nameRe.test(name));
  if (!rules.length) return row;
  const out = { ...row };
  if (Array.isArray(out.competitors)) {
    out.competitors = out.competitors.filter((c) => {
      const school = schoolFromUnknown(c);
      return !rules.some((r) => r.schoolRe.test(school));
    });
  }
  if (out.battle && typeof out.battle === 'object') {
    const battle = { ...out.battle };
    const compName = String(battle.competitorName || '');
    if (compName && rules.some((r) => r.schoolRe.test(compName))) {
      const next = Array.isArray(out.competitors) && out.competitors[0] ? out.competitors[0] : null;
      battle.competitorName = next ? schoolFromUnknown(next) || null : null;
      battle.competitor = next && next.score != null ? next.score : null;
    }
    out.battle = battle;
  }
  return out;
}

/** Scrub hub bundle/hero payloads before serve. */
function scrubHubPayload(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'string') return scrubHubTickerLines(value);
    if (value.length && value[0] && typeof value[0] === 'object') {
      // movement feed OR heat/battle rows
      if (value[0].summary != null || value[0].detail != null || value[0].school != null) {
        return scrubMovementFeedItems(value);
      }
      return value.map(scrubHeatOrBattleRow);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  const out = { ...value };
  if (Array.isArray(out.ticker)) out.ticker = scrubHubTickerLines(out.ticker);
  if (Array.isArray(out.movementFeed)) out.movementFeed = scrubMovementFeedItems(out.movementFeed);
  if (Array.isArray(out.heatIndex)) out.heatIndex = out.heatIndex.map(scrubHeatOrBattleRow);
  if (Array.isArray(out.battleBoard)) out.battleBoard = out.battleBoard.map(scrubHeatOrBattleRow);
  if (Array.isArray(out.battles)) out.battles = out.battles.map(scrubHeatOrBattleRow);
  if (out.hero && typeof out.hero === 'object') {
    out.hero = scrubHubPayload(out.hero);
  }
  return out;
}

function scrubPlayerVisits(slug, visits) {
  if (!Array.isArray(visits) || !visits.length) return Array.isArray(visits) ? visits : [];
  const rules = rulesForSlug(slug);
  if (!rules.length) return visits;
  return visits.filter((v) => {
    const school = schoolFromUnknown(v);
    if (!school) return true;
    return !rules.some((r) => r.schoolRe.test(school));
  });
}

function scrubVisitLogRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return Array.isArray(rows) ? rows : [];
  return rows.filter((row) => {
    const slug = row?.playerSlug || row?.slug || '';
    const school = row?.school || row?.visitSchool || row?.host || '';
    return !isDeniedVisit(slug, school);
  });
}

function scrubPlayerSchoolFields(player) {
  if (!player || typeof player !== 'object') return player;
  const slug = player.slug || player.id || '';
  if (Array.isArray(player.visits)) {
    player.visits = scrubPlayerVisits(slug, player.visits);
  }
  if (Array.isArray(player.visitHistory)) {
    player.visitHistory = scrubPlayerVisits(slug, player.visitHistory);
  }
  if (Array.isArray(player.competitors)) {
    player.competitors = scrubCompetitorList(slug, player.competitors);
  }
  if (Array.isArray(player.offers)) {
    player.offers = scrubOfferList(slug, player.offers);
  }
  if (Array.isArray(player.offerList)) {
    player.offerList = scrubOfferList(slug, player.offerList);
  }
  if (Array.isArray(player.topTeams)) {
    player.topTeams = scrubTopTeamsList(slug, player.topTeams);
  }
  if (Array.isArray(player.on3TopTeams)) {
    player.on3TopTeams = scrubTopTeamsList(slug, player.on3TopTeams);
  }
  if (Array.isArray(player.competingSchools)) {
    player.competingSchools = scrubCompetitorList(slug, player.competingSchools);
  }
  if (player.portalPredictions && typeof player.portalPredictions === 'object') {
    const pp = { ...player.portalPredictions };
    if (Array.isArray(pp.predictions)) {
      pp.predictions = scrubCompetitorList(slug, pp.predictions);
    }
    player.portalPredictions = pp;
  }
  return player;
}

/** @deprecated use scrubPlayerSchoolFields */
function scrubPlayerVisitFields(player) {
  return scrubPlayerSchoolFields(player);
}

/**
 * One-shot durable disk heal — /var/data/players.json survives deploys and can
 * keep denied rows forever. Rewrite when any denied row is present.
 */
function healDurableDeniedVisits(playersPath) {
  const fs = require('fs');
  const path = require('path');
  const filePath =
    playersPath ||
    path.join(require('./recruiting-data-dir').resolveRecruitingDataDir(), 'players.json');
  if (!fs.existsSync(filePath)) return { healed: false, reason: 'missing' };
  let players;
  try {
    players = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { healed: false, reason: err.message };
  }
  if (!Array.isArray(players)) return { healed: false, reason: 'not_array' };
  let changed = 0;
  for (const p of players) {
    if (!p || !p.slug) continue;
    const before = JSON.stringify({
      visits: p.visits,
      competitors: p.competitors,
      offers: p.offers,
      offerList: p.offerList,
      topTeams: p.topTeams,
      on3TopTeams: p.on3TopTeams,
    });
    scrubPlayerSchoolFields(p);
    const after = JSON.stringify({
      visits: p.visits,
      competitors: p.competitors,
      offers: p.offers,
      offerList: p.offerList,
      topTeams: p.topTeams,
      on3TopTeams: p.on3TopTeams,
    });
    if (after !== before) changed += 1;
  }
  if (!changed) return { healed: false, reason: 'clean', changed: 0 };
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(players, null, 2)}\n`, 'utf8');
    return { healed: true, changed };
  } catch (err) {
    return { healed: false, reason: err.message, changed };
  }
}

module.exports = {
  DENIED_VISITS,
  isDeniedVisit,
  isDeniedPlayerSchool,
  isDeniedVisitTickerLine,
  scrubHubTickerLines,
  scrubMovementFeedItems,
  scrubHubPayload,
  scrubPlayerVisits,
  scrubCompetitorList,
  scrubOfferList,
  scrubTopTeamsList,
  scrubVisitLogRows,
  scrubPlayerVisitFields,
  scrubPlayerSchoolFields,
  healDurableDeniedVisits,
};
