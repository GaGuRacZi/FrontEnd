import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

export function useNavigationLock() {
  const locked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      locked.current = false;

      return () => {
        locked.current = true;
      };
    }, []),
  );

  return useCallback((action: () => void) => {
    if (locked.current) return;

    locked.current = true;
    action();
  }, []);
}
