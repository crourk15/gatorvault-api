'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('lab-intel-promote', () => {
  let tmp;
  let prevLab;
  let prevNode;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-lab-'));
    prevLab = process.env.GV_LAB_PROMOTIONS_PATH;
    prevNode = process.env.NODE_ENV;
    process.env.GV_LAB_PROMOTIONS_PATH = path.join(tmp, 'lab-promotions.json');
    delete require.cache[require.resolve('../../lib/lab-promotions-store')];
    delete require.cache[require.resolve('../../lib/lab-intel-promote')];
    delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
  });

  afterEach(() => {
    if (prevLab == null) delete process.env.GV_LAB_PROMOTIONS_PATH;
    else process.env.GV_LAB_PROMOTIONS_PATH = prevLab;
    if (prevNode == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    delete require.cache[require.resolve('../../lib/lab-promotions-store')];
    delete require.cache[require.resolve('../../lib/lab-intel-promote')];
    delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('promotes offer/visit to lab stage and merges into allowlist set', () => {
    const promotions = require('../../lib/lab-promotions-store');
    const saved = promotions.upsertStage('lab', {
      slug: 'new-florida-target',
      name: 'New Florida Target',
      classYear: 2027,
      reasons: ['florida_offer'],
      sources: ['offer_log'],
    });
    assert.equal(saved.ok, true);
    assert.equal(promotions.getLabSlugSet(2027).has('new-florida-target'), true);

    delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
    const allowlist = require('../../lib/recruiting-target-allowlist');
    assert.equal(allowlist.getAllowlistSet(2027).has('new-florida-target'), true);
  });

  it('decideStage requires verifiable Florida involvement', () => {
    const { decideStage } = require('../../lib/lab-intel-promote');
    assert.equal(decideStage({ reasons: [], sources: [], sourceCount: 0, hasOffer: false, hasVisit: false, hasPrediction: false }), null);
    assert.equal(
      decideStage({
        reasons: ['prediction_machine'],
        sources: ['rivals_pm'],
        sourceCount: 1,
        hasOffer: false,
        hasVisit: false,
        hasPrediction: true,
      }),
      'watchlist'
    );
    assert.equal(
      decideStage({
        reasons: ['florida_offer'],
        sources: ['offer_log'],
        sourceCount: 1,
        hasOffer: true,
        hasVisit: false,
        visitVerified: false,
        hasPrediction: false,
      }),
      'lab'
    );
    assert.equal(
      decideStage({
        reasons: ['florida_visit'],
        sources: ['player_visit'],
        sourceCount: 1,
        hasOffer: false,
        hasVisit: true,
        visitVerified: false,
        hasPrediction: false,
      }),
      'watchlist'
    );
    assert.equal(
      decideStage({
        reasons: ['florida_visit'],
        sources: ['visit_log'],
        sourceCount: 1,
        hasOffer: false,
        hasVisit: true,
        visitVerified: true,
        hasPrediction: false,
      }),
      'lab'
    );
    assert.equal(
      decideStage({
        reasons: ['prediction_machine', 'multi_source'],
        sources: ['rivals_pm', 'on3'],
        sourceCount: 2,
        hasOffer: false,
        hasVisit: false,
        visitVerified: false,
        hasPrediction: true,
      }),
      'lab'
    );
  });


  it('treats On3 RPM like prediction machine (visit+RPM → lab)', () => {
    const { decideStage, collectSignals } = require('../../lib/lab-intel-promote');
    assert.equal(
      decideStage({
        reasons: ['on3_rpm', 'prediction_machine', 'florida_visit'],
        sources: ['on3_rpm', 'visit_log'],
        sourceCount: 2,
        hasOffer: false,
        hasVisit: true,
        visitVerified: false,
        hasPrediction: true,
        hasOn3Rpm: true,
        rpmConfidence: 55,
      }),
      'lab'
    );
    assert.equal(
      decideStage({
        reasons: ['on3_rpm', 'prediction_machine'],
        sources: ['on3_rpm'],
        sourceCount: 1,
        hasOffer: false,
        hasVisit: false,
        visitVerified: false,
        hasPrediction: true,
        hasOn3Rpm: true,
        rpmConfidence: 60,
      }),
      'watchlist'
    );

    const signals = collectSignals(
      {
        slug: 'cyion-smith',
        name: 'Cyion Smith',
        classYear: 2028,
        ufRpmPct: 58,
        on3Id: 242617,
      },
      {
        offerSlugs: new Set(),
        visitSlugs: new Set(['cyion-smith']),
        rivalsBySlug: new Map(),
        on3RpmBySlug: new Map([['cyion-smith', { confidence: 58, source: 'on3_rpm' }]]),
      }
    );
    assert.equal(signals.hasOn3Rpm, true);
    assert.equal(signals.hasPrediction, true);
    assert.equal(signals.hasVisit, true);
    assert.ok(signals.reasons.includes('on3_rpm'));
    assert.equal(decideStage(signals), 'lab');
  });

  it('promoteResolvedPredictionToRadar dryRun is watchlist without visit', async () => {
    const { promoteResolvedPredictionToRadar } = require('../../lib/lab-intel-promote');
    const result = await promoteResolvedPredictionToRadar({
      slug: 'brand-new-rpm-prospect',
      name: 'Brand New Rpm Prospect',
      classYear: 2028,
      fetchRpm: false,
      dryRun: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.stage, 'watchlist');
    assert.equal(result.row.slug, 'brand-new-rpm-prospect');
  });

});
