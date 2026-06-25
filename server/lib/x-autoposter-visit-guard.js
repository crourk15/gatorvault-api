/**
 * Fail-closed guard for X posts that promote FutureCast visit intel.
 * Blocks "fresh/upcoming visit" copy when the board has no verified upcoming OVs.
 */
const visitLogStore = require('./recruiting-visit-log-store');
const {
  getVisitIntelBoardSnapshot,
  buildVerifiedVisitRecapRows,
  formatVisitSourceLabel,
} = require('./visit-intel-utils');

const VISIT_INTEL_PROMO_RE =
  /(?:fresh\s+2027\s+visit|visit intel updated|futurecast.*visit intel|visit intel.*futurecast|visit tracked live|visit intel live|full tracker.*futurecast#visits|2027 visit intel)/i;

const UPCOMING_VISIT_PROMO_RE =
  /(?:fresh\s+2027\s+visit|upcoming\s+(?:ov|official visit)|visit intel updated|this weekend(?:'s)?\s+(?:ov|official visit)|visitors?\s+(?:this|next)\s+weekend)/i;

const RECAP_VISIT_PROMO_RE =
  /(?:confirmed\s+2027\s+summer|verified\s+(?:ov|official visit)|summer\s+slate|completed\s+(?:ov|official visit)|visit recap|on3-confirmed|on3 verified)/i;

function isVisitIntelPromotionText(text) {
  const t = String(text || '');
  if (VISIT_INTEL_PROMO_RE.test(t)) return true;
  if (/\bofficial visit\b/i.test(t) && /\bfuturecast\b/i.test(t)) return true;
  if (/\bvisit intel\b/i.test(t) && /gatorvault/i.test(t)) return true;
  return false;
}

function isUpcomingVisitPromotionText(text) {
  return UPCOMING_VISIT_PROMO_RE.test(String(text || ''));
}

function isVisitRecapPromotionText(text) {
  return RECAP_VISIT_PROMO_RE.test(String(text || ''));
}

function loadBoardSnapshot(asOf = new Date()) {
  const visitLogs = visitLogStore.loadDoc().items || [];
  return { visitLogs, ...getVisitIntelBoardSnapshot(visitLogs, asOf) };
}

function evaluateVisitIntelPostGate({ text, asOf = new Date() } = {}) {
  const body = String(text || '');
  if (!isVisitIntelPromotionText(body)) {
    return { allow: true, skipped: true, reason: 'not_visit_promo' };
  }

  const { visitLogs, upcomingCount, recapCount } = loadBoardSnapshot(asOf);

  if (isVisitRecapPromotionText(body) && recapCount > 0) {
    return {
      allow: true,
      reason: 'verified_recap_promo',
      upcomingCount,
      recapCount,
    };
  }

  if (isUpcomingVisitPromotionText(body) && upcomingCount === 0) {
    return {
      allow: false,
      reason: 'no_verified_upcoming_visits',
      upcomingCount,
      recapCount,
      message:
        'Visit intel promotion blocked: FutureCast has no verified upcoming UF official visits.',
    };
  }

  if (upcomingCount > 0) {
    return {
      allow: true,
      reason: 'verified_upcoming_visits',
      upcomingCount,
      recapCount,
    };
  }

  if (recapCount > 0 && !isUpcomingVisitPromotionText(body)) {
    return {
      allow: true,
      reason: 'verified_recap_available',
      upcomingCount,
      recapCount,
    };
  }

  return {
    allow: false,
    reason: 'no_verified_visit_data',
    upcomingCount,
    recapCount,
    message: 'Visit intel promotion blocked: no verified visit data on FutureCast board.',
  };
}

function buildVerifiedVisitRecapPostCopy(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const { visitLogs, upcomingCount, recapCount } = loadBoardSnapshot(asOf);
  if (!recapCount) return null;

  const recap = buildVerifiedVisitRecapRows([], visitLogs, asOf, { limit: 6 });
  const site = process.env.SITE_URL || 'https://gatorvaultinsider.com';
  const lines = recap.slice(0, 4).map((row) => {
    const window = `${row.visitStart}${row.visitEnd ? `-${row.visitEnd}` : ''}`;
    return `- ${row.name} (${window}, ${row.visitSourceLabel || formatVisitSourceLabel(row.visitSource)})`;
  });

  const header =
    upcomingCount > 0
      ? 'FutureCast 2027 Visit Intel — verified upcoming + completed OVs'
      : 'FutureCast 2027 Visit Intel — On3-verified summer OVs confirmed';

  const footer = `Full verified tracker: ${site}/vault/futurecast#visits`;

  return [header, '', ...lines, '', footer].join('\n').slice(0, 280);
}

module.exports = {
  VISIT_INTEL_PROMO_RE,
  UPCOMING_VISIT_PROMO_RE,
  RECAP_VISIT_PROMO_RE,
  isVisitIntelPromotionText,
  isUpcomingVisitPromotionText,
  isVisitRecapPromotionText,
  loadBoardSnapshot,
  evaluateVisitIntelPostGate,
  buildVerifiedVisitRecapPostCopy,
};
