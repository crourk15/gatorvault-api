/**
 * Event Clustering — group beat tweets into single UF football events.
 * One cluster → one elite quote retweet. Duplicates ignored.
 */
const crypto = require('crypto');
const copy = require('./x-autoposter-copy');
const beatFilters = require('./beat-writer-filters');
const template = require('./x-autoposter-template');
const sportClassifier = require('./x-autoposter-sport-classifier');
const { inferEventTypeFromText } = require('./x-autoposter-elite-research');

const CLUSTER_WINDOW_MS = parseInt(
  process.env.X_AUTOPOST_CLUSTER_WINDOW_MS || String(3 * 3600 * 1000),
  10
);

const SOURCE_TIER = {
  OFFICIAL_UF: 1,
  UF_ATHLETICS: 2,
  PRIMARY_BEAT: 3,
  NATIONAL_REPORTER: 4,
  OTHER_TRUSTED: 5
};

const OFFICIAL_UF_HANDLES = new Set([
  'gatorsfb',
  'uffootball',
  'florida_gators',
  'gatorfootball',
  'uf_football',
  'floridafootball'
]);

const UF_ATHLETICS_HANDLES = new Set(['floridagators', 'gators', 'ufathletics', 'gatorssports', 'florida_gators']);

const PRIMARY_BEAT_HANDLES = new Set([
  'corey_bender',
  'gatorsonline',
  'insidethegators',
  'onlygators',
  'gatorsbreakdown',
  'grahamhall_',
  'nickdelatorregc',
  'thomasgoldkamp',
  'blake_alderman',
  'keithniebuhr',
  'gatorsterritory',
  'alligatorarmy',
  'zachabolverdi',
  'andrew_ivins',
  'jamieivins',
  'ejhollandon3',
  'ttjharden8',
  'gatorsbreakdown'
]);

const NATIONAL_REPORTER_HANDLES = new Set([
  'hayesfawcett3',
  'chadsimmons_',
  'stevewiltfong',
  'charlespower'
]);

const PERSONAL_SKIP_RE =
  /\b(happy birthday|birthday wishes|wedding|anniversary|father'?s day|mother'?s day|merch|giveaway|podcast episode|listen (?:to|now)|subscribe to|my family|personal note|vacation photos?)\b/i;

const UF_FOOTBALL_NEWS_RE =
  /\b(recruit|commit|decommit|flip|portal|offer|visit|\bov\b|\buv\b|depth chart|injury|kickoff|schedule|signing|class of|rpm|futurecast|crystal ball|transfer|verb|official visit|unofficial visit|gators?|florida football|uf football|napier|sumrall)\b/i;

function isClusteringEnabled() {
  if (process.env.X_AUTOPOST_EVENT_CLUSTERING === 'false') return false;
  try {
    return require('./x-autoposter-elite-caption').isEliteModeEnabled();
  } catch {
    return true;
  }
}

function extractTweetId(post) {
  const url = String(post.url || '');
  const m = url.match(/status\/(\d+)/i);
  if (m) return m[1];
  const id = String(post.id || '');
  const xMatch = id.match(/^x_(\d+)$/);
  if (xMatch) return xMatch[1];
  return null;
}

function postUrls(post) {
  const urls = [];
  if (Array.isArray(post.attachmentUrls)) urls.push(...post.attachmentUrls);
  const text = String(post.text || '');
  urls.push(...(text.match(/https?:\/\/[^\s]+/g) || []));
  if (post.url) urls.push(post.url);
  return urls;
}

function classifySourceTier(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const urls = postUrls(post);

  if (OFFICIAL_UF_HANDLES.has(handle)) return SOURCE_TIER.OFFICIAL_UF;
  if (UF_ATHLETICS_HANDLES.has(handle)) return SOURCE_TIER.UF_ATHLETICS;
  if (urls.some((u) => /floridagators\.com/i.test(u))) return SOURCE_TIER.UF_ATHLETICS;

  if (PRIMARY_BEAT_HANDLES.has(handle)) return SOURCE_TIER.PRIMARY_BEAT;
  if (NATIONAL_REPORTER_HANDLES.has(handle) || beatFilters.isNationalUfOnlyReporter(post)) {
    return SOURCE_TIER.NATIONAL_REPORTER;
  }
  if (beatFilters.isTrustedBeatWriter(post)) return SOURCE_TIER.PRIMARY_BEAT;

  return SOURCE_TIER.OTHER_TRUSTED;
}

