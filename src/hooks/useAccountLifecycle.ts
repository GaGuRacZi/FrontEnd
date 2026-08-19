import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { isUuid } from '@/src/features/auth/services/kakaoAuthContract';
import { logoutRemoteSession } from '@/src/features/auth/services/kakaoAuthService';
import { useTerms } from '@/src/features/auth/terms';
import { useChatStore } from '@/src/features/chat/ChatStore';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { useSupportStore } from '@/src/features/mypage/support';
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
  const { clearSession, currentUserId } = useAuthSession();
  const { deleteConsentHistory } = useTerms();
  const {
    clearScreenSession: clearChatSession,
    deleteUserChatData,
  } = useChatStore();
  const { clearScreenSession: clearCommunitySession, deleteUserCommunityData } =
    useCommunityStore();
  const { clearScreenSession, deleteUserProfileData } = useMyPageStore();
  const {
    clearScreenSession: clearSupportSession,
    deleteUserSupportData,
  } = useSupportStore();
  const { clearDrafts, deleteUserPetData } = usePetStore();

  const logOut = useCallback(async () => {
    const userId = currentUserId;
    if (userId && isUuid(userId)) {
      await runWithRetry(logoutRemoteSession).catch(() => undefined);
    }
    await runAll([
      runWithRetry(clearChatSession),
      runWithRetry(clearCommunitySession),
      runWithRetry(clearSupportSession),
      runWithRetry(async () => clearScreenSession()),
      userId ? runWithRetry(() => clearDrafts(userId)) : Promise.resolve(),
    ]);
    if (userId) await runWithRetry(() => clearSession(userId));
  }, [
    clearChatSession,
    clearCommunitySession,
    clearDrafts,
    clearScreenSession,
    clearSession,
    clearSupportSession,
    currentUserId,
  ]);

  const deleteAccountData = useCallback(async (userId: string) => {
    await runAll([
      runWithRetry(() => deleteUserChatData(userId)),
      runWithRetry(() => deleteUserCommunityData(userId)),
      runWithRetry(() => deleteUserPetData(userId)),
      runWithRetry(() => deleteUserProfileData(userId)),
      runWithRetry(() => deleteUserSupportData(userId)),
      runWithRetry(deleteConsentHistory),
    ]);

    await runWithRetry(() => clearSession(userId));
    await runWithRetry(() => AsyncStorage.removeItem(PENDING_WITHDRAWAL_KEY));
  }, [
    clearSession,
    deleteConsentHistory,
    deleteUserChatData,
    deleteUserCommunityData,
    deleteUserPetData,
    deleteUserProfileData,
    deleteUserSupportData,
  ]);

  const resumePendingWithdrawal = useCallback(async () => {
    const pendingUserId = await AsyncStorage.getItem(PENDING_WITHDRAWAL_KEY);
    if (!pendingUserId) return false;
    if (!currentUserId || pendingUserId !== currentUserId) {
      await AsyncStorage.removeItem(PENDING_WITHDRAWAL_KEY).catch(() => undefined);
      return false;
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
