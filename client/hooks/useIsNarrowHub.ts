'use client';

import { useEffect, useState } from 'react';

const NARROW_HUB_QUERY = '(max-width: 767px)';

/** True on phone layouts; false on tablet/desktop and during SSR. */
export function useIsNarrowHub(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_HUB_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return narrow;
}
