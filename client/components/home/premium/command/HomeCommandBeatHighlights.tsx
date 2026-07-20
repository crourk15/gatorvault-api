'use client';

import React from 'react';
import type { HomeBeatPostView } from '@/components/home/premium/command/home-command-utils';
import { avatarInitials } from '@/components/home/premium/command/home-command-utils';

type Props = {
  posts: HomeBeatPostView[];
  loading?: boolean;
};

function BeatCard({ post }: { post: HomeBeatPostView }): React.ReactElement {
  return (
    <article className="home-wow-beat-card">
      <div className="home-wow-beat-watermark" aria-hidden="true">
        UF
      </div>
      <div className="home-wow-beat-header">
        <span className="home-wow-beat-avatar" aria-hidden="true">
          {avatarInitials(post.writerName)}
        </span>
        <div className="home-wow-beat-meta">
          <span className="home-wow-beat-name">{post.writerName}</span>
          <span className="home-wow-beat-outlet">{post.outlet}</span>
        </div>
        {post.badge ? <span className="home-wow-badge">{post.badge}</span> : null}
      </div>
      <p className="home-wow-beat-body">{post.text}</p>
      <div className="home-wow-beat-footer">
        <span>{post.timestamp || 'Recently'}</span>
        <a href={post.xUrl} className="home-wow-link-x" target="_blank" rel="noopener noreferrer">
          <span>View on X</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

/** Seeded posts paint as real cards — no boot-shell dual tree (avoids hydration mismatch). */
export function HomeCommandBeatHighlights({ posts, loading }: Props): React.ReactElement | null {
  if (!posts.length) {
    if (loading) {
      return (
        <>
          <div className="home-wow-section-header">
            <h2 className="home-wow-section-title">Beat Writer Highlights</h2>
            <p className="home-wow-section-subtitle">Hand-picked fire from UF beat writers.</p>
          </div>
          <section className="home-wow-card" data-testid="home-beat-highlights" aria-busy="true">
            <div className="home-wow-skeleton home-wow-skeleton--overlay" aria-hidden="true" />
          </section>
        </>
      );
    }
    return null;
  }

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Beat Writer Highlights</h2>
        <p className="home-wow-section-subtitle">Hand-picked fire from UF beat writers.</p>
      </div>
      <section className="home-wow-beat-grid" data-testid="home-beat-highlights">
        {posts.map((post) => (
          <BeatCard key={post.id} post={post} />
        ))}
      </section>
    </>
  );
}
