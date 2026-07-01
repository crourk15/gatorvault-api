/** Game Week Monday 8:00 AM ET auto-publish rules. */
const { isGameWeekAutoPublishEnabled } = require('./insider-articles-config');

const ET = 'America/New_York';
const GAME_WEEK_TYPE = 'Game Week';

function isMonday8amET(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return wd === 'Mon' && hour === 8;
}

function shouldRunGameWeekAutoPublish(now = new Date()) {
  if (!isGameWeekAutoPublishEnabled()) return false;
  return isMonday8amET(now);
}

function gameWeekQualityCheck(draft) {
  const html = String(draft?.bodyHtml || draft?.content || '');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  const required = [
    'thesis', 'opponent', 'scheme', 'roster', 'analytics', 'keys', 'next',
  ];
  const lower = text.toLowerCase();
  const missing = required.filter((k) => !lower.includes(k));
  return { ok: words >= 700 && missing.length <= 2, words, missing };
}

async function runGameWeekAutoPublish(deps) {
  const {
    listDrafts,
    generateDraftForType,
    approveDraft,
    publishToContentFeed,
    logger = console,
  } = deps;

  if (!shouldRunGameWeekAutoPublish()) return { skipped: true, reason: 'not-scheduled' };

  const drafts = await listDrafts();
  let draft = drafts.find(
    (d) => d.articleType === GAME_WEEK_TYPE && ['draft', 'approved'].includes(String(d.status || '').toLowerCase())
  );

  if (!draft) {
    draft = await generateDraftForType(GAME_WEEK_TYPE);
  }

  const qc = gameWeekQualityCheck(draft);
  if (!qc.ok) {
    logger.warn('[game-week-auto] quality gate failed', qc);
    return { skipped: true, reason: 'quality-gate', qc };
  }

  if (String(draft.status || '').toLowerCase() !== 'approved') {
    draft = await approveDraft(draft.id);
  }

  await publishToContentFeed(draft);
  return { published: true, id: draft.id, qc };
}

module.exports = {
  GAME_WEEK_TYPE,
  isMonday8amET,
  shouldRunGameWeekAutoPublish,
  gameWeekQualityCheck,
  runGameWeekAutoPublish,
};