function sourceTierLabel(tier) {
  switch (tier) {
    case SOURCE_TIER.OFFICIAL_UF:
      return 'Official UF';
    case SOURCE_TIER.UF_ATHLETICS:
      return 'UF Athletics';
    case SOURCE_TIER.PRIMARY_BEAT:
      return 'Primary beat writer';
    case SOURCE_TIER.NATIONAL_REPORTER:
      return 'National reporter';
    default:
      return 'Trusted source';
  }
}

function scoreDetail(post) {
  const text = template.stripEmojisHashtags(post.text || '');
  let score = Math.min(text.length, 280);
  if (template.FACTUAL_SIGNAL_RE.test(text)) score += 40;
  if (template.INSIDER_SIGNAL_RE.test(text)) score += 25;
  if (Array.isArray(post.attachmentUrls) && post.attachmentUrls.length) score += 15;
  if (extractTweetId(post)) score += 10;
  return score;
}

function selectBestSource(posts) {
  const ranked = [...posts].sort((a, b) => {
    const tierA = classifySourceTier(a);
    const tierB = classifySourceTier(b);
    if (tierA !== tierB) return tierA - tierB;
    return scoreDetail(b) - scoreDetail(a);
  });
  const chosen = ranked[0];
  return {
    post: chosen,
    tier: classifySourceTier(chosen),
    tierLabel: sourceTierLabel(classifySourceTier(chosen)),
    ranked: ranked.map((p) => ({
      handle: p.handle,
      writer: p.writerName || p.outlet,
      tier: classifySourceTier(p),
      tierLabel: sourceTierLabel(classifySourceTier(p)),
      detailScore: scoreDetail(p),
      url: p.url,
      tweetId: extractTweetId(p),
      textPreview: String(p.text || '').slice(0, 120)
    }))
  };
}

function extractEventKeywords(text) {
  const t = String(text || '').toLowerCase();
  const keys = [];
  const patterns = [
    /\b(commit(?:ted|ment)?|decommit|flip(?:ped)?|portal|offer(?:ed)?)\b/,
    /\b(official visit|\bov\b|\buv\b|unofficial visit)\b/,
    /\b(prediction|futurecast|rpm|crystal ball)\b/,
    /\b(injury|depth chart|kickoff|schedule|staff|camp)\b/,
    /\b(trending|momentum|heating up)\b/
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) keys.push(m[1] || m[0]);
  }
  return [...new Set(keys)].slice(0, 4);
}

