'use client';

import { useEffect, useState } from 'react';

const COMMAND_CENTER_QUERY = '(min-width: 1024px)';

/** True on desktop command-center layout (≥1024px). */
export function useIsCommandCenterDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMMAND_CENTER_QUERY);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return desktop;
}
