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

export type SignupData = {
  birthDate: string;
  breed: string;
  email: string;
  emailChecked: boolean;
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
  phone: string;
  phoneVerified: boolean;
  profileImageUri: string | null;
  region: string;
  weight: string;
};

type SignupContextValue = {
  data: SignupData;
  updateField: <Key extends keyof SignupData>(key: Key, value: SignupData[Key]) => void;
};

const SignupContext = createContext<SignupContextValue | null>(null);

function createInitialData(method: SignupMethod): SignupData {
  return {
    birthDate: '',
    breed: '',
    email: '',
    emailChecked: false,
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
    phone: '',
    phoneVerified: false,
    profileImageUri: null,
    region: '',
    weight: '',
  };
}

type SignupProviderProps = PropsWithChildren<{
  initialMethod?: SignupMethod;
}>;

export function SignupProvider({ children, initialMethod }: SignupProviderProps) {
  const methodInitialized = useRef(Boolean(initialMethod));
  const [data, setData] = useState<SignupData>(() => createInitialData(initialMethod ?? 'local'));

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

  const value = useMemo<SignupContextValue>(
    () => ({
      data,
      updateField,
    }),
    [data, updateField],
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
