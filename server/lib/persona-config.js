/**
 * GatorVault personas — each backed by real systems, stores, and vault routes.
 */
const PERSONAS = [
  {
    id: 'recruiting_obsessive',
    title: 'The Recruiting Obsessive',
    icon: '🏈',
    tagline: 'Tracks every commit, decommit, flip, and visit in real time.',
    vaultTab: 'recruit',
    systems: [
      {
        id: 'recruiting_board_db',
        name: 'Recruiting Board DB',
        tables: ['players', 'classes', 'visits', 'predictions', 'flip_risk', 'rpm_history'],
        store: 'data/recruiting/players.json',
        api: '/api/recruiting/board'
      },
      {
        id: 'live_board_ui',
        name: 'Live 2026/2027 Board UI',
        route: 'recruit',
        api: '/api/recruiting/feed'
      },
      {
        id: 'alerts_engine',
        name: 'Alerts Engine',
        store: 'data/recruiting/intel.json',
        events: ['commit', 'decommit', 'flip', 'ov_weekend', 'portal_radar'],
        api: '/api/recruiting/internal-alerts'
      }
    ],
    features: [
      'Live 2026/2027 board with star ratings and flip risk',
      'Beat writer stream + recruiting momentum alerts',
      'OV weekend intel and portal radar in one dashboard'
    ]
  },
  {
    id: 'film_room_nerd',
    title: 'The Film Room Nerd',
    icon: '📊',
    tagline: 'Wants verified scheme intel — not hot takes or third-party video.',
    vaultTab: 'highlights',
    systems: [
      {
        id: 'knowledge_engine_db',
        name: 'Verified Knowledge Engine DB',
        tables: ['football_concepts', 'uf_scheme_library', 'player_traits', 'opponent_tendencies', 'film_room_lessons'],
        store: 'data/film-room-knowledge/',
        api: '/api/film-room/knowledge/catalog'
      },
      {
        id: 'weekly_scheduler',
        name: 'Weekly Scheduler',
        outputs: ['Weekly Scheme School', 'Play of the Week'],
        api: '/api/film-room/catalog'
      },
      {
        id: 'film_room_catalog',
        name: 'Film Room Catalog UI',
        categories: ['Scheme School', 'Play of the Week', 'Matchup Spotlight', 'Recruit Fit', 'Player Traits'],
        route: 'highlights'
      }
    ],
    features: [
      'Weekly Scheme School & Play of the Week',
      'Scheme breakdowns, recruit fit & opponent prep',
      'Coaching-sourced text lessons — no hot takes or embeds'
    ]
  },
  {
    id: 'game_week_planner',
    title: 'The Game Week Planner',
    icon: '🗓️',
    tagline: 'Needs depth charts, injuries, and predictions before kickoff.',
    vaultTab: 'dc',
    systems: [
      {
        id: 'depth_chart_db',
        name: 'Depth Chart DB',
        tables: ['players', 'positions', 'status', 'injuries'],
        store: 'data/roster/players.json',
        api: '/api/roster/players'
      },
      {
        id: 'game_zone_db',
        name: 'Game Zone DB',
        fields: ['opponent', 'spread', 'total', 'sportsbook_links', 'confidence', 'keys_to_game'],
        api: '/api/betting/lines'
      },
      {
        id: 'weekly_game_job',
        name: 'Weekly Game Job',
        schedule: 'Updates depth chart + Game Zone before kickoff',
        route: 'gamezone'
      }
    ],
    features: [
      'Real starting-lineup intel beyond the official depth chart',
      'Game Zone with spread, total, and sportsbook links',
      'Confidence ratings and keys to the game every week'
    ]
  },
  {
    id: 'portal_hawk',
    title: 'The Transfer Portal Hawk',
    icon: '🔄',
    tagline: 'Follows every portal entry and exit obsessively.',
    vaultTab: 'portal',
    systems: [
      {
        id: 'portal_tracker_db',
        name: 'Portal Tracker DB',
        tables: ['portal_entries', 'portal_targets', 'position_needs', 'fit_scores', 'likelihood_to_land'],
        store: 'data/recruiting/players.json',
        api: '/api/recruiting/portal'
      },
      {
        id: 'comparison_engine',
        name: 'Comparison Engine',
        compares: ['incoming_vs_outgoing', 'traits', 'scheme_fit'],
        api: '/api/scouting/database'
      },
      {
        id: 'portal_alerts',
        name: 'Portal Alerts',
        sync: 'beat_writer_stream',
        api: '/api/live/dashboard'
      }
    ],
    features: [
      'Full portal tracker with position needs and likelihood to land',
      'Scheme-fit analysis and comparison to outgoing players',
      'Live portal alerts synced to the beat writer stream'
    ]
  },
  {
    id: 'fantasy_pickem',
    title: "The Fantasy/Pick'em Competitor",
    icon: '🏆',
    tagline: "Plays DFS, pick'em contests, or fantasy CFB.",
    vaultTab: 'gamezone',
    systems: [
      {
        id: 'prediction_db',
        name: 'Prediction DB',
        tables: ['game_picks', 'props', 'confidence', 'line_movement', 'results'],
        api: '/api/betting/lines'
      },
      {
        id: 'contest_engine',
        name: 'Contest Engine',
        features: ['Vault Points', 'weekly_pickem', 'leaderboard'],
        api: '/api/points/me'
      },
      {
        id: 'game_week_intel',
        name: 'Game-Week Intel Feed',
        surfaces: ['injury', 'depth_chart', 'matchup_notes'],
        api: '/api/live/dashboard'
      }
    ],
    features: [
      'Insider predictions, line movement context, and prop angles',
      'Game-week intel before it hits mainstream media',
      "Vault Points pick'em and weekly prediction contests"
    ]
  },
  {
    id: 'everyday_fan',
    title: 'The Everyday Gator Fan',
    icon: '🐊',
    tagline: 'Wants all-football coverage, community, and news in one hub.',
    vaultTab: 'live',
    systems: [
      {
        id: 'live_dashboard',
        name: 'Live Dashboard',
        api: '/api/live/dashboard'
      },
      {
        id: 'community_store',
        name: 'Community Threads',
        store: 'data/community/',
        api: '/api/community/threads'
      },
      {
        id: 'content_store',
        name: 'Articles & Headlines',
        api: '/api/content/articles'
      }
    ],
    features: [
      'Curated headlines + live beat writer stream',
      'Podcast hub, community threads, and breaking alerts',
      'Roster profiles, depth charts, and season-long storylines'
    ]
  }
];

function buildPersonasPayload() {
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    personas: PERSONAS
  };
}

function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}

module.exports = {
  PERSONAS,
  buildPersonasPayload,
  getPersona
};
