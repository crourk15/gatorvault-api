/**
 * Alert preferences — localStorage (compatible with monolith gv_alertPrefs).
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
  { icon: string; label: string }
> = {
  commit: { icon: '🎯', label: 'Commits' },
  portal: { icon: '🔄', label: 'Portal' },
  visit: { icon: '📍', label: 'Visits' },
  offer: { icon: '📬', label: 'Offers' },
  offers: { icon: '📬', label: 'Offers' },
  prediction: { icon: '🔮', label: 'Predictions' },
  trending: { icon: '🔥', label: 'Trending' },
  info: { icon: 'ℹ️', label: 'Info' },
  article: { icon: '📰', label: 'Articles' },
  score: { icon: '🏟️', label: 'Scores' },
  thread: { icon: '💬', label: 'Threads' },
  breaking: { icon: '🚨', label: 'Breaking' },
  scouting: { icon: '⚔️', label: 'Scouting' },
};

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  method: 'push',
  freq: 'instant',
  types: {
    commit: true,
    portal: true,
    visit: true,
    offer: true,
    offers: true,
    prediction: true,
    trending: true,
    info: true,
    article: true,
    score: true,
    thread: true,
    breaking: true,
    scouting: true,
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
