import { useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase/config';

/**
 * Tracks the offset between the local clock and the Firebase server clock.
 * `serverNow()` returns `Date.now()` corrected for clock skew.
 */
export function useServerTime() {
  const offsetRef = useRef(0);

  useEffect(() => {
    const fbRef = ref(db, '.info/serverTimeOffset');
    const unsub = onValue(fbRef, (snap) => {
      offsetRef.current = (snap.val() as number) ?? 0;
    });
    return unsub;
  }, []);

  function serverNow(): number {
    return Date.now() + offsetRef.current;
  }

  return { serverNow, offsetRef };
}
