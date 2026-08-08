/**
 * Silent first-touch attribution — no extra signup step.
 * Capture UTM/src/referrer on first landing; hold ~30 days; send once at register.
 */
export type FirstTouchAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  gclid: string | null;
  fbclid: string | null;
  referrer: string | null;
  landingPath: string | null;
  capturedAt: string;
};

const STORAGE_KEY = 'gv_first_touch';
const COOKIE_NAME = 'gv_ft';
const MAX_AGE_DAYS = 30;
const MAX_FIELD = 120;

function trimField(value: unknown): string | null {
  const s = String(value || '').trim().slice(0, MAX_FIELD);
  return s || null;
}

function parseCookie(): FirstTouchAttribution | null {
  if (typeof document === 'undefined') return null;
  try {
    const hit = document.cookie
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${COOKIE_NAME}=`));
    if (!hit) return null;
    const raw = decodeURIComponent(hit.slice(COOKIE_NAME.length + 1));
    return normalizeStored(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCookie(payload: FirstTouchAttribution): void {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
    const value = encodeURIComponent(JSON.stringify(payload));
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* private mode */
  }
}

function readStorage(): FirstTouchAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeStored(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStorage(payload: FirstTouchAttribution): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

function isExpired(capturedAt: string | null | undefined): boolean {
  const ms = Date.parse(String(capturedAt || ''));
  if (!Number.isFinite(ms)) return true;
  return Date.now() - ms > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function normalizeStored(raw: unknown): FirstTouchAttribution | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const capturedAt = trimField(o.capturedAt);
  if (!capturedAt || isExpired(capturedAt)) return null;
  return {
    source: trimField(o.source ?? o.utm_source),
    medium: trimField(o.medium ?? o.utm_medium),
    campaign: trimField(o.campaign ?? o.utm_campaign),
    content: trimField(o.content ?? o.utm_content),
    term: trimField(o.term ?? o.utm_term),
    gclid: trimField(o.gclid),
    fbclid: trimField(o.fbclid),
    referrer: trimField(o.referrer),
    landingPath: trimField(o.landingPath),
    capturedAt,
  };
}

function hasSignal(ft: FirstTouchAttribution | null): boolean {
  if (!ft) return false;
  return Boolean(
    ft.source ||
      ft.medium ||
      ft.campaign ||
      ft.content ||
      ft.term ||
      ft.gclid ||
      ft.fbclid ||
      ft.referrer
  );
}

function captureFromLocation(): FirstTouchAttribution | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const source =
    trimField(params.get('utm_source')) ||
    trimField(params.get('src')) ||
    trimField(params.get('source'));
  const medium = trimField(params.get('utm_medium')) || trimField(params.get('medium'));
  const campaign = trimField(params.get('utm_campaign')) || trimField(params.get('campaign'));
  const content = trimField(params.get('utm_content'));
  const term = trimField(params.get('utm_term'));
  const gclid = trimField(params.get('gclid'));
  const fbclid = trimField(params.get('fbclid'));
  let referrer: string | null = null;
  try {
    const ref = String(document.referrer || '').trim();
    if (ref) {
      const host = new URL(ref).hostname.replace(/^www\./i, '');
      const selfHost = window.location.hostname.replace(/^www\./i, '');
      if (host && host !== selfHost) referrer = host.slice(0, MAX_FIELD);
    }
  } catch {
    referrer = null;
  }
  const landingPath = trimField(
    `${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, MAX_FIELD)
  );
  const payload: FirstTouchAttribution = {
    source,
    medium,
    campaign,
    content,
    term,
    gclid,
    fbclid,
    referrer,
    landingPath,
    capturedAt: new Date().toISOString(),
  };
  // Only stamp when we have a real external/campaign signal (not bare internal navigations).
  if (!hasSignal(payload)) return null;
  return payload;
}

/** Read existing first-touch (cookie → localStorage). */
export function getFirstTouchAttribution(): FirstTouchAttribution | null {
  return parseCookie() || readStorage();
}

/**
 * Capture first-touch once. Never overwrites an existing unexpired stamp.
 * Safe to call on every page load.
 */
export function captureFirstTouchAttribution(): FirstTouchAttribution | null {
  if (typeof window === 'undefined') return null;
  const existing = getFirstTouchAttribution();
  if (existing) return existing;
  const next = captureFromLocation();
  if (!next) return null;
  writeStorage(next);
  writeCookie(next);
  return next;
}

/** Payload for POST /api/register — null when unknown/direct with no signal. */
export function firstTouchForRegister(): FirstTouchAttribution | null {
  captureFirstTouchAttribution();
  return getFirstTouchAttribution();
}

/** Human outlet label for admin UI. */
export function formatFirstTouchSource(ft: FirstTouchAttribution | null | undefined): string {
  if (!ft) return 'direct';
  if (ft.source) return ft.source;
  if (ft.referrer) return ft.referrer;
  if (ft.gclid) return 'google';
  if (ft.fbclid) return 'meta';
  return 'direct';
}
