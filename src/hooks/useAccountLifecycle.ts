import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { usePetStore } from '@/src/features/pet/PetStore';

export function useAccountLifecycle() {
  const { clearSession, currentUserId } = useAuthSession();
  const { clearDrafts, deleteUserPetData } = usePetStore();

  const logOut = useCallback(async () => {
    try {
      if (currentUserId) await clearDrafts(currentUserId);
    } finally {
      await clearSession();
    }
  }, [clearDrafts, clearSession, currentUserId]);

  const withdrawAccount = useCallback(async () => {
    if (currentUserId) await deleteUserPetData(currentUserId);
    await clearSession();
  }, [clearSession, currentUserId, deleteUserPetData]);

  return { logOut, withdrawAccount };
}
