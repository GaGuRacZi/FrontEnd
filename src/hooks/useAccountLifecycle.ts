import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { isUuid } from '@/src/features/auth/services/kakaoAuthContract';
import { logoutRemoteSession } from '@/src/features/auth/services/kakaoAuthService';
import { useTerms } from '@/src/features/auth/terms';
import { useChatStore } from '@/src/features/chat/ChatStore';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { useHealthSummaryStore } from '@/src/features/health-summary/HealthSummaryStore';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import {
  deleteRemoteAccount,
  registerRemotePushToken,
} from '@/src/features/mypage/services/mypageApi';
import { useSupportStore } from '@/src/features/mypage/support';
import { usePetStore } from '@/src/features/pet/PetStore';
import { retryOperation } from '@/src/utils/retry';

const PENDING_WITHDRAWAL_KEY = 'paw:account-withdrawal';

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
  const {
    clearScreenSession: clearHealthSummarySession,
    deleteUserHealthSummaryData,
  } = useHealthSummaryStore();

  const logOut = useCallback(async () => {
    const userId = currentUserId;
    if (userId && isUuid(userId)) {
      await retryOperation(() => registerRemotePushToken(null));
      await retryOperation(logoutRemoteSession);
    }
    await runAll([
      retryOperation(clearChatSession),
      retryOperation(clearCommunitySession),
      retryOperation(clearSupportSession),
      retryOperation(async () => clearScreenSession()),
      retryOperation(clearHealthSummarySession),
      userId ? retryOperation(() => clearDrafts(userId)) : Promise.resolve(),
    ]);
    if (userId) await retryOperation(() => clearSession(userId));
  }, [
    clearChatSession,
    clearCommunitySession,
    clearDrafts,
    clearHealthSummarySession,
    clearScreenSession,
    clearSession,
    clearSupportSession,
    currentUserId,
  ]);

  const deleteAccountData = useCallback(async (userId: string) => {
    await runAll([
      retryOperation(() => deleteUserChatData(userId)),
      retryOperation(() => deleteUserCommunityData(userId)),
      retryOperation(() => deleteUserPetData(userId)),
      retryOperation(() => deleteUserProfileData(userId)),
      retryOperation(() => deleteUserSupportData(userId)),
      retryOperation(() => deleteUserHealthSummaryData(userId)),
      retryOperation(deleteConsentHistory),
    ]);

    await retryOperation(() => clearSession(userId));
    await retryOperation(() => AsyncStorage.removeItem(PENDING_WITHDRAWAL_KEY));
  }, [
    clearSession,
    deleteConsentHistory,
    deleteUserChatData,
    deleteUserCommunityData,
    deleteUserHealthSummaryData,
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

    await deleteRemoteAccount();
    await retryOperation(() =>
      AsyncStorage.setItem(PENDING_WITHDRAWAL_KEY, currentUserId),
    );
    await deleteAccountData(currentUserId);
  }, [
    currentUserId,
    deleteAccountData,
  ]);

  return { logOut, resumePendingWithdrawal, withdrawAccount };
}