function clusterFingerprint(playerKey, eventType, anchorMs) {
  const bucket = Math.floor(anchorMs / CLUSTER_WINDOW_MS);
  const raw = `${playerKey}|${eventType}|${bucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function isNewsworthyBeatPost(post) {
  if (!beatFilters.shouldIncludeBeatPost(post)) return false;
  const text = String(post.text || '').trim();
  if (!text || text.length < 20) return false;
  if (PERSONAL_SKIP_RE.test(text)) return false;
  if (!beatFilters.isFloridaRelevantPost(post)) return false;
  if (!sportClassifier.isFootballAutoposterEligible(text, post)) return false;
  if (beatFilters.isHardBlockedNonUfContent(text)) return false;
  return true;
}

async function enrichPostMeta(post) {
  const prefilter = require('./beat-intel-prefilter');
  const guarded = await prefilter.guardBeatPost(post);
  const text = String(post.text || '');
  const playerName =
    guarded.playerName && copy.isValidPlayerName(guarded.playerName)
      ? guarded.playerName
      : copy.extractPlayerFromText(text);
  const eventType =
    inferEventTypeFromText(text) ||
    (guarded.triggerType === 'program_news' ? 'program_news' : null) ||
    (guarded.triggerType === 'team_event' ? 'team_event' : null) ||
    'update';
  const programKey =
    !playerName && (guarded.triggerType === 'program_news' || guarded.triggerType === 'team_event')
      ? `${guarded.triggerType}:${guarded.programNewsType || guarded.teamEventType || 'general'}`
      : null;

  const eligible =
    guarded.eligible !== false &&
    isNewsworthyBeatPost(post) &&
    (playerName || programKey || guarded.triggerType === 'program_news' || guarded.triggerType === 'team_event');

  return {
    post,
    guarded,
    eligible,
    playerName: playerName || null,
    playerSlug: guarded.playerSlug || null,
    eventType,
    programKey,
    triggerType: guarded.triggerType || null,
    keywords: extractEventKeywords(text)
  };
}

function postsMatchCluster(cluster, meta, postTime) {
  if (!meta.eligible) return false;

  const playerKey = (
    meta.playerSlug ||
    meta.playerName ||
    meta.programKey ||
    'program'
  ).toLowerCase();
  if (cluster.playerKey !== playerKey) return false;
  if (cluster.eventType !== meta.eventType) return false;
  if (Math.abs(postTime - cluster.latestAt) > CLUSTER_WINDOW_MS) return false;

  const sharedKeywords = meta.keywords.filter((k) => cluster.keywords.includes(k));
  if (meta.keywords.length && cluster.keywords.length && !sharedKeywords.length) {
    if (meta.eventType === 'update' || cluster.eventType === 'update') return true;
    return false;
  }
  return true;
}

async function buildClustersFromBeatPosts(posts) {
  const sorted = [...(posts || [])].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const clusters = [];

  for (const post of sorted) {
    const meta = await enrichPostMeta(post);
    if (!meta.eligible) continue;

    const postTime = new Date(post.publishedAt).getTime();
    if (Number.isNaN(postTime)) continue;

    const playerKey = (
      meta.playerSlug ||
      meta.playerName ||
      meta.programKey ||
      'program'
    ).toLowerCase();

    let cluster = clusters.find((c) => postsMatchCluster(c, meta, postTime));

    if (cluster) {
      cluster.posts.push(post);
      cluster.latestAt = Math.max(cluster.latestAt, postTime);
      cluster.earliestAt = Math.min(cluster.earliestAt, postTime);
      for (const kw of meta.keywords) {
        if (!cluster.keywords.includes(kw)) cluster.keywords.push(kw);
      }
      cluster.duplicateCount = cluster.posts.length - 1;
    } else {
      cluster = {
        id: clusterFingerprint(playerKey, meta.eventType, postTime),
        playerKey,
        playerName: meta.playerName,
        playerSlug: meta.playerSlug,
        eventType: meta.eventType,
        programKey: meta.programKey,
        triggerType: meta.triggerType,
        keywords: [...meta.keywords],
        posts: [post],
        latestAt: postTime,
        earliestAt: postTime,
        duplicateCount: 0
      };
      clusters.push(cluster);
    }
  }

  return clusters;
}

async function buildEliteClusterPost(cluster) {
  const clusterLog = require('./x-autoposter-cluster-log');
  const eliteCaption = require('./x-autoposter-elite-caption');

  if (!cluster?.posts?.length) {
    clusterLog.logClusterEvent({ skipped: true, skipReason: 'empty_cluster', cluster });
    return { ok: false, skipped: true, reason: 'empty_cluster' };
  }

  const combinedForSport = cluster.posts.map((p) => p.text).join(' ');
  if (!sportClassifier.isFootballAutoposterEligible(combinedForSport, cluster.posts[0])) {
    clusterLog.logClusterEvent({
      skipped: true,
      skipReason: 'non_football_sport',
      clusterId: cluster.id,
      eventType: cluster.eventType,
      playerName: cluster.playerName,
      sport: sportClassifier.classifySport(combinedForSport, cluster.posts[0]).sport
    });
    return { ok: false, skipped: true, reason: 'non_football_sport' };
  }

  const selection = selectBestSource(cluster.posts);
  const chosen = selection.post;
  const tweetId = extractTweetId(chosen);

  if (!tweetId) {
    clusterLog.logClusterEvent({
      skipped: true,
      skipReason: 'no_tweet_id',
      clusterId: cluster.id,
      eventType: cluster.eventType,
      playerName: cluster.playerName,
      duplicateCount: cluster.duplicateCount,
      clusterPosts: cluster.posts.length
    });
    return { ok: false, skipped: true, reason: 'no_tweet_id' };
  }

  const combinedBeatText = cluster.posts
    .map((p) => template.stripEmojisHashtags(p.text))
    .filter(Boolean)
    .join(' ');

  const built = await eliteCaption.buildEliteQuoteRetweet({
    beatText: combinedBeatText,
    sourcePost: chosen,
    sourceLabel: chosen.writerName || chosen.outlet || chosen.handle || 'Beat writer',
    playerName: cluster.playerName,
    playerSlug: cluster.playerSlug,
    eventType: cluster.eventType,
    triggerType: cluster.triggerType,
    clusterId: cluster.id,
    duplicateCount: cluster.duplicateCount
  });

  if (!built?.ok || !built.text) {
    clusterLog.logClusterEvent({
      skipped: true,
      skipReason: built?.reason || 'caption_failed',
      clusterId: cluster.id,
      eventType: cluster.eventType,
      playerName: cluster.playerName,
      chosenSource: selection,
      duplicateCount: cluster.duplicateCount,
      clusterPosts: cluster.posts.length,
      ignoredPosts: selection.ranked.slice(1).map((r) => r.url || r.handle)
    });
    return built || { ok: false, skipped: true, reason: 'caption_failed' };
  }

  const source = chosen.writerName || chosen.outlet || chosen.handle || 'Beat writer';
  const queueItem = {
    text: built.text,
    category: 'news',
    action: 'quote',
    topic: cluster.triggerType === 'program_news' ? 'program' : cluster.triggerType === 'team_event' ? 'team' : 'recruiting',
    urgencyLabel: cluster.triggerType === 'program_news' ? 'breaking' : 'major_beat',
    triggerType: cluster.triggerType,
    sourceEventType: `cluster:${cluster.eventType}`,
    sources: [{ label: source, url: chosen.url || null }],
    source: 'auto:event-cluster',
    quoteTweetId: tweetId,
    quoteTweetUrl: chosen.url || `https://x.com/i/status/${tweetId}`,
    intelFingerprint: cluster.id,
    clusterFingerprint: cluster.id,
    clusterMeta: {
      clusterId: cluster.id,
      eventType: cluster.eventType,
      duplicateCount: cluster.duplicateCount,
      clusterSize: cluster.posts.length,
      chosenSource: {
        handle: chosen.handle,
        writer: source,
        tier: selection.tier,
        tierLabel: selection.tierLabel,
        url: chosen.url,
        tweetId
      },
      ignoredSources: selection.ranked.slice(1)
    },
    playerName: built.playerName || cluster.playerName,
    sourceEventCreatedAt: chosen.publishedAt,
    sourcePublishedAt: chosen.publishedAt,
    templateBlocks: built.templateBlocks,
    validationMeta: {
      ...(built.validationMeta || {}),
      eliteMode: true,
      clusterId: cluster.id,
      quoteRetweet: true
    },
    playerContext: built.context
  };

  clusterLog.logClusterEvent({
    pass: true,
    clusterId: cluster.id,
    eventType: cluster.eventType,
    playerName: cluster.playerName,
    playerSlug: cluster.playerSlug,
    duplicateCount: cluster.duplicateCount,
    clusterSize: cluster.posts.length,
    chosenSource: queueItem.clusterMeta.chosenSource,
    ignoredSources: queueItem.clusterMeta.ignoredSources,
    sourcesUsed: built.validationMeta?.sourcesUsed || [],
    context: built.research
      ? {
          ufPosition: built.research.ufPosition,
          topSchools: built.research.topSchools,
          timing: built.research.timing
        }
      : null,
    templateBlocks: built.templateBlocks,
    finalCaption: built.text,
    programImpact: built.programImpact || null
  });

  return { ok: true, cluster, selection, queueItem, built };
}

module.exports = {
  isClusteringEnabled,
  CLUSTER_WINDOW_MS,
  SOURCE_TIER,
  extractTweetId,
  classifySourceTier,
  selectBestSource,
  isNewsworthyBeatPost,
  enrichPostMeta,
  buildClustersFromBeatPosts,
  buildEliteClusterPost,
  clusterFingerprint
};
