/**
 * FutureCast Phase 2 — players.json → Postgres migrator.
 * @see server/migrators/README.md
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  PLAYER_LIFECYCLE,
  PORTAL_STATUS,
  POSITIONS,
  SIGNAL_TYPE,
  UF_STATUS,
  type PlayerLifecycleStatus,
  type PortalStatus,
  type SignalType,
  type UFStatus,
} from '../shared/enums';
import { closeDb } from '../models/db';
import { upsertPlayer, type PlayerInsert } from '../models/player';
import { upsertHighSchoolProfile, type HighSchoolProfileInsert } from '../models/highschool-profile';
import { upsertCollegeProfile, type CollegeProfileInsert } from '../models/college-profile';
import { upsertPortalProfile, type PortalProfileInsert } from '../models/portal-profile';
import { upsertUFSpecificProfile, type UFSpecificProfileInsert } from '../models/uf-specific-profile';
import {
  insertDiscoverySignal,
  listDiscoverySignalsByPlayerId,
  type DiscoverySignalInsert,
} from '../models/discovery-signal';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SLUG_RE = /^[a-z0-9-]+$/;
const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'players.json');

export interface InputSignal {
  signal_type: string;
  signal_value?: Record<string, unknown>;
  created_at?: string;
}

export interface InputPlayer {
  id?: string | null;
  full_name: string;
  slug: string;
  class_year: number;
  position: string;
  status: string;
  height?: number | null;
  weight?: number | null;
  hometown?: string | null;
  state?: string | null;
  high_school?: string | null;
  stars?: number | null;
  composite_rating?: number | null;
  ranking_national?: number | null;
  ranking_position?: number | null;
  ranking_state?: number | null;
  committed_to?: string | null;
  high_school_profile?: Record<string, unknown> | null;
  college_profile?: Record<string, unknown> | null;
  portal_profile?: Record<string, unknown> | null;
  uf_specific_profile?: Record<string, unknown> | null;
  signals?: InputSignal[];
}

export interface MigratorSummary {
  imported: number;
  hsProfiles: number;
  collegeProfiles: number;
  portalProfiles: number;
  ufProfiles: number;
  signalsInserted: number;
  skipped: number;
  errors: number;
}

function isEnumMember<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function assertRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function assertRequiredNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a number`);
  }
  return n;
}

function validateClassYear(year: number): void {
  const max = new Date().getFullYear() + 6;
  if (year < 2010 || year > max) {
    throw new Error(`class_year must be between 2010 and ${max}`);
  }
}

function validateSlug(slug: string, seen: Set<string>): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`slug must be lowercase [a-z0-9-] only: ${slug}`);
  }
  if (seen.has(slug)) {
    throw new Error(`duplicate slug in file: ${slug}`);
  }
  seen.add(slug);
}

function validateOptionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): void {
  if (value == null || value === '') return;
  if (typeof value !== 'string' || !isEnumMember(value, allowed)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
}

export function validatePlayer(p: unknown, seenSlugs: Set<string>): asserts p is InputPlayer {
  if (!p || typeof p !== 'object') {
    throw new Error('player entry must be an object');
  }

  const row = p as InputPlayer;
  row.full_name = assertRequiredString(row.full_name, 'full_name');
  row.slug = assertRequiredString(row.slug, 'slug').toLowerCase();
  row.position = assertRequiredString(row.position, 'position').toUpperCase();
  row.status = assertRequiredString(row.status, 'status').toUpperCase();
  row.class_year = assertRequiredNumber(row.class_year, 'class_year');

  validateSlug(row.slug, seenSlugs);
  validateClassYear(row.class_year);

  if (!isEnumMember(row.position, POSITIONS)) {
    throw new Error(`position must be one of: ${POSITIONS.join(', ')}`);
  }
  if (!isEnumMember(row.status, PLAYER_LIFECYCLE)) {
    throw new Error(`status must be one of: ${PLAYER_LIFECYCLE.join(', ')}`);
  }

  if (row.portal_profile) {
    const portalStatus = row.portal_profile.portal_status;
    if (typeof portalStatus !== 'string' || !isEnumMember(portalStatus, PORTAL_STATUS)) {
      throw new Error(`portal_profile.portal_status must be one of: ${PORTAL_STATUS.join(', ')}`);
    }
  }
  if (row.uf_specific_profile) {
    validateOptionalEnum(row.uf_specific_profile.uf_status, 'uf_status', UF_STATUS);
  }
  for (const sig of row.signals ?? []) {
    if (typeof sig.signal_type !== 'string' || !isEnumMember(sig.signal_type, SIGNAL_TYPE)) {
      throw new Error(`signal_type must be one of: ${SIGNAL_TYPE.join(', ')}`);
    }
  }
}

function toPlayerInsert(p: InputPlayer): PlayerInsert {
  return {
    slug: p.slug,
    full_name: p.full_name,
    position: p.position,
    class_year: p.class_year,
    status: p.status as PlayerLifecycleStatus,
    height: p.height ?? null,
    weight: p.weight ?? null,
    hometown: p.hometown ?? null,
    state: p.state ?? null,
    high_school: p.high_school ?? null,
    stars: p.stars ?? null,
    composite_rating: p.composite_rating ?? null,
    ranking_national: p.ranking_national ?? null,
    ranking_position: p.ranking_position ?? null,
    ranking_state: p.ranking_state ?? null,
    committed_to: p.committed_to ?? null,
  };
}

function toHsInsert(playerId: string, raw: Record<string, unknown>): HighSchoolProfileInsert {
  return {
    player_id: playerId,
    offers: Array.isArray(raw.offers) ? raw.offers : [],
    stats: raw.stats && typeof raw.stats === 'object' ? (raw.stats as Record<string, unknown>) : {},
    recruiting_notes: typeof raw.recruiting_notes === 'string' ? raw.recruiting_notes : null,
    discovery_score: raw.discovery_score != null ? Number(raw.discovery_score) : null,
  };
}

function toCollegeInsert(playerId: string, raw: Record<string, unknown>): CollegeProfileInsert {
  return {
    player_id: playerId,
    college: assertRequiredString(raw.college, 'college_profile.college'),
    years_played: raw.years_played != null ? Number(raw.years_played) : null,
    games_played: raw.games_played != null ? Number(raw.games_played) : null,
    snaps: raw.snaps && typeof raw.snaps === 'object' ? (raw.snaps as Record<string, unknown>) : {},
    stats: raw.stats && typeof raw.stats === 'object' ? (raw.stats as Record<string, unknown>) : {},
    depth_history: Array.isArray(raw.depth_history) ? raw.depth_history : [],
  };
}

function toPortalInsert(playerId: string, raw: Record<string, unknown>): PortalProfileInsert {
  return {
    player_id: playerId,
    previous_school: typeof raw.previous_school === 'string' ? raw.previous_school : null,
    entered_portal_at: typeof raw.entered_portal_at === 'string' ? raw.entered_portal_at : null,
    exited_portal_at: typeof raw.exited_portal_at === 'string' ? raw.exited_portal_at : null,
    portal_status: raw.portal_status as PortalStatus,
    destination_school: typeof raw.destination_school === 'string' ? raw.destination_school : null,
    eligibility_remaining: raw.eligibility_remaining != null ? Number(raw.eligibility_remaining) : null,
    reason_tags: Array.isArray(raw.reason_tags) ? raw.reason_tags.map(String) : [],
    portal_likelihood: raw.portal_likelihood != null ? Number(raw.portal_likelihood) : null,
    likelihood_reason: typeof raw.likelihood_reason === 'string' ? raw.likelihood_reason : null,
  };
}

function toUfInsert(playerId: string, raw: Record<string, unknown>): UFSpecificProfileInsert {
  return {
    player_id: playerId,
    uf_fit_score: raw.uf_fit_score != null ? Number(raw.uf_fit_score) : null,
    athletic_score: raw.athletic_score != null ? Number(raw.athletic_score) : null,
    scheme_score: raw.scheme_score != null ? Number(raw.scheme_score) : null,
    character_score: raw.character_score != null ? Number(raw.character_score) : null,
    timeline_score: raw.timeline_score != null ? Number(raw.timeline_score) : null,
    uf_status: raw.uf_status != null ? (raw.uf_status as UFStatus) : null,
    uf_commit_probability: raw.uf_commit_probability != null ? Number(raw.uf_commit_probability) : null,
    score_computed_at: typeof raw.score_computed_at === 'string' ? raw.score_computed_at : null,
    depth_chart_path: typeof raw.depth_chart_path === 'string' ? raw.depth_chart_path : null,
    evaluation_notes: typeof raw.evaluation_notes === 'string' ? raw.evaluation_notes : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    metadata: raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : {},
  };
}

function signalDedupeKey(
  playerId: string,
  sig: InputSignal,
  signalValue: Record<string, unknown>
): string {
  return `${playerId}:${sig.signal_type}:${sig.created_at ?? ''}:${JSON.stringify(signalValue)}`;
}

function printSummary(summary: MigratorSummary): void {
  console.log('');
  console.log('--- FutureCast Player Migrator Summary ---');
  console.log(`Imported: ${summary.imported} players`);
  console.log(`HS profiles: ${summary.hsProfiles}`);
  console.log(`College profiles: ${summary.collegeProfiles}`);
  console.log(`Portal profiles: ${summary.portalProfiles}`);
  console.log(`UF profiles: ${summary.ufProfiles}`);
  console.log(`Signals inserted: ${summary.signalsInserted}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Errors: ${summary.errors}`);
  console.log('------------------------------------------');
}

export async function runPlayerMigrator(inputPath = DEFAULT_INPUT): Promise<MigratorSummary> {
  const summary: MigratorSummary = {
    imported: 0,
    hsProfiles: 0,
    collegeProfiles: 0,
    portalProfiles: 0,
    ufProfiles: 0,
    signalsInserted: 0,
    skipped: 0,
    errors: 0,
  };

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('players.json must be a JSON array');
  }

  const seenSlugs = new Set<string>();

  for (const entry of parsed) {
    const slugHint =
      entry && typeof entry === 'object' && 'slug' in entry ? String((entry as InputPlayer).slug) : 'unknown';

    try {
      validatePlayer(entry, seenSlugs);
      const p = entry as InputPlayer;

      const player = await upsertPlayer(toPlayerInsert(p));
      summary.imported += 1;

      if (p.high_school_profile) {
        await upsertHighSchoolProfile(toHsInsert(player.id, p.high_school_profile));
        summary.hsProfiles += 1;
      }
      if (p.college_profile) {
        await upsertCollegeProfile(toCollegeInsert(player.id, p.college_profile));
        summary.collegeProfiles += 1;
      }
      if (p.portal_profile) {
        await upsertPortalProfile(toPortalInsert(player.id, p.portal_profile));
        summary.portalProfiles += 1;
      }
      if (p.uf_specific_profile) {
        await upsertUFSpecificProfile(toUfInsert(player.id, p.uf_specific_profile));
        summary.ufProfiles += 1;
      }

      const existingSignals = await listDiscoverySignalsByPlayerId(player.id);
      const existingKeys = new Set(
        existingSignals.map((s) =>
          signalDedupeKey(player.id, { signal_type: s.signal_type, created_at: s.created_at }, s.signal_value)
        )
      );

      for (const sig of p.signals ?? []) {
        const signalValue =
          sig.signal_value && typeof sig.signal_value === 'object' ? sig.signal_value : {};
        const key = signalDedupeKey(player.id, sig, signalValue);
        if (existingKeys.has(key)) {
          summary.skipped += 1;
          continue;
        }

        const insert: DiscoverySignalInsert = {
          player_id: player.id,
          signal_type: sig.signal_type as SignalType,
          signal_value: signalValue,
        };
        await insertDiscoverySignal(insert);
        existingKeys.add(key);
        summary.signalsInserted += 1;
      }
    } catch (err) {
      summary.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error importing ${slugHint}:`, message);
    }
  }

  printSummary(summary);
  return summary;
}

if (require.main === module) {
  const input = process.argv[2] || DEFAULT_INPUT;
  runPlayerMigrator(input)
    .then(() => closeDb())
    .catch((err) => {
      console.error(err);
      closeDb().finally(() => process.exit(1));
    });
}
