'use strict';

/**
 * Portal Room on FutureCast; recruiting class cards stamp portal transfers.
 *
 * Run: node --experimental-strip-types --test server/test/fc-portal-room.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('portal commits on recruiting class cards', () => {
  it('maps portal category to a Portal transfer stamp', () => {
    const elite = read('server/lib/recruiting-hub-elite.js');
    assert.ok(elite.includes('Portal transfer'));
    assert.ok(elite.includes('getHubPortalCommits'));
    const card = read('client/components/recruiting-hub/elite/EliteCommitCard.tsx');
    assert.ok(card.includes('Portal transfer'));
    assert.ok(card.includes("tone: 'portal'"));
    assert.ok(card.includes('data-origin'));
  });

  it('redirects /vault/portal and recruiting ?tab=portal to FutureCast', () => {
    const routes = read('client/lib/vault-route-map.ts');
    assert.ok(routes.includes("portal: '/vault/futurecast#portal'"));
    const page = read('client/app/vault/portal/page.tsx');
    assert.ok(page.includes('futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal)'));
    const hub = read(
      'client/components/recruiting-hub/command-center/RecruitingHubCommandCenterClient.tsx'
    );
    assert.ok(hub.includes("tab === 'portal'"));
    assert.ok(hub.includes('window.location.replace(PORTAL_ROOM_HREF)'));
  });
});
