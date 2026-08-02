import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { clearTokens } from '@/src/services/tokenStorage';

import { clearActiveSignupTransaction } from '../signup/services/signupTransactionStore';
import {
  localCredentialRepository,
  type LocalCredentialVerification,
} from './localCredentialRepository';

const SESSION_STORAGE_KEY = 'paw:auth-session';
const SESSION_CLEAR_STORAGE_KEY = 'paw:auth-session-clear';
const EMAIL_USER_ID_PREFIX = 'user:email:';

export type AuthMethod = 'kakao' | 'local';
type LocalSignInResult =
  | { status: Exclude<LocalCredentialVerification, 'verified'> }
  | { status: 'verified'; userId: string };

type AuthSessionContextValue = {
  activateLocalCredential: (userId: string) => Promise<void>;
  activateSignupUser: (
    method: AuthMethod,
    email: string,
    signupSessionId: string,
  ) => Promise<string>;
  clearSession: (expectedUserId: string) => Promise<void>;
  currentUserId: string | null;
  deleteLocalCredential: (userId: string) => Promise<void>;
  hasLocalCredential: (userId: string) => Promise<boolean>;
  isReady: boolean;
  registerLocalCredential: (userId: string, password: string) => Promise<void>;
  retrySessionLoad: () => void;
  sessionLoadError: boolean;
  setCurrentUserId: (userId: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<LocalSignInResult>;
  verifyCurrentUserPassword: (password: string) => Promise<LocalCredentialVerification>;
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

function parseSessionUserId(value: string | null) {
  if (!value || value !== value.trim()) return null;
  if (/^(local|kakao):u\S+$/.test(value)) return value;
  if (!value.startsWith(EMAIL_USER_ID_PREFIX)) return null;

  const encodedEmail = value.slice(EMAIL_USER_ID_PREFIX.length);

  try {
    const email = decodeURIComponent(encodedEmail);
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email !== email.trim().toLowerCase() ||
      encodeURIComponent(email) !== encodedEmail
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

async function clearPersistedSession(userId: string) {
  const failures: unknown[] = [];

  try {
    await AsyncStorage.setItem(SESSION_CLEAR_STORAGE_KEY, userId);
  } catch (error) {
    failures.push(error);
  }

  const results = await Promise.allSettled([
    clearTokens(),
    clearActiveSignupTransaction(),
    AsyncStorage.removeItem(SESSION_STORAGE_KEY),
  ]);
  results.forEach((result) => {
    if (result.status === 'rejected') failures.push(result.reason);
  });

  if (results.every((result) => result.status === 'fulfilled')) {
    try {
      await AsyncStorage.removeItem(SESSION_CLEAR_STORAGE_KEY);
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) throw failures[0];
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const [sessionLoadError, setSessionLoadError] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const pendingSessionClearUserIdRef = useRef<string | null>(null);
  const sessionMutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSessionMutation = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = sessionMutationQueueRef.current.then(operation, operation);
    sessionMutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsReady(false);
    setSessionLoadError(false);

    void enqueueSessionMutation(async () => {
      const [storedUserId, pendingClearUserId] = await Promise.all([
        AsyncStorage.getItem(SESSION_STORAGE_KEY),
        AsyncStorage.getItem(SESSION_CLEAR_STORAGE_KEY),
      ]);
      const restoredUserId = parseSessionUserId(storedUserId);

      if (pendingClearUserId && (!storedUserId || pendingClearUserId === storedUserId)) {
        pendingSessionClearUserIdRef.current = pendingClearUserId;
        try {
          await clearPersistedSession(pendingClearUserId);
          pendingSessionClearUserIdRef.current = null;
        } finally {
          if (mounted) {
            currentUserIdRef.current = null;
            setCurrentUserIdState(null);
          }
        }
        return;
      }

      if (pendingClearUserId) {
        await AsyncStorage.removeItem(SESSION_CLEAR_STORAGE_KEY);
      }

      if (storedUserId && !restoredUserId) {
        pendingSessionClearUserIdRef.current = storedUserId;
        try {
          await clearPersistedSession(storedUserId);
          pendingSessionClearUserIdRef.current = null;
        } finally {
          if (mounted) {
            currentUserIdRef.current = null;
            setCurrentUserIdState(null);
          }
        }
        return;
      }

      if (mounted) {
        currentUserIdRef.current = restoredUserId;
        setCurrentUserIdState(restoredUserId);
      }
    })
      .then(() => {
        if (mounted) setSessionLoadError(false);
      })
      .catch(() => {
        if (mounted) setSessionLoadError(true);
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [enqueueSessionMutation, loadRequest]);

  const retrySessionLoad = useCallback(() => {
    setIsReady(false);
    setSessionLoadError(false);
    setLoadRequest((current) => current + 1);
  }, []);

  const setCurrentUserId = useCallback(
    (userId: string) =>
      enqueueSessionMutation(async () => {
        const normalizedUserId = parseSessionUserId(userId);
        if (!normalizedUserId) throw new Error('invalid-session-user-id');

        await AsyncStorage.setItem(SESSION_STORAGE_KEY, normalizedUserId);
        await AsyncStorage.removeItem(SESSION_CLEAR_STORAGE_KEY);
        pendingSessionClearUserIdRef.current = null;
        currentUserIdRef.current = normalizedUserId;
        setCurrentUserIdState(normalizedUserId);
        setSessionLoadError(false);
        setIsReady(true);
      }),
    [enqueueSessionMutation],
  );

  const activateSignupUser = useCallback(
    async (method: AuthMethod, email: string, signupSessionId: string) => {
      const userId = getSignupUserId(method, email, signupSessionId);
      await setCurrentUserId(userId);
      return userId;
    },
    [setCurrentUserId],
  );

  const activateLocalCredential = useCallback((userId: string) => {
    return localCredentialRepository.activate(userId);
  }, []);

  const registerLocalCredential = useCallback((userId: string, password: string) => {
    return localCredentialRepository.save(userId, password);
  }, []);

  const hasLocalCredential = useCallback((userId: string) => {
    return localCredentialRepository.has(userId);
  }, []);

  const deleteLocalCredential = useCallback((userId: string) => {
    return localCredentialRepository.delete(userId);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<LocalSignInResult> => {
      const userId = getSignupUserId('local', email, 'local-login');
      const status = await localCredentialRepository.verify(userId, password);

      if (status !== 'verified') return { status };

      await setCurrentUserId(userId);
      return { status, userId };
    },
    [setCurrentUserId],
  );

  const verifyCurrentUserPassword = useCallback(
    (password: string) => {
      if (!currentUserId) throw new Error('auth-session-required');
      return localCredentialRepository.verify(currentUserId, password);
    },
    [currentUserId],
  );

  const clearSession = useCallback(
    (expectedUserId: string) =>
      enqueueSessionMutation(async () => {
        if (
          currentUserIdRef.current !== expectedUserId &&
          pendingSessionClearUserIdRef.current !== expectedUserId
        ) {
          return;
        }

        pendingSessionClearUserIdRef.current = expectedUserId;
        try {
          await clearPersistedSession(expectedUserId);
          pendingSessionClearUserIdRef.current = null;
        } finally {
          if (currentUserIdRef.current === expectedUserId) {
            currentUserIdRef.current = null;
            setCurrentUserIdState(null);
            setSessionLoadError(false);
            setIsReady(true);
          }
        }
      }),
    [enqueueSessionMutation],
  );

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      activateLocalCredential,
      activateSignupUser,
      clearSession,
      currentUserId,
      deleteLocalCredential,
      hasLocalCredential,
      isReady,
      registerLocalCredential,
      retrySessionLoad,
      sessionLoadError,
      setCurrentUserId,
      signInWithPassword,
      verifyCurrentUserPassword,
    }),
    [
      activateLocalCredential,
      activateSignupUser,
      clearSession,
      currentUserId,
      deleteLocalCredential,
      hasLocalCredential,
      isReady,
      registerLocalCredential,
      retrySessionLoad,
      sessionLoadError,
      setCurrentUserId,
      signInWithPassword,
      verifyCurrentUserPassword,
    ],
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
