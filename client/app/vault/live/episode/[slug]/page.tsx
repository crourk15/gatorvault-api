import React from 'react';
import { VaultPodcastEpisodePage } from '@/components/vault/live/VaultPodcastEpisodePage';
import { PODCAST_CATALOG } from '@/lib/podcast-catalog';

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams(): { slug: string }[] {
  return PODCAST_CATALOG.map((entry) => ({ slug: entry.id }));
}

/** GatorNation Live episode hub — canonical /vault/live/episode/:slug route. */
export default function VaultLiveEpisodeRoute({ params }: PageProps): React.ReactElement {
  return <VaultPodcastEpisodePage episodeId={params.slug} />;
}
