/**
 * GV-OM job registry — manual re-run + cron metadata.
 */
const opsMonitor = require('./ops-monitor');

/** Alternate keys accepted by POST /api/ops/run-job */
const JOB_ALIASES = {
  depth_chart_refresh: 'depth-chart-refresh',
  roster_stats_sync: 'roster-stats-sync',
  game_zone_lines: 'game-zone-refresh',
  'article-engine:weekly-draft': 'article-engine-weekly-draft'
};

const JOBS = {
  'film-room-weekly': {
    label: 'Film Room catalog refresh',
    subsystem: 'cron:film-room-weekly',
    schedule: 'Every 6h (FILM_ROOM_SYNC_ENABLED)',
    async run() {
      const { rebuildFilmRoomCatalog } = require('./film-room-feed');
      const c = rebuildFilmRoomCatalog();
      return { ok: true, count: c?.counts, processedCount: c?.counts?.total || null };
    }
  },
  'recruiting-ingest': {
    label: 'Recruiting ingest (On3)',
    subsystem: 'cron:recruiting-ingest',
    schedule: 'Every 2m (ON3_INGEST_ENABLED)',
    async run(opts = {}) {
      const { runOn3Ingest } = require('./on3-ingest');
      return runOn3Ingest(opts);
    }
  },
  'uf-closing-board-sync': {
    label: 'UF 2027 Closing Class board (247Sports)',
    subsystem: 'cron:uf-closing-board',
    schedule: 'With recruiting ingest (UF_CLOSING_BOARD_SYNC)',
    async run(opts = {}) {
      const { syncFloridaClosingBoardToStore } = require('./uf-closing-board-247');
      return syncFloridaClosingBoardToStore({ classYear: 2027, ...opts });
    }
  },
  'portal-ingest': {
    label: 'Portal sync (On3)',
    subsystem: 'cron:portal-ingest',
    schedule: 'Boot + every 6h + Render cron',
    async run(opts = {}) {
      const { syncPortalFromOn3 } = require('./on3-ingest');
      return syncPortalFromOn3({ force: true, ...opts });
    }
  },
  'nil-refresh': {
    label: 'NIL dashboard refresh',
    subsystem: 'cron:nil-ingest',
    schedule: 'Every 6h + Render platform-ops cron',
    async run() {
      const nilStore = require('./nil-store');
      const dash = nilStore.buildDashboard();
      return { ok: true, processedCount: dash?.secRankings?.length || 0, dashboard: { updatedAt: dash.updatedAt } };
    }
  },
  'live-refresh': {
    label: 'Live dashboard refresh',
    subsystem: 'cron:live-refresh',
    schedule: 'Every 3m',
    async run() {
      const { refreshLiveDashboard } = require('./live-aggregator');
      return refreshLiveDashboard();
    }
  },
  'beat-writer-ingest': {
    label: 'Beat writer visit ingest',
    subsystem: 'autoposter:beat-writer',
    schedule: 'With live refresh',
    async run(opts = {}) {
      const { runBeatWriterIngest } = require('./beat-writer-ingest');
      return runBeatWriterIngest(opts);
    }
  },
  'beat-late-ingest': {
    label: 'Beat writer late ingest sweep',
    subsystem: 'cron:beat-late-ingest',
    schedule: 'Every 5m',
    async run(opts = {}) {
      const { runBeatLateIngestSweep } = require('./beat-writer-ingest');
      return runBeatLateIngestSweep(opts);
    }
  },
  'allowlist-intel-sweep': {
    label: 'Allowlist continuous intel sweep (visits/offers → intel)',
    subsystem: 'cron:allowlist-intel-sweep',
    schedule: 'With recruiting-light cron',
    async run(opts = {}) {
      const { runAllowlistIntelSweep } = require('./allowlist-intel-sweep');
      const classYear = parseInt(opts.classYear || process.env.ALLOWLIST_INTEL_CLASS_YEAR || '2028', 10);
      return runAllowlistIntelSweep({
        classYear,
        dryRun: opts.dryRun === true,
        maxCreates: opts.maxCreates != null ? Number(opts.maxCreates) : 200,
      });
    }
  },
  'vault-feed-2028-sweep': {
    label: '2028+ vault feed (7am/7pm ET) — beat → Vault/Lab, no 2027 auto-add',
    subsystem: 'cron:vault-feed-2028-sweep',
    schedule: 'Twice daily Render cron (7am + 7pm ET)',
    async run(opts = {}) {
      const { runVaultFeed2028Sweep } = require('./vault-feed-2028-sweep');
      return runVaultFeed2028Sweep({
        dryRun: opts.dryRun === true,
        force: opts.force === true,
        maxCreates: opts.maxCreates != null ? Number(opts.maxCreates) : 40,
        lookbackHours: opts.lookbackHours != null ? Number(opts.lookbackHours) : 36,
      });
    }
  },
  'uf-on3-news-discovery': {
    label: 'UF On3 team news discovery',
    subsystem: 'cron:uf-on3-news-discovery',
    schedule: 'With beat-late-ingest sweep',
    async run(opts = {}) {
      const { runUfOn3NewsDiscovery } = require('./uf-on3-news-discovery');
      return runUfOn3NewsDiscovery(opts);
    }
  },
  'beat-visit-ingest': {
    label: 'Beat visit cancel ingest',
    subsystem: 'cron:beat-visit-ingest',
    schedule: 'With live refresh',
    async run(opts = {}) {
      const { runBeatVisitIntelIngest } = require('./beat-visit-intel-ingest');
      return runBeatVisitIntelIngest(opts);
    }
  },
  'rivals-pm-ingest': {
    label: 'Rivals PM ingest',
    subsystem: 'cron:rivals-pm-ingest',
    schedule: 'Every 5m (RIVALS_PM_INGEST_ENABLED)',
    async run() {
      const { runRivalsPredictionIngest } = require('./rivals-prediction-ingest');
      return runRivalsPredictionIngest();
    }
  },
  'lab-intel-promote': {
    label: 'FutureCast Lab intel promote (offer/OV/prediction → board)',
    subsystem: 'cron:lab-intel-promote',
    schedule: 'With recruiting ingest + on demand',
    async run(opts = {}) {
      const { runLabIntelPromote } = require('./lab-intel-promote');
      return runLabIntelPromote({ dryRun: opts.dryRun === true });
    }
  },
  'media-ingest': {
    label: 'Media ingest',
    subsystem: 'cron:media-ingest',
    schedule: 'Every 15m (MEDIA_INGEST_ENABLED)',
    async run() {
      const { runMediaIngest } = require('./media-ingest');
      return runMediaIngest();
    }
  },
  'x-autoposter-run': {
    label: 'X autoposter queue processor',
    subsystem: 'autoposter:queue',
    schedule: 'Every 60s (X_AUTOPOST_ENABLED)',
    async run(opts = {}) {
      const autoposter = require('./x-autoposter');
      const fill = require('./x-autoposter-fill');
      const store = require('./x-autoposter-store');
      const refill = await fill.refillAutoposterQueue({
        minPending: parseInt(process.env.X_AUTOPOST_REFILL_MIN_PENDING || '5', 10),
        maxEnqueue: parseInt(process.env.X_AUTOPOST_REFILL_MAX_ENQUEUE || '8', 10),
        forcePost: opts.force === true,
        digDeeper: opts.digDeeper === true || opts.force === true
      });
      let processed = { processed: 0, skipped: true, reason: 'no_processor' };
      if (typeof autoposter.processDuePosts === 'function') {
        processed = await autoposter.processDuePosts({
          force: opts.force === true,
          limit: opts.limit || 1
        });
      }
      return {
        ok: true,
        pending: store.listQueue({ status: 'pending' }).length,
        refill,
        ...processed
      };
    }
  },
  'depth-chart-refresh': {
    label: 'Depth chart / roster refresh',
    subsystem: 'cron:depth-chart',
    schedule: 'Every 6h (DEPTH_CHART_ENABLED)',
    async run() {
      const { refreshDepthChart } = require('./depth-chart-jobs');
      return refreshDepthChart();
    }
  },
  'roster-stats-sync': {
    label: 'Roster CFBD production stats sync',
    subsystem: 'cron:roster-stats',
    schedule: 'Nightly (ROSTER_STATS_SYNC_ENABLED)',
    async run(opts = {}) {
      const { syncRosterProductionStats } = require('./roster-production-stats-sync');
      return syncRosterProductionStats(opts);
    }
  },
  'game-zone-refresh': {
    label: 'Game Zone lines refresh',
    subsystem: 'cron:game-zone',
    schedule: 'Every 6h (GAME_ZONE_ENABLED)',
    async run() {
      const { refreshLines } = require('./betting-lines');
      return refreshLines();
    }
  },
  'article-engine-weekly-draft': {
    label: 'Insider Articles weekly draft generator',
    subsystem: 'cron:article-engine',
    schedule: 'Weekly (ARTICLE_ENGINE_ENABLED)',
    async run(opts = {}) {
      const { generateWeeklyDrafts } = require('./insider-articles-engine');
      return generateWeeklyDrafts({ force: opts.force === true });
    }
  },
  'identity-patterns-rebuild': {
    label: 'Identity patterns full rebuild',
    subsystem: 'cron:identity-patterns',
    schedule: 'Manual / boot',
    async run() {
      const patternStore = require('./identity-patterns-store');
      return patternStore.rebuildAllPatterns();
    }
  },
  'ops-healthcheck': {
    label: 'Full ops health evaluation',
    subsystem: 'ops:healthcheck',
    schedule: 'Manual / cron',
    async run() {
      const { buildOpsStatusReport } = require('./ops-status');
      const report = await buildOpsStatusReport({ evaluateAlerts: true });
      return { ok: report.healthy !== false, report };
    }
  },
  'platform-health-sweep': {
    label: 'Platform health sweep (auto-heal stale tiles)',
    subsystem: 'ops:platform-sweep',
    schedule: 'Every 6h (PLATFORM_HEALTH_SWEEP_INTERVAL_MS)',
    async run(opts = {}) {
      const { runPlatformHealthSweep } = require('./platform-health-sweep');
      return runPlatformHealthSweep({ force: opts.force === true });
    }
  },
  'api-keepalive': {
    label: 'Render API keep-alive ping',
    subsystem: 'cron:api-keepalive',
    schedule: 'Every 12m (Render cron)',
    async run() {
      const { spawnSync } = require('child_process');
      const path = require('path');
      const script = path.join(__dirname, '..', 'scripts', 'render-keepalive-ping.js');
      const out = spawnSync(process.execPath, [script], {
        encoding: 'utf8',
        env: process.env,
      });
      if (out.status !== 0) {
        throw new Error(out.stderr || out.stdout || 'keepalive ping failed');
      }
      return { ok: true, output: (out.stdout || '').trim() };
    }
  },
  'qa-crawler': {
    label: 'QA crawler (full site + API)',
    subsystem: 'qa:crawler',
    schedule: 'Every 5m (QA_CRAWLER_ENABLED)',
    async run(opts = {}) {
      const { runQaCrawl } = require('./qa/qa-runner');
      return runQaCrawl({ force: opts.force !== false });
    }
  },
  'scouting-update': {
    label: 'War Room continuous scouting update (all players)',
    subsystem: 'cron:scouting-update',
    schedule: 'Every 6h (SCOUTING_UPDATE_ENABLED)',
    async run(opts = {}) {
      const { runContinuousScoutingUpdate } = require('./scouting-update-engine');
      return runContinuousScoutingUpdate({
        reason: opts.reason || 'ops_job',
        delayMs: parseInt(process.env.SCOUTING_UPDATE_DELAY_MS || '400', 10),
        playerSlug: opts.playerSlug || null
      });
    }
  },
  'self-runner-scan': {
    label: 'Self-Runner 2.0 platform blueprint scan',
    subsystem: 'self-runner:v2',
    schedule: 'On demand / after QA generate',
    async run(opts = {}) {
      const { runPlatformScanAndEnqueue } = require('./self-runner/self-runner-v2-engine');
      return runPlatformScanAndEnqueue({
        includeBlueprint: !!opts.includeBlueprint,
        enqueue: opts.enqueue !== false
      });
    }
  },
  'feed-repair': {
    label: 'Repair feed-items.json (SHA-256 dedupe integrity)',
    subsystem: 'live:feed-repair',
    schedule: 'On demand after deploy',
    async run() {
      const liveStore = require('./live-store');
      const result = liveStore.repairFeedItems();
      return {
        ok: result.validation?.ok !== false,
        before: result.before,
        after: result.after,
        removedCount: result.removedCount,
        rejectedCount: result.rejectedCount,
        validation: result.validation
      };
    }
  },
  'visit-intel-reconcile': {
    label: 'FutureCast visit intel reconcile (Supabase + JSON store)',
    subsystem: 'cron:visit-intel-reconcile',
    schedule: 'Every 3h Render cron + hub refresh + platform-ops',
    async run(opts = {}) {
      const { reconcileVisitIntelInStore } = require('./expire-stale-visit-intel');
      return reconcileVisitIntelInStore({
        dryRun: opts.dryRun === true,
        asOf: opts.asOf,
      });
    }
  },
  'reconcile-committed-targets': {
    label: 'Remove UF commits from target-board seeds',
    subsystem: 'recruiting:commit-target-cleanup',
    schedule: 'Boot + after commitment sync + on demand',
    async run(opts = {}) {
      const store = require('./recruiting-store');
      const { reconcileCommittedTargetsFromStore } = require('./commit-target-cleanup');
      return reconcileCommittedTargetsFromStore(store, {
        source: opts.source || 'ops_job',
        quiet: opts.quiet !== false,
        rootDir: opts.rootDir,
      });
    }
  },
  'commitment-sync': {
    label: 'Commitment reconciliation (On3 + Rivals allowlist)',
    subsystem: 'cron:commitment-sync',
    schedule: 'With On3 ingest (COMMITMENT_SYNC)',
    async run(opts = {}) {
      const { reconcileCommitments } = require('./allowlist-target-sync');
      return reconcileCommitments(opts);
    }
  },
  'product-intel-recompute': {
    label: 'Product Intelligence recompute from latest QA run',
    subsystem: 'product-intel:recompute',
    schedule: 'After QA crawl + on demand',
    async run(opts = {}) {
      const scheduler = require('./product-intel/product-intel-scheduler');
      const engine = require('./product-intel/product-intel-engine');
      const weekly = opts.weekly === true;
      if (opts.fromDeploy === true) {
        return engine.recomputeFromDeployProbes({ source: opts.source || 'ops_job' });
      }
      if (opts.runQaFirst === true) {
        const { runQaCrawl } = require('./qa/qa-runner');
        await runQaCrawl({ force: true });
      }
      return scheduler.syncIfStale({ force: opts.force !== false, daily: true, weekly });
    }
  },
  'app-store-gate-record': {
    label: 'Record App Store 7-day gate sample from live QA + PI health',
    subsystem: 'ops:app-store-gate',
    schedule: 'After QA crawl; on demand when crawl blocked by memory',
    async run(opts = {}) {
      const gate = require('./app-store-stability-gate');
      const snap = gate.buildSnapshot({ healthReady: opts.healthReady !== false });
      if (!opts.force && !snap.evaluation.green) {
        return {
          ok: false,
          skipped: true,
          reason: 'sample_not_green',
          evaluation: snap.evaluation,
          sample: snap.sample,
        };
      }
      const recorded = gate.recordDailySample(
        {
          qaPass: snap.sample.qaPass,
          healthReady: snap.sample.healthReady,
          productIntelOverall: snap.sample.productIntelOverall,
          crawlerFailed: snap.sample.crawlerFailed || 0,
          apiFailed: snap.sample.apiFailed || 0,
        },
        { force: opts.force === true }
      );
      return {
        ok: true,
        consecutiveGreenDays: recorded.consecutiveGreenDays,
        readyForSubmission: recorded.readyForSubmission,
        evaluation: snap.evaluation,
        recorded,
      };
    }
  },
  'visit-intel-recap': {
    label: 'FutureCast weekly verified OV recap (+ optional X queue)',
    subsystem: 'cron:visit-intel-recap',
    schedule: 'Mondays 14:00 UTC Render cron',
    async run(opts = {}) {
      const { runVisitIntelRecap } = require('./visit-intel-recap');
      return runVisitIntelRecap({
        dryRun: opts.dryRun === true,
        queueX: opts.queueX !== false,
        asOf: opts.asOf,
      });
    }
  },
  'visit-intel-daily-digest': {
    label: 'FutureCast daily verified OV email digest',
    subsystem: 'cron:visit-intel-daily-digest',
    schedule: 'Daily 14:00 UTC Render cron',
    async run(opts = {}) {
      const { runVisitIntelDailyDigest } = require('./visit-intel-recap');
      return runVisitIntelDailyDigest({
        dryRun: opts.dryRun === true,
        asOf: opts.asOf,
      });
    }
  },
  'gators-score-alerts': {
    label: 'UF kickoff / score / halftime / final push alerts (game window only)',
    subsystem: 'cron:gators-score-alerts',
    schedule: 'Every 2 min + 60s web watch during UF windows',
    async run(opts = {}) {
      const { runGatorsScoreAlerts } = require('./gators-score-alerts');
      return runGatorsScoreAlerts({
        dryRun: opts.dryRun === true,
        force: opts.force === true,
        kind: opts.kind,
        asOf: opts.asOf,
      });
    }
  },
  'push-alert-test': {
    label: 'Send test lock-screen push to one member email',
    subsystem: 'ops:push-alert-test',
    schedule: 'Manual',
    async run(opts = {}) {
      const email = String(opts.email || '').trim().toLowerCase();
      if (!email) return { ok: false, error: 'email required' };
      const { dispatchTestPushToEmail } = require('./push-alert-service');
      return dispatchTestPushToEmail(email, {
        kind: opts.kind || 'confirm',
        dryRun: opts.dryRun === true,
        fingerprint: opts.force
          ? `push_test_force|${email}|${opts.kind || 'confirm'}|${Date.now()}`
          : undefined,
      });
    }
  },
  'pending-visit-alerts': {
    label: 'Process pending visit alert queue (push + email)',
    subsystem: 'ops:pending-visit-alerts',
    schedule: 'Boot + manual',
    async run(opts = {}) {
      const { processPendingVisitAlerts } = require('./pending-visit-alerts');
      return processPendingVisitAlerts({
        dryRun: opts.dryRun === true,
        operatorEmails: opts.operatorEmails,
        asOf: opts.asOf,
      });
    }
  },
  'uf-trend-snapshot': {
    label: 'FutureCast daily UF % trend snapshots',
    subsystem: 'cron:uf-trend-snapshot',
    schedule: 'Daily 15:00 UTC Render cron',
    async run(opts = {}) {
      const { runDailyUfTrendSnapshot } = require('./uf-trend-snapshot');
      return runDailyUfTrendSnapshot({
        dryRun: opts.dryRun === true,
        asOf: opts.asOf,
      });
    }
  },
  'uf-fit-seed': {
    label: 'Weekly UF Fit sub-score seed for target board',
    subsystem: 'cron:uf-fit-seed',
    schedule: 'Weekly Sunday 04:00 UTC Render cron',
    async run(opts = {}) {
      const { spawnSync } = require('child_process');
      const path = require('path');
      const yearsRaw = opts.classYears || process.env.UF_FIT_SEED_CLASS_YEARS || '2027,2028';
      const classYears = String(yearsRaw)
        .split(',')
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const results = [];
      for (const classYear of classYears) {
        const args = [
          '--import',
          'tsx',
          path.join(__dirname, '..', 'scripts', 'seed-uf-fit-scores.js'),
          `--class-year=${classYear}`,
        ];
        if (opts.dryRun === true) args.push('--dry-run');
        const result = spawnSync(process.execPath, args, {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit',
          env: process.env,
        });
        results.push({ classYear, ok: result.status === 0 });
      }
      return { ok: results.every((r) => r.ok), results, dryRun: opts.dryRun === true };
    }
  },
  'early-discovery': {
    label: 'Weekly Early Discovery score recompute (2028+ HS)',
    subsystem: 'cron:early-discovery',
    schedule: 'Weekly Sunday 05:00 UTC Render cron',
    async run(opts = {}) {
      const { runEarlyDiscoveryJob } = require('../lib/early-discovery-run.js');
      return runEarlyDiscoveryJob({
        classYearGte: opts.classYearGte || 2028,
        dryRun: opts.dryRun === true,
      });
    }
  },
  'allowlist-futurecast-provision': {
    label: 'Seed MODEL predictions for 2028 allowlist (movement deltas)',
    subsystem: 'cron:allowlist-futurecast-provision',
    schedule: 'After early-discovery or on demand',
    async run(opts = {}) {
      const { runAllowlistFuturecastProvision } = require('./allowlist-futurecast-provision');
      return runAllowlistFuturecastProvision({
        classYear: opts.classYear || 2028,
        dryRun: opts.dryRun === true,
      });
    }
  },
  'editorial-younger-prospects-sync': {
    label: 'Sync locked 2028 Younger Prospects editorial board to store + Postgres',
    subsystem: 'cron:editorial-younger-prospects',
    schedule: 'On demand via ops:futurecast',
    async run() {
      const { spawnSync } = require('child_process');
      const path = require('path');
      const result = spawnSync(
        process.execPath,
        [path.join(__dirname, '..', 'scripts', 'sync-underclassmen-editorial-positions.js')],
        { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
      );
      return { ok: result.status === 0 };
    }
  },
  'portal-intelligence': {
    label: 'Daily portal likelihood recompute for college/portal candidates',
    subsystem: 'cron:portal-intelligence',
    schedule: 'Portal windows only (Dec–Jan, Apr–May); skipped off-season',
    async run(opts = {}) {
      const { shouldRunPortalIntelJob } = require('./recruiting-cycle.ts');
      if (opts.force !== true && process.env.PORTAL_INTEL_FORCE_RUN !== 'true' && !shouldRunPortalIntelJob()) {
        return {
          ok: true,
          skipped: true,
          reason: 'portal-window-closed',
          at: new Date().toISOString(),
        };
      }
      require('tsx/cjs');
      const { runPortalIntelJob } = require('../engines/futurecast/portal-intel/pipeline.ts');
      return runPortalIntelJob({
        limit: opts.limit || 200,
        dryRun: opts.dryRun === true,
      });
    }
  },
  'prediction-radar-promote': {
    label: 'Promote named prediction prospect to Lab/watchlist radar',
    subsystem: 'recruiting:auto-radar',
    schedule: 'On demand (teaser resolve recovery)',
    async run(opts = {}) {
      const slug = String(opts.slug || opts.playerSlug || '').trim().toLowerCase();
      if (!slug) return { ok: false, error: 'slug required' };
      const { promoteResolvedPredictionToRadar } = require('./lab-intel-promote');
      return promoteResolvedPredictionToRadar({
        slug,
        name: opts.name || opts.playerName || null,
        classYear: opts.classYear || 2028,
        reasons: opts.reasons || ['on3_rpm', 'teaser_identity', 'ops_promote'],
        sources: opts.sources || ['ops:prediction-radar-promote'],
        fetchRpm: opts.fetchRpm !== false,
        dryRun: opts.dryRun === true,
      });
    }
  },
  'on3-rpm-allowlist-sync': {
    label: 'On3 RPM UF % sync — allowlist + UF-active inventory (missing Rivals PM)',
    subsystem: 'cron:on3-rpm-allowlist',
    schedule: 'Daily after uf-trend-snapshot or on demand',
    async run(opts = {}) {
      const { syncAllowlistOn3Rpm } = require('./on3-rpm-allowlist');
      return syncAllowlistOn3Rpm({
        dryRun: opts.dryRun === true,
        fetch: opts.fetch !== false,
        classYear: opts.classYear,
        scope: opts.scope || process.env.ON3_RPM_SYNC_SCOPE || 'all',
        maxInventory: opts.maxInventory,
        writePlayers: opts.writePlayers !== false,
      });
    }
  },
  'allowlist-on3-rankings': {
    label: 'On3 composite + rank sync for UF allowlist targets',
    subsystem: 'cron:allowlist-on3-rankings',
    schedule: 'Weekly Sunday 16:00 UTC Render cron + platform-ops fallback',
    async run(opts = {}) {
      const { syncAllowlistTargetsFromOn3 } = require('./allowlist-target-sync.js');
      const classYear = Number(
        opts.classYear || process.env.ALLOWLIST_ON3_RANKINGS_CLASS_YEAR || 2028
      );
      const limit = Number(opts.limit || 0);
      const result = await syncAllowlistTargetsFromOn3({
        classYear,
        limit: limit > 0 ? limit : undefined,
      });
      return { ok: true, classYear, result };
    }
  },
  'player-intelligence-tier-a': {
    label: 'Refresh Tier A player intelligence (board + golden + allowlist)',
    subsystem: 'cron:player-intelligence-tier-a',
    schedule: 'Daily — rankings, gaps, observations for UF-priority players',
    async run(opts = {}) {
      const { refreshTierAIntelligence } = require('./player-intelligence-refresh');
      return refreshTierAIntelligence({
        limit: Number(opts.limit || 0) || undefined,
        verbose: opts.verbose === true
      });
    }
  },
  'golden-four-on3-sync': {
    label: 'Sync golden four On3 rankings (Ham, Drakeford, Robinson, Willingham)',
    subsystem: 'cron:golden-four-on3-sync',
    schedule: 'On demand — verified On3 recruit slugs for PR-789 rollout',
    async run() {
      const {
        syncAllGoldenFourFromOn3,
        refreshGoldenFourRankingCache
      } = require('./player-intelligence/golden-four-on3');
      const result = await syncAllGoldenFourFromOn3();
      await refreshGoldenFourRankingCache();
      return result;
    }
  },
  'golden-four-enqueue': {
    label: 'Enqueue golden-four elite posts (Drakeford → Robinson → Willingham)',
    subsystem: 'autoposter:golden-four-enqueue',
    schedule: 'On demand — PR-789 elite compose + queue',
    async run(opts = {}) {
      const { enqueueGoldenFourPosts } = require('./player-intelligence/golden-four-enqueue');
      return enqueueGoldenFourPosts({
        slugs: opts.slugs,
        includeHam: opts.includeHam === true,
        clearPendingNonGolden: opts.clearPendingNonGolden !== false,
        scheduleGapMs: opts.scheduleGapMs
      });
    }
  },
  'self-runner-purge-legacy-dedupe': {
    label: 'Reject legacy addDedupeRule Self-Runner proposals',
    subsystem: 'self-runner:cleanup',
    schedule: 'On demand after dedupe engine deploy',
    async run() {
      const { purgeLegacyDedupeProposals } = require('./self-runner/self-runner-queue-cleanup');
      return purgeLegacyDedupeProposals({ reject: true });
    }
  },
  'post-deploy-feed-cleanup': {
    label: 'Feed repair + purge legacy dedupe proposals + Self-Runner scan',
    subsystem: 'live:post-deploy-cleanup',
    schedule: 'On demand after Self-Runner 2.0 deploy',
    async run(opts = {}) {
      const liveStore = require('./live-store');
      const { purgeLegacyDedupeProposals } = require('./self-runner/self-runner-queue-cleanup');
      const repair = liveStore.repairFeedItems();
      const purge = purgeLegacyDedupeProposals({ reject: true });
      let scan = null;
      if (opts.skipScan !== true) {
        const { runPlatformScanAndEnqueue } = require('./self-runner/self-runner-v2-engine');
        scan = await runPlatformScanAndEnqueue({ includeBlueprint: false, enqueue: true });
      }
      return {
        ok: repair.validation?.ok !== false,
        repair: {
          before: repair.before,
          after: repair.after,
          removedCount: repair.removedCount,
          rejectedCount: repair.rejectedCount,
          validation: repair.validation
        },
        purge,
        scan: scan
          ? {
              scanId: scan.scanId,
              issueCount: scan.issueCount,
              patchCount: scan.patchCount,
              enqueued: scan.enqueued?.length ?? 0
            }
          : null
      };
    }
  }
};

function resolveJobId(jobId) {
  if (!jobId) return jobId;
  return JOB_ALIASES[jobId] || jobId;
}

function listJobs() {
  return Object.entries(JOBS).map(([id, job]) => ({
    id,
    label: job.label,
    subsystem: job.subsystem,
    schedule: job.schedule,
    aliases: Object.entries(JOB_ALIASES)
      .filter(([, canonical]) => canonical === id)
      .map(([alias]) => alias)
  }));
}

async function runJob(jobId, opts = {}) {
  const resolvedId = resolveJobId(jobId);
  opsMonitor.logEvent({
    subsystem: 'ops:run-job',
    status: 'started',
    message: `Job received: ${jobId}`,
    details: { jobId, resolvedId: resolvedId !== jobId ? resolvedId : undefined }
  });

  try {
    const { shouldBlockOpsJob, stayGreenSkipPayload } = require('./api-stay-green');
    if (shouldBlockOpsJob(resolvedId) || shouldBlockOpsJob(jobId)) {
      const skipped = stayGreenSkipPayload(`ops:${resolvedId || jobId}`);
      console.log('[ops-jobs] stay-green skip', resolvedId || jobId);
      return { jobId: resolvedId || jobId, requestedId: jobId, result: skipped };
    }
  } catch {
    /* optional */
  }

  const job = JOBS[resolvedId];
  if (!job) {
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: 'error',
      message: `Job failed: ${jobId}`,
      details: { jobId, resolvedId, reason: 'UNKNOWN_JOB' }
    });
    const err = new Error(`Unknown job: ${jobId}`);
    err.code = 'UNKNOWN_JOB';
    throw err;
  }

  opsMonitor.logEvent({
    subsystem: 'ops:run-job',
    status: 'started',
    message: `Job started: ${resolvedId}`,
    details: { jobId, resolvedId, label: job.label }
  });

  try {
    const result = await opsMonitor.wrapJob(resolvedId, job.subsystem, () => job.run(opts), {
      message: `${job.label} manual run`
    });

    const failed = result && result.ok === false && !result.skipped;
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: failed ? 'error' : 'success',
      message: failed ? `Job failed: ${resolvedId}` : `Job completed: ${resolvedId}`,
      details: {
        jobId,
        resolvedId,
        result: result && typeof result === 'object' ? { ok: result.ok, skipped: result.skipped, reason: result.reason, updatedAt: result.updatedAt, processedCount: result.processedCount } : result
      }
    });

    return { jobId: resolvedId, requestedId: jobId, result };
  } catch (err) {
    opsMonitor.logEvent({
      subsystem: 'ops:run-job',
      status: 'error',
      message: `Job failed: ${resolvedId}`,
      details: { jobId, resolvedId, error: err.message }
    });
    throw err;
  }
}

module.exports = {
  JOBS,
  JOB_ALIASES,
  listJobs,
  resolveJobId,
  runJob
};
