/**
 * FutureCast Phase 2 — transform legacy recruiting players.json → FutureCast format.
 * @see server/migrators/migrate-players.ts
 */
import fs from 'fs';
import path from 'path';
import { POSITIONS, type PortalStatus, type SignalType } from '../shared/enums';
import { validatePlayer, type InputPlayer } from '../migrators/migrate-players';

const SLUG_RE = /^[a-z0-9-]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_LEGACY = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'data', 'players.json');

const POSITION_ALIASES: Record<string, string> = {
  OT: 'OL',
  OG: 'OL',
  C: 'OL',
  IOL: 'OL',
  G: 'OL',
  T: 'OL',
  DE: 'DL',
  DT: 'DL',
  NT: 'DL',
  DB: 'S',
  FB: 'RB',
  LS: 'ATH',
};

export interface TransformSummary {
  transformed: number;
  hsProfiles: number;
  collegeProfiles: number;
  portalProfiles: number;
  ufProfiles: number;
  signals: number;
  errors: number;
}

type LegacyPlayer = Record<string, unknown>;

function slugify(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlug(raw: LegacyPlayer): string {
  const fromField = String(raw.slug || raw.id || '').trim().toLowerCase();
  const slug = SLUG_RE.test(fromField) ? fromField : slugify(String(raw.name || raw.full_name || ''));
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error('unable to derive valid slug');
  }
  return slug;
}

function normalizePosition(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const mapped = POSITION_ALIASES[upper] ?? upper;
  if ((POSITIONS as readonly string[]).includes(mapped)) {
    return mapped;
  }
  throw new Error(`unsupported position: ${raw} (mapped: ${mapped})`);
}

function parseClassYear(raw: LegacyPlayer): number {
  const value = raw.class_year ?? raw.classYear ?? raw.class;
  const year = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(year)) {
    throw new Error('class_year is required');
  }
  return year;
}

