/**
 * Detect prediction / RPM / crystal-ball signals that must never silently drop.
 */
'use strict';

const PREDICTION_TEXT_RE =
  /\b(?:prediction machine|futurecast|expert pick|crystal ball|\brpm\b|new\s*rpm|dropping a prediction|prediction in (?:their|his|her) favor|predicting the|projected to (?:land|get)|logging a new rpm|logged (?:an? )?rpm)\b/i;

const TEASER_URL_RE =
  /(?:new-rpm|crystal-ball|predicting-the|prediction-logged|projected-to-land|add-defensive-target-new-rpm|land-a-\d-star)/i;

function blobOf(input = {}) {
  return [input.text, input.title, input.url, input.detail, input.excerpt]
    .filter(Boolean)
    .join(' ');
}

function isTeaserOn3Url(url) {
  const u = String(url || '');
  if (!/on3\.com/i.test(u)) return false;
  if (!/\/news\//i.test(u)) return false;
  return TEASER_URL_RE.test(u);
}

function isPredictionSignal(input = {}) {
  const blob = blobOf(input);
  if (PREDICTION_TEXT_RE.test(blob)) return true;
  if (isTeaserOn3Url(input.url)) return true;
  if (String(input.eventType || '').toLowerCase() === 'prediction') return true;
  return false;
}

/** True when we should open an Unresolved Predictions case instead of silent skip. */
function shouldEnqueueUnresolvedPrediction(input = {}) {
  if (!isPredictionSignal(input)) return false;
  const slug = String(input.playerSlug || input.playerSlugHint || '').toLowerCase();
  const hasRealSlug =
    !!slug &&
    !slug.startsWith('beat-pending-') &&
    slug !== 'unknown-prospect' &&
    slug !== 'new-rpm';
  // Named + attached prospects are not "unresolved" — Pass 2 upgrades RPM % instead.
  if (hasRealSlug) return false;
  return true;
}

function safeEnqueueUnresolvedPrediction(input = {}) {
  try {
    if (!shouldEnqueueUnresolvedPrediction(input)) {
      return { enqueued: false, reason: 'not_prediction_signal' };
    }
    const store = require('./unresolved-predictions-store');
    const result = store.enqueue({
      reason: input.reason || 'unresolved_prediction',
      source: input.source || 'unknown',
      title: input.title || 'Unresolved prediction',
      textPreview: input.textPreview || input.text || input.detail || '',
      url: input.url || null,
      handle: input.handle || null,
      writerName: input.writerName || null,
      eventType: input.eventType || 'prediction',
      playerNameHint: input.playerNameHint || input.playerName || null,
      playerSlugHint: input.playerSlugHint || input.playerSlug || null,
      classYearHint: input.classYearHint || input.classYear || null,
      posHint: input.posHint || input.pos || null,
      fingerprint: input.fingerprint || null,
    });
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'recruiting:unresolved-predictions',
        status: result.created ? 'opened' : 'seen',
        message: result.created
          ? `Opened unresolved prediction: ${result.item.title}`
          : `Repeat unresolved prediction: ${result.item.title}`,
        details: {
          id: result.item.id,
          reason: result.item.reason,
          source: result.item.source,
          url: result.item.url,
        },
      });
    } catch {
      /* ops optional */
    }
    return { enqueued: true, created: result.created, item: result.item };
  } catch (err) {
    return { enqueued: false, error: err.message };
  }
}

module.exports = {
  PREDICTION_TEXT_RE,
  isTeaserOn3Url,
  isPredictionSignal,
  shouldEnqueueUnresolvedPrediction,
  safeEnqueueUnresolvedPrediction,
};
