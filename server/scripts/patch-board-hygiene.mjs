import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function patch(fileRel, replacers) {
  const file = path.join(root, fileRel);
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacers) {
    if (!s.includes(from)) throw new Error(`patch miss in ${fileRel}: ${from.slice(0, 50)}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s, 'utf8');
  console.log('patched', fileRel);
}

patch('server/api/futurecast/early-discovery.ts', [
  [
    `import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';`,
    `import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';\nimport { enrichWithRankings } from './ranking-enrichment';`,
  ],
  [
    `  return rows.map((row: Record<string, unknown>, index: number) => ({\n    id: row.id,\n    slug: row.slug,\n    fullName: row.full_name,\n    classYear: row.class_year,\n    position: row.position,\n    state: row.state,\n    stars: row.stars,\n    discoveryScore: Number(row.discovery_score) || 0,\n    ufFitScore: row.uf_fit_score != null ? Number(row.uf_fit_score) : null,\n    ufStatus: row.uf_status,\n    signalCount: Number(row.signal_count) || 0,\n    rank: index + 1,\n  }));`,
    `  return rows.map((row: Record<string, unknown>, index: number) =>\n    enrichWithRankings({\n      id: row.id,\n      slug: row.slug,\n      fullName: row.full_name,\n      classYear: row.class_year,\n      position: row.position,\n      state: row.state,\n      stars: row.stars,\n      discoveryScore: Number(row.discovery_score) || 0,\n      ufFitScore: row.uf_fit_score != null ? Number(row.uf_fit_score) : null,\n      ufStatus: row.uf_status,\n      signalCount: Number(row.signal_count) || 0,\n      rank: index + 1,\n    })\n  );`,
  ],
]);

patch('client/lib/early-discovery-api.ts', [
  [
    `export interface EarlyDiscoveryPlayer {\n  id: string;\n  slug: string;\n  fullName: string;\n  classYear: number;\n  position: string | null;\n  state: string | null;\n  stars: number;\n  discoveryScore: number;\n  ufFitScore: number | null;\n  ufStatus: string | null;\n  signalCount: number;\n  rank: number;\n}`,
    `export interface EarlyDiscoveryPlayer {\n  id: string;\n  slug: string;\n  fullName: string;\n  classYear: number;\n  position: string | null;\n  state: string | null;\n  stars: number;\n  discoveryScore: number;\n  ufFitScore: number | null;\n  ufStatus: string | null;\n  signalCount: number;\n  rank: number;\n  compositeScore?: number;\n  nationalRank?: number | null;\n  positionRank?: number | null;\n  stateRank?: number | null;\n}`,
  ],
]);

patch('client/lib/recruiting-card-adapters.ts', [
  [
    `export function fromEarlyDiscovery(p: EarlyDiscoveryPlayer): RecruitingBoardPlayer {\n  return {\n    slug: p.slug,\n    name: p.fullName,\n    tier: p.ufStatus === 'TARGET' ? 'HIGH' : 'MEDIUM',\n    position: p.position ?? undefined,\n    classYear: p.classYear,\n    stars: p.stars ?? 0,\n    fitScore: p.discoveryScore,\n    ufProbability: p.discoveryScore > 0 ? Math.min(1, p.discoveryScore / 100) : 0,\n    skinny: \`Discovery \${p.discoveryScore}\${p.ufStatus ? \` Â· UF \${p.ufStatus}\` : ''}\${p.signalCount ? \` Â· \${p.signalCount} signals\` : ''}\`,\n  };\n}`,
    `export function fromEarlyDiscovery(p: EarlyDiscoveryPlayer): RecruitingBoardPlayer {\n  const composite = p.compositeScore ?? undefined;\n  return {\n    slug: p.slug,\n    name: p.fullName,\n    tier: p.ufStatus === 'TARGET' ? 'HIGH' : 'MEDIUM',\n    position: p.position ?? undefined,\n    classYear: p.classYear,\n    state: p.state ?? undefined,\n    stars: p.stars ?? 0,\n    rating: composite,\n    displayRating: composite,\n    natlRank: p.nationalRank ?? undefined,\n    posRank: p.positionRank ?? undefined,\n    stateRank: p.stateRank ?? undefined,\n    fitScore: p.ufFitScore ?? undefined,\n    ufProbability: p.discoveryScore > 0 ? Math.min(1, p.discoveryScore / 100) : 0,\n    skinny: \`Discovery score \${p.discoveryScore}\${p.signalCount ? \` Â· \${p.signalCount} signals\` : ''}\${p.ufStatus ? \` Â· UF \${p.ufStatus}\` : ''}\`,\n  };\n}`,
  ],
  [
    `    skinny:\n      p.portalLikelihood > 0\n        ? \`Portal likelihood \${p.portalLikelihood}% Â· \${p.signalCount} signals\`\n        : \`\${p.signalCount} FutureCast signals\`,`,
    `    skinny:\n      p.portalLikelihood > 0\n        ? \`Portal likelihood \${p.portalLikelihood}% Â· \${p.signalCount} signals\`\n        : p.signalCount > 0\n          ? \`\${p.signalCount} FutureCast signals\`\n          : undefined,`,
  ],
]);

patch('client/components/futurecast/EarlyDiscoveryGrid.tsx', [
  [
    `          <ClassicRecruitCard\n            player={fromEarlyDiscovery(player)}\n            variant="target"\n            rank={player.rank}\n          />`,
    `          <ClassicRecruitCard\n            player={fromEarlyDiscovery(player)}\n            variant="target"\n          />`,
  ],
]);

patch('client/components/futurecast/FutureCastBigBoardPage.tsx', [
  [
    `      <div className="fc-big-board-toolbar">`,
    `      {activeTab === 'early-discovery' && classYear < 2028 ? (\n        <p className="rh-elite-section__sub" style={{ margin: '0 0 0.75rem' }}>\n          Early Discovery covers class of 2028 and later (showing {earlyDiscoveryClassGte}+).\n        </p>\n      ) : null}\n\n      <div className="fc-big-board-toolbar">`,
  ],
]);

console.log('board hygiene patches done');
