const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const store = require('./media-ingest-store');
const brand = require('./media-brand');

async function downloadToFile(url, destPath) {
  const res = await fetch(url, { timeout: 120000 });
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = await res.buffer();
  fs.writeFileSync(destPath, buf);
  return destPath;
}

async function ensureRawInput(item) {
  const rawDir = store.resolveServerPath('media/ingest/raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `${item.id}.mp4`);

  if (item.localPath && fs.existsSync(item.localPath)) {
    if (path.resolve(item.localPath) !== path.resolve(rawPath)) {
      fs.copyFileSync(item.localPath, rawPath);
    }
    return rawPath;
  }

  if (item.sourceUrl) {
    await downloadToFile(item.sourceUrl, rawPath);
    return rawPath;
  }

  throw new Error('Queue item has no localPath or sourceUrl');
}

async function processQueueItem(item) {
  store.updateQueueItem(item.id, { status: 'processing' });

  if (!brand.hasFfmpeg()) {
    throw new Error('ffmpeg not available — install ffmpeg on the server (see docs/media-ingest-setup.md)');
  }

  const rawPath = await ensureRawInput(item);
  const workDir = store.resolveServerPath(path.join('media/ingest/work', item.id));
  const mediaDir =
    item.kind === 'interview'
      ? store.resolveServerPath('media/interviews')
      : store.resolveServerPath('media/highlights');
  const posterDir =
    item.kind === 'interview'
      ? store.resolveServerPath('media/interviews/posters')
      : store.resolveServerPath('media/highlights/posters');

  const slugSet =
    item.kind === 'interview' ? store.loadInterviewSlugs() : store.loadHighlightSlugs();
  const slug = store.uniqueSlug(item.title || item.id, slugSet);
  const outputPath = path.join(mediaDir, `${slug}.mp4`);
  const posterPath = path.join(posterDir, `${slug}.jpg`);

  const brandResult = brand.trimAndBrandClip({
    inputPath: rawPath,
    outputPath,
    workDir,
    title: item.title,
    subtitle: item.gameLine || item.category,
    category: item.category,
    durationSec: item.durationSec,
    skipIntroSec: item.skipIntroSec,
    skipOutroSec: item.skipOutroSec
  });

  brand.generatePosterFromVideo(outputPath, posterPath);

  const relVideo = item.kind === 'interview' ? `/media/interviews/${slug}.mp4` : `/media/highlights/${slug}.mp4`;
  const relPoster = item.kind === 'interview'
    ? `/media/interviews/posters/${slug}.jpg`
    : `/media/highlights/posters/${slug}.jpg`;

  const clip = {
    id: `ingest-${item.id}`,
    ingestId: item.id,
    slug,
    title: item.title,
    dek: item.dek || '',
    gameLine: item.gameLine || '',
    season: item.season || String(new Date().getFullYear()),
    category: item.category,
    duration: brandResult.durationLabel,
    thumbUrl: fs.existsSync(posterPath) ? relPoster : null,
    videoUrl: relVideo,
    featured: !!item.featured,
    playerSlugs: item.playerSlugs || [],
    gameSlug: item.gameSlug || null,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    ingestSource: item.sourceType,
    publishedAt: new Date().toISOString()
  };

  if (item.kind === 'interview') store.appendInterview(clip);
  else store.appendHighlight(clip);

  store.markSeen(item.id);
  store.updateQueueItem(item.id, {
    status: 'ready',
    slug,
    outputPath: relVideo,
    processedAt: new Date().toISOString()
  });

  if (item.sourceType === 'inbox' && item.localPath && fs.existsSync(item.localPath)) {
    const processedDir = path.join(path.dirname(item.localPath), '_processed');
    fs.mkdirSync(processedDir, { recursive: true });
    const dest = path.join(processedDir, path.basename(item.localPath));
    try {
      fs.renameSync(item.localPath, dest);
      const sidecar = item.localPath.replace(/\.mp4$/i, '.meta.json');
      if (fs.existsSync(sidecar)) fs.renameSync(sidecar, dest.replace(/\.mp4$/i, '.meta.json'));
    } catch {
      /* inbox cleanup is best-effort */
    }
  }

  store.pushLog({
    level: 'success',
    stage: 'process',
    kind: item.kind,
    slug,
    title: item.title,
    sourceId: item.sourceId
  });

  return { clip, brandResult };
}

async function processPendingQueue({ limit = 5 } = {}) {
  const queue = store.loadQueue().filter((q) => q.status === 'pending');
  const batch = queue.slice(0, limit);
  const results = { processed: [], failed: [] };

  for (const item of batch) {
    try {
      const out = await processQueueItem(item);
      results.processed.push(out);
    } catch (err) {
      store.updateQueueItem(item.id, { status: 'failed', error: err.message });
      store.pushLog({
        level: 'error',
        stage: 'process',
        id: item.id,
        title: item.title,
        message: err.message
      });
      results.failed.push({ id: item.id, error: err.message });
    }
  }

  return results;
}

module.exports = {
  processQueueItem,
  processPendingQueue,
  ensureRawInput
};
