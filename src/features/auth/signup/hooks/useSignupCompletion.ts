import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppAlert } from '@/src/components/modal';
import {
  getSignupUserId,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import {
  consentStore,
  hasCurrentRequiredSignupConsents,
  termsRepository,
  useTerms,
} from '@/src/features/auth/terms';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { signupDataToPetEntity } from '@/src/features/pet/petMappers';
import { usePetStore } from '@/src/features/pet/PetStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import {
  clearSignupTransaction,
  isSignupTransactionOwner,
  loadSignupTransaction,
  saveSignupTransaction,
  type SignupTransactionOwner,
} from '../services/signupTransactionStore';
import { useSignup } from '../SignupContext';

export function useSignupCompletion() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const {
    committedSignupRecovery,
    data,
    markSignupCompleted,
    signupSessionId,
  } = useSignup();
  const {
    activateLocalCredential,
    activateSignupUser,
    deleteLocalCredential,
    hasLocalCredential,
    registerLocalCredential,
  } = useAuthSession();
  const { deleteUserPetData, hasStoredUserPetData, registerSignupPet } = usePetStore();
  const {
    deleteUserProfileData,
    hasStoredUserProfileData,
    registerSignupProfile,
  } = useMyPageStore();
  const {
    finalizeSignupConsents,
    signupIdentityFinalized,
  } = useTerms();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  const completeSignup = useCallback(async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    const currentUserId = getSignupUserId(data.method, data.email, signupSessionId);
    const transactionOwner: SignupTransactionOwner = committedSignupRecovery ?? {
      email: data.email,
      method: data.method,
      sessionId: signupSessionId,
      userId: currentUserId,
    };
    const userId = transactionOwner.userId;
    let consentsFinalized = signupIdentityFinalized;
    let ownsTransaction = false;

    try {
      if (
        getSignupUserId(
          transactionOwner.method,
          transactionOwner.email,
          transactionOwner.sessionId,
        ) !== userId
      ) {
        throw new Error('signup-owner-mismatch');
      }

      const storedTransaction = await loadSignupTransaction(userId);
      const transaction = storedTransaction.transaction;
      const ownsStoredTransaction = Boolean(
        transaction && isSignupTransactionOwner(transaction, transactionOwner),
      );
      const [hasPetData, profileStatus, consentHistory, hasCredentialData, currentTerms] =
        await Promise.all([
          hasStoredUserPetData(userId),
          hasStoredUserProfileData(userId),
          consentStore.getHistory(userId),
          transactionOwner.method === 'local'
            ? hasLocalCredential(userId)
            : Promise.resolve(true),
          termsRepository.getTerms(),
        ]);
      const hasCompleteAccount =
        hasPetData &&
        profileStatus === 'valid' &&
        hasCurrentRequiredSignupConsents(consentHistory, currentTerms) &&
        hasCredentialData;

      if (
        ownsStoredTransaction &&
        (transaction?.status === 'committed' ||
          signupIdentityFinalized ||
          hasCompleteAccount)
      ) {
        if (hasCompleteAccount) {
          if (transaction?.status !== 'committed') {
            await saveSignupTransaction(transactionOwner, 'committed');
          }
          if (transactionOwner.method === 'local') {
            await activateLocalCredential(userId);
          }
          await activateSignupUser(
            transactionOwner.method,
            transactionOwner.email,
            transactionOwner.sessionId,
          );
          markSignupCompleted();
          await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
            () => undefined,
          );
          router.push('/signup/complete');
          return;
        }
        throw new Error('signup-committed-data-incomplete');
      }

      if (committedSignupRecovery) {
        throw new Error('signup-committed-transaction-missing');
      }

      if (!signupIdentityFinalized) {
        if (transaction?.status === 'pending' && ownsStoredTransaction) {
          ownsTransaction = true;
          const recoveryResults = await Promise.allSettled([
            deleteUserPetData(userId),
            deleteUserProfileData(userId),
            consentStore.deleteHistory(userId),
            transactionOwner.method === 'local'
              ? deleteLocalCredential(userId)
              : Promise.resolve(),
          ]);
          if (recoveryResults.some((result) => result.status === 'rejected')) {
            throw new Error('signup-recovery-failed');
          }
          await clearSignupTransaction(userId, transactionOwner.sessionId);
        } else if (
          hasPetData ||
          profileStatus !== 'missing' ||
          consentHistory.length > 0 ||
          (transactionOwner.method === 'local' && hasCredentialData)
        ) {
          showAlert('이미 가입된 계정이에요', '기존 계정으로 로그인해주세요.', [
            { text: '닫기', style: 'cancel' },
            {
              text: '로그인하기',
              onPress: () => navigateOnce(() => router.replace('/login')),
            },
          ]);
          throw new Error('signup-account-exists');
        }

        if (storedTransaction.exists) {
          await clearSignupTransaction(userId);
        }
        await saveSignupTransaction(transactionOwner, 'pending');
        ownsTransaction = true;
      }

      const initialPet = signupDataToPetEntity(data, userId);
      await registerSignupPet(userId, initialPet);
      await registerSignupProfile(data, userId);
      if (transactionOwner.method === 'local') {
        await registerLocalCredential(userId, data.password);
      }
      await finalizeSignupConsents(userId);
      consentsFinalized = true;
      await saveSignupTransaction(transactionOwner, 'committed');
      if (transactionOwner.method === 'local') {
        await activateLocalCredential(userId);
      }
      await activateSignupUser(
        transactionOwner.method,
        transactionOwner.email,
        transactionOwner.sessionId,
      );
      markSignupCompleted();
      await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
        () => undefined,
      );
      router.push('/signup/complete');
    } catch (error) {
      if (ownsTransaction && !consentsFinalized) {
        const cleanupResults = await Promise.allSettled([
          deleteUserPetData(userId),
          deleteUserProfileData(userId),
          consentStore.deleteHistory(userId),
          transactionOwner.method === 'local'
            ? deleteLocalCredential(userId)
            : Promise.resolve(),
        ]);
        if (cleanupResults.every((result) => result.status === 'fulfilled')) {
          await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
            () => undefined,
          );
        }
      }
      if (!(error instanceof Error) || error.message !== 'signup-account-exists') {
        showAlert('회원가입을 완료하지 못했어요', '잠시 후 다시 시도해주세요.');
      }
      throw error;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    activateLocalCredential,
    activateSignupUser,
    committedSignupRecovery,
    data,
    deleteLocalCredential,
    deleteUserPetData,
    deleteUserProfileData,
    finalizeSignupConsents,
    hasLocalCredential,
    hasStoredUserPetData,
    hasStoredUserProfileData,
    markSignupCompleted,
    navigateOnce,
    registerSignupPet,
    registerSignupProfile,
    registerLocalCredential,
    router,
    showAlert,
    signupIdentityFinalized,
    signupSessionId,
  ]);

  useEffect(() => {
    if (!committedSignupRecovery || recoveryAttemptedRef.current) return;

    recoveryAttemptedRef.current = true;
    void completeSignup().catch(() => undefined);
  }, [committedSignupRecovery, completeSignup]);

  return {
    completeSignup,
    hasCommittedSignupRecovery: Boolean(committedSignupRecovery),
    signupIdentityFinalized,
    submitting,
  };
}
