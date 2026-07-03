#!/usr/bin/env node
/** Refresh insider-style corpus from live X beat-writer timelines (or beat cache). */
const path = require('path');

async function main() {
  const mode = process.argv[2] || 'cache';
  const styleCorpus = require(path.join(__dirname, '..', 'lib', 'autoposter', 'insider-style-corpus'));

  let corpus;
  if (mode === 'x' || mode === 'fresh') {
    const out = await styleCorpus.refreshFromX({ maxPostsPerWriter: 20 });
    corpus = out.corpus || out;
    console.log('[insider-style] refreshed from X', {
      ok: out.ok !== false,
      sampleSize: corpus.sampleSize,
      source: corpus.source,
      writers: corpus.writersSampled?.length || 0
    });
  } else {
    corpus = styleCorpus.refreshFromBeatCache();
    console.log('[insider-style] refreshed from beat cache', {
      sampleSize: corpus.sampleSize,
      source: corpus.source,
      writers: corpus.writersSampled?.length || 0
    });
  }

  const guide = styleCorpus.getStyleGuide();
  console.log('\nWriting rules learned from insider timelines:');
  for (const rule of guide.writingRules || []) console.log(`- ${rule}`);
  console.log('\nAggregate:', guide.aggregate);
  console.log('\nSaved:', styleCorpus.CORPUS_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
