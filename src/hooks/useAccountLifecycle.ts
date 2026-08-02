import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useTerms } from '@/src/features/auth/terms';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

const PENDING_WITHDRAWAL_KEY = 'paw:account-withdrawal';

async function runWithRetry(operation: () => Promise<void>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function runAll(operations: Promise<void>[]) {
  const results = await Promise.allSettled(operations);
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed) throw failed.reason;
}

export function useAccountLifecycle() {
  const { clearSession, currentUserId, deleteLocalCredential } = useAuthSession();
  const { deleteConsentHistory } = useTerms();
  const { clearScreenSession: clearCommunitySession, deleteUserCommunityData } =
    useCommunityStore();
  const { clearScreenSession, deleteUserProfileData } = useMyPageStore();
  const { clearDrafts, deleteUserPetData } = usePetStore();

  const logOut = useCallback(async () => {
    const userId = currentUserId;
    await runAll([
      runWithRetry(clearCommunitySession),
      runWithRetry(async () => clearScreenSession()),
      userId ? runWithRetry(() => clearDrafts(userId)) : Promise.resolve(),
    ]);
    if (userId) await runWithRetry(() => clearSession(userId));
  }, [
    clearCommunitySession,
    clearDrafts,
    clearScreenSession,
    clearSession,
    currentUserId,
  ]);

  const deleteAccountData = useCallback(async (userId: string) => {
    await runAll([
      runWithRetry(() => deleteUserCommunityData(userId)),
      runWithRetry(() => deleteUserPetData(userId)),
      runWithRetry(() => deleteUserProfileData(userId)),
      runWithRetry(deleteConsentHistory),
    ]);

    await runWithRetry(() => deleteLocalCredential(userId));
    await runWithRetry(() => AsyncStorage.removeItem(PENDING_WITHDRAWAL_KEY));
    await runWithRetry(() => clearSession(userId));
  }, [
    clearSession,
    deleteLocalCredential,
    deleteConsentHistory,
    deleteUserCommunityData,
    deleteUserPetData,
    deleteUserProfileData,
  ]);

  const resumePendingWithdrawal = useCallback(async () => {
    const pendingUserId = await AsyncStorage.getItem(PENDING_WITHDRAWAL_KEY);
    if (!pendingUserId) return false;
    if (!currentUserId || pendingUserId !== currentUserId) {
      throw new Error('withdrawal-user-mismatch');
    }

    await deleteAccountData(currentUserId);
    return true;
  }, [currentUserId, deleteAccountData]);

  const withdrawAccount = useCallback(async () => {
    if (!currentUserId) throw new Error('auth-session-required');

    await runWithRetry(() =>
      AsyncStorage.setItem(PENDING_WITHDRAWAL_KEY, currentUserId),
    );
    await deleteAccountData(currentUserId);
  }, [
    currentUserId,
    deleteAccountData,
  ]);

  return { logOut, resumePendingWithdrawal, withdrawAccount };
}
