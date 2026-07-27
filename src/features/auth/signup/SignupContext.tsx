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

import type { AuthMethod } from '@/src/features/auth/session/AuthSessionStore';
import { getSignupConsentUserId, TermsProvider } from '@/src/features/auth/terms';
import type { PetGender, PetType } from '@/src/features/pet/types';

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
  data: SignupData;
  emailVerification: EmailVerificationState;
  markSignupCompleted: () => void;
  signupCompleted: boolean;
  signupSessionId: string;
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
  const methodInitialized = useRef(Boolean(initialMethod));
  const [signupSessionId] = useState(
    () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`,
  );
  const [data, setData] = useState<SignupData>(() => createInitialData(initialMethod ?? 'local'));
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState>({
    error: null,
    status: 'idle',
  });
  const [signupCompleted, setSignupCompleted] = useState(false);

  useEffect(() => {
    if (!initialMethod || methodInitialized.current) return;

    methodInitialized.current = true;
    setData((current) => ({ ...current, method: initialMethod }));
  }, [initialMethod]);

  const updateField = useCallback(
    <Key extends keyof SignupData>(key: Key, fieldValue: SignupData[Key]) => {
      setData((current) => ({ ...current, [key]: fieldValue }));
    },
    [],
  );

  const updateFields = useCallback((fields: Partial<SignupData>) => {
    setData((current) => ({ ...current, ...fields }));
  }, []);

  const updateEmailVerification = useCallback((state: Partial<EmailVerificationState>) => {
    setEmailVerification((current) => ({ ...current, ...state }));
  }, []);

  const markSignupCompleted = useCallback(() => {
    setSignupCompleted(true);
  }, []);

  const value = useMemo<SignupContextValue>(
    () => ({
      data,
      emailVerification,
      markSignupCompleted,
      signupCompleted,
      signupSessionId,
      updateEmailVerification,
      updateField,
      updateFields,
    }),
    [
      data,
      emailVerification,
      markSignupCompleted,
      signupCompleted,
      signupSessionId,
      updateEmailVerification,
      updateField,
      updateFields,
    ],
  );

  return (
    <SignupContext.Provider value={value}>
      <TermsProvider scope="signup" userId={getSignupConsentUserId(signupSessionId)}>
        {children}
      </TermsProvider>
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
