import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export type CommitCardProps = {
  playerId: string;
  name: string;
  position: string;
  height?: string;
  weight?: string;
  ranking: string;
  stars: number;
  commitDate?: string;
  hometown?: string;
  school?: string;
  photoUrl?: string;
};

function parseHtWt(htWt?: string | null): { height?: string; weight?: string } {
  if (!htWt) return {};
  const [height, weight] = htWt.split('/').map((part) => part.trim());
  return { height: height || undefined, weight: weight || undefined };
}

function on3CompositeLabel(player: RecruitingBoardPlayer): string {
  const natl = player.natlRank ?? player.natl;
  if (natl != null) return `On3 #${natl}`;
  if (player.rating != null) return `On3 ${Number(player.rating).toFixed(1)}`;
  if (player.displayRating != null) return `On3 ${Number(player.displayRating).toFixed(1)}`;
  return 'On3 —';
}

function mapPlayer(c: RecruitingBoardPlayer): CommitCardProps {
  const { height, weight } = parseHtWt(c.htWt);
  const slug = c.slug;
  return {
    playerId: slug,
    name: c.name,
    position: c.position || c.pos || '—',
    height,
    weight,
    ranking: on3CompositeLabel(c),
    stars: Number(c.stars) || 0,
    commitDate: c.commitDate ?? undefined,
    hometown: c.state ?? undefined,
    school: c.school ?? undefined,
    photoUrl: slug ? `/headshots/${encodeURIComponent(slug)}.jpg` : undefined,
  };
}

/** Map existing board commits for a class year — no ingest changes. */
export function mapCommits(commits: RecruitingBoardPlayer[], classYear: number): CommitCardProps[] {
  return commits.filter((c) => Number(c.classYear) === classYear).map(mapPlayer);
}

/** @deprecated use mapCommits(commits, 2026) */
export function mapCommits2026(commits: RecruitingBoardPlayer[]): CommitCardProps[] {
  return mapCommits(commits, 2026);
}
