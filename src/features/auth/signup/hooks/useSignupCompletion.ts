import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppAlert } from '@/src/components/modal';
import {
  getSignupUserId,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import {
  completeKakaoOnboarding,
  KakaoAuthError,
} from '@/src/features/auth/services/kakaoAuthService';
import {
  consentStore,
  hasCurrentRequiredSignupConsents,
  termsRepository,
  useTerms,
} from '@/src/features/auth/terms';
import {
  REQUIRED_SIGNUP_TERM_IDS,
  TERM_IDS,
} from '@/src/features/auth/terms/types';
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
import { hasValidSignupLocation } from '../signupValidation';

export function useSignupCompletion() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const {
    clearSignupDraft,
    committedSignupRecovery,
    data,
    markSignupCompleted,
    signupSessionId,
  } = useSignup();
  const {
    activateLocalCredential,
    activatePreparedRemoteSignup,
    activateSignupUser,
    deleteLocalCredential,
    hasLocalCredential,
    pendingRemoteSignupUserId,
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
    hasCurrentConsent,
    signupIdentityFinalized,
    status: termsStatus,
  } = useTerms();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);

  const completeSignup = useCallback(async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    const currentUserId =
      data.method === 'kakao'
        ? pendingRemoteSignupUserId ?? ''
        : getSignupUserId(data.method, data.email, signupSessionId);
    const transactionOwner: SignupTransactionOwner = committedSignupRecovery ?? {
      email: data.email,
      method: data.method,
      sessionId: signupSessionId,
      userId: currentUserId,
    };
    const userId = transactionOwner.userId;
    let consentsFinalized = signupIdentityFinalized;
    let ownsTransaction = false;
    let remoteOnboardingAttempted = false;
    let remoteOnboardingCompleted = false;

    try {
      if (!currentUserId) throw new Error('missing-remote-signup-session');

      if (
        (transactionOwner.method === 'kakao'
          ? transactionOwner.userId !== pendingRemoteSignupUserId
          : getSignupUserId(
              transactionOwner.method,
              transactionOwner.email,
              transactionOwner.sessionId,
            ) !== userId)
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
      let hasCompleteAccount =
        hasPetData &&
        profileStatus === 'valid' &&
        hasCurrentRequiredSignupConsents(consentHistory, currentTerms) &&
        hasCredentialData;
      const canFinalizeCommittedKakao =
        ownsStoredTransaction &&
        transaction?.status === 'committed' &&
        transactionOwner.method === 'kakao' &&
        !signupIdentityFinalized &&
        hasPetData &&
        profileStatus === 'valid' &&
        REQUIRED_SIGNUP_TERM_IDS.every((termId) => hasCurrentConsent(termId));

      if (canFinalizeCommittedKakao) {
        await finalizeSignupConsents(userId);
        consentsFinalized = true;
        hasCompleteAccount = true;
      }
      const canRecoverAccount =
        transaction?.status === 'committed' ||
        (transactionOwner.method === 'local' &&
          (signupIdentityFinalized || hasCompleteAccount));

      if (ownsStoredTransaction && canRecoverAccount) {
        if (hasCompleteAccount) {
          if (transaction?.status !== 'committed') {
            await saveSignupTransaction(transactionOwner, 'committed');
          }
          await clearSignupDraft();
          if (transactionOwner.method === 'local') {
            await activateLocalCredential(userId);
          }
          if (transactionOwner.method === 'kakao') {
            await activatePreparedRemoteSignup(userId);
          } else {
            await activateSignupUser(
              transactionOwner.method,
              transactionOwner.email,
              transactionOwner.sessionId,
            );
          }
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
        if (
          transaction?.status === 'pending' &&
          transaction.method === transactionOwner.method &&
          transaction.userId === userId
        ) {
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
          await clearSignupTransaction(userId, transaction.sessionId);
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
              onPress: () =>
                navigateOnce(async () => {
                  try {
                    await clearSignupDraft();
                    router.replace('/login');
                  } catch (error) {
                    showAlert(
                      '회원가입을 종료하지 못했어요',
                      '잠시 후 다시 시도해주세요.',
                    );
                    throw error;
                  }
                }),
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

      let kakaoLocation: { latitude: number; longitude: number } | null = null;
      if (transactionOwner.method === 'kakao') {
        if (
          !hasValidSignupLocation(data) ||
          data.latitude === null ||
          data.longitude === null
        ) {
          throw new Error('missing-onboarding-location');
        }
        kakaoLocation = { latitude: data.latitude, longitude: data.longitude };
      }
      const initialPet = signupDataToPetEntity(data, userId);
      await registerSignupPet(userId, initialPet);
      await registerSignupProfile(data, userId);
      if (transactionOwner.method === 'local') {
        await registerLocalCredential(userId, data.password);
      }
      if (kakaoLocation) {
        remoteOnboardingAttempted = true;
        await completeKakaoOnboarding({
          agreements: {
            AGE_OVER_14: hasCurrentConsent(TERM_IDS.age),
            LOCATION_SERVICE: hasCurrentConsent(TERM_IDS.location),
            MARKETING_PUSH: hasCurrentConsent(TERM_IDS.marketing),
            PRIVACY: hasCurrentConsent(TERM_IDS.privacy),
            PROFILE_EXTRA: hasCurrentConsent(TERM_IDS.profilePrivacy),
            TERMS_OF_SERVICE: hasCurrentConsent(TERM_IDS.service),
          },
          intro: data.introduction,
          location: kakaoLocation,
          name: data.name,
          nickname: data.nickname,
        });
        remoteOnboardingCompleted = true;
        await saveSignupTransaction(transactionOwner, 'committed');
      }
      await finalizeSignupConsents(userId);
      consentsFinalized = true;
      if (!kakaoLocation) {
        await saveSignupTransaction(transactionOwner, 'committed');
      }
      await clearSignupDraft();
      if (transactionOwner.method === 'local') {
        await activateLocalCredential(userId);
      }
      if (transactionOwner.method === 'kakao') {
        await activatePreparedRemoteSignup(userId);
      } else {
        await activateSignupUser(
          transactionOwner.method,
          transactionOwner.email,
          transactionOwner.sessionId,
        );
      }
      markSignupCompleted();
      await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
        () => undefined,
      );
      router.push('/signup/complete');
    } catch (error) {
      const preserveRemoteOnboarding =
        transactionOwner.method === 'kakao' &&
        (remoteOnboardingCompleted ||
          (remoteOnboardingAttempted &&
            error instanceof KakaoAuthError &&
            error.kind !== 'invalid-kakao-token' &&
            error.kind !== 'invalid-nickname'));

      if (ownsTransaction && !consentsFinalized && !preserveRemoteOnboarding) {
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
      if (error instanceof KakaoAuthError && error.kind === 'invalid-nickname') {
        showAlert('닉네임을 확인해주세요', error.message);
        navigateOnce(() => router.dismissTo('/signup/user-info'));
        return;
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
    activatePreparedRemoteSignup,
    activateSignupUser,
    clearSignupDraft,
    committedSignupRecovery,
    data,
    deleteLocalCredential,
    deleteUserPetData,
    deleteUserProfileData,
    finalizeSignupConsents,
    hasCurrentConsent,
    hasLocalCredential,
    hasStoredUserPetData,
    hasStoredUserProfileData,
    markSignupCompleted,
    navigateOnce,
    pendingRemoteSignupUserId,
    registerSignupPet,
    registerSignupProfile,
    registerLocalCredential,
    router,
    showAlert,
    signupIdentityFinalized,
    signupSessionId,
  ]);

  useEffect(() => {
    if (
      !committedSignupRecovery ||
      recoveryAttemptedRef.current ||
      termsStatus !== 'ready'
    ) {
      return;
    }

    recoveryAttemptedRef.current = true;
    void completeSignup().catch(() => undefined);
  }, [committedSignupRecovery, completeSignup, termsStatus]);

  return {
    completeSignup,
    hasCommittedSignupRecovery: Boolean(committedSignupRecovery),
    signupIdentityFinalized,
    submitting,
  };
}
