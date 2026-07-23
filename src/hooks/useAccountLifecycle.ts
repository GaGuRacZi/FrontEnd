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
    try {
      const tasks = currentUserId
        ? [
            deleteUserProfileData(currentUserId),
            deleteUserPetData(currentUserId),
            deleteConsentHistory(),
          ]
        : [deleteConsentHistory()];
      const results = await Promise.allSettled(tasks);
      if (results.some((result) => result.status === 'rejected')) {
        throw new Error('withdraw-cleanup-failed');
      }
    } finally {
      await clearSession();
    }
  }, [
    clearSession,
    currentUserId,
    deleteConsentHistory,
    deleteUserPetData,
    deleteUserProfileData,
  ]);

  return { logOut, withdrawAccount };
}
