import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';
import {
  getSignupUserId,
  useAuthSession,
  type AuthMethod,
} from '@/src/features/auth/session/AuthSessionStore';
import { loadRemoteUserProfile } from '@/src/features/auth/services/kakaoAuthService';
import { getSignupConsentUserId, TermsProvider } from '@/src/features/auth/terms';
import {
  persistProfileImage,
  removeProfileImage,
} from '@/src/features/mypage/services/profileImageStorage';
import type { PetGender, PetType } from '@/src/features/pet/types';

import {
  clearActiveSignupDraft,
  loadActiveSignupDraft,
  saveActiveSignupDraft,
} from './services/signupDraftStore';
import {
  clearActiveSignupTransaction,
  loadActiveSignupTransaction,
  saveSignupTransaction,
  type SignupTransaction,
} from './services/signupTransactionStore';

export type SignupMethod = AuthMethod;
export type { PetGender, PetType } from '@/src/features/pet/types';
type EmailVerificationStatus = 'confirming' | 'idle' | 'requesting';
type EmailVerificationError = {
  field: 'code' | 'email';
  message: string;
} | null;

type EmailVerificationState = {
  error: EmailVerificationError;
  status: EmailVerificationStatus;
};

export type SignupData = {
  birthDate: string;
  breed: string;
  email: string;
  emailVerificationCode: string;
  emailVerificationId: string | null;
  emailVerificationToken: string | null;
  introduction: string;
  latitude: number | null;
  longitude: number | null;
  method: SignupMethod;
  name: string;
  neutered: boolean | null;
  nickname: string;
  password: string;
  passwordConfirm: string;
  petGender: PetGender | null;
  petName: string;
  petType: PetType | null;
  profileImageUri: string | null;
  region: string;
  regionSource: 'current' | 'search' | null;
  weight: string;
};

type SignupContextValue = {
  clearSignupDraft: () => Promise<void>;
  committedSignupRecovery: SignupTransaction | null;
  data: SignupData;
  emailVerification: EmailVerificationState;
  markSignupCompleted: () => void;
  signupCompleted: boolean;
  signupSessionId: string;
  updateProfileImage: (sourceUri: string) => Promise<void>;
  updateField: <Key extends keyof SignupData>(key: Key, value: SignupData[Key]) => void;
  updateEmailVerification: (state: Partial<EmailVerificationState>) => void;
  updateFields: (fields: Partial<SignupData>) => void;
};

const SignupContext = createContext<SignupContextValue | null>(null);

function createInitialData(method: SignupMethod): SignupData {
  return {
    birthDate: '',
    breed: '',
    email: '',
    emailVerificationCode: '',
    emailVerificationId: null,
    emailVerificationToken: null,
    introduction: '',
    latitude: null,
    longitude: null,
    method,
    name: '',
    neutered: null,
    nickname: '',
    password: '',
    passwordConfirm: '',
    petGender: null,
    petName: '',
    petType: null,
    profileImageUri: null,
    region: '',
    regionSource: null,
    weight: '',
  };
}

type SignupProviderProps = PropsWithChildren<{
  initialMethod?: SignupMethod;
}>;

