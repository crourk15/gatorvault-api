/**
 * Canonical platform wiring manifest — single source of truth for guardian checks.
 */
module.exports = {
  /** Files that must exist on disk (Linux case-sensitive paths). */
  CRITICAL_FILES: [
    'server.js',
    'lib/health.js',
    'lib/insider-articles-routes.js',
    'lib/insider-articles-store.js',
    'lib/insider-articles-engine.js',
    'lib/gm2/gm2-routes.js',
    'lib/gm2/index.js',
    'lib/product-intel/product-intel-routes.js',
    'lib/product-intel/product-intel-store.js',
    'lib/self-runner/self-runner-routes.js',
    'lib/self-runner/self-runner-engine.js',
    'lib/live-routes.js',
    'lib/live-store.js',
    'lib/live-feed-dedup.js',
    'lib/live-dashboard-cache.js',
    'lib/recruiting-routes.js',
    'lib/ops-routes.js',
    'lib/qa-routes.js'
  ],

  /** Route modules server.js must wire — file path relative to server root, expected export. */
  ROUTE_WIRING: [
    { id: 'recruiting', file: 'lib/recruiting-routes', export: 'mountRecruitingRoutes' },
    { id: 'content', file: 'lib/content-routes', export: 'mountContentRoutes' },
    { id: 'community', file: 'lib/community-routes', export: 'mountCommunityRoutes' },
    { id: 'roster', file: 'lib/roster-routes', export: 'mountRosterRoutes' },
    { id: 'live', file: 'lib/live-routes', export: 'mountLiveRoutes' },
    { id: 'highlights', file: 'lib/highlights-routes', export: 'mountHighlightsRoutes' },
    { id: 'interviews', file: 'lib/interviews-routes', export: 'mountInterviewsRoutes' },
    { id: 'media-ingest', file: 'lib/media-ingest-routes', export: 'mountMediaIngestRoutes' },
    { id: 'war-room', file: 'lib/war-room-routes', export: 'mountWarRoomRoutes' },
    { id: 'platform', file: 'lib/platform-routes', export: 'mountPlatformRoutes' },
    { id: 'x-autoposter', file: 'lib/x-autoposter-routes', export: 'mountXAutoposterRoutes' },
    { id: 'monitoring', file: 'lib/monitoring-routes', export: 'mountMonitoringRoutes' },
    { id: 'admin', file: 'lib/admin-routes', export: 'mountAdminRoutes' },
    { id: 'film-room-knowledge', file: 'lib/film-room-knowledge-routes', export: 'mountFilmRoomKnowledgeRoutes' },
    { id: 'nil', file: 'lib/nil-routes', export: 'mountNilRoutes' },
    { id: 'ops', file: 'lib/ops-routes', export: 'mountOpsRoutes' },
    { id: 'team-staff', file: 'lib/team-staff-routes', export: 'mountTeamStaffRoutes' },
    { id: 'qa', file: 'lib/qa-routes', export: 'mountQaRoutes' },
    { id: 'product-intel', file: 'lib/product-intel/product-intel-routes', export: 'mountProductIntelRoutes' },
    { id: 'gm2', file: 'lib/gm2/gm2-routes', export: 'mountGm2Routes' },
    { id: 'vault-grade-admin', file: 'lib/vault-grade-admin-routes', export: 'mountVaultGradeAdminRoutes' },
    { id: 'self-runner', file: 'lib/self-runner/self-runner-routes', export: 'mountSelfRunnerRoutes' },
    { id: 'insider-articles', file: 'lib/insider-articles-routes', export: 'mountInsiderArticlesRoutes' }
  ],

  /** Side-effect routers: require('./lib/...')(app) */
  SIDE_EFFECT_ROUTERS: ['lib/health.js', 'lib/ops-restart.js', 'lib/redeploy.js'],

  /** Subsystems checked at runtime for /api/health. */
  RUNTIME_SYSTEMS: ['db', 'insiderArticles', 'gm2', 'productIntel', 'selfRunner']
};
