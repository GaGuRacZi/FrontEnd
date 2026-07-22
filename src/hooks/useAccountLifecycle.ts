import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useTerms } from '@/src/features/auth/terms';
import { usePetStore } from '@/src/features/pet/PetStore';

export function useAccountLifecycle() {
  const { clearSession, currentUserId } = useAuthSession();
  const { deleteConsentHistory } = useTerms();
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
    await deleteConsentHistory();
    await clearSession();
  }, [clearSession, currentUserId, deleteConsentHistory, deleteUserPetData]);

  return { logOut, withdrawAccount };
}
