'use client';

import React from 'react';

export function SwampStandardBlock(): React.ReactElement {
  return (
    <article className="team-swamp-standard">
      <h3 className="team-swamp-standard__title">Building The Swamp Standard</h3>
      <p className="team-swamp-standard__lead">
        Toughness, defense, and a hostile home field — the through-line of Gator football.
      </p>
      <ul className="team-swamp-standard__list">
        <li>Toughness — relentless effort and accountability in every rep</li>
        <li>Defense — pressure, speed, and DBU tradition</li>
        <li>The Swamp — opponents&apos; dreams go to die here</li>
        <li>Recruiting footprint — Florida, Georgia, and Texas pipelines</li>
      </ul>
    </article>
  );
}
