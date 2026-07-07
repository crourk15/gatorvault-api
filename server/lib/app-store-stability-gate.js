/**
 * 7-day App Store stability window - one green sample per UTC calendar day.
 */
const fs = require('fs');
const path = require('path');

const GATE_PATH = path.join(__dirname, '..', 'data', 'ops', 'app-store-gate.json');
const REQUIRED_DAYS = parseInt(process.env.APP_STORE_GATE_DAYS || '7', 10);
const PI_MIN = parseInt(process.env.APP_STORE_GATE_PI_MIN || '90', 10);

function emptyDoc() {
  return {
    version: 1,
    requiredDays: REQUIRED_DAYS,
    piMin: PI_MIN,
    windowStartedAt: null,
    consecutiveGreenDays: 0,
    lastSampleAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    readyForSubmission: false,
    days: [],
  };
}

function readDoc() {
  try {
    return { ...emptyDoc(), ...JSON.parse(fs.readFileSync(GATE_PATH, 'utf8')) };
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(GATE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(GATE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
}

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function evaluateSample({ qaPass, healthReady, productIntelOverall, crawlerFailed = 0, apiFailed = 0 }) {
  const reasons = [];
  if (!qaPass) reasons.push('qa_crawl_failed');
  if (!healthReady) reasons.push('health_not_ready');
  if (productIntelOverall == null || productIntelOverall < PI_MIN) {
    reasons.push(`product_intel_below_${PI_MIN}`);
  }
  if (crawlerFailed > 0) reasons.push('crawler_failures');
  if (apiFailed > 0) reasons.push('api_failures');
  return {
    green: reasons.length === 0,
    reasons,
    productIntelOverall,
    healthReady,
    qaPass,
  };
}

function recordDailySample(sample, options = {}) {
  const evalResult = evaluateSample(sample);
  const doc = readDoc();
  const day = utcDayKey();

  if (doc.days[0]?.day === day && !options.force) {
    return { ...doc, unchanged: true, evaluation: evalResult };
  }

  if (!evalResult.green) {
    doc.consecutiveGreenDays = 0;
    doc.windowStartedAt = null;
    doc.lastFailureAt = new Date().toISOString();
    doc.lastFailureReason = evalResult.reasons.join(', ');
    doc.readyForSubmission = false;
    doc.days.unshift({
      day,
      green: false,
      reasons: evalResult.reasons,
      productIntelOverall: sample.productIntelOverall,
      at: new Date().toISOString(),
    });
    doc.days = doc.days.slice(0, 14);
    doc.lastSampleAt = new Date().toISOString();
    writeDoc(doc);
    return { ...doc, evaluation: evalResult, reset: true };
  }

  if (!doc.windowStartedAt) doc.windowStartedAt = day;
  const prevGreen = doc.days.filter((d) => d.green).map((d) => d.day);
  if (!prevGreen.includes(day)) {
    doc.consecutiveGreenDays = (doc.consecutiveGreenDays || 0) + 1;
  }
  doc.days.unshift({
    day,
    green: true,
    reasons: [],
    productIntelOverall: sample.productIntelOverall,
    at: new Date().toISOString(),
  });
  doc.days = doc.days.slice(0, 14);
  doc.lastSampleAt = new Date().toISOString();
  doc.readyForSubmission = doc.consecutiveGreenDays >= REQUIRED_DAYS;
  writeDoc(doc);
  return { ...doc, evaluation: evalResult, reset: false };
}

function buildSnapshot(overrides = {}) {
  const qaStore = require('./qa/qa-store');
  const piStore = require('./product-intel/product-intel-store');
  const qa = qaStore.readDoc();
  const pi = piStore.readDoc();
  const lastRun = qa.lastRun || qa.runs?.[0] || null;
  const latestRun = qa.runs?.[0] || null;
  const failedChecks = latestRun?.summary?.failed || latestRun?.failed || 0;

  const sample = {
    qaPass: !!(lastRun?.pass ?? latestRun?.pass),
    healthReady: overrides.healthReady !== undefined ? overrides.healthReady : true,
    productIntelOverall: pi.scores?.overall ?? null,
    crawlerFailed: latestRun?.modules?.crawler?.failed || 0,
    apiFailed: latestRun?.modules?.api?.failed || 0,
    failedChecks,
    ...overrides,
  };

  const doc = readDoc();
  const evaluation = evaluateSample(sample);
  return {
    requiredDays: REQUIRED_DAYS,
    piMin: PI_MIN,
    consecutiveGreenDays: doc.consecutiveGreenDays || 0,
    windowStartedAt: doc.windowStartedAt,
    readyForSubmission: doc.readyForSubmission,
    lastFailureAt: doc.lastFailureAt,
    lastFailureReason: doc.lastFailureReason,
    days: doc.days || [],
    sample,
    evaluation,
    criteria: {
      qaPass: true,
      healthReady: true,
      productIntelMin: PI_MIN,
      crawlerFailures: 0,
      apiFailures: 0,
      consecutiveDays: REQUIRED_DAYS,
    },
  };
}

module.exports = {
  REQUIRED_DAYS,
  PI_MIN,
  readDoc,
  evaluateSample,
  recordDailySample,
  buildSnapshot,
};