function parseHtWt(htWt: unknown): { height: number | null; weight: number | null } {
  if (typeof htWt !== 'string' || !htWt.trim()) {
    return { height: null, weight: null };
  }
  const match = htWt.match(/(\d+)-(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (!match) {
    return { height: null, weight: null };
  }
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  const weight = Number(match[3]);
  const height = Math.round(feet * 12 + inches);
  return {
    height: Number.isFinite(height) ? height : null,
    weight: Number.isFinite(weight) ? weight : null,
  };
}

function parseHometownSchool(school: unknown): { hometown: string | null; state: string | null; high_school: string | null } {
  if (typeof school !== 'string' || !school.trim()) {
    return { hometown: null, state: null, high_school: null };
  }
  const text = school.trim();
  if (!text.includes(',')) {
    return { hometown: null, state: null, high_school: text };
  }
  const parts = text.split(',').map((p) => p.trim());
  const state = parts[parts.length - 1] || null;
  const hometown = parts.slice(0, -1).join(', ') || null;
  return { hometown, state, high_school: null };
}

function normalizeRating(rating: unknown): number | null {
  if (rating == null || rating === '') return null;
  const n = Number(rating);
  if (!Number.isFinite(n)) return null;
  if (n > 1) return Math.round((n / 100) * 1000) / 1000;
  return n;
}

function legacyId(raw: LegacyPlayer): string | null {
  const id = raw.id;
  if (typeof id === 'string' && UUID_RE.test(id)) {
    return id;
  }
  return null;
}

function isTestPlayer(raw: LegacyPlayer): boolean {
  const slug = String(raw.slug || '').toLowerCase();
  const name = String(raw.name || raw.full_name || '').toLowerCase();
  return slug === 'test-recruit' || name === 'test recruit';
}

function hasLegacyPortal(raw: LegacyPlayer): boolean {
  if (raw.portal && typeof raw.portal === 'object') return true;
  return String(raw.category || '').toLowerCase() === 'portal';
}

function hasLegacyCollege(raw: LegacyPlayer): boolean {
  if (raw.college && typeof raw.college === 'object') return true;
  if (hasLegacyPortal(raw) && raw.fromSchool) return true;
  const status = String(raw.status || '').toLowerCase();
  return status === 'enrolled' && !!raw.fromSchool;
}

function hasLegacyHighSchool(raw: LegacyPlayer): boolean {
  if (raw.high_school && typeof raw.high_school === 'object') return true;
  return !hasLegacyPortal(raw) && !hasLegacyCollege(raw);
}

function computeLifecycle(raw: LegacyPlayer): 'HS' | 'COLLEGE' | 'PORTAL' {
  if (hasLegacyPortal(raw)) return 'PORTAL';
  if (hasLegacyCollege(raw)) return 'COLLEGE';
  return 'HS';
}

function mapPortalStatus(raw: LegacyPlayer): PortalStatus {
  const explicit = raw.portal && typeof raw.portal === 'object'
    ? (raw.portal as Record<string, unknown>).portal_status
    : null;
  if (typeof explicit === 'string') {
    const upper = explicit.toUpperCase();
    if (['IN_PORTAL', 'COMMITTED', 'WITHDRAWN', 'TRANSFERRED'].includes(upper)) {
      return upper as PortalStatus;
    }
  }

  const status = String(raw.status || '').toLowerCase();
  if (status === 'portal_in') return 'IN_PORTAL';
  if (status === 'withdrawn') return 'WITHDRAWN';
  if (status === 'transferred') return 'TRANSFERRED';
  if (status === 'committed' || status === 'enrolled') return 'COMMITTED';
  return 'IN_PORTAL';
}

function buildHighSchoolProfile(raw: LegacyPlayer): Record<string, unknown> | null {
  if (raw.high_school_profile && typeof raw.high_school_profile === 'object') {
    return raw.high_school_profile as Record<string, unknown>;
  }
  if (raw.high_school && typeof raw.high_school === 'object') {
    const hs = raw.high_school as Record<string, unknown>;
    return {
      offers: Array.isArray(hs.offers) ? hs.offers : [],
      stats: hs.stats && typeof hs.stats === 'object' ? hs.stats : {},
      recruiting_notes: typeof hs.recruiting_notes === 'string' ? hs.recruiting_notes : null,
      discovery_score: hs.discovery_score != null ? Number(hs.discovery_score) : null,
    };
  }
  if (!hasLegacyHighSchool(raw)) {
    return null;
  }

  const committedTo = raw.committedTo ?? raw.committed_to;
  const offers: unknown[] = [];
  if (typeof committedTo === 'string' && committedTo.trim()) {
    offers.push({
      school: committedTo.trim(),
      date: raw.commitDate ?? raw.commit_date ?? null,
    });
  }

  return {
    offers,
    stats: {
      stars: raw.stars ?? null,
      rating: raw.rating ?? null,
      natl_rank: raw.natlRank ?? raw.natl_rank ?? null,
      pos_rank: raw.posRank ?? raw.pos_rank ?? null,
      state_rank: raw.stateRank ?? raw.state_rank ?? null,
      on3_id: raw.on3Id ?? raw.on3_id ?? null,
    },
    recruiting_notes: String(raw.profileNote || raw.skinny || '').trim() || null,
    discovery_score: null,
  };
}

function buildCollegeProfile(raw: LegacyPlayer): Record<string, unknown> | null {
  if (raw.college_profile && typeof raw.college_profile === 'object') {
    return raw.college_profile as Record<string, unknown>;
  }
  if (raw.college && typeof raw.college === 'object') {
    const c = raw.college as Record<string, unknown>;
    return {
      college: c.college ?? c.school_name ?? c.school,
      years_played: c.years_played ?? null,
      games_played: c.games_played ?? null,
      snaps: c.snaps ?? {},
      stats: c.stats ?? {},
      depth_history: Array.isArray(c.depth_history) ? c.depth_history : [],
    };
  }
  if (!hasLegacyCollege(raw)) return null;

  const fromSchool = raw.fromSchool ?? raw.from_school;
  if (typeof fromSchool !== 'string' || !fromSchool.trim()) {
    return null;
  }

  return {
    college: fromSchool.trim(),
    years_played: null,
    games_played: null,
    snaps: {},
    stats: {},
    depth_history: [],
  };
}

function buildPortalProfile(raw: LegacyPlayer): Record<string, unknown> | null {
  if (raw.portal_profile && typeof raw.portal_profile === 'object') {
    return raw.portal_profile as Record<string, unknown>;
  }
  if (raw.portal && typeof raw.portal === 'object') {
    const p = raw.portal as Record<string, unknown>;
    return {
      previous_school: p.previous_school ?? null,
      entered_portal_at: p.entered_portal_at ?? null,
      exited_portal_at: p.exited_portal_at ?? null,
      portal_status: mapPortalStatus(raw),
      destination_school: p.destination_school ?? null,
      eligibility_remaining: p.eligibility_remaining ?? null,
      reason_tags: Array.isArray(p.reason_tags) ? p.reason_tags : [],
      portal_likelihood: p.portal_likelihood ?? null,
      likelihood_reason: p.likelihood_reason ?? null,
    };
  }
  if (!hasLegacyPortal(raw)) return null;

  const fromSchool = raw.fromSchool ?? raw.from_school;
  const committedTo = raw.committedTo ?? raw.committed_to;

  return {
    previous_school: typeof fromSchool === 'string' ? fromSchool : null,
    entered_portal_at: null,
    exited_portal_at: null,
    portal_status: mapPortalStatus(raw),
    destination_school: typeof committedTo === 'string' ? committedTo : null,
    eligibility_remaining: null,
    reason_tags: [],
    portal_likelihood: null,
    likelihood_reason: null,
  };
}

function buildUfProfile(raw: LegacyPlayer): Record<string, unknown> | null {
  if (raw.uf_specific_profile && typeof raw.uf_specific_profile === 'object') {
    return raw.uf_specific_profile as Record<string, unknown>;
  }

  const rivalsConfidence = raw.rivalsConfidence ?? raw.rivals_confidence;
  const hasRivals = raw.rivalsLastPrediction || rivalsConfidence != null;
  if (!hasRivals) return null;

  return {
    uf_fit_score: null,
    athletic_score: null,
    scheme_score: null,
    character_score: null,
    timeline_score: null,
    uf_status: 'TARGET',
    uf_commit_probability: rivalsConfidence != null ? Number(rivalsConfidence) : null,
    score_computed_at: null,
    depth_chart_path: null,
    evaluation_notes: typeof raw.rivalsLastPrediction === 'string' ? raw.rivalsLastPrediction : null,
    tags: [],
    metadata: {
      rivals_analyst: raw.rivalsAnalyst ?? null,
      rivals_article_url: raw.rivalsArticleUrl ?? null,
      on3_profile_url: raw.on3ProfileUrl ?? null,
    },
  };
}

function buildSignals(raw: LegacyPlayer): InputPlayer['signals'] {
  if (Array.isArray(raw.signals)) {
    return raw.signals.map((sig) => {
      const s = sig as Record<string, unknown>;
      return {
        signal_type: String(s.signal_type || s.type || 'OTHER').toUpperCase() as SignalType,
        signal_value:
          s.signal_value && typeof s.signal_value === 'object'
            ? (s.signal_value as Record<string, unknown>)
            : s.value && typeof s.value === 'object'
              ? (s.value as Record<string, unknown>)
              : {},
        created_at:
          typeof s.created_at === 'string'
            ? s.created_at
            : typeof s.createdAt === 'string'
              ? s.createdAt
              : new Date().toISOString(),
      };
    });
  }

  const out: NonNullable<InputPlayer['signals']> = [];
  const committedTo = raw.committedTo ?? raw.committed_to;
  if (typeof committedTo === 'string' && committedTo.trim()) {
    out.push({
      signal_type: 'OFFER',
      signal_value: { school: committedTo.trim() },
      created_at:
        typeof raw.commitDate === 'string'
          ? `${raw.commitDate}T12:00:00.000Z`
          : typeof raw.updatedAt === 'string'
            ? raw.updatedAt
            : new Date().toISOString(),
    });
  }

  if (raw.rivalsLastPrediction) {
    out.push({
      signal_type: 'EVALUATION_NOTE',
      signal_value: {
        prediction: raw.rivalsLastPrediction,
        analyst: raw.rivalsAnalyst ?? null,
        confidence: raw.rivalsConfidence ?? null,
      },
      created_at: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    });
  }

  return out;
}

export function transformLegacyPlayer(raw: LegacyPlayer): InputPlayer {
  const fullName = String(raw.full_name || raw.name || '').trim();
  if (!fullName) {
    throw new Error('name/full_name is required');
  }

  const slug = normalizeSlug(raw);
  const position = normalizePosition(String(raw.position || raw.pos || ''));
  const class_year = parseClassYear(raw);
  const { height, weight } = parseHtWt(raw.htWt ?? raw.ht_wt);
  const location = parseHometownSchool(raw.school);

  const high_school_profile = buildHighSchoolProfile(raw);
  const college_profile = buildCollegeProfile(raw);
  const portal_profile = buildPortalProfile(raw);
  const uf_specific_profile = buildUfProfile(raw);
  const signals = buildSignals(raw);

  const lifecycle = computeLifecycle(raw);

  const player: InputPlayer = {
    id: legacyId(raw),
    full_name: fullName,
    slug,
    class_year,
    position,
    status: lifecycle,
    height,
    weight,
    hometown: location.hometown,
    state: location.state,
    high_school: location.high_school,
    stars: raw.stars != null ? Number(raw.stars) : null,
    composite_rating: normalizeRating(raw.rating ?? raw.composite_rating),
    ranking_national: raw.natlRank != null ? Number(raw.natlRank) : raw.ranking_national != null ? Number(raw.ranking_national) : null,
    ranking_position: raw.posRank != null ? Number(raw.posRank) : raw.ranking_position != null ? Number(raw.ranking_position) : null,
    ranking_state: raw.stateRank != null ? Number(raw.stateRank) : raw.ranking_state != null ? Number(raw.ranking_state) : null,
    committed_to:
      typeof raw.committedTo === 'string'
        ? raw.committedTo
        : typeof raw.committed_to === 'string'
          ? raw.committed_to
          : null,
  };

  if (high_school_profile) player.high_school_profile = high_school_profile;
  if (college_profile) player.college_profile = college_profile;
  if (portal_profile) player.portal_profile = portal_profile;
  if (uf_specific_profile) player.uf_specific_profile = uf_specific_profile;
  if (signals.length) player.signals = signals;

  return player;
}

function printSummary(summary: TransformSummary): void {
  console.log('');
  console.log('--- FutureCast Transform Summary ---');
  console.log(`Players transformed: ${summary.transformed}`);
  console.log(`HS profiles: ${summary.hsProfiles}`);
  console.log(`College profiles: ${summary.collegeProfiles}`);
  console.log(`Portal profiles: ${summary.portalProfiles}`);
  console.log(`UF profiles: ${summary.ufProfiles}`);
  console.log(`Signals: ${summary.signals}`);
  console.log(`Errors: ${summary.errors}`);
  console.log('------------------------------------');
}

export async function runRecruitingTransform(
  legacyPath = DEFAULT_LEGACY,
  outputPath = DEFAULT_OUTPUT
): Promise<TransformSummary> {
  const summary: TransformSummary = {
    transformed: 0,
    hsProfiles: 0,
    collegeProfiles: 0,
    portalProfiles: 0,
    ufProfiles: 0,
    signals: 0,
    errors: 0,
  };

  if (!fs.existsSync(legacyPath)) {
    throw new Error(`Legacy file not found: ${legacyPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Legacy players.json must be a JSON array');
  }

  const output: InputPlayer[] = [];
  const seenSlugs = new Set<string>();

  for (const entry of parsed) {
    const hint =
      entry && typeof entry === 'object'
        ? String((entry as LegacyPlayer).slug || (entry as LegacyPlayer).name || 'unknown')
        : 'unknown';

    try {
      if (!entry || typeof entry !== 'object') {
        throw new Error('entry must be an object');
      }
      if (isTestPlayer(entry as LegacyPlayer)) {
        continue;
      }

      const player = transformLegacyPlayer(entry as LegacyPlayer);
      validatePlayer(player, seenSlugs);
      output.push(player);

      summary.transformed += 1;
      if (player.high_school_profile) summary.hsProfiles += 1;
      if (player.college_profile) summary.collegeProfiles += 1;
      if (player.portal_profile) summary.portalProfiles += 1;
      if (player.uf_specific_profile) summary.ufProfiles += 1;
      summary.signals += player.signals?.length ?? 0;
    } catch (err) {
      summary.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error transforming ${hint}:`, message);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  printSummary(summary);
  console.log(`Wrote ${output.length} players → ${outputPath}`);
  return summary;
}

if (require.main === module) {
  const legacy = process.argv[2] || DEFAULT_LEGACY;
  const output = process.argv[3] || DEFAULT_OUTPUT;
  runRecruitingTransform(legacy, output).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
