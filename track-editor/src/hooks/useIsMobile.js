import { useEffect, useState } from 'react';

/**
 * Returns true when viewport width ≤ breakpoint (default 768px).
 * Uses matchMedia so it reacts to orientation changes and window resizes.
 * Handles the older Safari/iOS matchMedia API (addListener vs addEventListener).
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);

    // Safari < 14 only supports addListener/removeListener
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      // eslint-disable-next-line no-undef
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, [breakpoint]);

  return isMobile;
}
