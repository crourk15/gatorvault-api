/**
 * Voice Engine v1.1.1 — machine-checkable QA gates.
 */
const copy = require('../x-autoposter-copy');
const template = require('../x-autoposter-template');
const insiderTone = require('./insider-tone');
const phraseMemory = require('./voice-phrase-memory');

const UF_LINK_RE =
  /\b(board|depth|scheme|portal|class|visit|rpm|install|trench|recruit|target|priority|mix|race|window|camp|rep)\b/i;
const FLORIDA_RE = /\b(florida|gators|\buf\b|gainesville|swamp)\b/i;

const HYPE_RE = [
  /\bbreaking\b/i,
  /\bhuge\b/i,
  /\bwow\b/i,
  /\b🔥\b/,
  /\bsources tell us\b/i,
  /\bper reports\b/i,
  /\baccording to sources\b/i,
  /\bwe have learned\b/i,
  /\bhere is your update\b/i
];

const BOT_RE = [
  /\bgenerating post\b/i,
  /\bthis is interesting because\b/i,
  /\bflorida is trending\b/i,
  /\bbig news\b/i,
  /\bhuge momentum\b/i
];

const STOP_NGRAM = new Set(['gatorvault', 'florida', 'gators', 'the', 'and', 'for', 'with']);

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasRealIntel(text, signal, blocks) {
  const combined = `${blocks?.intel || ''} ${text}`.toLowerCase();
  const beat = String(signal?.beatText || signal?.event?.description || '').toLowerCase();
  if (signal?.metrics?.rpm != null) return true;
  if (signal?.metrics?.visitDate) return true;
  if (signal?.metrics?.compSchools?.length) return true;
  if (signal?.metrics?.depthChartNote) return true;
  if (signal?.metrics?.schemeNote) return true;

  let beatHits = 0;
  for (const m of beat.matchAll(/\b[a-z][a-z'-]{4,}\b/g)) {
    if (combined.includes(m[0])) {
      beatHits += 1;
      if (beatHits >= 2) return true;
    }
  }
  return beatHits >= 1 && combined.length >= 40;
}

function hasUfContext(text) {
  const t = String(text || '');
  return FLORIDA_RE.test(t) && UF_LINK_RE.test(t);
}

function hasStrategyData(blocks, signal) {
  const s = String(blocks?.strategy || '');
  if (!s || s.length < 16) return false;
  const m = signal?.metrics || {};
  if (m.rpm != null && /\d/.test(s)) return true;
  if (m.visitDate && /\d|visit|window/i.test(s)) return true;
  if (m.compSchools?.length && m.compSchools.some((c) => s.includes(c.split(' ')[0]))) return true;
  if (m.depthChartNote && s.length >= 20) return true;
  if (m.schemeNote && s.length >= 20) return true;
  return /\d+%|\bvisit\b|\bcompet/i.test(s);
}

function hookValid(hook) {
  const h = String(hook || '').trim();
  if (!h) return false;
  if (wordCount(h) > 8) return false;
  if (insiderTone.isGenericFluff(h)) return false;
  if (phraseMemory.hookRecentlyUsed(h)) return false;
  return true;
}

function ctaValid(cta, mode) {
  const c = String(cta || '').trim();
  if (!c) return false;
  if (/download|sign up|subscribe now|get the app/i.test(c)) return false;
  if (mode === 'recruiting' && (/^https?:\/\//i.test(c) || /futurecast\/player\/|\/player\//i.test(c))) {
    return true;
  }
  if (/gatorvault/i.test(c)) {
    if (phraseMemory.ctaRecentlyUsed(c)) return false;
    return true;
  }
  return /^https?:\/\//i.test(c);
}

function ngrams(text, n = 3) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_NGRAM.has(w));
  const out = [];
  for (let i = 0; i <= words.length - n; i += 1) {
    out.push(words.slice(i, i + n).join(' '));
  }
  return out;
}

function readRecentPosts() {
  try {
    const xStore = require('../x-autoposter-store');
    const doc = xStore.loadQueue();
    return (doc.items || [])
      .filter((i) => i.status === 'sent' || i.status === 'pending')
      .slice(0, 20)
      .map((i) => i.text || '');
  } catch {
    return [];
  }
}

function templateOverlapScore(text) {
  const cand = new Set(ngrams(text, 3));
  if (!cand.size) return 0;
  let max = 0;
  for (const prev of readRecentPosts()) {
    const prevSet = new Set(ngrams(prev, 3));
    if (!prevSet.size) continue;
    let shared = 0;
    for (const g of cand) {
      if (prevSet.has(g)) shared += 1;
    }
    max = Math.max(max, shared / cand.size);
  }
  return max;
}

function runQualityGate(signal, blocks, text, candidate = {}) {
  const reasons = [];
  const mode = signal?.type === 'recruiting' && signal?.player ? 'recruiting' : 'non_recruiting';

  if (!hasRealIntel(text, signal, blocks)) reasons.push('missing_real_intel');
  if (!hasUfContext(`${blocks?.context || ''} ${text}`)) reasons.push('missing_uf_context');
  if (!hasStrategyData(blocks, signal)) reasons.push('missing_strategy_data');
  if (!hookValid(blocks?.hook)) reasons.push('invalid_hook');
  if (!ctaValid(blocks?.cta, mode)) reasons.push('invalid_cta');

  const combined = `${text} ${blocks?.intel} ${blocks?.context} ${blocks?.strategy}`;
  for (const re of HYPE_RE) {
    if (re.test(combined)) {
      reasons.push('hype_language');
      break;
    }
  }
  for (const re of BOT_RE) {
    if (re.test(combined)) {
      reasons.push('bot_language');
      break;
    }
  }

  const tone = insiderTone.validateInsiderTone(combined, { minWords: 12 });
  if (!tone.ok && tone.errors.includes('forbidden_tone')) reasons.push('forbidden_tone');

  if (templateOverlapScore(text) > 0.45) reasons.push('template_overlap');

  if (String(text || '').length > parseInt(process.env.VOICE_CHAR_LIMIT || '280', 10)) {
    reasons.push('char_limit');
  }

  if (mode === 'recruiting' && candidate.playerName) {
    if (!copy.isValidPlayerName(candidate.playerName)) reasons.push('invalid_player_name');
    if (!copy.postReferencesPlayerName(text, candidate.playerName)) reasons.push('player_not_in_body');
  }

  return {
    passed: reasons.length === 0,
    reason: reasons[0] || null,
    reasons
  };
}

module.exports = {
  runQualityGate,
  hasRealIntel,
  hasUfContext,
  hasStrategyData,
  hookValid,
  ctaValid,
  templateOverlapScore
};
