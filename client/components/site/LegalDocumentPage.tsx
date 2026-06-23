import React from 'react';
import type { LegalDocument } from '@/lib/legal-content';
import '@/lib/legal.css';

export function LegalDocumentPage({ doc }: { doc: LegalDocument }): React.ReactElement {
  return (
    <article className="gv-legal" data-testid={`legal-${doc.id}`}>
      <p className="gv-legal__meta">Effective {doc.effectiveDate}</p>
      <h1 className="gv-legal__title">{doc.title}</h1>
      <p className="gv-legal__intro">{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.id} className="gv-legal__section" id={section.id}>
          <h2 className="gv-legal__heading">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="gv-legal__p">
              {paragraph}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="gv-legal__list">
              {section.bullets.map((item) => (
                <li key={item.slice(0, 48)}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <p className="gv-legal__contact">
        Questions? Email{' '}
        <a href={`mailto:${doc.contactEmail}`}>{doc.contactEmail}</a>.
      </p>
    </article>
  );
}
