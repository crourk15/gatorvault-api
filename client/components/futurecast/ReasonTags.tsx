/**
 * Portal reason tag chips.
 * @see server/docs/futurecast-platform-spec.md §1.4, §4.3
 */
import React from 'react';

export interface ReasonTagsProps {
  tags: string[];
}

export function ReasonTags({ tags }: ReasonTagsProps): React.ReactElement {
  if (!tags.length) return <></>;
  return (
    <ul className="fc-reason-tags" data-testid="reason-tags">
      {tags.map((tag) => (
        <li key={tag} className="fc-reason-tag">{tag.replace(/_/g, ' ')}</li>
      ))}
    </ul>
  );
}
