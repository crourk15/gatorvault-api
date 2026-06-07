#!/usr/bin/env node
/**
 * Fetch On3 Rivals "Scouting Summary" blocks (Charles Power / Rivals staff)
 * and upsert War Room breakdowns for UF commits when a public summary exists.
 */
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const warRoom = require('../lib/war-room-store');

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
  const cpIdx = text.search(/\bCP\s+Charles Power\b/i);
  const idx = text.indexOf('Scouting Summary');
  if (idx === -1) return null;

  let body = text.slice(idx + 'Scouting Summary'.length).trim();
  if (cpIdx > idx && cpIdx < idx + 8000) {
    body = body.replace(/^[\d/]+\s*/, '');
  }
  body = body.replace(/^Charles Power\s*/i, '').replace(/^CP\s+Charles Power\s*[\d/]+\s*/i, '');
  const stop = body.search(
    /\b(Read More|Latest News|Athlete-Only|Rivals Verified|Featured Film|Personal Life|No personal-life|Contacts Email|Gallery ·|Photos Gallery|COMMITTED|Recent Articles|How Florida|Subscribe)\b/i
  );
  if (stop > 60) body = body.slice(0, stop).trim();
  if (body.length < 80) return null;
  return body;
}

function extractComparison(html) {
  const text = stripHtml(html);
  const m = text.match(/reminds us of ([^.]{10,120}\.)/i);
  return m ? m[1].trim() : null;
}

function sentencesFromSummary(summary) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function buildBreakdown(player, summary, url, comparison) {
  const lower = summary.toLowerCase();
  const weaknessHints = sentencesFromSummary(summary).filter((s) =>
    /\b(question|need to|will need|remains a|lack of|older for|unverified|few years away|early in his development)\b/i.test(s)
  );
  const strengthHints = sentencesFromSummary(summary).filter(
    (s) => !weaknessHints.includes(s) && s.length > 25
  );

  return {
    playerSlug: player.slug,
    playerName: player.name,
    playerType: player.category === 'portal' ? 'portal' : player.category === 'target' ? 'target' : 'recruit',
    sources: [
      {
        writer: 'Charles Power',
        outlet: 'On3 / Rivals',
        url,
        publishedAt: '2026-06-01'
      }
    ],
    strengths: strengthHints.slice(0, 8),
    weaknesses: weaknessHints.slice(0, 4),
    comparison: comparison || null,
    schemeFit: null,
    staffNotes: null,
    projection: sentencesFromSummary(summary).find((s) => /project|upside|impact|develop into|early/i.test(s)) || null,
    insiderNotes: summary,
    recruitingStory: player.commitDate
      ? `Committed to Florida on ${player.commitDate}${player.school ? ` · ${player.school}` : ''}`
      : null,
    nflProjection: sentencesFromSummary(summary).find((s) => /draft|NFL|pro/i.test(s)) || null
  };
}

async function fetchPage(slug, on3Id) {
  const url = `https://www.on3.com/rivals/${slug}-${on3Id}/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultSeed/1.0)' }
  });
  if (!res.ok) return { url, error: `HTTP ${res.status}` };
  const html = await res.text();
  const summary = extractScoutingSummary(html);
  const comparison = extractComparison(html);
  return { url, summary, comparison };
}

/** Slugs missing on3Id in players.json but with known Rivals profile IDs */
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
  'peyton-miller': '238083'
};

async function main() {
  const playersPath = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  const targets = players.filter((p) => p.committedTo === 'Florida' && (p.on3Id || ON3_OVERRIDES[p.slug]));

  let seeded = 0;
  let skipped = 0;

  for (const p of targets) {
    process.stderr.write(`… ${p.slug}\n`);
    try {
      const on3Id = p.on3Id || ON3_OVERRIDES[p.slug];
      const page = await fetchPage(p.slug, on3Id);
      if (!page.summary) {
        skipped += 1;
        continue;
      }
      const entry = buildBreakdown(p, page.summary, page.url, page.comparison);
      if (!entry.strengths.length && !entry.insiderNotes) {
        skipped += 1;
        continue;
      }
      warRoom.upsertBreakdown(p.slug, entry);
      seeded += 1;
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      process.stderr.write(`  err ${p.slug}: ${e.message}\n`);
      skipped += 1;
    }
  }

  console.log(JSON.stringify({ seeded, skipped, total: warRoom.getAllBreakdowns().length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
