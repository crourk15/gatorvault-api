import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function patch(fileRel, replacers) {
  const file = path.join(root, fileRel);
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacers) {
    if (!s.includes(from)) {
      if (to.includes('position') && s.includes('position?: string')) {
        continue;
      }
      throw new Error(`patch miss in ${fileRel}: ${from.slice(0, 40)}`);
    }
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s, 'utf8');
  console.log('patched', fileRel);
}

patch('client/lib/early-discovery-api.ts', [
  [
    `export interface EarlyDiscoveryQuery {
  class_year_gte?: number;
  min_discovery_score?: number;
  limit?: number;
}`,
    `export interface EarlyDiscoveryQuery {
  class_year_gte?: number;
  min_discovery_score?: number;
  limit?: number;
  /** Client-side filter only (not sent to API until server supports ?position=). */
  position?: string;
}`,
  ],
]);

patch('client/components/futurecast/EarlyDiscoveryGrid.tsx', [
  [
    `export function EarlyDiscoveryGrid({ query, onPlayerClick }: EarlyDiscoveryGridProps): React.ReactElement {
  const [players, setPlayers] = useState<EarlyDiscoveryPlayer[]>([]);`,
    `export function EarlyDiscoveryGrid({ query, onPlayerClick }: EarlyDiscoveryGridProps): React.ReactElement {
  const { position, ...apiQuery } = query;
  const [players, setPlayers] = useState<EarlyDiscoveryPlayer[]>([]);`,
  ],
  [
    `      const data = await fetchEarlyDiscovery(query);
      setPlayers(data.players ?? []);`,
    `      const data = await fetchEarlyDiscovery(apiQuery);
      let list = data.players ?? [];
      if (position) {
        const pos = position.toUpperCase();
        list = list.filter((p) => (p.position || '').toUpperCase() === pos);
      }
      setPlayers(list.map((p, index) => ({ ...p, rank: index + 1 })));`,
  ],
  ['  }, [query]);', '  }, [apiQuery, position]);'],
]);

patch('client/components/futurecast/FutureCastBigBoardPage.tsx', [
  [
    `            min_discovery_score: 50,
            limit: 100,
          }}`,
    `            min_discovery_score: 50,
            limit: 100,
            position: position || undefined,
          }}`,
  ],
]);

console.log('client early-discovery position filter done');
