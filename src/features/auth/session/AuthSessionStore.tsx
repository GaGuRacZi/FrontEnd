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
import {
  attachActiveSignupDraftRemoteUserId,
  clearActiveSignupDraft,
} from '../signup/services/signupDraftStore';
import { clearActiveSignupTransaction } from '../signup/services/signupTransactionStore';
import { isUuid } from '../services/kakaoAuthContract';
import {
  KakaoAuthError,
  loadRemoteUserProfile,
  loadRemoteUserIdentity,
} from '../services/kakaoAuthService';
import {
  LocalAuthError,
  signInWithLocalCredentials,
} from '../services/localAuthService';
import type { KakaoLoginOutcome } from '../services/kakaoAuthContract';

const SESSION_STORAGE_KEY = 'paw:auth-session';
const SESSION_CLEAR_STORAGE_KEY = 'paw:auth-session-clear';
const PENDING_REMOTE_SIGNUP_STORAGE_KEY = 'paw:auth-pending-remote-signup';

export type AuthMethod = 'kakao' | 'local';
export type RemoteAuthSession = AuthTokens & { uid: string };
type PasswordVerification = 'invalid' | 'missing' | 'verified';
type PendingRemoteSignup = { method: AuthMethod; uid: string };

type AuthSessionContextValue = {
  activatePreparedRemoteSignup: (userId: string) => Promise<void>;
  activateRemoteSession: (session: RemoteAuthSession) => Promise<void>;
  clearSession: (expectedUserId: string) => Promise<void>;
  currentUserId: string | null;
  isReady: boolean;
  pendingRemoteSignupUserId: string | null;
  pendingRemoteSignupMethod: AuthMethod | null;
  prepareRemoteSignup: (
    session: RemoteAuthSession,
    method: AuthMethod,
    signupSessionId?: string,
  ) => Promise<void>;
  retrySessionLoad: () => void;
  sessionLoadError: boolean;
  signInWithPassword: (email: string, password: string) => Promise<KakaoLoginOutcome>;
  verifyCurrentUserPassword: (password: string) => Promise<PasswordVerification>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function parseSessionUserId(value: string | null) {
  if (!value || value !== value.trim()) return null;
  return isUuid(value) ? value : null;
}

function parsePendingRemoteSignup(value: string | null): PendingRemoteSignup | null {
  if (!value) return null;

  if (isUuid(value)) {
    return { method: 'kakao', uid: value };
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      !('method' in parsed) ||
      !('uid' in parsed) ||
      (parsed.method !== 'kakao' && parsed.method !== 'local') ||
      typeof parsed.uid !== 'string' ||
      !isUuid(parsed.uid)
    ) {
      return null;
    }

    return { method: parsed.method, uid: parsed.uid };
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
  const [pendingRemoteSignupMethod, setPendingRemoteSignupMethodState] = useState<
    AuthMethod | null
  >(null);
  const [isReady, setIsReady] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const [sessionLoadError, setSessionLoadError] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const pendingRemoteSignupUserIdRef = useRef<string | null>(null);
  const pendingRemoteSignupMethodRef = useRef<AuthMethod | null>(null);
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
            pendingRemoteSignupMethodRef.current = null;
            setPendingRemoteSignupMethodState(null);
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
      const restoredPendingRemoteSignup = parsePendingRemoteSignup(
        storedPendingRemoteSignupUserId,
      );

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
          : !restoredUserId && restoredPendingRemoteSignup
            ? restoredPendingRemoteSignup.uid
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
        !restoredPendingRemoteSignup
      ) {
        await AsyncStorage.removeItem(PENDING_REMOTE_SIGNUP_STORAGE_KEY);
      }

      if (mounted) {
        currentUserIdRef.current = restoredUserId;
        setCurrentUserIdState(restoredUserId);
        const pendingRemoteUserId = restoredUserId
          ? null
          : restoredPendingRemoteSignup?.uid ?? null;
        pendingRemoteSignupUserIdRef.current = pendingRemoteUserId;
        setPendingRemoteSignupUserIdState(pendingRemoteUserId);
        const pendingMethod = restoredUserId
          ? null
          : restoredPendingRemoteSignup?.method ?? null;
        pendingRemoteSignupMethodRef.current = pendingMethod;
        setPendingRemoteSignupMethodState(pendingMethod);
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

  const prepareRemoteSignup = useCallback(
    (session: RemoteAuthSession, method: AuthMethod, signupSessionId?: string) =>
      enqueueSessionMutation(async () => {
        const remoteSession = parseRemoteSession(session);
        if (currentUserIdRef.current) throw new Error('auth-session-already-active');
        if (method !== 'kakao' && method !== 'local') {
          throw new Error('invalid-auth-method');
        }
        const preservesPendingSignup =
          pendingRemoteSignupUserIdRef.current === remoteSession.uid &&
          pendingRemoteSignupMethodRef.current === method;
        const shouldRetainLocalDraft =
          method === 'local' &&
          !pendingRemoteSignupUserIdRef.current &&
          typeof signupSessionId === 'string' &&
          Boolean(signupSessionId.trim()) &&
          (await attachActiveSignupDraftRemoteUserId(signupSessionId, remoteSession.uid));

        if (!preservesPendingSignup && !shouldRetainLocalDraft) {
          await Promise.allSettled([
            clearActiveSignupDraft(),
            clearActiveSignupTransaction(),
          ]);
        }
        await AsyncStorage.multiRemove(
          preservesPendingSignup
            ? [SESSION_STORAGE_KEY, SESSION_CLEAR_STORAGE_KEY]
            : [
                SESSION_STORAGE_KEY,
                SESSION_CLEAR_STORAGE_KEY,
                PENDING_REMOTE_SIGNUP_STORAGE_KEY,
              ],
        );
        if (!preservesPendingSignup) {
          pendingRemoteSignupUserIdRef.current = null;
          setPendingRemoteSignupUserIdState(null);
          pendingRemoteSignupMethodRef.current = null;
          setPendingRemoteSignupMethodState(null);
        }

        try {
          await saveTokens(remoteSession);
          await AsyncStorage.setItem(
            PENDING_REMOTE_SIGNUP_STORAGE_KEY,
            JSON.stringify({ method, uid: remoteSession.uid }),
          );
        } catch (error) {
          return rollbackRemoteSession(error);
        }

        pendingRemoteSignupUserIdRef.current = remoteSession.uid;
        setPendingRemoteSignupUserIdState(remoteSession.uid);
        pendingRemoteSignupMethodRef.current = method;
        setPendingRemoteSignupMethodState(method);
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
        pendingRemoteSignupMethodRef.current = null;
        setPendingRemoteSignupMethodState(null);

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
        pendingRemoteSignupMethodRef.current = null;
        setPendingRemoteSignupMethodState(null);
        pendingSessionClearUserIdRef.current = null;
        currentUserIdRef.current = normalizedUserId;
        setCurrentUserIdState(normalizedUserId);
        setSessionLoadError(false);
        setIsReady(true);
      }),
    [enqueueSessionMutation],
  );

  const signInWithPassword = useCallback(
    (email: string, password: string) => signInWithLocalCredentials(email, password),
    [],
  );

  const verifyCurrentUserPassword = useCallback(
    (password: string) =>
      enqueueSessionMutation(async () => {
        const userId = currentUserIdRef.current;
        if (!userId || !isUuid(userId)) return 'missing' as const;

        try {
          const profile = await loadRemoteUserProfile();
          const outcome = await signInWithLocalCredentials(profile.email, password);

          if (
            outcome.kind !== 'authenticated' ||
            outcome.session.uid !== userId ||
            outcome.session.isNew ||
            currentUserIdRef.current !== userId
          ) {
            return 'invalid' as const;
          }

          await saveTokens(outcome.session);
          return 'verified' as const;
        } catch (error) {
          if (error instanceof LocalAuthError && error.kind === 'invalid-credentials') {
            return 'invalid' as const;
          }

          throw error;
        }
      }),
    [enqueueSessionMutation],
  );

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
          pendingRemoteSignupMethodRef.current = null;
          setPendingRemoteSignupMethodState(null);
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
        pendingRemoteSignupMethodRef.current = null;
        setCurrentUserIdState(null);
        setPendingRemoteSignupUserIdState(null);
        setPendingRemoteSignupMethodState(null);
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
      activatePreparedRemoteSignup,
      activateRemoteSession,
      clearSession,
      currentUserId,
      isReady,
      pendingRemoteSignupUserId,
      pendingRemoteSignupMethod,
      prepareRemoteSignup,
      retrySessionLoad,
      sessionLoadError,
      signInWithPassword,
      verifyCurrentUserPassword,
    }),
    [
      activatePreparedRemoteSignup,
      activateRemoteSession,
      clearSession,
      currentUserId,
      isReady,
      pendingRemoteSignupUserId,
      pendingRemoteSignupMethod,
      prepareRemoteSignup,
      retrySessionLoad,
      sessionLoadError,
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
