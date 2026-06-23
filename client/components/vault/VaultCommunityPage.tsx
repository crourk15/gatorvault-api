'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Chip, PageLayout, PageSection } from '@/components/brand';
import { CommunityConfirmModal } from '@/components/community/CommunityConfirmModal';
import { CommunityPostActions } from '@/components/community/CommunityPostActions';
import { CommunityReportModal } from '@/components/community/CommunityReportModal';
import { CommunityToastProvider, useCommunityToast } from '@/components/community/CommunityToast';
import {
  communityAuthorLabel,
  createCommunityThread,
  fetchCommunityCategories,
  fetchCommunityPulse,
  fetchCommunityThread,
  fetchCommunityThreads,
  fetchLiveRooms,
  flagCommunityPost,
  flagCommunityThread,
  type CommunityCategory,
  type CommunityPost,
  type CommunityPulse,
  type CommunityThread,
  type LiveRoom,
} from '@/lib/community-api';
import {
  blockUserEmail,
  isEmailBlocked,
  loadBlockedEmails,
  unblockUserEmail,
  type ReportReasonId,
} from '@/lib/community-ugc';
import { loadSession } from '@/lib/auth-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type SortId = 'trending' | 'recent' | 'active' | 'replies';

type ReportTarget =
  | { kind: 'post'; post: CommunityPost }
  | { kind: 'thread'; thread: CommunityThread };

type BlockTarget = {
  email: string;
  displayName: string;
};

const TRENDING_TOPICS = ['QB battle 2026', 'Portal targets', 'Georgia week', 'NIL rankings', 'Depth chart'];

const STAFF_POSTS = [
  { title: 'Spring practice intel', author: 'GatorVault Staff', badge: 'staff' as const },
  { title: 'Recruiting board update', author: 'Insider Desk', badge: 'staff' as const },
];

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function threadCategoryLabel(thread: CommunityThread): string {
  return thread.category?.name || thread.categoryLabel || thread.categorySlug || 'General';
}

