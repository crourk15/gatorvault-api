'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { buildSeedAlerts } from '@/lib/alerts-hub-seed';
import { buildFanAlertCards, formatAlertTime } from '@/lib/alert-fan-copy';
import { sendTestPushAlert, syncAlertPushPrefs, unsubscribeVisitPush } from '@/lib/push-alerts-api';
import { syncEmailAlertPrefs } from '@/lib/alert-email-api';
import { isNativeApp } from '@/lib/api-base';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const REFRESH_MS = 60_000;
const SEED_ALERTS = buildSeedAlerts();
const HAS_SEED = SEED_ALERTS.length > 0;

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
  const [apiAlerts, setApiAlerts] = useState<FutureCastAlert[]>(HAS_SEED ? SEED_ALERTS : []);
  const [localAlerts, setLocalAlerts] = useState<LocalRecentAlert[]>([]);
  // Seeded first paint is content-ready; live refresh still runs in background.
  const [loading, setLoading] = useState(!HAS_SEED);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [nativeShell, setNativeShell] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    setPrefs(loadAlertPrefs());
    setLocalAlerts(loadLocalRecentAlerts());
    setNativeShell(isNativeApp());
  }, []);

  const loadFeed = useCallback(async (isInitial: boolean) => {
    if (isInitial && !HAS_SEED) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await fetchAlerts();
      setApiAlerts(rows);
      setLocalAlerts(loadLocalRecentAlerts());
      setError(null);
    } catch (err) {
      // Keep seed painted if live wake fails.
      if (!HAS_SEED) {
        setError(err instanceof Error ? err.message : 'Could not load alerts.');
      }
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

  const fanCards = useMemo(() => buildFanAlertCards(apiAlerts), [apiAlerts]);

  return (
    <div className="gv-vault-alerts" data-testid="vault-alerts">
      <section className="gv-alerts-hero" aria-label="My Alerts">
        <div className="gv-alerts-hero__bg" aria-hidden="true" />
        <div className="gv-alerts-hero__sweep" aria-hidden="true" />
        <div className="gv-alerts-hero__watermark" aria-hidden="true">
          GATORS
        </div>
        <div className="gv-alerts-hero__inner">
          <p className="gv-alerts-hero__eyebrow">GatorVault</p>
          <h1 className="gv-alerts-hero__title">My Alerts</h1>
          <p className="gv-alerts-hero__sub">
            Visits, commits, and Gator scores on your lock screen — plus the board moves that matter
            inside the Vault.
          </p>
        </div>
      </section>

      <div className="gv-vault-alerts__layout">
        <section className="gv-vault-alerts__prefs">
          <h2 className="gv-vault-alerts__section-title">Lock-screen &amp; email</h2>
          <p className="gv-vault-alerts__section-hint">
            Choose what hits your phone. Visits can digest by email; commits and scores fire push.
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
          {(prefs.method === 'push' || prefs.method === 'both') &&
          (prefs.types.visit || prefs.types.commit || prefs.types.score) ? (
            <button
              type="button"
              className="gv-alert-save-btn gv-alert-save-btn--secondary"
              disabled={testingPush}
              onClick={() => {
                setTestingPush(true);
                void sendTestPushAlert('confirm', { force: true }).then((out) => {
                  setTestingPush(false);
                  if (out.ok) {
                    setPushStatus(
                      nativeShell
                        ? 'Test alert sent — check your lock screen.'
                        : 'Test alert sent — check browser notifications.'
                    );
                  } else if (out.reason === 'no_devices') {
                    setPushStatus('Save Preferences first so this device can register for push.');
                  } else if (out.reason === 'sign_in') {
                    setPushStatus('Sign in to send a test alert.');
                  } else if (out.reason === 'membership') {
                    setPushStatus('Active membership required for push alerts.');
                  } else if (out.reason === 'rate_limited') {
                    setPushStatus('Test alert already sent — wait a minute and try again.');
                  } else {
                    setPushStatus('Could not send test alert. Try Save Preferences, then retry.');
                  }
                });
              }}
            >
              {testingPush ? 'Sending test…' : 'Send test alert'}
            </button>
          ) : null}
          {pushStatus ? <p className="gv-vault-alerts__section-hint">{pushStatus}</p> : null}
          {nativeShell ? (
            <p className="gv-vault-alerts__section-hint">
              On iPhone: Save Preferences → Allow notifications. You should get a confirmation
              ping on the lock screen within a few seconds.
            </p>
          ) : null}
        </section>

        <section className="gv-vault-alerts__feed">
          <div className="gv-vault-alerts__feed-header">
            <div>
              <h2 className="gv-vault-alerts__section-title">Board intel</h2>
              <p className="gv-vault-alerts__section-hint gv-vault-alerts__section-hint--flush">
                Visits, flip watch, and the Florida odds moves worth opening.
              </p>
            </div>
            {localAlerts.length > 0 ? (
              <button type="button" className="gv-alert-mark-read" onClick={handleMarkAllRead}>
                Mark all as read
              </button>
            ) : null}
          </div>

          {loading && <p className="gv-page-status">Loading board intel…</p>}

          {!loading && error && (
            <UiError
              title="Alerts unavailable"
              message={error}
              retry={() => void loadFeed(true)}
              backHref="/vault/futurecast/"
              backLabel="← FutureCast"
            />
          )}

          {!loading && !error && (
            <div className="gv-vault-alerts__feed-list">
              {fanCards.map((card) => (
                <article
                  key={card.id}
                  className={`gv-vault-alert-card gv-vault-alert-card--${card.tone}`}
                  data-testid="vault-alert-card"
                >
                  <div className="gv-vault-alert-card__top">
                    <span className={`gv-vault-alert-card__chip gv-vault-alert-card__chip--${card.tone}`}>
                      {card.chip}
                    </span>
                    <time className="gv-vault-alert-card__time" dateTime={card.createdAt}>
                      {formatAlertTime(card.createdAt)}
                    </time>
                  </div>
                  <a
                    href={playerProfilePath(card.playerSlug, card.lifecycle, true)}
                    className="gv-vault-alert-card__name"
                  >
                    {card.playerName}
                  </a>
                  <p className="gv-vault-alert-card__headline">{card.headline}</p>
                  {card.detail ? <p className="gv-vault-alert-card__detail">{card.detail}</p> : null}
                </article>
              ))}

              {localAlerts.map((alert, idx) => (
                <article
                  key={`local-${idx}-${alert._ts ?? idx}`}
                  className={`gv-vault-alert-card gv-vault-alert-card--intel${alert.read ? ' is-read' : ''}`}
                >
                  <div className="gv-vault-alert-card__top">
                    <span className="gv-vault-alert-card__chip gv-vault-alert-card__chip--intel">
                      {alert.type === 'visit'
                        ? 'Visit'
                        : alert.type === 'commit'
                          ? 'Commit'
                          : alert.type === 'score'
                            ? 'Score'
                            : 'Alert'}
                    </span>
                  </div>
                  <p className="gv-vault-alert-card__headline">{alert.title || alert.text}</p>
                </article>
              ))}

              {fanCards.length === 0 && localAlerts.length === 0 && (
                <UiEmpty
                  message="No board intel yet."
                  hint="Turn on Visits, Commits, or Scores — or check FutureCast for live movement."
                />
              )}
            </div>
          )}

          <p className="gv-vault-alerts__fc-link">
            <a href="/vault/futurecast/">Open FutureCast Lab →</a>
          </p>
        </section>
      </div>
    </div>
  );
}
