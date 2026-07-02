const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'x');
const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
function discoveryEnabled() { return process.env.X_AUTOPOST_DISCOVERY_ENABLED !== 'false'; }
function readJson(filePath, fallback) { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; } }
function writeJson(filePath, data) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); }
function fpHash(input) { return crypto.createHash('sha256').update(String(input || '')).digest('hex').slice(0, 16); }
function stripHtml(text) { return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function newsCandidateFromBuilt(built, extra = {}) {
  if (!built?.text) return null;
  return { text: built.text, category: 'news', topic: extra.topic || 'recruiting', urgencyLabel: extra.urgencyLabel || 'major_beat',
    postUrgency: extra.postUrgency || null, triggerType: extra.triggerType || null, teamEventType: extra.teamEventType || null,
    programNewsType: extra.programNewsType || null, sourceEventType: extra.sourceEventType || null,
    sources: extra.sources || [{ label: 'GatorVault', url: SITE_URL }], source: extra.source || 'auto:discovery',
    intelFingerprint: extra.intelFingerprint || null, playerName: built.playerName || extra.playerName || null,
    playerSlug: built.playerSlug || extra.playerSlug || null, sourceEventCreatedAt: extra.sourceEventCreatedAt || new Date().toISOString(),
    sourcePublishedAt: extra.sourcePublishedAt || extra.sourceEventCreatedAt || null, identityConfirmed: extra.identityConfirmed || false,
    validationMeta: { ...(built.validationMeta || {}), ...(extra.validationMeta || {}) }, templateBlocks: built.templateBlocks || null,
    playerContext: built.playerContext || null };
}
module.exports = { DATA_DIR, SITE_URL, discoveryEnabled, readJson, writeJson, fpHash, stripHtml, newsCandidateFromBuilt };
