/**
 * GM 2.0 — shared types and feature identifiers.
 */
const GM2_FEATURES = Object.freeze({
  RECRUITING_ALERTS: 'recruiting_alerts',
  HEAT_CHECK: 'heat_check',
  VISIT_RECAP: 'visit_recap',
  PROGRAM_PULSE: 'program_pulse',
  PROGRAM_NEWS: 'program_news',
  PORTAL_TRACKER: 'portal_tracker',
  AUTOPOSTER: 'autoposter',
  PLAYER_PAGE: 'player_page',
  BOARD: 'board',
  LIVE_FEED: 'live_feed',
  HEADLINES: 'headlines',
  MY_ALERTS: 'my_alerts'
});

const GM2_ACTIONS = Object.freeze({
  ALLOW: 'allow',
  REJECT: 'reject',
  QUARANTINE: 'quarantine',
  NEEDS_RESOLUTION: 'needs_resolution',
  BLOCK_RENDER: 'block_render'
});

const TRUSTED_SOURCES = new Set([
  'on3',
  'manual',
  'rivals_pm',
  '247',
  'rivals',
  'beat_writer',
  'beat_writer_ingest',
  'beat_visit_intel',
  'admin'
]);

const BLOCKED_SOURCES = new Set([
  'fan',
  'message_board',
  'meme',
  'commentary',
  'snapshot',
  'internal',
  'needs_resolution'
]);

const INTERNAL_SOURCES = new Set([
  'beat_writer_ingest',
  'beat_visit_intel',
  'auto:intel',
  'auto:beat',
  'auto:beat-intel',
  'auto:beat-momentum',
  'auto:beat-writer',
  'auto:program-news',
  'needs_resolution',
  'snapshot',
  'internal'
]);

const VERIFIED_COMMIT_SOURCES = new Set(['on3', 'manual']);

module.exports = {
  GM2_FEATURES,
  GM2_ACTIONS,
  TRUSTED_SOURCES,
  BLOCKED_SOURCES,
  INTERNAL_SOURCES,
  VERIFIED_COMMIT_SOURCES
};
