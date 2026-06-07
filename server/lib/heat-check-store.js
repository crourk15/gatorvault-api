const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');

const PREDICTIONS_PATH = path.join(store.DATA_DIR, 'heat-predictions.json');

const COMMITTED_STATUSES = new Set(['committed', 'enrolled', 'signed']);

const RISING_TRIGGERS = new Set([
  'crystal_ball_uf',
  'rpm_uf',
  'insider_prediction_uf',
  'visit_uf_leads',
  'staff_momentum',
  'decision_soon_uf',
  'player_favorite_uf'
]);

const COOLING_TRIGGERS = new Set([
  'prediction_other',
  'visit_shift_away',
  'insider_slipping',
  'competitor_offer'
]);

const TRIGGER_LABELS = {
  crystal_ball_uf: 'Crystal Ball → Florida',
  rpm_uf: 'On3 RPM → Florida',
  insider_prediction_uf: 'Insider prediction → Florida',
  visit_uf_leads: 'Visit intel · UF leads',
  staff_momentum: 'Staff momentum',
  decision_soon_uf: 'Decision window · UF trending',
  player_favorite_uf: 'Player favorite · Florida',
  prediction_other: 'Crystal Ball · other school',
  visit_shift_away: 'Visit shifted momentum',
  insider_slipping: 'Insider intel · UF slipping',
  competitor_offer: 'Major competitor offer'
};

const TRUSTED_INSIDERS = [
  'Steve Wiltfong',
  'Corey Bender',
  'Blake Alderman',
  'Gators Online',
  'On3'
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadPredictionsFile() {
  return readJson(PREDICTIONS_PATH, { entries: [], history: {} });
}

function savePredictionsFile(data) {
  writeJson(PREDICTIONS_PATH, data);
}

function isUFCommitted(player) {
  if (!player) return false;
  if (player.category === 'recruit' && COMMITTED_STATUSES.has(String(player.status || '').toLowerCase())) {
    return String(player.committedTo || '').toLowerCase() === 'florida';
  }
  return false;
}

function isCommittedAnywhere(player) {
  if (!player) return false;
  return COMMITTED_STATUSES.has(String(player.status || '').toLowerCase());
}

function shouldExcludePlayer(player, entry) {
  if (!entry || !entry.playerSlug) return true;
  if (player && isUFCommitted(player)) return true;
  if (player && player.category === 'recruit' && isCommittedAnywhere(player)) return true;
  return false;
}

function formatMovement(history, entry) {
  if (!history || history.length < 2) return null;
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  if (prev.direction === curr.direction) return null;
  if (curr.direction === 'rising') return 'Moved to RISING';
  if (curr.direction === 'cooling') return 'Moved to COOLING';
  return null;
}

function enrichEntry(entry, player, historyMap) {
  const history = (historyMap && historyMap[entry.playerSlug]) || [];
  const movement = formatMovement(history, entry);
  const prior = history.length > 1 ? history[history.length - 2] : null;

  return {
    playerSlug: entry.playerSlug,
    playerName: entry.playerName || (player && player.name) || entry.playerSlug,
    pos: entry.pos || (player && player.pos) || '',
    classYear: entry.classYear || (player && player.classYear) || null,
    school: entry.school || (player && player.school) || '',
    direction: entry.direction,
    trigger: entry.trigger,
    triggerLabel: TRIGGER_LABELS[entry.trigger] || entry.trigger,
    predictionType: entry.predictionType || null,
    predictionSchool: entry.predictionSchool || null,
    source: entry.source || 'on3',
    insider: entry.insider || null,
    headline: entry.headline || '',
    detail: entry.detail || '',
    decisionDate: entry.decisionDate || null,
    recordedAt: entry.recordedAt || entry.updatedAt || null,
    movement,
    priorDirection: prior ? prior.direction : null,
    priorTriggerLabel: prior ? TRIGGER_LABELS[prior.trigger] || prior.trigger : null
  };
}

function appendHistory(data, entry) {
  if (!entry.playerSlug) return;
  data.history = data.history || {};
  const list = data.history[entry.playerSlug] || [];
  const last = list[list.length - 1];
  const changed =
    !last ||
    last.direction !== entry.direction ||
    last.trigger !== entry.trigger ||
    last.predictionSchool !== entry.predictionSchool;
  if (!changed) return;
  list.push({
    direction: entry.direction,
    trigger: entry.trigger,
    predictionSchool: entry.predictionSchool || null,
    insider: entry.insider || null,
    recordedAt: entry.recordedAt || new Date().toISOString()
  });
  data.history[entry.playerSlug] = list.slice(-12);
}

async function buildHeatCheck() {
  const data = loadPredictionsFile();
  const players = await store.getAllPlayers();
  const playerBySlug = {};
  players.forEach((p) => {
    playerBySlug[p.slug] = p;
  });

  const rising = [];
  const cooling = [];
  const seen = new Set();

  (data.entries || []).forEach((entry) => {
    if (!entry || !entry.playerSlug || seen.has(entry.playerSlug + ':' + entry.direction)) return;
    const player = playerBySlug[entry.playerSlug];
    if (shouldExcludePlayer(player, entry)) return;

    const triggers =
      entry.direction === 'rising' ? RISING_TRIGGERS : COOLING_TRIGGERS;
    if (!triggers.has(entry.trigger)) return;

    if (entry.insider && !TRUSTED_INSIDERS.some((n) => String(entry.insider).includes(n.split(' ')[0]))) {
      if (entry.source !== 'on3' && entry.source !== 'gators_online') return;
    }

    const item = enrichEntry(entry, player, data.history);
    seen.add(entry.playerSlug + ':' + entry.direction);
    if (entry.direction === 'rising') rising.push(item);
    else cooling.push(item);
  });

  const sortByDate = (a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0);
  rising.sort(sortByDate);
  cooling.sort(sortByDate);

  return {
    ok: true,
    tier: 'war',
    rising,
    cooling,
    updatedAt: data.updatedAt || new Date().toISOString(),
    counts: { rising: rising.length, cooling: cooling.length }
  };
}

function upsertHeatEntry(entry) {
  const data = loadPredictionsFile();
  data.entries = data.entries || [];
  const idx = data.entries.findIndex(
    (e) => e.playerSlug === entry.playerSlug && e.direction === entry.direction
  );
  const row = {
    ...entry,
    recordedAt: entry.recordedAt || new Date().toISOString()
  };
  if (idx >= 0) data.entries[idx] = { ...data.entries[idx], ...row };
  else data.entries.push(row);
  appendHistory(data, row);
  data.updatedAt = new Date().toISOString();
  savePredictionsFile(data);
  return row;
}

module.exports = {
  PREDICTIONS_PATH,
  buildHeatCheck,
  loadPredictionsFile,
  upsertHeatEntry,
  TRIGGER_LABELS,
  RISING_TRIGGERS,
  COOLING_TRIGGERS
};
