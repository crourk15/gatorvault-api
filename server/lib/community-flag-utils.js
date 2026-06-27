/** Shared UGC report reason validation and duplicate guards. */

const VALID_REPORT_REASONS = new Set(['spam', 'harassment', 'inappropriate', 'other']);

function normalizeReportReason(reason) {
  const id = String(reason || '').trim().toLowerCase();
  return VALID_REPORT_REASONS.has(id) ? id : null;
}

function hasDuplicateOpenFlag(flags, { reporterEmail, postId, threadId }) {
  const email = String(reporterEmail || '').trim().toLowerCase();
  if (!email) return false;
  return flags.some((f) => {
    if (f.status !== 'open') return false;
    if (String(f.reporterEmail || '').trim().toLowerCase() !== email) return false;
    if (postId) return f.postId === postId;
    return f.threadId === threadId && !f.postId;
  });
}

function flagValidationError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = {
  VALID_REPORT_REASONS,
  normalizeReportReason,
  hasDuplicateOpenFlag,
  flagValidationError,
};