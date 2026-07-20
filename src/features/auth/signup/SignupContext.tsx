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

export type SignupMethod = 'kakao' | 'local';
export type PetType = 'cat' | 'dog' | null;
export type PetGender = 'female' | 'male' | null;
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
  petGender: PetGender;
  petName: string;
  petType: PetType;
  profileImageUri: string | null;
  region: string;
  regionSource: 'current' | 'search' | null;
  weight: string;
};

type SignupContextValue = {
  data: SignupData;
  emailVerification: EmailVerificationState;
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
  const [data, setData] = useState<SignupData>(() => createInitialData(initialMethod ?? 'local'));
  const [emailVerification, setEmailVerification] = useState<EmailVerificationState>({
    error: null,
    status: 'idle',
  });

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

  const value = useMemo<SignupContextValue>(
    () => ({
      data,
      emailVerification,
      updateEmailVerification,
      updateField,
      updateFields,
    }),
    [data, emailVerification, updateEmailVerification, updateField, updateFields],
  );

  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup() {
  const context = useContext(SignupContext);

  if (!context) {
    throw new Error('useSignup must be used inside SignupProvider.');
  }

  return context;
}