export function SignupProvider({ children, initialMethod }: SignupProviderProps) {
  const { pendingRemoteSignupUserId } = useAuthSession();
  const signupMethod = pendingRemoteSignupUserId ? 'kakao' : initialMethod;
  const restorationStarted = useRef(false);
  const draftEnabledRef = useRef(true);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [signupSessionId, setSignupSessionId] = useState(
    () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`,
  );
  const [data, setData] = useState<SignupData>(() => createInitialData(signupMethod ?? 'local'));
  const dataRef = useRef(data);
  const signupSessionIdRef = useRef(signupSessionId);
  const pendingRemoteSignupUserIdRef = useRef(pendingRemoteSignupUserId);
  pendingRemoteSignupUserIdRef.current = pendingRemoteSignupUserId;
  const [committedSignupRecovery, setCommittedSignupRecovery] =
    useState<SignupTransaction | null>(null);
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState>({
    error: null,
    status: 'idle',
  });
  const [signupReady, setSignupReady] = useState(false);
  const [signupCompleted, setSignupCompleted] = useState(false);

  useEffect(() => {
    if (restorationStarted.current) return;

    restorationStarted.current = true;
    let active = true;

    void Promise.allSettled([loadActiveSignupTransaction(), loadActiveSignupDraft()])
      .then(async ([transactionResult, draftResult]) => {
        if (!active) return;

        const loadedTransaction =
          transactionResult.status === 'fulfilled' ? transactionResult.value : null;
        const loadedDraft = draftResult.status === 'fulfilled' ? draftResult.value : null;

        const isCurrentMethod = (method: SignupMethod) =>
          pendingRemoteSignupUserId
            ? method === 'kakao'
            : method === 'local' && (!signupMethod || signupMethod === method);
        const transaction =
          loadedTransaction &&
          isCurrentMethod(loadedTransaction.method) &&
          (loadedTransaction.method === 'kakao'
            ? loadedTransaction.userId === pendingRemoteSignupUserId
            : getSignupUserId(
                loadedTransaction.method,
                loadedTransaction.email,
                loadedTransaction.sessionId,
              ) === loadedTransaction.userId)
            ? loadedTransaction
            : null;
        let draft =
          loadedDraft &&
          isCurrentMethod(loadedDraft.method) &&
          (loadedDraft.method === 'kakao'
            ? loadedDraft.remoteUserId === pendingRemoteSignupUserId
            : loadedDraft.remoteUserId === null)
            ? loadedDraft
            : null;

        if (loadedTransaction && !transaction) {
          await clearActiveSignupTransaction();
        }
        if (loadedDraft && !draft) {
          await clearActiveSignupDraft(loadedDraft.sessionId);
        }
        if (!active) return;

        if (transaction) {
          if (
            draft &&
            (draft.sessionId !== transaction.sessionId ||
              draft.method !== transaction.method ||
              draft.remoteUserId !==
                (transaction.method === 'kakao' ? transaction.userId : null))
          ) {
            await clearActiveSignupDraft(draft.sessionId);
            draft = null;
          }
          const restoredTransaction =
            transaction.method === 'kakao' && transaction.status === 'pending'
              ? await loadRemoteUserProfile()
                  .then((profile) =>
                    !profile.isNew && profile.uid === transaction.userId
                      ? saveSignupTransaction(transaction, 'committed')
                      : transaction,
                  )
                  .catch(() => transaction)
              : transaction;
          if (!active) return;
          const restoredData = {
            ...createInitialData(transaction.method),
            ...(draft?.data ?? {}),
            email: transaction.email,
            method: transaction.method,
          };
          signupSessionIdRef.current = transaction.sessionId;
          setSignupSessionId(transaction.sessionId);
          dataRef.current = restoredData;
          setData(restoredData);
          if (restoredTransaction.status === 'committed') {
            setCommittedSignupRecovery(restoredTransaction);
          }
          return;
        }

        if (draft) {
          const restoredData = {
            ...createInitialData(draft.method),
            ...draft.data,
            method: draft.method,
          };
          signupSessionIdRef.current = draft.sessionId;
          setSignupSessionId(draft.sessionId);
          dataRef.current = restoredData;
          setData(restoredData);
          return;
        }

        if (signupMethod) {
          setData((current) => {
            const next = { ...current, method: signupMethod };
            dataRef.current = next;
            return next;
          });
        }
      })
      .catch(() => {
        if (active && signupMethod) {
          setData((current) => {
            const next = { ...current, method: signupMethod };
            dataRef.current = next;
            return next;
          });
        }
      })
      .finally(() => {
        if (active) setSignupReady(true);
      });

    return () => {
      active = false;
    };
  }, [pendingRemoteSignupUserId, signupMethod]);

  const flushSignupDraft = useCallback(() => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    if (!draftEnabledRef.current) return Promise.resolve();

    const currentData = dataRef.current;
    const remoteUserId = pendingRemoteSignupUserIdRef.current;
    if (currentData.method === 'kakao' && !remoteUserId) return Promise.resolve();

    return saveActiveSignupDraft({
      data: currentData,
      method: currentData.method,
      remoteUserId: currentData.method === 'kakao' ? remoteUserId : null,
      sessionId: signupSessionIdRef.current,
    }).then(() => undefined);
  }, []);

  useEffect(() => {
    if (!signupReady || signupCompleted || !draftEnabledRef.current) return undefined;

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      void flushSignupDraft().catch(() => undefined);
    }, 250);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [data, flushSignupDraft, signupCompleted, signupReady]);

  useEffect(() => {
    if (!signupReady) return undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        void flushSignupDraft().catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
      void flushSignupDraft().catch(() => undefined);
    };
  }, [flushSignupDraft, signupReady]);

  const updateField = useCallback(
    <Key extends keyof SignupData>(key: Key, fieldValue: SignupData[Key]) => {
      setData((current) => {
        const next = { ...current, [key]: fieldValue };
        dataRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateFields = useCallback((fields: Partial<SignupData>) => {
    setData((current) => {
      const next = { ...current, ...fields };
      dataRef.current = next;
      return next;
    });
  }, []);

  const clearSignupDraft = useCallback(async () => {
    draftEnabledRef.current = false;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    await clearActiveSignupDraft(signupSessionIdRef.current);
  }, []);

  const updateProfileImage = useCallback(
    async (sourceUri: string) => {
      if (!draftEnabledRef.current) throw new Error('signup-cancelled');

      const sessionId = signupSessionIdRef.current;
      const temporaryUserId = getSignupConsentUserId(sessionId);
      const profileImageUri = await persistProfileImage(temporaryUserId, sourceUri);

      if (!draftEnabledRef.current || signupSessionIdRef.current !== sessionId) {
        await removeProfileImage(temporaryUserId, profileImageUri).catch(() => undefined);
        throw new Error('signup-cancelled');
      }

      const previousData = dataRef.current;
      const nextData = { ...previousData, profileImageUri };
      dataRef.current = nextData;
      setData(nextData);

      try {
        await saveActiveSignupDraft({
          data: nextData,
          method: nextData.method,
          remoteUserId:
            nextData.method === 'kakao' ? pendingRemoteSignupUserId : null,
          sessionId,
        });
      } catch (error) {
        if (dataRef.current.profileImageUri === profileImageUri) {
          dataRef.current = previousData;
          setData(previousData);
        }
        await removeProfileImage(temporaryUserId, profileImageUri).catch(() => undefined);
        throw error;
      }

      await removeProfileImage(
        temporaryUserId,
        previousData.profileImageUri,
      ).catch(() => undefined);
    },
    [pendingRemoteSignupUserId],
  );

  const updateEmailVerification = useCallback((state: Partial<EmailVerificationState>) => {
    setEmailVerification((current) => ({ ...current, ...state }));
  }, []);

  const markSignupCompleted = useCallback(() => {
    setSignupCompleted(true);
  }, []);

  const value = useMemo<SignupContextValue>(
    () => ({
      clearSignupDraft,
      committedSignupRecovery,
      data,
      emailVerification,
      markSignupCompleted,
      signupCompleted,
      signupSessionId,
      updateProfileImage,
      updateEmailVerification,
      updateField,
      updateFields,
    }),
    [
      clearSignupDraft,
      committedSignupRecovery,
      data,
      emailVerification,
      markSignupCompleted,
      signupCompleted,
      signupSessionId,
      updateProfileImage,
      updateEmailVerification,
      updateField,
      updateFields,
    ],
  );

  return (
    <SignupContext.Provider value={value}>
      {signupReady ? (
        <TermsProvider scope="signup" userId={getSignupConsentUserId(signupSessionId)}>
          {children}
        </TermsProvider>
      ) : (
        <AppScreen>
          <LoadingView label="회원가입 정보를 확인하고 있어요." />
        </AppScreen>
      )}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);

  if (!context) {
    throw new Error('useSignup must be used inside SignupProvider.');
  }

  return context;
}
