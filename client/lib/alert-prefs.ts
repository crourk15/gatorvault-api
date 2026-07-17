/**
 * Alert preferences — localStorage (compatible with monolith gv_alertPrefs).
 *
 * Delivery reality:
 * - visit: Web Push + email (Safari/Chrome) and native APNs when registered
 * - commit / score: server prefs + push when subscribed (native APNs / Web Push)
 * - everything else: in-app feed filter only (not lock-screen)
 */

export type AlertMethod = 'push' | 'email' | 'both';
export type AlertFreq = 'instant' | 'daily' | 'weekly';

export type AlertCategoryId =
  | 'commit'
  | 'portal'
  | 'visit'
  | 'offer'
  | 'offers'
  | 'prediction'
  | 'trending'
  | 'info'
  | 'article'
  | 'score'
  | 'thread'
  | 'breaking'
  | 'scouting';

/** Categories that can drive lock-screen / email delivery today. */
export type DeliverableAlertCategory = 'visit' | 'commit' | 'score';

export type AlertDeliveryStatus = 'live' | 'coming' | 'feed_only';

export type AlertPrefs = {
  method: AlertMethod;
  freq: AlertFreq;
  types: Record<AlertCategoryId, boolean>;
  followPlayers: string[];
  dailyTime?: string;
  dailyOpenIfNew?: boolean;
  timeZone?: string;
  emailTo?: string;
};

const STORAGE_KEY = 'gv_alertPrefs';

export const ALERT_CATEGORY_META: Record<
  AlertCategoryId,
  { label: string; status: AlertDeliveryStatus; hint: string }
> = {
  visit: {
    label: 'Visits',
    status: 'live',
    hint: 'Verified UF official visits — push + email',
  },
  commit: {
    label: 'Commits',
    status: 'live',
    hint: 'UF commits and flips — push when enabled',
  },
  score: {
    label: 'Scores',
    status: 'live',
    hint: 'Gators kickoff + final — game window only',
  },
  portal: {
    label: 'Portal',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  offer: {
    label: 'Offers',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  offers: {
    label: 'Offers',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  prediction: {
    label: 'Predictions',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  trending: {
    label: 'Trending',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  info: {
    label: 'Info',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  article: {
    label: 'Articles',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  thread: {
    label: 'Threads',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  breaking: {
    label: 'Breaking',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
  scouting: {
    label: 'Scouting',
    status: 'feed_only',
    hint: 'In-app feed only for now',
  },
};

/** Primary toggles shown on My Alerts (honest delivery surface). */
export const PRIMARY_ALERT_CATEGORIES: DeliverableAlertCategory[] = ['visit', 'commit', 'score'];

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  method: 'push',
  freq: 'instant',
  types: {
    commit: true,
    portal: false,
    visit: true,
    offer: false,
    offers: false,
    prediction: false,
    trending: false,
    info: false,
    article: false,
    score: true,
    thread: false,
    breaking: false,
    scouting: false,
  },
  followPlayers: [],
};

function mergeStored(stored: Partial<AlertPrefs> | null): AlertPrefs {
  const base: AlertPrefs = JSON.parse(JSON.stringify(DEFAULT_ALERT_PREFS));
  if (!stored || typeof stored !== 'object') return base;

  if (stored.method === 'push' || stored.method === 'email' || stored.method === 'both') {
    base.method = stored.method;
  }
  if (stored.freq === 'instant' || stored.freq === 'daily' || stored.freq === 'weekly') {
    base.freq = stored.freq;
  }
  if (stored.types && typeof stored.types === 'object') {
    for (const key of Object.keys(base.types) as AlertCategoryId[]) {
      if (typeof stored.types[key] === 'boolean') {
        base.types[key] = stored.types[key];
      }
    }
  }
  if (Array.isArray(stored.followPlayers)) {
    base.followPlayers = stored.followPlayers.slice();
  }
  if (stored.dailyTime) base.dailyTime = stored.dailyTime;
  if (typeof stored.dailyOpenIfNew === 'boolean') base.dailyOpenIfNew = stored.dailyOpenIfNew;
  if (stored.timeZone) base.timeZone = stored.timeZone;
  if (stored.emailTo) base.emailTo = stored.emailTo;

  return base;
}

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === 'undefined') return DEFAULT_ALERT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_PREFS;
    return mergeStored(JSON.parse(raw) as Partial<AlertPrefs>);
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPrefs(prefs: AlertPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

export type LocalRecentAlert = {
  title?: string;
  text?: string;
  type?: string;
  read?: boolean;
  _ts?: number;
};

export function loadLocalRecentAlerts(): LocalRecentAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('gv_recentAlerts');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalRecentAlert[];
    return Array.isArray(parsed) ? parsed.slice(-50).reverse() : [];
  } catch {
    return [];
  }
}

export function markLocalAlertsRead(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('gv_recentAlerts');
    if (!raw) return;
    const list = JSON.parse(raw) as LocalRecentAlert[];
    if (!Array.isArray(list)) return;
    list.forEach((a) => {
      a.read = true;
    });
    localStorage.setItem('gv_recentAlerts', JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
