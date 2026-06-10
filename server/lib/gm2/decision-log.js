/**
 * GM 2.0 — structured accept/reject/quarantine decision log.
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'recruiting', 'gm2-decisions.json');
const MAX_EVENTS = 500;

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return { version: 1, events: [], updatedAt: null };
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(LOG_PATH, JSON.stringify(doc, null, 2));
}

function logDecision(entry) {
  const doc = readDoc();
  doc.events = doc.events || [];
  doc.events.unshift({
    id: `gm2_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...entry
  });
  doc.events = doc.events.slice(0, MAX_EVENTS);
  writeDoc(doc);

  const tag = `[gm2:${entry.layer || 'core'}]`;
  if (entry.action === 'allow' || entry.action === 'block_render') {
    if (process.env.GM2_VERBOSE === 'true') {
      console.log(tag, entry.action, entry.feature || entry.subsystem, entry.reason || entry.playerSlug || '');
    }
  } else {
    console.warn(tag, entry.action, entry.reason || '', entry.playerSlug || entry.fingerprint || '');
  }
  return doc.events[0];
}

function listDecisions({ limit = 100, layer = null, feature = null } = {}) {
  let events = readDoc().events || [];
  if (layer) events = events.filter((e) => e.layer === layer);
  if (feature) events = events.filter((e) => e.feature === feature);
  return events.slice(0, limit);
}

function countByAction(sinceMs = 86400000) {
  const since = Date.now() - sinceMs;
  const counts = { allow: 0, reject: 0, quarantine: 0, needs_resolution: 0, block_render: 0 };
  for (const e of readDoc().events || []) {
    if (new Date(e.at).getTime() < since) continue;
    if (counts[e.action] != null) counts[e.action] += 1;
  }
  return counts;
}

module.exports = {
  LOG_PATH,
  logDecision,
  listDecisions,
  countByAction
};
