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

function BootBeatCardShell({ index }: { index: number }): React.ReactElement {
  return (
    <article className="home-wow-beat-card" data-beat-card={index} hidden>
      <div className="home-wow-beat-header">
        <span className="home-wow-beat-avatar" data-beat-avatar aria-hidden="true">
          UF
        </span>
        <div className="home-wow-beat-meta">
          <span className="home-wow-beat-name" data-beat-name>
            Beat Writer
          </span>
          <span className="home-wow-beat-outlet" data-beat-outlet>
            UF Beat
          </span>
        </div>
        <span className="home-wow-badge">Beat Writer</span>
      </div>
      <p className="home-wow-beat-body" data-beat-text />
      <div className="home-wow-beat-footer">
        <span data-beat-time>Recently</span>
        <a href="#" className="home-wow-link-x" data-beat-url target="_blank" rel="noopener noreferrer">
          <span>View on X</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function HomeCommandBeatHighlights({ posts, loading }: Props): React.ReactElement | null {
  if (!loading && posts.length === 0) return null;

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Beat Writer Highlights</h2>
        <p className="home-wow-section-subtitle">Hand-picked fire from UF beat writers.</p>
      </div>
      {loading ? (
        <section className="home-wow-card" data-testid="home-beat-highlights" data-home-boot="beat-highlights">
          <div className="home-wow-skeleton home-wow-skeleton--overlay" data-home-boot-skeleton aria-hidden="true" />
          <div className="home-wow-beat-grid home-wow-beat-grid--boot" data-home-boot-body>
            {[0, 1, 2].map((index) => (
              <BootBeatCardShell key={index} index={index} />
            ))}
          </div>
        </section>
      ) : (
        <section className="home-wow-beat-grid" data-testid="home-beat-highlights">
          {posts.map((post) => (
            <BeatCard key={post.id} post={post} />
          ))}
        </section>
      )}
    </>
  );
}
