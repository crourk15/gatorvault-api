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
    <article className="home-card">
      <div className="home-beat-header">
        <span className="home-beat-avatar" aria-hidden="true">
          {avatarInitials(post.writerName)}
        </span>
        <div className="home-beat-meta">
          <span className="home-beat-name">{post.writerName}</span>
          <span className="home-beat-outlet">{post.outlet}</span>
        </div>
        {post.badge ? <span className="home-badge">{post.badge}</span> : null}
      </div>
      <p className="home-beat-body">{post.text}</p>
      <div className="home-beat-footer">
        <span>{post.timestamp || 'Recently'}</span>
        <a href={post.xUrl} className="home-link-x" target="_blank" rel="noopener noreferrer">
          View on X →
        </a>
      </div>
    </article>
  );
}

export function HomeCommandBeatHighlights({ posts, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="home-section-header">
        <h2 className="home-section-title">Beat Writer Highlights</h2>
        <p className="home-section-subtitle">Hand-picked fire from UF beat writers.</p>
      </div>
      {loading ? (
        <div className="home-card-skeleton" data-testid="home-beat-highlights" aria-hidden="true" />
      ) : posts.length === 0 ? (
        <section className="home-card" data-testid="home-beat-highlights">
          <p className="home-empty">Nothing active right now — beat posts appear when the feed updates.</p>
        </section>
      ) : (
        <section className="home-beat-grid" data-testid="home-beat-highlights">
          {posts.map((post) => (
            <BeatCard key={post.id} post={post} />
          ))}
        </section>
      )}
    </>
  );
}
