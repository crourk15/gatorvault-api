// === ADD TO server.js (after mountRecruitingRoutes(app);) ===

function startOn3IngestScheduler() {
  if (process.env.ON3_INGEST_ENABLED !== 'true') return;
  const { runOn3Ingest } = require('./lib/on3-ingest');
  const intervalMs = Math.max(60000, parseInt(process.env.ON3_INGEST_INTERVAL_MS || '120000', 10) || 120000);
  const bootDelay = Math.max(5000, parseInt(process.env.ON3_INGEST_BOOT_DELAY_MS || '15000', 10) || 15000);

  const tick = () => {
    runOn3Ingest()
      .then((r) => {
        if (r.fired && r.fired.length) {
          console.log('[on3-ingest] fired', r.fired.length, 'event(s)');
        }
      })
      .catch((err) => console.warn('[on3-ingest]', err.message));
  };

  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('On3 ingest: enabled (every', Math.round(intervalMs / 1000), 's)');
}

// === ADD INSIDE app.listen callback (after recruiting API ready log) ===
  try {
    startOn3IngestScheduler();
  } catch (e) {
    console.warn('On3 ingest scheduler failed to start', e.message);
  }
