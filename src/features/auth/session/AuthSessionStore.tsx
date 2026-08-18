import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearTokens,
  getTokens,
  saveTokens,
  subscribeToTokenInvalidation,
  type AuthTokens,
} from '@/src/services/tokenStorage';
import { clearActiveSignupDraft } from '../signup/services/signupDraftStore';
import { clearActiveSignupTransaction } from '../signup/services/signupTransactionStore';
import { isUuid } from '../services/kakaoAuthContract';
import {
  KakaoAuthError,
  loadRemoteUserIdentity,
} from '../services/kakaoAuthService';
import {
  localCredentialRepository,
  type LocalCredentialVerification,
} from './localCredentialRepository';

const SESSION_STORAGE_KEY = 'paw:auth-session';
const SESSION_CLEAR_STORAGE_KEY = 'paw:auth-session-clear';
const PENDING_REMOTE_SIGNUP_STORAGE_KEY = 'paw:auth-pending-remote-signup';
const EMAIL_USER_ID_PREFIX = 'user:email:';

export type AuthMethod = 'kakao' | 'local';
export type RemoteAuthSession = AuthTokens & { uid: string };
type LocalSignInResult =
  | { status: Exclude<LocalCredentialVerification, 'verified'> }
  | { status: 'verified'; userId: string };

