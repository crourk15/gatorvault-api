/** GatorNation Live — dev-ready prop types */

export type TickerTag = 'BREAKING' | 'VISIT' | 'COMMIT' | 'PORTAL' | 'RUMOR';

export type LiveTickerProps = {
  items: {
    type: TickerTag;
    text: string;
    timestamp: string;
    source: string;
    url?: string;
  }[];
  loading?: boolean;
};

export type PodcastCardProps = {
  id?: string;
  title: string;
  description: string;
  logoUrl?: string;
  thumbnailUrl?: string;
  hosts?: string[];
  appleUrl: string;
  spotifyUrl: string;
  youtubeUrl: string;
  websiteUrl: string;
};

export type RecruitingUpdateCardProps = {
  source: string;
  headline: string;
  url: string;
  timestamp: string;
  category: string;
  icon?: string;
};

export type LivePanelProps = {
  title: string;
  description?: string;
  insider?: boolean;
  items: {
    text: string;
    timestamp?: string;
    source?: string;
    url?: string;
    handle?: string;
    writerName?: string;
  }[];
};

export type RecruitingSnapshotProps = {
  commits: number;
  nationalRank: number | null;
  secRank: number | null;
  blueChips: number;
  inStatePercent: number;
  momentum: number;
  momentumTrend?: 'up' | 'down' | 'neutral';
};

/** Brand-aligned section copy */
export const GNL_COPY = {
  hero: {
    title: 'GATORNATION LIVE',
    subtitle: 'Real-time updates from beat writers, insiders, and official sources.',
    liveBadge: (seconds: number) => `LIVE • Updates every ${seconds} seconds`,
  },
  podcastHub: 'Podcast Hub',
  mediaGrid: 'Media Grid',
  trendingTopics: 'Trending Topics',
  filmRoomPreview: 'Film Room',
  filmRoomPreviewSubtitle: 'Scheme breakdowns, personnel notes, and cut-ups from the vault.',
  recruitingFeed: 'Latest Recruiting Updates',
  livePanels: 'Live Panels',
  snapshot: {
    title: 'Recruiting Snapshot',
    subtitle: "Your quick look at Florida's class performance and momentum.",
  },
  movementIntel: {
    title: 'Movement Intel',
    subtitle: "Who's rising, who's falling, and where the volatility sits.",
  },
  footer: {
    title: 'GatorNation Live Resources',
    tagline: 'Podcasts • Recruiting Hub • Movement Intel • Portal',
  },
  panels: {
    visits: {
      title: 'Visits Happening Now',
      description: 'Real-time tracking of recruits currently on campus.',
    },
    portal: {
      title: 'Portal Buzz',
      description: 'Latest movement, rumors, and trending portal targets.',
    },
    beat: {
      title: 'Beat Writer Highlights',
      description: 'Top notes from trusted Florida beat reporters.',
    },
    staff: {
      title: 'Staff Notes',
      description: 'Internal insights and behind-the-scenes intel. (Insider only)',
    },
  },
} as const;
