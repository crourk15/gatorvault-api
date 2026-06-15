import React from 'react';
import { VaultPodcastEpisodePage } from '@/components/vault/live/VaultPodcastEpisodePage';
import { PODCAST_CATALOG } from '@/lib/podcast-catalog';

type PageProps = {
  params: { id: string };
};

export function generateStaticParams(): { id: string }[] {
  return PODCAST_CATALOG.map((entry) => ({ id: entry.id }));
}

export default function VaultPodcastEpisodeRoute({ params }: PageProps): React.ReactElement {
  return <VaultPodcastEpisodePage episodeId={params.id} />;
}
