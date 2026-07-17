import { getApiBase, isNativeApp } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

export type PushConfig = {
  ok: boolean;
  enabled: boolean;
  publicKey: string | null;
  apnsConfigured?: boolean;
};

export type AlertPushPrefs = {
  visit: boolean;
  commit: boolean;
  score: boolean;
  followPlayers: string[];
};

function authHeaders(json = false): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

export async function fetchPushConfig(): Promise<PushConfig> {
  const res = await fetch(`${getApiBase()}/api/push/config`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load push config.');
  return res.json() as Promise<PushConfig>;
}

async function subscribeWebPush(prefs: AlertPushPrefs): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const config = await fetchPushConfig();
  if (!config.enabled || !config.publicKey) {
    return { ok: false, reason: 'disabled' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const registration = await navigator.serviceWorker.register('/push-sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  const res = await fetch(`${getApiBase()}/api/push/subscribe`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      prefs,
    }),
  });

  if (res.status === 401) return { ok: false, reason: 'sign_in' };
  if (res.status === 403) return { ok: false, reason: 'membership' };
  if (!res.ok) return { ok: false, reason: 'server' };

  return { ok: true };
}

/** Register/update Web Push and/or native APNs prefs. */
export async function syncAlertPushPrefs(
  prefs: AlertPushPrefs
): Promise<{ ok: boolean; reason?: string }> {
  if (isNativeApp()) {
    try {
      const { registerNativePush } = await import('@/lib/native-push');
      return registerNativePush(prefs);
    } catch {
      return { ok: false, reason: 'unsupported' };
    }
  }
  return subscribeWebPush(prefs);
}

/** @deprecated Use syncAlertPushPrefs — kept for call-site compatibility. */
export async function subscribeVisitPush(
  visitEnabled: boolean,
  followPlayers: string[] = []
): Promise<{ ok: boolean; reason?: string }> {
  return syncAlertPushPrefs({
    visit: visitEnabled,
    commit: false,
    score: false,
    followPlayers,
  });
}

/** @deprecated Use syncAlertPushPrefs */
export async function syncVisitPushPrefs(options: {
  visit: boolean;
  followPlayers: string[];
}): Promise<{ ok: boolean; reason?: string }> {
  return syncAlertPushPrefs({
    visit: options.visit,
    commit: false,
    score: false,
    followPlayers: options.followPlayers,
  });
}

export async function unsubscribeVisitPush(): Promise<void> {
  if (isNativeApp()) {
    try {
      const { unregisterNativePush } = await import('@/lib/native-push');
      await unregisterNativePush();
    } catch {
      /* ok */
    }
    return;
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${getApiBase()}/api/push/unsubscribe`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe().catch(() => undefined);
}