function VaultCommunityPageInner({ initialThreadId }: { initialThreadId?: string }): React.ReactElement {
  const { pushToast } = useCommunityToast();
  const [sort, setSort] = useState<SortId>('trending');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<CommunityThread | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('locker');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);

  const session = useMemo(() => loadSession(), []);
  const viewerEmail = session?.email ?? null;
  const canModerate = Boolean(viewerEmail);

  useEffect(() => {
    if (viewerEmail) setBlockedEmails(loadBlockedEmails(viewerEmail));
  }, [viewerEmail]);

  const requireSignIn = useCallback((): boolean => {
    if (viewerEmail) return true;
    pushToast({
      kind: 'error',
      title: 'Sign in required',
      body: 'Sign in to report or block community members.',
    });
    return false;
  }, [pushToast, viewerEmail]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, rows, pulseData, liveRooms] = await Promise.all([
        fetchCommunityCategories(),
        fetchCommunityThreads({ sort, category: category || undefined, limit: 40 }),
        fetchCommunityPulse(),
        fetchLiveRooms(),
      ]);
      setCategories(cats);
      setThreads(rows);
      setPulse(pulseData);
      setRooms(liveRooms);
      if (cats.length && !newCategory) setNewCategory(cats[0].slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community.');
    } finally {
      setLoading(false);
    }
  }, [sort, category, newCategory]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setSelectedThread(null);
    try {
      const data = await fetchCommunityThread(id);
      setSelectedThread(data.thread);
      setSelectedPosts(data.posts);
    } catch {
      setSelectedThread(null);
      setSelectedPosts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialThreadId) void openThread(initialThreadId);
  }, [initialThreadId, openThread]);

  const submitThread = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await createCommunityThread({
        title: newTitle.trim(),
        body: newBody.trim(),
        category: newCategory,
      });
      setNewTitle('');
      setNewBody('');
      setShowForm(false);
      await load();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not post thread.');
    } finally {
      setPosting(false);
    }
  };

  const isAuthorBlocked = useCallback(
    (authorEmail?: string | null) => isEmailBlocked(viewerEmail, authorEmail, blockedEmails),
    [blockedEmails, viewerEmail],
  );

  const isOwnAuthor = useCallback(
    (authorEmail?: string | null) =>
      Boolean(viewerEmail && authorEmail && viewerEmail.toLowerCase() === authorEmail.toLowerCase()),
    [viewerEmail],
  );

  const handleReportOpen = (target: ReportTarget) => {
    if (!requireSignIn()) return;
    setReportTarget(target);
  };

  const handleReportSubmit = async (reason: ReportReasonId) => {
    if (!reportTarget) return;
    setModerationLoading(true);
    try {
      if (reportTarget.kind === 'post') {
        await flagCommunityPost(reportTarget.post.id, reason);
        setSelectedPosts((prev) =>
          prev.map((p) => (p.id === reportTarget.post.id ? { ...p, flagged: true } : p)),
        );
      } else {
        await flagCommunityThread(reportTarget.thread.id, reason);
        setSelectedThread((prev) =>
          prev && prev.id === reportTarget.thread.id ? { ...prev, flagged: true } : prev,
        );
      }
      setReportTarget(null);
      pushToast({
        kind: 'success',
        title: 'Report submitted',
        body: 'Thanks — our team will review this content.',
      });
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Could not submit report',
        body: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setModerationLoading(false);
    }
  };

  const handleBlockOpen = (target: BlockTarget) => {
    if (!requireSignIn()) return;
    setBlockTarget(target);
  };

  const handleBlockConfirm = () => {
    if (!blockTarget || !viewerEmail) return;
    const next = blockUserEmail(viewerEmail, blockTarget.email);
    setBlockedEmails(next);
    setBlockTarget(null);
    pushToast({
      kind: 'success',
      title: 'User blocked',
      body: `${blockTarget.displayName} will no longer appear in your feed.`,
    });
  };

  const handleUnblock = (email: string, displayName: string) => {
    if (!viewerEmail) return;
    const next = unblockUserEmail(viewerEmail, email);
    setBlockedEmails(next);
    pushToast({
      kind: 'success',
      title: 'User unblocked',
      body: `${displayName} is visible again.`,
    });
  };

  const reportTargetLabel =
    reportTarget?.kind === 'post'
      ? `a reply by ${communityAuthorLabel(reportTarget.post)}`
      : reportTarget?.kind === 'thread'
        ? `the thread “${reportTarget.thread.title}”`
        : '';

  const renderBlockedPlaceholder = (displayName: string, email?: string) => (
    <div className="gv-community__post gv-community__post--blocked">
      <p className="gv-community__blocked-label">Blocked member</p>
      <p className="gv-community__blocked-body">Content from {displayName} is hidden.</p>
      {email && viewerEmail ? (
        <button
          type="button"
          className="gv-community__action-btn"
          onClick={() => handleUnblock(email, displayName)}
        >
          Unblock
        </button>
      ) : null}
    </div>
  );

  return (
    <PageLayout
      theme="white"
      title="Community"
      subtitle="Member-led talk, game week analysis, recruiting debate, and insider reaction."
      testId="vault-community"
    >
      <div className="gv-community__layout">
        <div className="gv-community__main">
          <PageSection title="Trending Topics">
            <div className="gv-ds-filters">
              {TRENDING_TOPICS.map((t) => (
                <Chip key={t} variant="trending">
                  {t}
                </Chip>
              ))}
            </div>
          </PageSection>

          <PageSection title="Staff Posts">
            <div className="gv-community__staff-grid">
              {STAFF_POSTS.map((p) => (
                <Card key={p.title}>
                  <Chip variant="staff">Staff</Chip>
                  <h3 className="gv-type-h3" style={{ margin: '0.5rem 0' }}>{p.title}</h3>
                  <p style={{ margin: 0, opacity: 0.7 }}>{p.author}</p>
                </Card>
              ))}
            </div>
          </PageSection>

          <div className="gv-community__toolbar">
            <div className="gv-alert-choices">
              {(['trending', 'recent', 'active', 'replies'] as SortId[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`gv-alert-choice${sort === s ? ' is-active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'trending' ? '🔥 Trending' : s === 'recent' ? '🕐 Recent' : s === 'active' ? '📈 Active' : '💬 Replies'}
                </button>
              ))}
            </div>
            <select
              className="gv-community__select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.label || c.name}
                </option>
              ))}
            </select>
            <button type="button" className="gv-community__new-btn" onClick={() => setShowForm((v) => !v)}>
              + New Thread
            </button>
          </div>

          {showForm && (
            <div className="gv-community__form">
              <input
                className="gv-alert-input"
                placeholder="Thread title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={200}
              />
              <textarea
                className="gv-alert-input gv-community__textarea"
                placeholder="Start the conversation…"
                rows={3}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <select
                className="gv-community__select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.label || c.name}
                  </option>
                ))}
              </select>
              {postError ? <p className="gv-community__post-error">{postError}</p> : null}
              <button type="button" className="gv-alert-save-btn" disabled={posting} onClick={() => void submitThread()}>
                {posting ? 'Posting…' : 'Post Thread'}
              </button>
            </div>
          )}

          {loading && <p className="gv-page-status">Loading threads…</p>}
          {error && !loading && (
            <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
          )}

          {!loading && !error && selectedId && !selectedThread && (
            <div className="gv-community__thread-detail">
              <button
                type="button"
                className="gv-film-back"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedPosts([]);
                }}
              >
                ← All threads
              </button>
              <p className="gv-page-status">Loading thread…</p>
            </div>
          )}

          {!loading && !error && selectedId && selectedThread && (
            <div className="gv-community__thread-detail">
              <button
                type="button"
                className="gv-film-back"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedThread(null);
                  setSelectedPosts([]);
                }}
              >
                ← All threads
              </button>
              <ul className="gv-community__posts">
                <li
                  className={`gv-community__post${selectedThread.flagged ? ' gv-community__post--flagged' : ''}${
                    isAuthorBlocked(selectedThread.authorEmail) ? ' gv-community__post--blocked-author' : ''
                  }`}
                >
                  {isAuthorBlocked(selectedThread.authorEmail) ? (
                    renderBlockedPlaceholder(
                      communityAuthorLabel(selectedThread),
                      selectedThread.authorEmail,
                    )
                  ) : (
                    <>
                      <div className="gv-community__post-head">
                        <p className="gv-community__post-author">{communityAuthorLabel(selectedThread)}</p>
                        <CommunityPostActions
                          canModerate={canModerate}
                          isOwnContent={isOwnAuthor(selectedThread.authorEmail)}
                          isBlockedAuthor={isAuthorBlocked(selectedThread.authorEmail)}
                          flagged={selectedThread.flagged}
                          onReport={() => handleReportOpen({ kind: 'thread', thread: selectedThread })}
                          onBlock={() =>
                            handleBlockOpen({
                              email: selectedThread.authorEmail || '',
                              displayName: communityAuthorLabel(selectedThread),
                            })
                          }
                        />
                      </div>
                      <h3 className="gv-community__thread-op-title">{selectedThread.title}</h3>
                      <p className="gv-community__post-body">{selectedThread.body}</p>
                      <p className="gv-community__post-meta">
                        {threadCategoryLabel(selectedThread)} · {timeAgo(selectedThread.createdAt)}
                      </p>
                    </>
                  )}
                </li>
                {selectedPosts.map((p) => {
                  const blocked = isAuthorBlocked(p.authorEmail);
                  return (
                    <li
                      key={p.id}
                      className={`gv-community__post${p.flagged ? ' gv-community__post--flagged' : ''}${
                        blocked ? ' gv-community__post--blocked-author' : ''
                      }`}
                    >
                      {blocked ? (
                        renderBlockedPlaceholder(communityAuthorLabel(p), p.authorEmail)
                      ) : (
                        <>
                          <div className="gv-community__post-head">
                            <p className="gv-community__post-author">{communityAuthorLabel(p)}</p>
                            <CommunityPostActions
                              canModerate={canModerate}
                              isOwnContent={isOwnAuthor(p.authorEmail)}
                              isBlockedAuthor={blocked}
                              flagged={p.flagged}
                              onReport={() => handleReportOpen({ kind: 'post', post: p })}
                              onBlock={() =>
                                handleBlockOpen({
                                  email: p.authorEmail || '',
                                  displayName: communityAuthorLabel(p),
                                })
                              }
                            />
                          </div>
                          <p className="gv-community__post-body">{p.body}</p>
                          <p className="gv-community__post-meta">{timeAgo(p.createdAt)}</p>
                        </>
                      )}
                    </li>
                  );
                })}
                {selectedPosts.length === 0 && !selectedThread.body && (
                  <UiEmpty message="No replies yet." />
                )}
              </ul>
            </div>
          )}

          {!loading && !error && !selectedId && (
            <PageSection title="Threads">
              <ul className="gv-community__threads">
                {threads.map((t) => {
                  const blockedAuthor = isAuthorBlocked(t.authorEmail);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`gv-community__thread-row${blockedAuthor ? ' gv-community__thread-row--blocked' : ''}${
                          t.flagged ? ' gv-community__thread-row--flagged' : ''
                        }`}
                        onClick={() => void openThread(t.id)}
                      >
                        <span className="gv-community__thread-title">
                          {t.pinned ? '📌 ' : ''}
                          {t.title}
                          {blockedAuthor ? (
                            <span className="gv-community__blocked-chip">Blocked author</span>
                          ) : null}
                        </span>
                        <span className="gv-community__thread-meta">
                          {threadCategoryLabel(t)} · {t.replyCount ?? 0} replies ·{' '}
                          {timeAgo(t.lastActivityAt || t.createdAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {threads.length === 0 && <UiEmpty message="No threads yet — start the conversation." />}
              </ul>
            </PageSection>
          )}
        </div>

        <aside className="gv-community__aside">
          {blockedEmails.length > 0 ? (
            <section className="gv-community__panel">
              <h2 className="gv-vault-alerts__section-title">Blocked members</h2>
              <ul className="gv-community__blocked-list">
                {blockedEmails.map((email) => (
                  <li key={email} className="gv-community__blocked-list-item">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="gv-community__action-btn"
                      onClick={() => handleUnblock(email, email)}
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Recruiting Q&amp;A</h2>
            <Card>
              <p style={{ margin: 0 }}>Ask recruiting questions — staff answers weekly.</p>
            </Card>
          </section>

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Game Week Threads</h2>
            {rooms.map((r) => (
              <div key={r.id} className="gv-community__room">
                <p className="gv-community__room-title">{r.title}</p>
                {r.description ? <p className="gv-community__room-desc">{r.description}</p> : null}
                {r.scheduledAt || r.startsAt ? (
                  <p className="gv-community__room-meta">
                    {new Date(r.scheduledAt || r.startsAt || '').toLocaleString()}
                  </p>
                ) : null}
              </div>
            ))}
            {rooms.length === 0 && !loading && <p className="gv-page-status">No live rooms scheduled.</p>}
          </section>

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Community Pulse</h2>
            {pulse ? (
              <div className="gv-community__pulse-grid">
                <div className="gv-recruit-stat">
                  <span>Replies today</span>
                  <strong>{pulse.repliesToday ?? '—'}</strong>
                </div>
                <div className="gv-recruit-stat">
                  <span>Trending</span>
                  <strong>{pulse.trending ?? '—'}</strong>
                </div>
              </div>
            ) : (
              <p className="gv-page-status">Loading pulse…</p>
            )}
          </section>
        </aside>
      </div>

      <CommunityReportModal
        open={Boolean(reportTarget)}
        targetLabel={reportTargetLabel}
        loading={moderationLoading}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason) => void handleReportSubmit(reason)}
      />

      <CommunityConfirmModal
        open={Boolean(blockTarget)}
        title="Block this member?"
        description={
          blockTarget
            ? `You will no longer see posts from ${blockTarget.displayName}. You can unblock them anytime from the sidebar.`
            : undefined
        }
        confirmLabel="Block user"
        confirmTone="danger"
        loading={moderationLoading}
        onCancel={() => setBlockTarget(null)}
        onConfirm={handleBlockConfirm}
      />
    </PageLayout>
  );
}

export function VaultCommunityPage({ initialThreadId }: { initialThreadId?: string } = {}): React.ReactElement {
  return (
    <CommunityToastProvider>
      <VaultCommunityPageInner initialThreadId={initialThreadId} />
    </CommunityToastProvider>
  );
}
