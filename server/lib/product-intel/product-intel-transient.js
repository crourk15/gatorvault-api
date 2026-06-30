/**
 * Detect transient QA crawl failures (network resets, timeouts) — not product bugs.
 */
const { isRetryableFetchError } = require('../qa/qa-utils');

function messageFrom(input) {
  if (!input) return '';
  const parts = [
    input.error,
    input.message,
    input.label,
    input.title,
    input.repro,
    typeof input.details === 'string' ? input.details : null
  ];
  return parts.filter(Boolean).join(' ');
}

function isTransientNetworkFailure(input) {
  const msg = messageFrom(input);
  if (!msg) return false;
  return isRetryableFetchError(msg) || /this operation was aborted/i.test(msg);
}

module.exports = {
  isTransientNetworkFailure,
  messageFrom
};