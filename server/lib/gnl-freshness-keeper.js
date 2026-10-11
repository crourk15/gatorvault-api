/**
 * Keep Gator Nation Live moving without a sync warm on /health.
 *
 * Every minute: re-read the beat file into the dashboard snapshot (async).
 * If that file is older than 15 minutes, the 10-minute beat cron missed a
 * cycle — pull writers once, then wait out the full window before trying again.
 * Never call this from the dashboard GET. X pulls stay off the request path.
 */
const DEFAULT_TICK_MS = 60 * 1000;
const DEFAULT_BEAT_MAX_AGE_MS = 15 * 60 * 1000;

let started = false;
let beatInFlight = false;
let nextBeatAttemptAt = 0;

function beatNeedsRefresh(fetchedAt, now = Date.now(), maxAgeMs = DEFAULT_BEAT_MAX_AGE_MS) {
  const fetched = Date.parse(fetchedAt || '') || 0;
  if (!fetched) return true;
  return now - fetched >= maxAgeMs;
}

function startGnlFreshnessKeeper() {
  if (process.env.GNL_FRESHNESS_KEEPER === 'false') {
    console.log('[gnl-freshness] keeper off (GNL_FRESHNESS_KEEPER=false)');
    return;
  }
  if (started) return;
  started = true;

  const tickMs = Math.max(
    30000,
    parseInt(process.env.GNL_SNAPSHOT_REFRESH_MS || String(DEFAULT_TICK_MS), 10) || DEFAULT_TICK_MS
  );
  const beatMaxAgeMs = Math.max(
    5 * 60 * 1000,
    parseInt(process.env.GNL_BEAT_MAX_AGE_MS || String(DEFAULT_BEAT_MAX_AGE_MS), 10) || DEFAULT_BEAT_MAX_AGE_MS
  );

  const tick = () => {
    try {
      const dash = require('./live-dashboard-cache');
      dash.scheduleAsyncWarm();
      if (beatInFlight || Date.now() < nextBeatAttemptAt) return;
      const guards = require('./pipeline-guards');
      if (guards.shouldSkipHeavyJob('gnl-beat-keeper')) return;
      const liveBeat = require('./live-beat');
      const beat = liveBeat.getBeatPosts(1);
      if (!beatNeedsRefresh(beat && beat.fetchedAt, Date.now(), beatMaxAgeMs)) return;
      beatInFlight = true;
      nextBeatAttemptAt = Date.now() + beatMaxAgeMs;
      console.log('[gnl-freshness] beat file is stale — pulling writers');
      Promise.resolve()
        .then(() => liveBeat.refreshBeatStream())
        .then(() => {
          console.log('[gnl-freshness] beat refresh done');
        })
        .catch((err) => console.warn('[gnl-freshness] beat refresh:', err.message))
        .finally(() => {
          beatInFlight = false;
          try {
            dash.scheduleAsyncWarm();
          } catch {
            /* snapshot rebuild is best-effort */
          }
        });
    } catch (err) {
      console.warn('[gnl-freshness] tick:', err.message);
    }
  };

  const timer = setInterval(tick, tickMs);
  timer.unref?.();
  console.log(
    '[gnl-freshness] keeper on every',
    Math.round(tickMs / 1000),
    's; beat pull if older than',
    Math.round(beatMaxAgeMs / 60000),
    'min'
  );
}

module.exports = {
  startGnlFreshnessKeeper,
  beatNeedsRefresh,
  DEFAULT_TICK_MS,
  DEFAULT_BEAT_MAX_AGE_MS
};
