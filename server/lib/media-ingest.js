const discover = require('./media-ingest-discover');
const processor = require('./media-ingest-processor');
const store = require('./media-ingest-store');
const brand = require('./media-brand');

async function runMediaIngest(options = {}) {
  const startedAt = new Date().toISOString();
  const result = {
    ok: true,
    startedAt,
    ffmpeg: brand.hasFfmpeg(),
    discover: null,
    process: null,
    errors: []
  };

  if (!brand.hasFfmpeg()) {
    result.ok = false;
    result.errors.push({
      stage: 'preflight',
      error: 'ffmpeg not found — discovery will run but processing requires ffmpeg on PATH'
    });
  }

  try {
    result.discover = await discover.discoverAll();
  } catch (err) {
    result.ok = false;
    result.errors.push({ stage: 'discover', error: err.message });
    store.pushLog({ level: 'error', stage: 'discover', message: err.message });
  }

  if (options.discoverOnly) {
    result.finishedAt = new Date().toISOString();
    return result;
  }

  try {
    const limit = parseInt(options.limit || process.env.MEDIA_INGEST_BATCH_LIMIT || '5', 10);
    result.process = await processor.processPendingQueue({ limit });
    if (result.process.failed.length) result.ok = false;
  } catch (err) {
    result.ok = false;
    result.errors.push({ stage: 'process', error: err.message });
    store.pushLog({ level: 'error', stage: 'process', message: err.message });
  }

  result.finishedAt = new Date().toISOString();
  result.status = store.getIngestStatus();
  return result;
}

module.exports = {
  runMediaIngest
};
