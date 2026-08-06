#!/usr/bin/env node
/**
 * Persist a Vault film-desk eval (strengths, GatorVault comp, projection)
 * into War Room breakdowns + optional film-traits so FutureCast / player
 * profiles pick them up live.
 *
 * Usage:
 *   node server/scripts/upsert-vault-film-eval.js \
 *     --slug=hudson-west \
 *     --name="Hudson West" \
 *     --pos=QB \
 *     --type=target \
 *     --hudl="https://www.hudl.com/embed/video/3/..." \
 *     --comparison="West comps to Joe Flacco — …" \
 *     --projection="West projects as …" \
 *     --strengths="Trait one.|Trait two.|Trait three." \
 *     --angle="Short vault film angle."
 *
 * Or pass a JSON file:
 *   node server/scripts/upsert-vault-film-eval.js --file=server/data/war-room/vault-evals/hudson-west.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const warRoom = require('../lib/war-room-store');
const filmTraits = require('../lib/film-traits-store');
const { isFilmDeskMeta } = require('../lib/recruiting-intel-quality');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function splitPipeList(value) {
  if (!value) return [];
  return String(value)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadFromFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}


function lastNameFromPlayerName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(p));
  return parts.length ? parts[parts.length - 1] : '';
}

/** War Room corrupt-gate requires last name in key narrative fields. */
function ensureIdentityInText(text, playerName) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const last = lastNameFromPlayerName(playerName);
  if (!last) return raw;
  const escaped = last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\b' + escaped + '\\b', 'i').test(raw)) {
    return raw;
  }
  return `${last} — ${raw}`;
}

function buildPayload(raw) {
  const slug = String(raw.slug || raw.playerSlug || '').trim();
  if (!slug) throw new Error('--slug / playerSlug required');

  const hudl = String(raw.hudl || raw.highlightUrl || raw.url || '').trim();
  const publishedAt = String(raw.publishedAt || new Date().toISOString().slice(0, 10));

  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths
    : splitPipeList(raw.strengths);
  const weaknesses = Array.isArray(raw.weaknesses)
    ? raw.weaknesses
    : splitPipeList(raw.weaknesses);

  return {
    slug,
    playerName: String(raw.name || raw.playerName || slug).trim(),
    playerType: String(raw.type || raw.playerType || 'target').toLowerCase(),
    pos: raw.pos || raw.position || null,
    hudl,
    publishedAt,
    strengths,
    weaknesses,
    comparison: ensureIdentityInText(raw.comparison, raw.name || raw.playerName || slug),
    projection: ensureIdentityInText(raw.projection, raw.name || raw.playerName || slug),
    schemeFit: String(raw.schemeFit || '').trim() || null,
    // Film-desk provenance belongs in staffNotes — never insiderNotes (corrupt-gate).
    insiderNotes: (() => {
      const note = ensureIdentityInText(
        raw.insiderNotes || raw.eval,
        raw.name || raw.playerName || slug
      );
      if (!note || isFilmDeskMeta(note)) return null;
      return note;
    })(),
    staffNotes:
      String(raw.staffNotes || '').trim() ||
      `Vault film desk verified ${publishedAt}.`,
    recruitingStory: String(raw.recruitingStory || '').trim() || null,
    vaultFilmAngle: String(raw.angle || raw.vaultFilmAngle || '').trim() || null,
    traits: Array.isArray(raw.traits) ? raw.traits : strengths,
  };
}

function main() {
  const file = argValue('--file');
  const raw = file
    ? loadFromFile(file)
    : {
        slug: argValue('--slug'),
        name: argValue('--name'),
        pos: argValue('--pos'),
        type: argValue('--type'),
        hudl: argValue('--hudl'),
        comparison: argValue('--comparison'),
        projection: argValue('--projection'),
        strengths: argValue('--strengths'),
        weaknesses: argValue('--weaknesses'),
        schemeFit: argValue('--schemeFit'),
        insiderNotes: argValue('--insiderNotes') || argValue('--eval'),
        staffNotes: argValue('--staffNotes'),
        recruitingStory: argValue('--recruitingStory'),
        angle: argValue('--angle'),
        publishedAt: argValue('--publishedAt'),
      };

  const payload = buildPayload(raw);
  if (!payload.comparison) throw new Error('--comparison required');
  if (!payload.projection) throw new Error('--projection required');
  if (!payload.strengths.length) {
    throw new Error('--strengths required (pipe-separated tape traits)');
  }
  if (!payload.hudl && !hasFlag('--allow-no-hudl')) {
    throw new Error('--hudl highlight URL required (or pass --allow-no-hudl)');
  }

  const breakdown = warRoom.upsertBreakdown(payload.slug, {
    playerSlug: payload.slug,
    playerName: payload.playerName,
    playerType: payload.playerType,
    sources: [
      {
        writer: 'Charles Power',
        outlet: 'GatorVault film desk (Hudl)',
        url: payload.hudl || null,
        publishedAt: payload.publishedAt,
      },
    ],
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
    comparison: payload.comparison,
    projection: payload.projection,
    schemeFit: payload.schemeFit,
    insiderNotes: payload.insiderNotes,
    staffNotes: payload.staffNotes,
    recruitingStory: payload.recruitingStory,
    featured: false,
  });

  let film = null;
  if (payload.hudl || payload.vaultFilmAngle || payload.traits.length) {
    film = filmTraits.upsertFilmTraits(payload.slug, {
      playerName: payload.playerName,
      sources: payload.hudl
        ? [
            {
              type: 'hudl',
              label: 'Vault film desk highlight',
              url: payload.hudl,
            },
          ]
        : undefined,
      traits: payload.traits,
      vaultFilmAngle: payload.vaultFilmAngle,
      clipNotes: 'Vault film desk — persisted with War Room eval/comp/projection.',
      doNotClaim: [
        'Do not invent tackle totals or grades from highlight reps alone',
        'Do not overclaim NFL projection from camp/highlight reps alone',
      ],
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: payload.slug,
        warRoom: {
          comparison: breakdown.comparison,
          projection: breakdown.projection,
          strengths: breakdown.strengths?.length || 0,
          updatedAt: breakdown.updatedAt,
        },
        filmTraits: film
          ? {
              slug: film.slug || payload.slug,
              sources: (film.sources || []).length,
              traits: (film.traits || []).length,
            }
          : null,
      },
      null,
      2
    )
  );
}

main();
