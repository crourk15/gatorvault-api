'use client';

import React from 'react';

export function SwampStandardBlock(): React.ReactElement {
  return (
    <article className="team-swamp-standard">
      <h3 className="team-swamp-standard__title">Building The Swamp Standard</h3>
      <p className="team-swamp-standard__lead">
        One of college football&apos;s most hostile environments — where toughness, defense, and early recruiting
        footprint define Gator Nation.
      </p>
      <ul className="team-swamp-standard__list">
        <li>Toughness — relentless effort and accountability in every rep</li>
        <li>Defense — identity built on pressure, speed, and DBU tradition</li>
        <li>Hostile home environment — opponents&apos; dreams go to die in The Swamp</li>
        <li>Early recruiting footprint — Florida, Georgia, and Texas pipelines</li>
        <li>Emmitt Smith era — all-time rushing standard and SEC contender culture</li>
        <li>Wilber Marshall identity — prototype for modern Gator linebackers</li>
      </ul>
    </article>
  );
}
