import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export type PortalStatusValue = 'in' | 'target' | 'out';

export type PortalPlayer = RecruitingBoardPlayer & {
  portalStatus: PortalStatusValue;
  category?: string;
};

const PORTAL_STATUS_VALUES: PortalStatusValue[] = ['in', 'target', 'out'];

export function isPortalStatusValue(value: unknown): value is PortalStatusValue {
  return typeof value === 'string' && PORTAL_STATUS_VALUES.includes(value as PortalStatusValue);
}

/** Map store/API rows to hub portal buckets; HS recruits return null and are excluded. */
export function derivePortalStatus(
  player: RecruitingBoardPlayer & { portalStatus?: string; category?: string }
): PortalStatusValue | null {
  if (isPortalStatusValue(player.portalStatus)) {
    return player.portalStatus;
  }

  if (player.status === 'portal_out') return 'out';
  if (player.category !== 'portal') return null;

  const committed =
    player.isCommittedToUF ||
    player.committedTo === 'Florida' ||
    player.status === 'committed' ||
    player.status === 'enrolled';

  return committed ? 'in' : 'target';
}

export function withPortalStatus(
  player: RecruitingBoardPlayer & { portalStatus?: string; category?: string }
): PortalPlayer | null {
  const portalStatus = derivePortalStatus(player);
  if (!portalStatus) return null;
  return { ...player, portalStatus };
}

export type PortalBuckets = {
  incoming: PortalPlayer[];
  targets: PortalPlayer[];
  outgoing: PortalPlayer[];
};

export function buildPortalBuckets(
  incomingRaw: RecruitingBoardPlayer[],
  allPlayers: RecruitingBoardPlayer[]
): PortalBuckets {
  const pool = new Map<string, PortalPlayer>();

  for (const player of [...incomingRaw, ...allPlayers]) {
    const mapped = withPortalStatus(player);
    if (!mapped) continue;
    pool.set(mapped.slug, mapped);
  }

  const players = [...pool.values()];
  return {
    incoming: players.filter((p) => p.portalStatus === 'in'),
    targets: players.filter((p) => p.portalStatus === 'target'),
    outgoing: players.filter((p) => p.portalStatus === 'out'),
  };
}

export function filterPortalPlayers(players: PortalPlayer[]): PortalPlayer[] {
  return players.filter((p) => isPortalStatusValue(p.portalStatus));
}
