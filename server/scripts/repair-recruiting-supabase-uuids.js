#!/usr/bin/env node
/**
 * Repair recruiting Supabase rows where slug was sent as players.id / recruiting_events.player_id.
 * Safe to re-run — verifies evan-pryor upsert and reports slug-as-id JSON records locally.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const store = require('../lib/recruiting-store');

const PLAYERS_JSON = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function scanLocalSlugIds() {
  let players;
  try {
    players = JSON.parse(fs.readFileSync(PLAYERS_JSON, 'utf8'));
  } catch {
    return { scanned: 0, slugIds: [] };
  }
  const slugIds = players
    .filter((p) => p.id && !store.isValidUuid(p.id))
    .map((p) => ({ slug: p.slug, id: p.id }));
  return { scanned: players.length, slugIds };
}

async function verifySupabasePlayer(slug) {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) return { skipped: true, reason: 'no_supabase' };

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(sbUrl, sbKey);
  const { data, error } = await sb.from('players').select('id, slug, name').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) return { slug, exists: false };
  return {
    slug,
    exists: true,
    id: data.id,
    idValid: store.isValidUuid(data.id),
    name: data.name
  };
}

async function upsertPortalProbe() {
  const existing = await store.getPlayerBySlug('evan-pryor');
  const probe = {
    ...(existing || {}),
    slug: 'evan-pryor',
    name: existing?.name || 'Evan Pryor',
    pos: existing?.pos || 'RB',
    classYear: existing?.classYear || 2026,
    category: 'portal',
    status: existing?.status || 'enrolled',
    committedTo: 'Florida',
    on3Id: existing?.on3Id || 43376
  };
  delete probe.id;
  const saved = await store.upsertPlayer(probe);
  return {
    ok: !!saved,
    slug: saved?.slug,
    id: saved?.id,
    idValid: store.isValidUuid(saved?.id)
  };
}

async function main() {
  const local = scanLocalSlugIds();
  console.log('[repair-recruiting-uuids] local JSON slug-as-id count:', local.slugIds.length);
  if (local.slugIds.length) {
    console.log('[repair-recruiting-uuids] examples:', local.slugIds.slice(0, 5));
  }

  const evan = await verifySupabasePlayer('evan-pryor');
  console.log('[repair-recruiting-uuids] evan-pryor supabase:', evan);

  const upsert = await upsertPortalProbe();
  console.log('[repair-recruiting-uuids] evan-pryor upsert probe:', upsert);

  if (!upsert.ok || !upsert.idValid) {
    console.error('[repair-recruiting-uuids] FAILED — upsert still produces invalid id');
    process.exit(1);
  }

  console.log('[repair-recruiting-uuids] OK');
}

main().catch((err) => {
  console.error('[repair-recruiting-uuids] fatal:', err.message);
  process.exit(1);
});
