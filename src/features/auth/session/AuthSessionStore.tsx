import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SESSION_STORAGE_KEY = 'paw:auth-session';

export type AuthMethod = 'kakao' | 'local';

type AuthSessionContextValue = {
  activateSignupUser: (
    method: AuthMethod,
    email: string,
    signupSessionId: string,
  ) => Promise<string>;
  clearSession: () => Promise<void>;
  currentUserId: string | null;
  isReady: boolean;
  setCurrentUserId: (userId: string) => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function getSignupUserId(
  method: AuthMethod,
  email: string,
  signupSessionId: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail) {
    return `user:email:${encodeURIComponent(normalizedEmail)}`;
  }
  return `${method}:u${signupSessionId}`;
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((storedUserId) => {
        if (!mounted) return;
        setCurrentUserIdState(storedUserId || null);
      })
      .catch(() => {
        if (mounted) setCurrentUserIdState(null);
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setCurrentUserId = useCallback(async (userId: string) => {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, userId);
    setCurrentUserIdState(userId);
  }, []);

  const activateSignupUser = useCallback(
    async (method: AuthMethod, email: string, signupSessionId: string) => {
      const userId = getSignupUserId(method, email, signupSessionId);
      await setCurrentUserId(userId);
      return userId;
    },
    [setCurrentUserId],
  );

  const clearSession = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUserIdState(null);
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      activateSignupUser,
      clearSession,
      currentUserId,
      isReady,
      setCurrentUserId,
    }),
    [activateSignupUser, clearSession, currentUserId, isReady, setCurrentUserId],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}
