/** PR-5 — protect strategy line from destructive compression. */

const { MIN_STRATEGY_CHARS } = require('./strategy-types');

function guardCompression(strategyLine, maxLen = 220) {
  const s = String(strategyLine || '').trim();
  if (!s) return s;
  if (s.length <= maxLen) return s;

  const cut = s.lastIndexOf('. ', maxLen - 1);
  if (cut >= MIN_STRATEGY_CHARS) {
    return s.slice(0, cut + 1);
  }

  if (s.length >= MIN_STRATEGY_CHARS) return s.slice(0, maxLen).replace(/\s+\S*$/, '.');
  return s;
}

function isTruncatedBadly(text) {
  const t = String(text || '');
  return /— the\.|\bthe\.\s*$|\.\.\.$/.test(t) || (t.length > 0 && t.length < MIN_STRATEGY_CHARS);
}

module.exports = {
  guardCompression,
  isTruncatedBadly
};
