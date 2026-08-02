#!/usr/bin/env node
/**
 * Audit 2028 FutureCast chase ranking — who scores where and why.
 *
 *   node server/scripts/audit-chase-board.js
 *   node server/scripts/audit-chase-board.js --year=2028 --top=25
 */
'use strict';

const { buildChaseFeatureIndex, computeChaseScore } = require('../lib/uf-chase-score');
const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
const { getLiveBoardTargets } = require('../lib/live-board-targets');

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

function ptsBreakdown(chase, feat) {
  const { visitChasePoints, recentVisitPoints } = require('../lib/uf-chase-score');
  return {
    visits: chase.visitPts != null ? chase.visitPts : visitChasePoints(feat.ov, feat.uv),
    recentVisit: recentVisitPoints(feat.latestVisitAt),
    flOffer: (feat.flOffers || 0) > 0 ? 14 : 0,
    ufStatus:
      chase.ufStatus === 'PRIORITY' ? 14 : chase.ufStatus === 'TARGET' ? 8 : 0,
    staffLead: chase.hasStaffLead ? 8 : 0,
    secondary: chase.hasSecondaryRecruiter ? 6 : 0,
    staffFlag: chase.hasStaffFlag ? 16 : 0,
    pursuit: Math.min(16, (chase.pursuit || 0) * 5),
    scheduledOv: chase.scheduledOv ? 8 : 0,
    intel: Math.min(14, (chase.intel || 0) * 2),
    allowlist: chase.allowlisted || chase.headliner ? 10 : 0,
  };
}

async function main() {
  const year = Number(argValue('--year', '2028')) || 2028;
  const topN = Number(argValue('--top', '25')) || 25;
  const index = buildChaseFeatureIndex({ classYear: year });
  const allow = getAllowlistSet(year);
  const live = await getLiveBoardTargets(year);

  const scored = live
    .map((t) => {
      const slug = String(t.slug || '').toLowerCase();
      const result = computeChaseScore(
        {
          slug,
          ufFitScore: t.rating || t.fitScore || 0,
          uf_status: t.uf_status || t.ufStatus || null,
          evaluation_notes: t.evaluation_notes || t.evaluationNotes || null,
          signals: t.signals || [],
        },
        index
      );
      const feat = index.bySlug.get(slug) || { ov: 0, uv: 0, flOffers: 0, latestVisitAt: 0 };
      const recent = (result.chase?.visitPts || 0) > 0 && recentVisitAgeLabel(feat.latestVisitAt);
      return {
        slug,
        name: t.name || slug,
        pos: t.pos || t.position || '—',
        chaseScore: result.chaseScore,
        chase: result.chase,
        feat,
        recent,
        pts: ptsBreakdown(result.chase, feat),
        allowlisted: allow.has(slug),
      };
    })
    .sort((a, b) => b.chaseScore - a.chaseScore || a.name.localeCompare(b.name));

  console.log(`\n=== ${year} FutureCast chase audit ===`);
  console.log(
    JSON.stringify(
      {
        liveBoard: live.length,
        allowlist: allow.size,
        visitFeatureSlugs: index.bySlug.size,
        intelSlugs: index.intelCounts.size,
        pursuitSlugs: index.pursuitCounts?.size || 0,
        staffAssigned: Object.keys(index.staffMap || {}).length,
      },
      null,
      2
    )
  );

  console.log(`\nTop ${topN} by chaseScore:`);
  for (let i = 0; i < Math.min(topN, scored.length); i += 1) {
    const r = scored[i];
    const tags = [
      r.chase.hasStaffLead ? 'staff' : '',
      r.chase.hasSecondaryRecruiter ? '2nd' : '',
      r.chase.pursuit ? `pursue${r.chase.pursuit}` : '',
      r.chase.scheduledOv ? 'schedOV' : '',
      r.recent || '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `${String(i + 1).padStart(2)}. ${r.name.padEnd(22)} ${String(r.pos).padEnd(4)} chase=${String(r.chaseScore).padStart(5)}  ov${r.feat.ov}/uv${r.feat.uv}/off${r.feat.flOffers} intel${r.chase.intel}${tags ? ` ${tags}` : ''}  pts=${JSON.stringify(r.pts)}`
    );
  }

  // Coverage: FL offer + OV not on this year's live board (often other class years).
  const onBoard = new Set(scored.map((r) => r.slug));
  const gaps = [];
  for (const [slug, feat] of index.bySlug) {
    if (onBoard.has(slug)) continue;
    if ((feat.flOffers || 0) < 1) continue;
    if ((feat.ov || 0) < 1 && (feat.uv || 0) < 2) continue;
    const result = computeChaseScore({ slug }, index);
    gaps.push({ slug, chaseScore: result.chaseScore, ...feat, intel: result.chase.intel });
  }
  gaps.sort((a, b) => b.chaseScore - a.chaseScore);
  console.log(`\nHigh FL traction NOT on ${year} live board (check class year / allowlist):`);
  gaps.slice(0, 12).forEach((g) => console.log(' -', g));

  const flat = scored.filter((r) => r.feat.ov === 0 && r.feat.uv === 2 && r.feat.flOffers >= 1);
  console.log(`\nFlat cluster (0 OV / 2 UV / FL offer): ${flat.length} of ${scored.length} live targets`);
  const oneVisitPursuit = scored.filter(
    (r) => (r.feat.ov || 0) + (r.feat.uv || 0) === 1 && (r.chase.pursuit || r.chase.hasSecondaryRecruiter)
  );
  console.log(
    `1-visit + pursuit/secondary: ${oneVisitPursuit.length} (should be able to outrank multi-visit campers)`
  );
  console.log('Done.\n');
}

function recentVisitAgeLabel(latestVisitAt) {
  const { recentVisitPoints } = require('../lib/uf-chase-score');
  const pts = recentVisitPoints(latestVisitAt);
  if (pts >= 3) return 'recent21';
  if (pts >= 2) return 'recent45';
  if (pts >= 1) return 'recent90';
  return '';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
