/**
 * Persists aggregate insider-style stats from live X beat-writer timelines.
 */
const fs = require('fs');
const path = require('path');
const analyzer = require('./insider-style-analyzer');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'x');
const CORPUS_PATH = path.join(DATA_DIR, 'insider-style-corpus.json');

let _mem = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function buildCorpusFromPosts(posts, { source = 'beat-cache' } = {}) {
  const analyzed = analyzer.analyzeCorpus(posts);
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    source,
    sampleSize: analyzed.sampleSize,
    writersSampled: analyzed.writersSampled,
    aggregate: analyzed.aggregate,
    styleGuide: analyzer.getStyleGuide(analyzed)
  };
}

function getSeedCorpus() {
  return buildCorpusFromPosts(analyzer.SEED_POSTS, { source: 'seed' });
}

function loadCorpusFromDisk() {
  try {
    if (!fs.existsSync(CORPUS_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
    if (!raw?.aggregate) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveCorpus(corpus) {
  ensureDir();
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2));
  _mem = corpus;
  return corpus;
}

function getCorpus() {
  if (_mem?.aggregate) return _mem;
  _mem = loadCorpusFromDisk() || getSeedCorpus();
  return _mem;
}

function refreshFromPosts(posts, { source = 'beat-cache' } = {}) {
  const corpus = buildCorpusFromPosts(posts, { source });
  if (corpus.sampleSize > 0) saveCorpus(corpus);
  return corpus;
}

function refreshFromBeatCache() {
  try {
    const liveBeat = require('../live-beat');
    const { posts = [] } = liveBeat.getBeatPosts(120);
    if (posts.length) return refreshFromPosts(posts, { source: 'beat-cache' });
  } catch {
    /* optional */
  }
  return getCorpus();
}

async function refreshFromX({ maxPostsPerWriter = 15 } = {}) {
  try {
    const liveBeat = require('../live-beat');
    const fresh = await liveBeat.fetchAllWriterPostsFresh({ maxPostsPerWriter });
    if (fresh?.posts?.length) {
      return refreshFromPosts(fresh.posts, { source: fresh.tokenStatus?.ok ? 'x-api' : 'nitter' });
    }
  } catch (e) {
    return { ok: false, error: e.message, corpus: getCorpus() };
  }
  return { ok: false, reason: 'no_posts', corpus: getCorpus() };
}

function getStyleHints(opts = {}) {
  return analyzer.getStyleHints(getCorpus(), opts);
}

function getStyleGuide() {
  return analyzer.getStyleGuide(getCorpus());
}

module.exports = {
  CORPUS_PATH,
  getCorpus,
  saveCorpus,
  getSeedCorpus,
  refreshFromPosts,
  refreshFromBeatCache,
  refreshFromX,
  getStyleHints,
  getStyleGuide,
  buildCorpusFromPosts
};
