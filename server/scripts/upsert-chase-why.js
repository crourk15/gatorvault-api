#!/usr/bin/env node
/**
 * Upsert / clear live Why we chase copy for Priority Chase cards.
 * Ships on next HP API serve — no Codemagic after the client prefers whyWeChase.
 *
 * Usage:
 *   node server/scripts/upsert-chase-why.js --slug=izayah-vickers \
 *     --text="Florida already owns this CB on the board — staff is locked on Vickers."
 *
 *   node server/scripts/upsert-chase-why.js --slug=izayah-vickers --clear
 *
 *   node server/scripts/upsert-chase-why.js --file=server/data/recruiting/chase-why-overrides.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const store = require('../lib/chase-why-store');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function main() {
  const file = argValue('--file');
  if (file) {
    const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const bySlug = doc.bySlug && typeof doc.bySlug === 'object' ? doc.bySlug : doc;
    let n = 0;
    for (const [slug, row] of Object.entries(bySlug)) {
      if (slug === 'version' || slug === 'updatedAt') continue;
      const text = typeof row === 'string' ? row : row?.text;
      if (!text) continue;
      store.upsertOverride(slug, text, { updatedBy: 'upsert-chase-why-file' });
      n += 1;
      console.log(`ok ${slug}`);
    }
    console.log(`upserted ${n}`);
    return;
  }

  const slug = argValue('--slug');
  if (!slug) {
    console.error('Need --slug=… or --file=…');
    process.exit(1);
  }

  if (hasFlag('--clear')) {
    const cleared = store.clearOverride(slug);
    console.log(cleared ? `cleared ${slug}` : `no override for ${slug}`);
    return;
  }

  const text = argValue('--text');
  if (!text) {
    console.error('Need --text="…" or --clear');
    process.exit(1);
  }

  const row = store.upsertOverride(slug, text, { updatedBy: 'upsert-chase-why' });
  console.log(JSON.stringify({ ok: true, slug: String(slug).toLowerCase(), override: row }, null, 2));
}

main();
