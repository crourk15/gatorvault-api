#!/usr/bin/env node
/** Probe On3 Rivals pages for public Charles Power scouting summaries */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractScoutingSummary(html) {
  const text = stripHtml(html);
  const idx = text.indexOf('Scouting Summary');
  if (idx === -1) return null;
  let body = text.slice(idx + 'Scouting Summary'.length).trim();
  body = body.replace(/^[\d/]+\s*/, '').replace(/^Charles Power\s*/i, '');
  const stop = body.search(
    /\b(Read More|Latest News|Athlete-Only|Rivals Verified|Featured Film|Personal Life|No personal-life|Contacts Email|Gallery ·|Photos Gallery)\b/i
  );
  if (stop > 60) body = body.slice(0, stop).trim();
  if (body.length < 80) return null;
  return body;
}

const ON3_OVERRIDES = {
  'elias-pearl': '281377',
  'davin-davidson': '259412',
  'aamaury-fountain': '281368',
  'andrew-beard': '236047',
  'tramond-collins': '258942',
  'amare-nugent': '249286',
  'cahron-wheeler': '282819',
  'jabios-smith': '245408',
  'elijah-hutcheson': '241889',
  'peyton-miller': '238083',
  'anthony-jennings': '258941',
  'tommy-douglas': '258944',
  'kennedee-jackson': '281373',
  'stive-bentley-keumajou': '258945',
  'devoun-kendrick': '258946',
  'jackson-ballinger': '258947',
  'kailib-dillard': '258948',
  'cain-van-norden': '258949'
};

async function main() {
  const playersPath = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  const uf = players.filter((p) => p.committedTo === 'Florida');
  const seen = new Set();
  const hits = [];

  for (const p of uf) {
    const on3Id = p.on3Id || ON3_OVERRIDES[p.slug];
    if (!on3Id || seen.has(p.slug)) continue;
    seen.add(p.slug);
    const url = `https://www.on3.com/rivals/${p.slug}-${on3Id}/`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultSeed/1.0)' }
      });
      const html = await res.ok ? await res.text() : '';
      const summary = extractScoutingSummary(html);
      if (summary) {
        hits.push({ slug: p.slug, name: p.name, url, summary: summary.slice(0, 200) + '…' });
        process.stderr.write(`HIT ${p.slug}\n`);
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      process.stderr.write(`ERR ${p.slug}: ${e.message}\n`);
    }
  }
  console.log(JSON.stringify({ hits: hits.length, players: hits }, null, 2));
}

main();
