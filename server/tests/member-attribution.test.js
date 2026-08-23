'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeFirstTouch,
  outletLabel,
  countBySource,
} = require('../lib/member-attribution');

describe('member first-touch attribution', () => {
  it('sanitizes UTM payload and drops empty noise', () => {
    const ft = sanitizeFirstTouch({
      source: '  x  ',
      medium: 'social',
      campaign: 'fall_camp',
      content: 'dallas_post',
      referrer: 't.co',
      landingPath: '/vault/recruiting/?utm_source=x',
      capturedAt: '2026-08-08T15:00:00.000Z',
    });
    assert.equal(ft.source, 'x');
    assert.equal(ft.medium, 'social');
    assert.equal(ft.campaign, 'fall_camp');
    assert.equal(outletLabel(ft), 'x');
  });

  it('accepts utm_* aliases and src short codes', () => {
    const ft = sanitizeFirstTouch({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'trial_aug',
      capturedAt: new Date().toISOString(),
    });
    assert.equal(ft.source, 'meta');
    assert.equal(outletLabel(ft), 'meta');
  });

  it('returns null when there is no attribution signal', () => {
    assert.equal(sanitizeFirstTouch({ landingPath: '/join/' }), null);
    assert.equal(sanitizeFirstTouch(null), null);
  });

  it('rolls up outlet counts for Admin Hub', () => {
    const by = countBySource([
      { source: 'x' },
      { source: 'x' },
      { source: 'meta' },
      { source: 'direct' },
    ]);
    assert.deepEqual(by[0], { source: 'x', count: 2 });
    assert.equal(by.find((r) => r.source === 'meta')?.count, 1);
  });

  it('falls back to referrer / click ids for outlet label', () => {
    assert.equal(outletLabel({ referrer: 'on3.com' }), 'on3.com');
    assert.equal(outletLabel({ gclid: 'abc' }), 'google');
    assert.equal(outletLabel({ fbclid: 'xyz' }), 'meta');
    assert.equal(outletLabel(null), 'direct');
  });

  it('sanitizes signupChannel website vs ios and rolls up byChannel', () => {
    const {
      sanitizeSignupChannel,
      signupChannelFromReq,
      countByChannel,
    } = require('../lib/member-attribution');
    assert.equal(sanitizeSignupChannel('website'), 'website');
    assert.equal(sanitizeSignupChannel('web'), 'website');
    assert.equal(sanitizeSignupChannel('ios'), 'ios');
    assert.equal(sanitizeSignupChannel('app'), 'ios');
    assert.equal(sanitizeSignupChannel(''), 'unknown');
    assert.equal(
      signupChannelFromReq({ body: { signupChannel: 'website' } }),
      'website'
    );
    assert.equal(
      signupChannelFromReq({
        body: {},
        get: (h) => (String(h).toLowerCase() === 'x-gv-client' ? 'ios' : ''),
      }),
      'ios'
    );
    const by = countByChannel([
      { signupChannel: 'website' },
      { signupChannel: 'website' },
      { signupChannel: 'ios' },
      {},
    ]);
    assert.deepEqual(by, [
      { channel: 'website', count: 2 },
      { channel: 'ios', count: 1 },
      { channel: 'unknown', count: 1 },
    ]);
  });
});
