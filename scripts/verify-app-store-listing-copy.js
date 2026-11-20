#!/usr/bin/env node
/** Guard App Store listing copy against Apple limits and live-product facts. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PASTE = path.join(ROOT, 'docs', 'app-store-screenshots', 'APP_STORE_CONNECT_PASTE.txt');
const CONNECT = path.join(ROOT, 'docs', 'APP_STORE_CONNECT.md');
const LANDING_FILES = [
  'client/components/welcome/LandingHeroElite.tsx',
  'client/components/welcome/LandingSystemOverview.tsx',
  'client/components/welcome/LandingWhyGatorVault.tsx',
  'client/components/welcome/LandingFinalCTA.tsx',
  'client/lib/pricing-tiers.ts',
];

const SUBTITLE = 'Commits, portal & visit alerts';
const PROMO =
  'Florida recruiting in one place: 2028 board, campus visits, Game Week keys, and film. 30-day free trial — no card required.';
const KEYWORDS =
  'football,uf,florida,gators,recruiting,signing,2028,class,predictions,sec,depth,chart,film,futurecast';

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });

function section(text, heading) {
  const re = new RegExp(`${heading}[\\s\\S]*?(?=\\n--- |\\n## |$)`);
  const m = text.match(re);
  return m ? m[0] : '';
}

function main() {
  const paste = fs.readFileSync(PASTE, 'utf8');
  const connect = fs.readFileSync(CONNECT, 'utf8');
  const listing = `${paste}\n${connect}`;

  if (SUBTITLE.length > 30) fail('subtitle-limit', `${SUBTITLE.length} > 30`);
  else pass('subtitle-limit', `${SUBTITLE.length} / 30`);

  if (PROMO.length > 170) fail('promo-limit', `${PROMO.length} > 170`);
  else pass('promo-limit', `${PROMO.length} / 170`);

  if (KEYWORDS.length > 100) fail('keywords-limit', `${KEYWORDS.length} > 100`);
  else pass('keywords-limit', `${KEYWORDS.length} / 100`);

  if (!listing.includes(SUBTITLE)) fail('subtitle-present', 'subtitle missing from docs');
  else pass('subtitle-present', SUBTITLE);

  if (!listing.includes(PROMO)) fail('promo-present', 'promo missing from docs');
  else pass('promo-present', 'promo matches');

  if (!listing.includes(KEYWORDS)) fail('keywords-present', 'keywords missing from docs');
  else pass('keywords-present', 'keywords match');

  if (listing.includes('GatorVault Insider')) pass('app-name', 'GatorVault Insider kept');
  else fail('app-name', 'app name missing');

  for (const price of ['$4.99', '$47.88', '$9.99', '$95.88', '$19.99', '$191.88']) {
    if (!listing.includes(price)) fail(`price-${price}`, `${price} missing`);
    else pass(`price-${price}`, price);
  }

  if (/30-day free trial/i.test(listing) && /no card required/i.test(listing)) {
    pass('trial', '30-day no-card trial kept');
  } else fail('trial', '30-day no-card trial missing');

  if (/7-day|7 days free|\$69\.99|\$39\.99|Season Pass|On3-sourced/i.test(listing)) {
    fail('banned-copy', 'listing still has 7-day, new prices, Season Pass, or On3-sourced');
  } else pass('banned-copy', 'no 7-day / $69.99 / On3-sourced');

  const desc = `${section(paste, '--- Description ---')}\n${section(connect, '## Description')}`;
  if (!/War Room/.test(desc)) fail('war-room', 'War Room missing from description');
  else pass('war-room', 'War Room listed');

  if (/2029|2030/.test(desc)) fail('empty-class', 'description promises 2029/2030');
  else pass('empty-class', 'no 2029/2030 promise');

  if (!listing.includes('02-recruiting.png') || !listing.includes('Every Florida target. One board.')) {
    fail('screenshot-lead', 'board-first screenshot order missing');
  } else pass('screenshot-lead', 'board first');

  for (const rel of LANDING_FILES) {
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (/On3-sourced/i.test(body)) fail(`landing-on3-${rel}`, 'On3-sourced still in marketing file');
    else pass(`landing-on3-${rel}`, 'clean');
  }

  const summary = {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.fail) process.exit(1);
}

main();
