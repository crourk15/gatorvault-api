/** PR-5 — protect strategy/context from destructive compression. */

const { MIN_STRATEGY_CHARS } = require('./strategy-types');

const TWEET_STRATEGY_MAX = parseInt(process.env.VOICE_STRATEGY_MAX_CHARS || '100', 10);
const TWEET_CONTEXT_MAX = parseInt(process.env.VOICE_CONTEXT_MAX_CHARS || '88', 10);

const BROKEN_ENDING_RE =
  /(?:— the\.|\bthe\.\s*$|\.\.\.$|\bwith first visit to\.\s*$|\bwith on\.\s*$|\bplus first visit to\.\s*$|— spring\.\s*$|\bnot\s*\.?\s*$|\bmeans\s*\.?\s*$)/i;

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

function guardForTweet(line, maxLen = TWEET_STRATEGY_MAX) {
  const s = String(line || '').trim();
  if (!s || s.length <= maxLen) return s;
  const cut = s.lastIndexOf('. ', maxLen - 1);
  if (cut >= Math.min(MIN_STRATEGY_CHARS, Math.floor(maxLen * 0.55))) {
    return s.slice(0, cut + 1);
  }
  const em = s.lastIndexOf(' — ', maxLen - 1);
  if (em >= Math.min(MIN_STRATEGY_CHARS, Math.floor(maxLen * 0.55))) {
    return `${s.slice(0, em)}.`;
  }
  return s.slice(0, maxLen).replace(/\s+\S*$/, '').replace(/[,;:\-—]+$/, '').trim() + '.';
}

function isTruncatedBadly(text) {
  const t = String(text || '');
  if (!t) return false;
  if (BROKEN_ENDING_RE.test(t)) return true;
  if (t.length > 0 && t.length < MIN_STRATEGY_CHARS && !/\.$/.test(t)) return true;
  return false;
}

function blocksHaveTruncation(blocks, text) {
  const parts = [blocks?.context, blocks?.strategy, blocks?.intel, text];
  return parts.some((p) => isTruncatedBadly(p));
}

module.exports = {
  TWEET_STRATEGY_MAX,
  TWEET_CONTEXT_MAX,
  guardCompression,
  guardForTweet,
  isTruncatedBadly,
  blocksHaveTruncation
};
