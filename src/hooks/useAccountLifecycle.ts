import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useTerms } from '@/src/features/auth/terms';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

export function useAccountLifecycle() {
  const { clearSession, currentUserId } = useAuthSession();
  const { deleteConsentHistory } = useTerms();
  const { clearScreenSession, deleteUserProfileData } = useMyPageStore();
  const { clearDrafts, deleteUserPetData } = usePetStore();

  const logOut = useCallback(async () => {
    try {
      if (currentUserId) await clearDrafts(currentUserId);
      clearScreenSession();
    } finally {
      await clearSession();
    }
  }, [clearDrafts, clearScreenSession, clearSession, currentUserId]);

  const withdrawAccount = useCallback(async () => {
    if (currentUserId) await deleteUserProfileData(currentUserId);
    if (currentUserId) await deleteUserPetData(currentUserId);
    await deleteConsentHistory();
    await clearSession();
  }, [
    clearSession,
    currentUserId,
    deleteConsentHistory,
    deleteUserPetData,
    deleteUserProfileData,
  ]);

  return { logOut, withdrawAccount };
}
