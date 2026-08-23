/**
 * Campus visit → 2028 allowlist promote (Chase / Closest).
 * Run: node server/test/campus-visit-allowlist-promote.test.js
 */
'use strict';

const assert = require('assert');
const {
  floridaCampusVisitSetUp,
  shouldPromoteOnCampusVisit,
} = require('../lib/campus-visit-allowlist-promote');
const { shouldPromoteToFutureCast, floridaOfferedOnPlayer } = require('../lib/desk-intel-futurecast-feed');

function main() {
  // Offer alone — War Room path, NOT allowlist.
  const offerOnly = {
    name: 'Amaree Joshua',
    slug: 'amaree-joshua',
    classYear: 2028,
    on3Slug: 'amaree-joshua-999',
    ufStatus: 'Florida Offered',
    ufOffer: true,
    ufRpmPct: 25,
  };
  assert.ok(floridaOfferedOnPlayer(offerOnly));
  assert.ok(!floridaCampusVisitSetUp(offerOnly));
  assert.ok(!shouldPromoteOnCampusVisit(offerOnly, 2028));
  assert.ok(!shouldPromoteToFutureCast(offerOnly, 2028));

  // Bare polluted "visit" status — do not promote.
  const bareVisit = {
    name: 'Noise Kid',
    slug: 'noise-kid',
    classYear: 2028,
    on3Slug: 'noise-kid-1',
    ufOvStatus: 'visit',
  };
  assert.ok(!floridaCampusVisitSetUp(bareVisit));
  assert.ok(!shouldPromoteToFutureCast(bareVisit, 2028));

  // Campus visit scheduled — MUST allowlist.
  const scheduled = {
    name: 'Visit Kid',
    slug: 'visit-kid',
    classYear: 2028,
    on3Slug: 'visit-kid-1',
    ufOvStatus: 'scheduled',
    visitStart: '2026-09-12',
  };
  assert.ok(floridaCampusVisitSetUp(scheduled));
  assert.ok(shouldPromoteOnCampusVisit(scheduled, 2028));
  assert.ok(shouldPromoteToFutureCast(scheduled, 2028));

  // Logged Florida UV trail — promote.
  const trail = {
    name: 'Trail Kid',
    slug: 'trail-kid',
    classYear: 2028,
    on3Slug: 'trail-kid-1',
    visitTrail: [{ school: 'Florida', type: 'unofficial_visit' }],
  };
  assert.ok(shouldPromoteToFutureCast(trail, 2028));

  // Closing class never soft-expands.
  assert.ok(!shouldPromoteToFutureCast({ ...scheduled, classYear: 2027 }, 2027));

  // Offer + On3 UV counts (Nick-shaped) — visit side promotes.
  const nickShaped = {
    name: 'Nick Carroll',
    classYear: 2028,
    on3Slug: 'nick-carroll-281042',
    ufRpmPct: 36,
    ufStatus: 'Florida Offered',
    on3TopTeams: [
      { team: { name: 'Florida' }, status: 'Offered', prediction: 36, year: 2028, unOfficialVisitCount: 2 },
    ],
  };
  assert.ok(shouldPromoteToFutureCast(nickShaped, 2028));

  console.log('campus-visit-allowlist-promote.test.js PASS');
}

main();
