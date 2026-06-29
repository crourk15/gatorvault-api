#!/usr/bin/env node
/**
 * Backfill Recruiting Hub intel for UF commits from On3 Rivals:
 * - Charles Power "Scouting Summary" -> war-room breakdowns (strengths, projection)
 * - On3 nilValue -> recruiting/players.json (when totalValue > 0)
 *
 * Usage: node scripts/seed-hub-intel-from-on3.js [--year=2027] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const warRoom = require('../lib/war-room-store');
const scoutingDb = require('../lib/scouting-database');
const intelQuality = require('../lib/recruiting-intel-quality');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

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
};

function parseArgs() {
  const args = process.argv.slice(2);
  let year = 2027;
  let dryRun = false;
  for (const arg of args) {
    if (arg.startsWith('--year=')) year = parseInt(arg.split('=')[1], 10);
    if (arg === '--dry-run') dryRun = true;
  }
  return { year, dryRun };
}

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
    /\b(Read More|Latest News|Athlete-Only|Rivals Verified|Featured Film|Personal Life|No personal-life|Contacts Email|Gallery ·|Photos Gallery|COMMITTED|Recent Articles|How Florida|Subscribe|View All Reports)\b/i
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

function buildVerifiedOn3Summary(player) {
  const pos = player.pos || 'prospect';
  const stars = Number(player.stars);
  const parts = [];
  if (stars) parts.push(`${stars}-star ${pos}`);
  if (player.htWt) parts.push(`listed at ${player.htWt}`);
  if (player.school) parts.push(`from ${player.school}`);
  const ranks = [];
  if (player.natlRank != null) ranks.push(`#${player.natlRank} nationally`);
  if (player.posRank != null) ranks.push(`#${player.posRank} at ${pos}`);
  if (player.stateRank != null) ranks.push(`#${player.stateRank} in state`);
  if (ranks.length) parts.push(ranks.join(', '));

  let body = `${player.name} is a ${parts.join(' · ')}.`;
  const profileNote = String(player.profileNote || '').trim();
  if (
    profileNote &&
    profileNote.length >= 40 &&
    !intelQuality.isGenericBeatArticle(profileNote, player.name)
  ) {
    body += ` ${profileNote}`;
  } else if (player.commitDate) {
    body += ` Committed to Florida on ${player.commitDate}.`;
  } else {
    body += ' Committed to Florida.';
  }
  return body.length >= 80 ? body : null;
}

function breakdownIsCorrupt(existing, player) {
  if (!existing) return false;
  const name = player.name;
  const fields = [
    existing.insiderNotes,
    existing.projection,
    ...(existing.strengths || []),
  ].filter(Boolean);
  if (!fields.length) return false;
  return fields.some(
    (text) =>
      intelQuality.isGenericBeatArticle(String(text), name) ||
      !intelQuality.intelReferencesPlayer(String(text), name)
  );
}

function resolveFallbackSummary(player) {
  const fromPlayer = intelQuality.firstVerifiedIntel(
    player,
    ['skinny', 'insiderNotes', 'notePreview', 'evaluationSummary'],
    player.name
  );
  if (fromPlayer && fromPlayer.length >= 80) {
    return {
      summary: fromPlayer,
      writer: 'Charles Power',
      outlet: 'On3 profile',
      url: player.on3ProfileUrl || null,
      source: 'player-record',
    };
  }

  const entry = scoutingDb.getEntryBySlug(player.slug);
  if (entry) {
    const candidates = [
      entry.scoutingSummary,
      ...(entry.updates || []).map((u) => u.content),
    ].filter(Boolean);
    for (const text of candidates) {
      const body = String(text).trim();
      if (body.length < 80) continue;
      if (intelQuality.isGenericBeatArticle(body, player.name)) continue;
      return {
        summary: body,
        writer: entry.analystName || entry.updates?.[0]?.analystName || 'On3',
        outlet: entry.outlet || entry.updates?.[0]?.source?.split('/')?.[0]?.trim() || 'On3',
        url: entry.sourceUrl || entry.updates?.[0]?.sourceUrl || null,
        source: 'scouting-database',
      };
    }
  }

  const verified = buildVerifiedOn3Summary(player);
  if (verified) {
    return {
      summary: verified,
      writer: 'Charles Power',
      outlet: 'On3 verified composite',
      url: player.on3ProfileUrl || null,
      source: 'on3-verified-profile',
    };
  }

  return null;
}

function buildBreakdown(player, summary, url, comparison, sourceMeta = {}) {
  const writer = sourceMeta.writer || 'Charles Power';
  const outlet = sourceMeta.outlet || 'On3 / Rivals';
  const weaknessHints = sentencesFromSummary(summary).filter((s) =>
    /\b(question|need to|will need|remains a|lack of|older for|unverified|few years away|early in his development|still developing|can continue improving)\b/i.test(
      s
    )
  );
  const strengthHints = sentencesFromSummary(summary).filter(
    (s) => !weaknessHints.includes(s) && s.length > 25
  );

  const projection =
    sentencesFromSummary(summary).find(
      (s) =>
        !weaknessHints.includes(s) &&
        /\b(projectable|projects as|project as|ceiling|upside|impact|develop into|starter|rotation|early contributor|college level|day one|primed for|ready-to-play|instant impact|high-level|could be)\b/i.test(
          s
        )
    ) || null;

  return {
    playerSlug: player.slug,
    playerName: player.name,
    playerType: 'commit',
    sources: [
      {
        writer,
        outlet,
        url,
        publishedAt: new Date().toISOString().slice(0, 10),
      },
    ],
    strengths: strengthHints.slice(0, 8),
    weaknesses: weaknessHints.slice(0, 4),
    comparison: comparison || null,
    schemeFit: null,
    staffNotes: null,
    projection,
    insiderNotes: summary,
    recruitingStory: player.commitDate
      ? `Committed to Florida on ${player.commitDate}${player.school ? ` · ${player.school}` : ''}`
      : null,
    nflProjection: sentencesFromSummary(summary).find((s) => /\bdraft|NFL|pro\b/i.test(s)) || null,
  };
}

function parseOn3NilValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw === 'object') {
    const total = Number(raw.totalValue ?? raw.value ?? 0);
    if (Number.isFinite(total) && total > 0) return Math.round(total);
  }
  return null;
}

async function fetchOn3Page(slug, on3Id) {
  const url = `https://www.on3.com/rivals/${slug}-${on3Id}/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultSeed/1.0)' },
  });
  if (!res.ok) return { url, error: `HTTP ${res.status}` };
  const html = await res.text();
  const summary = extractScoutingSummary(html);
  const comparison = extractComparison(html);
  let nilValue = null;
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const pp = JSON.parse(nextMatch[1])?.props?.pageProps || {};
      nilValue = parseOn3NilValue(pp.player?.nilValue ?? pp.nilValue);
    } catch {
      /* optional */
    }
  }
  return { url, summary, comparison, nilValue };
}

