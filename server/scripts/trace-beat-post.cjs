#!/usr/bin/env node
/** Trace a beat tweet through ingest → compose → QA without posting. */
require('../lib/autoposter/uf-premium-mode').applyToProcessEnv();

const ingest = require('../lib/beat-writer-ingest');
const ingestGate = require('../lib/beat-recruiting-ingest-gate');
const prefilter = require('../lib/beat-intel-prefilter');
const filters = require('../lib/beat-writer-filters');
const { parseOn3BeatUrlIdentity } = require('../lib/on3-recruit-discovery');
const qa = require('../lib/autoposter/recruiting-post-qa');

const FLOYD_POST = {
  handle: 'Corey_Bender',
  writerName: 'Corey Bender',
  outlet: 'On3',
  text:
    'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd.\nWith decision day approaching, is that still the call? 👀\nHere is the latest: https://on3.com/teams/florida-gators/news/revisiting-my-florida-gators-prediction-for-4-star-cb-raheem-floyd/ (On3+)',
  publishedAt: new Date().toISOString(),
  url: 'https://x.com/Corey_Bender/status/floyd-rpm-trace',
  id: 'x_floyd_rpm_trace'
};

async function trace() {
  const out = { post: 'Raheem Floyd / Corey Bender RPM', steps: [] };
  const step = (name, data) => {
    out.steps.push({ name, ...data });
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(data, null, 2));
  };

  step('trusted_writer', {
    ok: filters.isTrustedBeatWriter(FLOYD_POST),
    include: filters.shouldIncludeBeatPost(FLOYD_POST)
  });

  step('strict_gate', ingestGate.evaluateStrictRecruitingIngestGate(FLOYD_POST, FLOYD_POST.text));

  step('on3_url_identity', parseOn3BeatUrlIdentity(FLOYD_POST.text, FLOYD_POST.url));

  const guarded = await prefilter.guardBeatPost(FLOYD_POST);
  step('prefilter', guarded);

  const parsed = ingest.parseBeatPostForVisitIntel(FLOYD_POST, { logSkips: false });
  step('parseBeatPostForVisitIntel', parsed || { skipped: true });

  if (!parsed) {
    console.log('\nTRACE STOPPED: parse returned null');
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const trustedWriter = ingest.isVisitIngestWriter({ handle: parsed.sourceHandle });
  const bypass = await prefilter.bypassRecruitingPipeline(parsed.detail, {
    playerName: parsed.playerName,
    playerSlug: parsed.playerSlug,
    source: parsed.sourceHandle || parsed.source,
    subsystem: 'autoposter:beat-writer',
    trustedWriter,
    post: FLOYD_POST
  });
  step('bypassRecruitingPipeline', bypass || { pass: true });

  const eligibility = await prefilter.evaluateBeatIntelEligibility(parsed.detail, {
    playerName: parsed.playerName,
    playerSlug: parsed.playerSlug,
    trustedWriter,
    post: FLOYD_POST
  });
  step('evaluateBeatIntelEligibility', eligibility);

  const copy = require('../lib/x-autoposter-copy');
  const intelPayload = {
    id: 'trace-dry-run',
    fingerprint: parsed.fingerprint,
    eventType: parsed.eventType,
    playerName: parsed.playerName,
    playerSlug: parsed.playerSlug,
    classYear: parsed.classYear,
    pos: parsed.pos,
    school: parsed.school,
    highSchool: parsed.highSchool,
    stars: parsed.stars,
    source: parsed.source,
    analystName: parsed.source,
    sourceHandle: parsed.sourceHandle,
    detail: parsed.detail,
    text: parsed.text,
    timestamp: parsed.timestamp,
    articleUrl: parsed.articleUrl,
    identityConfirmed: true,
    sourceType: 'beat'
  };
  const built = await copy.buildIntelCopyAsync(intelPayload);
  step('buildIntelCopyAsync', {
    ok: !!built?.text,
    skipReason: built?.skipReason || built?.reason || built?._needsResolution,
    missingFields: built?.missingFields || built?.missingAfter || null,
    textPreview: built?.text ? String(built.text).slice(0, 280) : null,
    validationMeta: built?.validationMeta || null,
    templateBlocks: built?.templateBlocks || null
  });

  if (!built?.text && parsed.eventType === 'prediction') {
    const prediction = require('../lib/x-autoposter-prediction');
    const predBuilt = await prediction.buildPredictionPost({
      intel: intelPayload,
      playerSlug: parsed.playerSlug,
      playerName: parsed.playerName,
      sourceLabel: parsed.source,
      skipIdentityLookup: false
    });
    step('buildPredictionPost', {
      ok: predBuilt?.ok,
      skipped: predBuilt?.skipped,
      reason: predBuilt?.reason,
      missingAfter: predBuilt?.missingAfter || null,
      textPreview: predBuilt?.text ? String(predBuilt.text).slice(0, 280) : null
    });
  }

  const finalBuilt = built?.text ? built : null;
  if (finalBuilt?.text) {
    const qaCandidate = {
      ...finalBuilt,
      topic: 'recruiting',
      playerName: parsed.playerName,
      playerSlug: parsed.playerSlug,
      source: 'auto:beat-writer',
      validationMeta: { ...(built.validationMeta || {}), beatText: parsed.text || parsed.detail }
    };
    step('recruiting_qa', {
      pass: qa.passesPublishGate(qaCandidate),
      rejectReason: qa.rejectReason(qaCandidate)
    });

    step('queueAutoposter', {
      note: 'Skipped live queue — dry run only',
      wouldQueue: qa.passesPublishGate(qaCandidate) && !!finalBuilt.text
    });
  }

  console.log('\n--- FULL TRACE ---');
  console.log(JSON.stringify(out, null, 2));
}

trace().catch((err) => {
  console.error(err);
  process.exit(1);
});
