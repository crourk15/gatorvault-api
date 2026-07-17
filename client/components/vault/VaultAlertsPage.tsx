'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ALERT_CATEGORY_META,
  DEFAULT_ALERT_PREFS,
  PRIMARY_ALERT_CATEGORIES,
  loadAlertPrefs,
  loadLocalRecentAlerts,
  markLocalAlertsRead,
  saveAlertPrefs,
  type AlertFreq,
  type AlertMethod,
  type AlertPrefs,
  type DeliverableAlertCategory,
  type LocalRecentAlert,
} from '@/lib/alert-prefs';
import { fetchAlerts, type FutureCastAlert } from '@/lib/alerts-api';
import { syncAlertPushPrefs, unsubscribeVisitPush } from '@/lib/push-alerts-api';
import { syncEmailAlertPrefs } from '@/lib/alert-email-api';
import { isNativeApp } from '@/lib/api-base';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const REFRESH_MS = 60_000;

function ChoiceButtons<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <div className="gv-alert-choices" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`gv-alert-choice${value === opt.id ? ' is-active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function VaultAlertsPage(): React.ReactElement {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_ALERT_PREFS);
  const [saved, setSaved] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [apiAlerts, setApiAlerts] = useState<FutureCastAlert[]>([]);
  const [localAlerts, setLocalAlerts] = useState<LocalRecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [nativeShell, setNativeShell] = useState(false);

  useEffect(() => {
    setPrefs(loadAlertPrefs());
    setLocalAlerts(loadLocalRecentAlerts());
    setNativeShell(isNativeApp());
  }, []);

  const loadFeed = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await fetchAlerts();
      setApiAlerts(rows);
      setLocalAlerts(loadLocalRecentAlerts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alerts.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await loadFeed(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [loadFeed]);

  const toggleCategory = (id: DeliverableAlertCategory) => {
    setPrefs((p) => ({
      ...p,
      types: { ...p.types, [id]: !p.types[id] },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveAlertPrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    const wantsPush = prefs.method === 'push' || prefs.method === 'both';
    const wantsEmail = prefs.method === 'email' || prefs.method === 'both';
    const pushPrefs = {
      visit: Boolean(prefs.types.visit),
      commit: Boolean(prefs.types.commit),
      score: Boolean(prefs.types.score),
      followPlayers: prefs.followPlayers,
    };

    if (wantsEmail && prefs.types.visit) {
      void syncEmailAlertPrefs({
        method: prefs.method,
        freq: prefs.freq,
        visit: true,
        followPlayers: prefs.followPlayers,
      }).then((out) => {
        if (out.ok && !wantsPush) {
          setPushStatus(
            prefs.freq === 'weekly'
              ? 'Weekly verified OV recap emails enabled.'
              : prefs.freq === 'daily'
                ? 'Daily verified OV digest emails enabled.'
                : prefs.freq === 'instant'
                  ? 'Instant verified OV emails enabled.'
                  : 'Email alert preferences saved.'
          );
        } else if (out.reason === 'sign_in') {
          setPushStatus('Sign in to enable email alerts.');
        } else if (out.reason === 'membership') {
          setPushStatus('Active membership required for email alerts.');
        }
      });
    }

    if (wantsPush && (prefs.types.visit || prefs.types.commit || prefs.types.score)) {
      void syncAlertPushPrefs(pushPrefs).then((out) => {
        if (out.ok) {
          const parts: string[] = [];
          if (prefs.types.visit) parts.push('visits');
          if (prefs.types.commit) parts.push('commits');
          if (prefs.types.score) parts.push('scores');
          setPushStatus(
            nativeShell
              ? `Lock-screen alerts enabled for ${parts.join(', ')} on this iPhone.`
              : `Push enabled for ${parts.join(', ')} on this browser.`
          );
        } else if (out.reason === 'denied') {
          setPushStatus(
            nativeShell
              ? 'Notifications blocked — enable them in iPhone Settings → GatorVault.'
              : 'Browser blocked notifications — enable them in site settings.'
          );
        } else if (out.reason === 'sign_in') {
          setPushStatus('Sign in to enable push alerts.');
        } else if (out.reason === 'membership') {
          setPushStatus('Active membership required for push alerts.');
        } else if (out.reason === 'disabled') {
          setPushStatus('Lock-screen alerts are unavailable right now. Try again later.');
        } else if (out.reason === 'unsupported') {
          setPushStatus(
            nativeShell
              ? 'Lock-screen alerts need an app update. Your in-app feed still works.'
              : 'This browser does not support push notifications.'
          );
        }
      });
    } else if (!wantsPush) {
      void unsubscribeVisitPush().then(() => {
        setPushStatus('Push alerts disabled on this device.');
      });
    } else if (wantsPush && !prefs.types.visit && !prefs.types.commit && !prefs.types.score) {
      void syncAlertPushPrefs({
        visit: false,
        commit: false,
        score: false,
        followPlayers: prefs.followPlayers,
      }).then((out) => {
        if (out.ok) {
          setPushStatus('All lock-screen categories off — feed still updates in-app.');
        } else if (out.reason === 'sign_in') {
          setPushStatus('Sign in to update push alert preferences.');
        }
      });
    }
  };

  const addPlayer = () => {
    const name = playerInput.trim();
    if (!name) return;
    setPrefs((p) => {
      if (p.followPlayers.includes(name)) return p;
      return { ...p, followPlayers: [...p.followPlayers, name] };
    });
    setPlayerInput('');
    setSaved(false);
  };

  const removePlayer = (name: string) => {
    setPrefs((p) => ({
      ...p,
      followPlayers: p.followPlayers.filter((x) => x !== name),
    }));
    setSaved(false);
  };

  const handleMarkAllRead = () => {
    markLocalAlertsRead();
    setLocalAlerts(loadLocalRecentAlerts());
  };

  return (
    <div className="gv-vault-alerts" data-testid="vault-alerts">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">My Alerts</h1>
        <p className="gv-page-subtitle">
          Lock-screen and email for visits, commits, and Gator scores. Everything else stays in your
          in-app feed.
        </p>
      </div>

      <div className="gv-vault-alerts__layout">
        <section className="gv-vault-alerts__prefs">
          <h2 className="gv-vault-alerts__section-title">Lock-screen &amp; email</h2>
          <p className="gv-vault-alerts__section-hint">
            Only these three categories leave the app. Verified UF visits support email digests;
            commits and scores are instant push.
          </p>

          <div className="gv-alert-toggles">
            {PRIMARY_ALERT_CATEGORIES.map((id) => {
              const meta = ALERT_CATEGORY_META[id];
              const active = prefs.types[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`gv-alert-toggle${active ? ' is-active' : ''}`}
                  onClick={() => toggleCategory(id)}
                  title={meta.hint}
                >
                  <span className="gv-alert-toggle__label">{meta.label}</span>
                  <span className="gv-alert-toggle__status">Live</span>
                </button>
              );
            })}
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Notification Method</p>
            <ChoiceButtons<AlertMethod>
              ariaLabel="Notification method"
              value={prefs.method}
              onChange={(method) => {
                setPrefs((p) => ({ ...p, method }));
                setSaved(false);
              }}
              options={[
                { id: 'push', label: 'Push' },
                { id: 'email', label: 'Email' },
                { id: 'both', label: 'Both' },
              ]}
            />
            <p className="gv-vault-alerts__section-hint">
              Email currently covers verified official visits. Push covers visits, commits, and
              scores.
            </p>
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Visit email frequency</p>
            <ChoiceButtons<AlertFreq>
              ariaLabel="Alert frequency"
              value={prefs.freq}
              onChange={(freq) => {
                setPrefs((p) => ({ ...p, freq }));
                setSaved(false);
              }}
              options={[
                { id: 'instant', label: 'Instant' },
                { id: 'daily', label: 'Daily Digest' },
                { id: 'weekly', label: 'Weekly Roundup' },
              ]}
            />
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Favorite players (optional filter)</p>
            <p className="gv-vault-alerts__section-hint">
              Empty list = all verified visits/commits. Add names to only hear about those recruits.
            </p>
            <div className="gv-alert-player-input">
              <input
                type="text"
                className="gv-alert-input"
                placeholder="Type a player name and press Enter"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlayer();
                  }
                }}
              />
            </div>
            {prefs.followPlayers.length > 0 && (
              <ul className="gv-alert-player-tags">
                {prefs.followPlayers.map((name) => (
                  <li key={name} className="gv-alert-player-tag">
                    <span>{name}</span>
                    <button type="button" onClick={() => removePlayer(name)} aria-label={`Remove ${name}`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="gv-alert-save-btn" onClick={handleSave}>
            {saved ? 'Preferences Saved' : 'Save Preferences'}
          </button>
          {pushStatus ? <p className="gv-vault-alerts__section-hint">{pushStatus}</p> : null}
        </section>

        <section className="gv-vault-alerts__feed">
          <div className="gv-vault-alerts__feed-header">
            <h2 className="gv-vault-alerts__section-title">In-app feed</h2>
            <button type="button" className="gv-alert-mark-read" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          </div>
          <p className="gv-vault-alerts__section-hint">
            Movement and intel show up here as they land.
          </p>

          {loading && <p className="gv-page-status">Loading alerts…</p>}

          {!loading && error && (
            <UiError
              title="Alerts unavailable"
              message={error}
              retry={() => void loadFeed(true)}
              backHref="/vault/futurecast/alerts"
              backLabel="← FutureCast Alerts"
            />
          )}

          {!loading && !error && (
            <div className="gv-vault-alerts__feed-list">
              {apiAlerts.map((alert) => (
                <article key={alert.id} className="gv-vault-alert-item">
                  <a
                    href={playerProfilePath(alert.playerSlug, alert.lifecycle, true)}
                    className="gv-vault-alert-item__message"
                  >
                    {alert.message}
                  </a>
                  <p className="gv-vault-alert-item__meta">
                    {alert.type} · {alert.playerName}
                  </p>
                </article>
              ))}

              {localAlerts.map((alert, idx) => (
                <article
                  key={`local-${idx}-${alert._ts ?? idx}`}
                  className={`gv-vault-alert-item${alert.read ? ' is-read' : ''}`}
                >
                  <p className="gv-vault-alert-item__message">{alert.title || alert.text}</p>
                  {alert.type ? (
                    <p className="gv-vault-alert-item__meta">{alert.type}</p>
                  ) : null}
                </article>
              ))}

              {apiAlerts.length === 0 && localAlerts.length === 0 && (
                <UiEmpty
                  message="No alerts yet."
                  hint="Enable Visits, Commits, or Scores on the left — or open FutureCast movement."
                />
              )}
            </div>
          )}

          <p className="gv-vault-alerts__fc-link">
            <a href="/vault/futurecast/alerts">View FutureCast movement alerts →</a>
          </p>
        </section>
      </div>
    </div>
  );
}