async function main() {
  const { year, dryRun } = parseArgs();
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const commits = players.filter(
    (p) =>
      p.committedTo === 'Florida' &&
      Number(p.classYear) === year &&
      (p.on3Id || ON3_OVERRIDES[p.slug])
  );

  let seeded = 0;
  let nilSynced = 0;
  let skipped = 0;
  const report = [];

  for (const p of commits) {
    process.stderr.write(`… ${p.slug}\n`);
    try {
      const on3Id = p.on3Id || ON3_OVERRIDES[p.slug];
      const page = await fetchOn3Page(p.slug, on3Id);

      if (page.nilValue != null && page.nilValue !== p.nilValue) {
        p.nilValue = page.nilValue;
        p.nilEstimate = page.nilValue;
        p.nilSource = 'on3-profile';
        nilSynced += 1;
      }

      let summary = page.summary;
      let sourceMeta = { writer: 'Charles Power', outlet: 'On3 / Rivals' };
      let summarySource = 'on3-charles-power';

      if (!summary) {
        const fallback = resolveFallbackSummary(p);
        if (fallback) {
          summary = fallback.summary;
          sourceMeta = {
            writer: fallback.writer,
            outlet: fallback.outlet,
            url: fallback.url,
          };
          summarySource = fallback.source;
        }
      }

      if (!summary) {
        skipped += 1;
        report.push({ slug: p.slug, status: 'no_summary', nilValue: page.nilValue ?? null });
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const entry = buildBreakdown(
        p,
        summary,
        page.url || sourceMeta.url || null,
        page.comparison,
        sourceMeta
      );
      if (!entry.strengths.length && !entry.projection && !entry.insiderNotes) {
        skipped += 1;
        report.push({ slug: p.slug, status: 'empty_breakdown' });
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const existing = warRoom.getBreakdownBySlug(p.slug);
      const replaceExisting =
        !existing ||
        breakdownIsCorrupt(existing, p) ||
        summarySource === 'on3-charles-power' ||
        (summarySource === 'scouting-database' && breakdownIsCorrupt(existing, p));

      if (!replaceExisting && existing?.insiderNotes) {
        skipped += 1;
        report.push({ slug: p.slug, status: 'skipped_existing', summarySource });
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      if (!dryRun) {
        warRoom.upsertBreakdown(p.slug, entry);
      }
      seeded += 1;
      report.push({
        slug: p.slug,
        status: 'seeded',
        summarySource,
        strengths: entry.strengths.length,
        projection: !!entry.projection,
        nilValue: page.nilValue ?? null,
      });
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      process.stderr.write(`  err ${p.slug}: ${e.message}\n`);
      skipped += 1;
      report.push({ slug: p.slug, status: 'error', error: e.message });
    }
  }

  if (!dryRun) {
    fs.writeFileSync(PLAYERS_PATH, `${JSON.stringify(players, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        year,
        dryRun,
        commits: commits.length,
        seeded,
        nilSynced,
        skipped,
        breakdowns: dryRun ? null : warRoom.getAllBreakdowns().length,
        report,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
