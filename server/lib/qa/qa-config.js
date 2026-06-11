/**
 * GatorVault QA Crawler — configuration.
 */
const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
const API_URL = (process.env.QA_API_URL || process.env.API_BASE_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');

const PUBLIC_API_ENDPOINTS = [
  { id: 'ping', path: '/api/ping', json: true },
  { id: 'recruiting-ingest-status', path: '/api/recruiting/ingest/status', json: true },
  { id: 'live-pipeline-health', path: '/api/live/pipeline/health', json: true },
  { id: 'live-dashboard', path: '/api/live/dashboard', json: true },
  { id: 'live-feed', path: '/api/live/feed', json: true },
  { id: 'film-room-catalog', path: '/api/film-room/catalog', json: true, validate: 'filmCatalog' },
  { id: 'articles-published', path: '/api/articles/published', json: true, validate: 'articlesSorted' },
  { id: 'content-published', path: '/api/content/published', json: true, validate: 'contentSorted' },
  { id: 'roster-players', path: '/api/roster/players', json: true, validate: 'roster' },
  { id: 'recruiting-board', path: '/api/recruiting/board', json: true },
  { id: 'recruiting-portal', path: '/api/recruiting/portal', json: true },
  { id: 'pricing', path: '/api/pricing', json: true },
  { id: 'personas', path: '/api/personas', json: true },
  { id: 'content-ingest-status', path: '/api/content/ingest/status', json: true },
  { id: 'war-room-breakdowns', path: '/api/war-room/breakdowns', json: true },
  { id: 'nil-dashboard', path: '/api/nil/dashboard', json: true }
];

const PUBLIC_PAGES = [
  { id: 'home', path: '/', markers: ['GATORVAULT', 'highlight-modal-ov', 'openHighlightPlayer'] },
  { id: 'admin-hub', path: '/admin', markers: ['GatorVault', 'admin-hub-core'] }
];

const QA_MODULES = [
  'api',
  'content',
  'integrity',
  'pages',
  'browser',
  'ux',
  'visual-integrity'
];

module.exports = {
  SITE_URL,
  API_URL,
  INTERVAL_MS: parseInt(process.env.QA_CRAWLER_INTERVAL_MS || '300000', 10),
  BOOT_DELAY_MS: parseInt(process.env.QA_CRAWLER_BOOT_DELAY_MS || '90000', 10),
  ENABLED: process.env.QA_CRAWLER_ENABLED !== 'false',
  BROWSER_ENABLED: process.env.QA_BROWSER_ENABLED === 'true',
  ALERT_ON_FAIL: process.env.QA_ALERT_ON_FAIL !== 'false',
  FETCH_TIMEOUT_MS: parseInt(process.env.QA_FETCH_TIMEOUT_MS || '15000', 10),
  PUBLIC_API_ENDPOINTS,
  PUBLIC_PAGES,
  QA_MODULES,
  SLACK_WEBHOOK: process.env.SLACK_WEBHOOK_URL || process.env.QA_SLACK_WEBHOOK || null
};
