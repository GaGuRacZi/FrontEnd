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
  expiresAt: number | null;
  requestedEmail: string | null;
  status: EmailVerificationStatus;
};

export type SignupData = {
  birthDate: string;
  breed: string;
  email: string;
  emailVerificationCode: string;
  emailVerified: boolean;
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
  resumeSignupDraft: () => void;
  committedSignupRecovery: SignupTransaction | null;
  data: SignupData;
  emailVerification: EmailVerificationState;
  flushSignupDraft: () => Promise<void>;
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
    emailVerified: false,
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
  const {
    isReady,
    pendingRemoteSignupMethod,
    pendingRemoteSignupUserId,
  } = useAuthSession();
  const signupMethod = pendingRemoteSignupMethod ?? initialMethod;
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
  const [committedSignupRecovery, setCommittedSignupRecovery] =
    useState<SignupTransaction | null>(null);
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState>({
    error: null,
    expiresAt: null,
    requestedEmail: null,
    status: 'idle',
  });
  const [signupReady, setSignupReady] = useState(false);
  const [signupCompleted, setSignupCompleted] = useState(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    pendingRemoteSignupUserIdRef.current = pendingRemoteSignupUserId;
  }, [pendingRemoteSignupUserId]);

  useEffect(() => {
    if (!isReady || restorationStarted.current) return;

    restorationStarted.current = true;
    let active = true;

    void Promise.allSettled([loadActiveSignupTransaction(), loadActiveSignupDraft()])
      .then(async ([transactionResult, draftResult]) => {
        if (!active) return;

        const loadedTransaction =
          transactionResult.status === 'fulfilled' ? transactionResult.value : null;
        const loadedDraft = draftResult.status === 'fulfilled' ? draftResult.value : null;

        const isCurrentMethod = (method: SignupMethod) =>
          pendingRemoteSignupMethod
            ? method === pendingRemoteSignupMethod
            : method === 'local' && (!signupMethod || signupMethod === method);
        const transaction =
          loadedTransaction &&
          isCurrentMethod(loadedTransaction.method) &&
          (pendingRemoteSignupUserId
            ? loadedTransaction.userId === pendingRemoteSignupUserId
            : false)
            ? loadedTransaction
            : null;
        const draftMatches =
          loadedDraft &&
          isCurrentMethod(loadedDraft.method) &&
          (pendingRemoteSignupUserId
            ? loadedDraft.remoteUserId === pendingRemoteSignupUserId ||
              (loadedDraft.method === 'local' && loadedDraft.remoteUserId === null)
            : loadedDraft.method === 'local' && loadedDraft.remoteUserId === null);
        let draft = draftMatches ? loadedDraft : null;

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
              (draft.remoteUserId !== transaction.userId &&
                !(transaction.method === 'local' && draft.remoteUserId === null)))
          ) {
            await clearActiveSignupDraft(draft.sessionId);
            draft = null;
          }
          const restoredTransaction =
            transaction.status === 'pending'
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
            emailVerified: transaction.method === 'local',
            method: transaction.method,
          };
          signupSessionIdRef.current = transaction.sessionId;
          setSignupSessionId(transaction.sessionId);
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
            emailVerified: draft.method === 'local' && draft.remoteUserId !== null,
            method: draft.method,
          };
          signupSessionIdRef.current = draft.sessionId;
          setSignupSessionId(draft.sessionId);
          setData(restoredData);
          return;
        }

        if (signupMethod) {
          setData((current) => {
            return { ...current, method: signupMethod };
          });
        }
      })
      .catch(() => {
        if (active && signupMethod) {
          setData((current) => {
            return { ...current, method: signupMethod };
          });
        }
      })
      .finally(() => {
        if (active) setSignupReady(true);
      });

    return () => {
      active = false;
    };
  }, [
    isReady,
    pendingRemoteSignupMethod,
    pendingRemoteSignupUserId,
    signupMethod,
  ]);

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
      remoteUserId: remoteUserId ?? null,
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
      setData((current) => ({ ...current, [key]: fieldValue }));
    },
    [],
  );

  const updateFields = useCallback((fields: Partial<SignupData>) => {
    setData((current) => ({ ...current, ...fields }));
  }, []);

  const clearSignupDraft = useCallback(async () => {
    draftEnabledRef.current = false;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    await clearActiveSignupDraft(signupSessionIdRef.current);
  }, []);

  const resumeSignupDraft = useCallback(() => {
    draftEnabledRef.current = true;
  }, []);

  const updateProfileImage = useCallback(
    async (sourceUri: string) => {
      if (!draftEnabledRef.current) throw new Error('signup-cancelled');

      const sessionId = signupSessionIdRef.current;
      const remoteUserId = pendingRemoteSignupUserIdRef.current;
      if (!remoteUserId && dataRef.current.method === 'kakao') {
        throw new Error('signup-session-required');
      }
      const temporaryUserId = getSignupConsentUserId(sessionId);
      const profileImageUri = await persistProfileImage(temporaryUserId, sourceUri);

      if (!draftEnabledRef.current || signupSessionIdRef.current !== sessionId) {
        await removeProfileImage(temporaryUserId, profileImageUri).catch(() => undefined);
        throw new Error('signup-cancelled');
      }

      const previousImageUri = dataRef.current.profileImageUri;
      dataRef.current = { ...dataRef.current, profileImageUri };
      setData((current) => ({ ...current, profileImageUri }));

      try {
        await saveActiveSignupDraft({
          data: dataRef.current,
          method: dataRef.current.method,
          remoteUserId: remoteUserId ?? null,
          sessionId,
        });
      } catch (error) {
        if (dataRef.current.profileImageUri === profileImageUri) {
          dataRef.current = { ...dataRef.current, profileImageUri: previousImageUri };
          setData((current) => ({ ...current, profileImageUri: previousImageUri }));
        }
        await removeProfileImage(temporaryUserId, profileImageUri).catch(() => undefined);
        throw error;
      }

      await removeProfileImage(
        temporaryUserId,
        previousImageUri,
      ).catch(() => undefined);
    },
    [],
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
      resumeSignupDraft,
      committedSignupRecovery,
      data,
      emailVerification,
      flushSignupDraft,
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
      resumeSignupDraft,
      committedSignupRecovery,
      data,
      emailVerification,
      flushSignupDraft,
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
