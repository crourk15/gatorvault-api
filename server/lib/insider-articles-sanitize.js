/**
 * Sanitize beat/recruiting text before article generation.
 */
const { isValidPlayerName } = require('./x-autoposter-player-context');

function sanitizeText(text) {
  let t = String(text || '');
  t = t.replace(/https?:\/\/\S+/gi, ' ');
  t = t.replace(/\bx\.com\/\S+/gi, ' ');
  t = t.replace(/@\w{2,}/g, ' ');
  t = t.replace(/\bVIP\b/gi, ' ');
  t = t.replace(/[""][^""]{0,280}[""]/g, ' ');
  t = t.replace(/[''][^'']{0,280}['']/g, ' ');
  t = t.replace(/\btweet(?:ed|ing|s)?\b/gi, ' ');
  t = t.replace(/\bper\s+(?:twitter|x|tweet)\b/gi, ' ');
  t = t.replace(/\bthread\b/gi, ' ');
  t = t.replace(/\(\s*\)/g, ' ');
  t = t.replace(/\[\s*\]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function sanitizePlayerName(name) {
  const cleaned = sanitizeText(name);
  if (!cleaned || !isValidPlayerName(cleaned)) return null;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(0, 3).join(' ');
}

function sanitizeIntelDetail(detail) {
  const t = sanitizeText(detail);
  if (!t || t.length < 24) return null;
  if (/^(?:official visit|ov preview|visit weekend)/i.test(t) && t.length < 48) return null;
  return t.slice(0, 320);
}

function hasEmptyParentheses(text) {
  return /\(\s*\)/.test(String(text || ''));
}

function wordCount(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasRequiredSections(html) {
  const t = String(html || '').toLowerCase();
  return (
    t.includes('overview') &&
    t.includes('trends') &&
    t.includes('analysis') &&
    (t.includes("what's next") || t.includes('whats next') || t.includes('what is next'))
  );
}

/** Detect paragraphs that are mostly bold names with no analysis. */
function isNameOnlyListBody(html) {
  const paragraphs = String(html || '').match(/<p>[\s\S]*?<\/p>/gi) || [];
  if (paragraphs.length < 3) return false;
  let nameOnly = 0;
  for (const p of paragraphs) {
    const inner = p.replace(/<\/?p>/gi, '').replace(/<[^>]+>/g, '').trim();
    if (!inner) continue;
    if (/^[\w\s'.-]+ — [\w\s'.-]+$/.test(inner) && inner.length < 80) nameOnly += 1;
    if (/^<strong>[^<]+<\/strong>\s*\([^)]+\)\s*—/.test(p) && inner.length < 90) nameOnly += 1;
  }
  return nameOnly >= 3;
}

/** Detect legacy template filler and meta-instructions masquerading as analysis. */
function isGenericBoilerplateBody(html) {
  const t = String(html || '').toLowerCase();
  const fillerPatterns = [
    'gatorvault recruiting coverage is locked',
    'every data point below passed sanitization',
    'drafts are never auto-published',
    'approve in gv-om',
    'heat check does not treat a single rpm tick',
    'gatorvault will refresh heat check when',
    'no 2026 class references',
    'recruiting class chatter is intentionally excluded',
    'not social posts or paywalled snippets',
    'visit volume alone is not a ranking',
    'film-room and depth integrations on gatorvault map starters'
  ];
  let hits = 0;
  for (const p of fillerPatterns) {
    if (t.includes(p)) hits += 1;
  }
  return hits >= 2;
}

module.exports = {
  sanitizeText,
  sanitizePlayerName,
  sanitizeIntelDetail,
  hasEmptyParentheses,
  wordCount,
  hasRequiredSections,
  isNameOnlyListBody,
  isGenericBoilerplateBody
};
