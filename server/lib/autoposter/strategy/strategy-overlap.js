/** PR-5 — template overlap via 3-gram Jaccard. */

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'are', 'was', 'with']);

function ngrams(text, n = 3) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  const out = [];
  for (let i = 0; i <= words.length - n; i += 1) {
    out.push(words.slice(i, i + n).join(' '));
  }
  return out;
}

function jaccard3gram(a, b) {
  const setA = new Set(ngrams(a, 3));
  const setB = new Set(ngrams(b, 3));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const g of setA) {
    if (setB.has(g)) shared += 1;
  }
  return shared / setA.size;
}

function maxPairwiseOverlap(lines, threshold = 0.35) {
  const texts = (lines || []).filter(Boolean);
  let max = 0;
  const pairs = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const score = jaccard3gram(texts[i], texts[j]);
      max = Math.max(max, score);
      if (score >= threshold) {
        pairs.push({ i, j, score });
      }
    }
  }
  return { max, pairs };
}

module.exports = {
  ngrams,
  jaccard3gram,
  maxPairwiseOverlap
};