type AuthSessionContextValue = {
  activateLocalCredential: (userId: string) => Promise<void>;
  activatePreparedRemoteSignup: (userId: string) => Promise<void>;
  activateRemoteSession: (session: RemoteAuthSession) => Promise<void>;
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
  pendingRemoteSignupUserId: string | null;
  prepareRemoteSignup: (session: RemoteAuthSession) => Promise<void>;
  registerLocalCredential: (userId: string, password: string) => Promise<void>;
  retrySessionLoad: () => void;
  sessionLoadError: boolean;
  setCurrentUserId: (userId: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<LocalSignInResult>;
  verifyCurrentUserPassword: (password: string) => Promise<LocalCredentialVerification>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function getEmailUserId(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail
    ? `${EMAIL_USER_ID_PREFIX}${encodeURIComponent(normalizedEmail)}`
    : null;
}

export function getSignupUserId(
  method: AuthMethod,
  email: string,
  signupSessionId: string,
) {
  return getEmailUserId(email) ?? `${method}:u${signupSessionId}`;
}

function parseSessionUserId(value: string | null) {
  if (!value || value !== value.trim()) return null;
  if (isUuid(value)) return value;
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

function parseRemoteSession(session: RemoteAuthSession) {
  const uid = parseSessionUserId(session.uid);

  if (
    !uid ||
    !isUuid(uid) ||
    typeof session.accessToken !== 'string' ||
    !session.accessToken.trim() ||
    typeof session.refreshToken !== 'string' ||
    !session.refreshToken.trim()
  ) {
    throw new Error('invalid-remote-session');
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    uid,
  };
}

async function rollbackRemoteSession(error: unknown): Promise<never> {
  const results = await Promise.allSettled([
    clearTokens(),
    AsyncStorage.removeItem(SESSION_STORAGE_KEY),
    AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY),
  ]);
  const cleanupFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (cleanupFailure && error instanceof Error && error.cause === undefined) {
    error.cause = cleanupFailure.reason;
  }

  throw error;
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
    clearActiveSignupDraft(),
    clearActiveSignupTransaction(),
    AsyncStorage.removeItem(SESSION_STORAGE_KEY),
    AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY),
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
  const [pendingRemoteSignupUserId, setPendingRemoteSignupUserIdState] = useState<
    string | null
  >(null);
  const [isReady, setIsReady] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const [sessionLoadError, setSessionLoadError] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const pendingRemoteSignupUserIdRef = useRef<string | null>(null);
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
      const clearRestoredSession = async (userId: string) => {
        pendingSessionClearUserIdRef.current = userId;
        try {
          await clearPersistedSession(userId);
          pendingSessionClearUserIdRef.current = null;
        } finally {
          if (mounted) {
            currentUserIdRef.current = null;
            setCurrentUserIdState(null);
            pendingRemoteSignupUserIdRef.current = null;
            setPendingRemoteSignupUserIdState(null);
          }
        }
      };
      const [storedUserId, pendingClearUserId, storedPendingRemoteSignupUserId] =
        await Promise.all([
          AsyncStorage.getItem(SESSION_STORAGE_KEY),
          AsyncStorage.getItem(SESSION_CLEAR_STORAGE_KEY),
          AsyncStorage.getItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY),
        ]);
      const restoredUserId = parseSessionUserId(storedUserId);
      const parsedPendingRemoteSignupUserId = parseSessionUserId(
        storedPendingRemoteSignupUserId,
      );
      const restoredPendingRemoteSignupUserId =
        parsedPendingRemoteSignupUserId && isUuid(parsedPendingRemoteSignupUserId)
          ? parsedPendingRemoteSignupUserId
          : null;

      if (pendingClearUserId && (!storedUserId || pendingClearUserId === storedUserId)) {
        await clearRestoredSession(pendingClearUserId);
        return;
      }

      if (pendingClearUserId) {
        await AsyncStorage.removeItem(SESSION_CLEAR_STORAGE_KEY);
      }

      if (storedUserId && !restoredUserId) {
        await clearRestoredSession(storedUserId);
        return;
      }

      const remoteUserId =
        restoredUserId && isUuid(restoredUserId)
          ? restoredUserId
          : !restoredUserId && restoredPendingRemoteSignupUserId
            ? restoredPendingRemoteSignupUserId
            : null;

      if (remoteUserId) {
        const tokens = await getTokens();

        if (!tokens?.accessToken.trim() || !tokens.refreshToken.trim()) {
          await clearRestoredSession(remoteUserId);
          return;
        }

        try {
          const identity = await loadRemoteUserIdentity();
          if (
            identity.uid !== remoteUserId ||
            (Boolean(restoredUserId) && identity.isNew)
          ) {
            await clearRestoredSession(remoteUserId);
            return;
          }
        } catch (error) {
          if (
            (await getTokens()) &&
            (!(error instanceof KakaoAuthError) || error.kind !== 'invalid-kakao-token')
          ) {
            throw error;
          }
          await clearRestoredSession(remoteUserId);
          return;
        }
      } else {
        await clearTokens();
      }

      if (restoredUserId && storedPendingRemoteSignupUserId) {
        await AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY);
      } else if (
        !restoredUserId &&
        storedPendingRemoteSignupUserId &&
        !restoredPendingRemoteSignupUserId
      ) {
        await AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY);
      }

      if (mounted) {
        currentUserIdRef.current = restoredUserId;
        setCurrentUserIdState(restoredUserId);
        const pendingRemoteUserId = restoredUserId
          ? null
          : restoredPendingRemoteSignupUserId;
        pendingRemoteSignupUserIdRef.current = pendingRemoteUserId;
        setPendingRemoteSignupUserIdState(pendingRemoteUserId);
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

        await clearTokens();
        await AsyncStorage.multiRemove([
          SESSION_STORAGE_KEY,
          SESSION_CLEAR_STORAGE_KEY,
          PENDING_REMOTE_SIGNUP_STORAGE_KEY,
        ]);
        pendingRemoteSignupUserIdRef.current = null;
        setPendingRemoteSignupUserIdState(null);
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, normalizedUserId);
        pendingSessionClearUserIdRef.current = null;
        currentUserIdRef.current = normalizedUserId;
        setCurrentUserIdState(normalizedUserId);
        setSessionLoadError(false);
        setIsReady(true);
      }),
    [enqueueSessionMutation],
  );

  const prepareRemoteSignup = useCallback(
    (session: RemoteAuthSession) =>
      enqueueSessionMutation(async () => {
        const remoteSession = parseRemoteSession(session);
        if (currentUserIdRef.current) throw new Error('auth-session-already-active');

        await Promise.allSettled([
          clearActiveSignupDraft(),
          clearActiveSignupTransaction(),
        ]);
        await AsyncStorage.multiRemove([
          SESSION_STORAGE_KEY,
          SESSION_CLEAR_STORAGE_KEY,
          PENDING_REMOTE_SIGNUP_STORAGE_KEY,
        ]);
        pendingRemoteSignupUserIdRef.current = null;
        setPendingRemoteSignupUserIdState(null);

        try {
          await saveTokens(remoteSession);
          await AsyncStorage.setItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY, remoteSession.uid);
        } catch (error) {
          return rollbackRemoteSession(error);
        }

        pendingRemoteSignupUserIdRef.current = remoteSession.uid;
        setPendingRemoteSignupUserIdState(remoteSession.uid);
      }),
    [enqueueSessionMutation],
  );

  const activateRemoteSession = useCallback(
    (session: RemoteAuthSession) =>
      enqueueSessionMutation(async () => {
        const remoteSession = parseRemoteSession(session);
        if (currentUserIdRef.current) throw new Error('auth-session-already-active');

        await Promise.allSettled([
          clearActiveSignupDraft(),
          clearActiveSignupTransaction(),
        ]);
        await AsyncStorage.multiRemove([
          SESSION_STORAGE_KEY,
          SESSION_CLEAR_STORAGE_KEY,
          PENDING_REMOTE_SIGNUP_STORAGE_KEY,
        ]);
        pendingRemoteSignupUserIdRef.current = null;
        setPendingRemoteSignupUserIdState(null);

        try {
          await saveTokens(remoteSession);
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, remoteSession.uid);
        } catch (error) {
          return rollbackRemoteSession(error);
        }

        pendingSessionClearUserIdRef.current = null;
        currentUserIdRef.current = remoteSession.uid;
        setCurrentUserIdState(remoteSession.uid);
        setSessionLoadError(false);
        setIsReady(true);
      }),
    [enqueueSessionMutation],
  );

  const activatePreparedRemoteSignup = useCallback(
    (userId: string) =>
      enqueueSessionMutation(async () => {
        const normalizedUserId = parseSessionUserId(userId);
        if (
          !normalizedUserId ||
          !isUuid(normalizedUserId) ||
          pendingRemoteSignupUserIdRef.current !== normalizedUserId
        ) {
          throw new Error('invalid-pending-remote-signup');
        }

        const tokens = await getTokens();
        if (!tokens?.accessToken.trim() || !tokens.refreshToken.trim()) {
          throw new Error('missing-remote-session-token');
        }

        await AsyncStorage.removeItem(SESSION_CLEAR_STORAGE_KEY);
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, normalizedUserId);
        await AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY);
        pendingRemoteSignupUserIdRef.current = null;
        setPendingRemoteSignupUserIdState(null);
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
      const userId = parseSessionUserId(getEmailUserId(email));
      if (!userId) return { status: 'invalid' };

      const status = await localCredentialRepository.verify(userId, password);

      if (status !== 'verified') return { status };

      await Promise.allSettled([
        clearActiveSignupDraft(),
        clearActiveSignupTransaction(),
      ]);
      await setCurrentUserId(userId);
      return { status, userId };
    },
    [setCurrentUserId],
  );

  const verifyCurrentUserPassword = useCallback((password: string) => {
    const userId = currentUserIdRef.current;
    if (!userId) throw new Error('auth-session-required');
    return localCredentialRepository.verify(userId, password);
  }, []);

  const clearSession = useCallback(
    (expectedUserId: string) =>
      enqueueSessionMutation(async () => {
        if (
          currentUserIdRef.current !== expectedUserId &&
          pendingSessionClearUserIdRef.current !== expectedUserId &&
          pendingRemoteSignupUserIdRef.current !== expectedUserId
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
          pendingRemoteSignupUserIdRef.current = null;
          setPendingRemoteSignupUserIdState(null);
        }
      }),
    [enqueueSessionMutation],
  );

  useEffect(
    () =>
      subscribeToTokenInvalidation(() => {
        const userId = currentUserIdRef.current ?? pendingRemoteSignupUserIdRef.current;
        if (!userId || !isUuid(userId)) return;

        pendingSessionClearUserIdRef.current = userId;
        currentUserIdRef.current = null;
        pendingRemoteSignupUserIdRef.current = null;
        setCurrentUserIdState(null);
        setPendingRemoteSignupUserIdState(null);
        setIsReady(true);
        void enqueueSessionMutation(() => clearPersistedSession(userId))
          .then(() => {
            pendingSessionClearUserIdRef.current = null;
            setSessionLoadError(false);
          })
          .catch(() => setSessionLoadError(true));
      }),
    [enqueueSessionMutation],
  );

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      activateLocalCredential,
      activatePreparedRemoteSignup,
      activateRemoteSession,
      activateSignupUser,
      clearSession,
      currentUserId,
      deleteLocalCredential,
      hasLocalCredential,
      isReady,
      pendingRemoteSignupUserId,
      prepareRemoteSignup,
      registerLocalCredential,
      retrySessionLoad,
      sessionLoadError,
      setCurrentUserId,
      signInWithPassword,
      verifyCurrentUserPassword,
    }),
    [
      activateLocalCredential,
      activatePreparedRemoteSignup,
      activateRemoteSession,
      activateSignupUser,
      clearSession,
      currentUserId,
      deleteLocalCredential,
      hasLocalCredential,
      isReady,
      pendingRemoteSignupUserId,
      prepareRemoteSignup,
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
