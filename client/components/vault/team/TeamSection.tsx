import React from 'react';

type TeamSectionProps = {
  id?: string;
  className?: string;
  title: string;
  titleAccent?: boolean;
  description?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
};

export function TeamSection({
  id,
  className = '',
  title,
  titleAccent,
  description,
  headerExtra,
  children,
}: TeamSectionProps): React.ReactElement {
  return (
    <section id={id} className={`gv-team-section${className ? ` ${className}` : ''}`}>
      <div className="gv-team-section-head">
        <div>
          <h2
            className={`gv-team-section-title${titleAccent ? ' gv-team-section-title--accent' : ''}`}
          >
            {title}
          </h2>
          {description ? <p className="gv-team-section-desc">{description}</p> : null}
        </div>
        {headerExtra}
      </div>
      {children}
    </section>
  );
}
