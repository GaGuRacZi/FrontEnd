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

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import type { RemoteUserProfile } from '@/src/features/auth/services/kakaoAuthContract';
import {
  getPushToken,
  hasPushPermission,
  listenForPushTokenRefresh,
} from '@/src/services/pushNotifications';
import { retryOperation } from '@/src/utils/retry';

import {
  disablePushNotifications,
  mergeRemoteMyPageProfile,
  mergeRemoteUserProfile,
} from './mypageMappers';
import {
  changeRemoteSubscription,
  deleteRemoteProfileImage,
  getRemoteMyPageHome,
  getRemotePayment,
  getRemotePaymentHistory,
  getRemoteMyPageProfile,
  getRemoteNotificationSettings,
  getRemoteSubscription,
  registerRemotePushToken,
  updateRemoteMyPageRegion,
  updateRemoteNotificationSettings,
} from './services/mypageApi';
import { updateRemoteUserProfile } from './services/profileApi';
import { mypageRepository } from './services/mypageRepository';
import {
  flushQueuedProfileImageRemovals,
  queueProfileImageRemoval,
  removeUserProfileImages,
} from './services/profileImageStorage';
import type {
  NotificationSettings,
  PaymentHistoryItem,
  PlanId,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from './types';

type MutationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'error' | 'invalid' | 'not-ready' | 'not-supported';
    };

export type StoredProfileStatus = 'missing' | 'recoverable' | 'valid';

type MyPageStoreContextValue = {
  clearScreenSession: () => void;
  deleteUserProfileData: (userId?: string) => Promise<void>;
  getPaymentHistoryItem: (paymentId: string) => Promise<PaymentHistoryItem>;
  hasLoadError: boolean;
  hasStoredUserProfileData: (userId: string) => Promise<StoredProfileStatus>;
  isReady: boolean;
  notificationSettings: NotificationSettings | null;
  notificationSettingsLoadError: boolean;
  paymentHistory: PaymentHistoryItem[];
  paymentHistoryLoadError: boolean;
  profile: UserProfile | null;
  registerRemoteProfile: (
    profile: RemoteUserProfile,
    method?: 'kakao' | 'local',
  ) => Promise<void>;
  reloadMyPage: () => void;
  scheduleCancelSubscription: () => Promise<MutationResult>;
  subscription: SubscriptionState | null;
  subscriptionLoadError: boolean;
  switchPlan: (planId: PlanId) => Promise<MutationResult>;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<MutationResult>;
  updateProfile: (profile: UserProfile) => Promise<MutationResult>;
};

const MyPageStoreContext = createContext<MyPageStoreContextValue | null>(null);

const EMPTY_PAYMENT_HISTORY: PaymentHistoryItem[] = [];

export function MyPageProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredMyPageState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [notificationSettingsLoadError, setNotificationSettingsLoadError] = useState(false);
  const [paymentHistoryLoadError, setPaymentHistoryLoadError] = useState(false);
  const [subscriptionLoadError, setSubscriptionLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const activeUserRef = useRef<string | null>(null);
  const readyUserRef = useRef<string | null>(null);
  const stateRef = useRef<StoredMyPageState | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const applyState = useCallback((nextState: StoredMyPageState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const persist = useCallback(async (
    userId: string,
    nextState: StoredMyPageState,
    afterSave?: () => Promise<void>,
  ) => {
    if (activeUserRef.current === userId && readyUserRef.current === userId) {
      applyState(nextState);
    }
    await mypageRepository.saveState(userId, nextState).catch(() => undefined);
    if (afterSave) await afterSave().catch(() => undefined);
  }, [applyState]);

  const enqueueMutation = useCallback(<T,>(mutation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(mutation, mutation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    activeUserRef.current = currentUserId;
    readyUserRef.current = null;
    stateRef.current = null;
    setState(null);
    setIsReady(false);
    setHasLoadError(false);
    setNotificationSettingsLoadError(false);
    setPaymentHistoryLoadError(false);
    setSubscriptionLoadError(false);

    if (!currentUserId) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    const pushPermission = hasPushPermission();
    void pushPermission
      .then(async (hasPermission) => {
        if (!active || activeUserRef.current !== currentUserId) return;
        if (!hasPermission) {
          await retryOperation(async () => {
            if (!active || activeUserRef.current !== currentUserId) return;
            await registerRemotePushToken(null);
          });
          return;
        }

        const pushToken = await getPushToken();
        if (active && activeUserRef.current === currentUserId && pushToken) {
          await retryOperation(async () => {
            if (!active || activeUserRef.current !== currentUserId) return;
            await registerRemotePushToken(pushToken);
          });
        }
      })
      .catch(() => undefined);

    Promise.all([
      mypageRepository.loadState(currentUserId),
      getRemoteMyPageProfile(),
      pushPermission,
      Promise.allSettled([
        getRemoteMyPageHome(),
        getRemoteNotificationSettings(),
        getRemoteSubscription(),
        getRemotePaymentHistory(),
      ]),
    ])
      .then(async ([loadedState, remoteProfile, hasNotificationPermission, optionalResults]) => {
        if (!active || activeUserRef.current !== currentUserId) return;
        const [remoteHomeResult, notificationResult, subscriptionResult, paymentHistoryResult] = optionalResults;
        const remoteHome = remoteHomeResult.status === 'fulfilled' ? remoteHomeResult.value : null;
        const remoteNotificationSettings = notificationResult.status === 'fulfilled'
          ? notificationResult.value
          : null;
        const remoteSubscription = subscriptionResult.status === 'fulfilled'
          ? subscriptionResult.value
          : null;
        const remotePaymentHistory = paymentHistoryResult.status === 'fulfilled'
          ? paymentHistoryResult.value
          : null;
        setNotificationSettingsLoadError(notificationResult.status === 'rejected');
        setPaymentHistoryLoadError(paymentHistoryResult.status === 'rejected');
        setSubscriptionLoadError(subscriptionResult.status === 'rejected');
        const resolvedNotificationSettings =
          remoteNotificationSettings ?? loadedState.notificationSettings;
        const notificationSettings = hasNotificationPermission
          ? resolvedNotificationSettings
          : disablePushNotifications(resolvedNotificationSettings);
        if (!hasNotificationPermission) {
          await updateRemoteNotificationSettings(notificationSettings).catch(() => undefined);
        }
        if (!active || activeUserRef.current !== currentUserId) return;

        const initialState = {
          ...loadedState,
          notificationSettings,
          paymentHistory: remotePaymentHistory ?? loadedState.paymentHistory,
          profile: mergeRemoteMyPageProfile(loadedState.profile, remoteProfile),
          subscription: remoteSubscription ?? (
            remoteHome?.subscription.active === false
              ? {
                  currentPlanId: 'baby-jelly' as const,
                  nextBillingDate: null,
                  pendingPlanId: null,
                  pendingType: null,
                }
              : loadedState.subscription
          ),
        };
        readyUserRef.current = currentUserId;
        await mypageRepository.saveState(currentUserId, initialState).catch(() => undefined);
        if (!active || activeUserRef.current !== currentUserId) return;
        applyState(initialState);
      })
      .catch(() => {
        if (!active || activeUserRef.current !== currentUserId) return;
        setHasLoadError(true);
      })
      .finally(() => {
        if (active && activeUserRef.current === currentUserId) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyState, currentUserId, loadRequest, sessionReady]);

  useEffect(() => {
    if (!sessionReady || !currentUserId) return;
    const userId = currentUserId;
    return listenForPushTokenRefresh((pushToken) => {
      if (activeUserRef.current !== userId) return;
      void retryOperation(async () => {
        if (activeUserRef.current !== userId) return;
        await registerRemotePushToken(pushToken);
      }).catch(() => undefined);
    });
  }, [currentUserId, sessionReady]);

  const reloadMyPage = useCallback(() => {
    setLoadRequest((current) => current + 1);
  }, []);

  const hasStoredUserProfileData = useCallback(
    (userId: string) =>
      enqueueMutation(() => mypageRepository.getStoredStateStatus(userId)),
    [enqueueMutation],
  );

  const getPaymentHistoryItem = useCallback(
    (paymentId: string) => getRemotePayment(paymentId),
    [],
  );

  const registerRemoteProfile = useCallback(
    (remoteProfile: RemoteUserProfile, method: 'kakao' | 'local' = 'kakao') =>
      enqueueMutation(async () => {
        const previous = await mypageRepository.loadState(remoteProfile.uid);

        const nextState = {
          ...previous,
          profile: mergeRemoteUserProfile(previous.profile, remoteProfile, method),
        };

        await persist(remoteProfile.uid, nextState);
      }),
    [enqueueMutation, persist],
  );

  const updateProfile = useCallback(
    (profile: UserProfile) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;

        if (!userId || readyUserRef.current !== userId || !stateRef.current) {
          return { ok: false, reason: 'not-ready' };
        }

        const current = stateRef.current;
        const previousUri = current.profile.profileImageUri;
        const nextProfile = {
          ...profile,
          nickname: profile.nickname.trim(),
          introduction: profile.introduction.trim(),
          location: profile.location.trim(),
          name: profile.name.trim(),
          updatedAt: new Date().toISOString(),
        };
        try {
          if (
            nextProfile.regionCode &&
            nextProfile.regionCode !== current.profile.regionCode
          ) {
            await updateRemoteMyPageRegion(nextProfile.regionCode);
          }
          const remoteProfile = await updateRemoteUserProfile({
            imageUri:
              previousUri !== nextProfile.profileImageUri
                ? nextProfile.profileImageUri
                : undefined,
            intro: nextProfile.introduction,
            name: nextProfile.name,
            nickname: nextProfile.nickname,
          });
          if (previousUri && !nextProfile.profileImageUri) {
            await deleteRemoteProfileImage();
          }
          const mergedProfile = mergeRemoteUserProfile(nextProfile, remoteProfile);
          const remoteNextState = {
            ...current,
            profile: {
              ...mergedProfile,
              profileImageUri:
                nextProfile.profileImageUri === null ? null : mergedProfile.profileImageUri,
              regionCode: nextProfile.regionCode,
            },
          };
          await persist(
            userId,
            remoteNextState,
            async () => {
              await Promise.all([
                queueProfileImageRemoval(userId, previousUri),
                queueProfileImageRemoval(userId, nextProfile.profileImageUri),
              ]).catch(() => undefined);
              await flushQueuedProfileImageRemovals(userId, [
                remoteNextState.profile.profileImageUri,
              ]).catch(() => undefined);
            },
          );

          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const updateNotificationSettings = useCallback(
    (settings: Partial<NotificationSettings>) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;
        const current = stateRef.current;
        if (!userId || readyUserRef.current !== userId || !current) {
          return { ok: false, reason: 'not-ready' };
        }

        try {
          const notificationSettings = await updateRemoteNotificationSettings(settings);
          await persist(userId, { ...current, notificationSettings });
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const switchPlan = useCallback(
    (planId: PlanId) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;
        const current = stateRef.current;
        if (!userId || readyUserRef.current !== userId || !current) {
          return { ok: false, reason: 'not-ready' };
        }

        try {
          const subscription = await changeRemoteSubscription(planId);
          const paymentHistory = await getRemotePaymentHistory().catch(
            () => current.paymentHistory,
          );
          await persist(userId, { ...current, paymentHistory, subscription });
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const scheduleCancelSubscription = useCallback(
    () => switchPlan('baby-jelly'),
    [switchPlan],
  );

  const deleteUserProfileData = useCallback(
    (userId = currentUserId ?? undefined) =>
      enqueueMutation(async () => {
        if (!userId) return;

        await mypageRepository.deleteUser(userId);
        await removeUserProfileImages(userId);
      }),
    [currentUserId, enqueueMutation],
  );

  const clearScreenSession = useCallback(() => undefined, []);

  const stateMatchesSession = Boolean(
    currentUserId && readyUserRef.current === currentUserId,
  );
  const visibleState = stateMatchesSession ? state : null;
  const storeReady = sessionReady && (!currentUserId || isReady);

  const value = useMemo<MyPageStoreContextValue>(
    () => ({
      clearScreenSession,
      deleteUserProfileData,
      getPaymentHistoryItem,
      hasLoadError,
      hasStoredUserProfileData,
      isReady: storeReady,
      notificationSettings: visibleState?.notificationSettings ?? null,
      notificationSettingsLoadError,
      paymentHistory: visibleState?.paymentHistory ?? EMPTY_PAYMENT_HISTORY,
      paymentHistoryLoadError,
      profile: visibleState?.profile ?? null,
      registerRemoteProfile,
      reloadMyPage,
      scheduleCancelSubscription,
      subscription: visibleState?.subscription ?? null,
      subscriptionLoadError,
      switchPlan,
      updateNotificationSettings,
      updateProfile,
    }),
    [
      clearScreenSession,
      deleteUserProfileData,
      getPaymentHistoryItem,
      hasLoadError,
      hasStoredUserProfileData,
      notificationSettingsLoadError,
      paymentHistoryLoadError,
      registerRemoteProfile,
      reloadMyPage,
      scheduleCancelSubscription,
      storeReady,
      subscriptionLoadError,
      switchPlan,
      updateNotificationSettings,
      updateProfile,
      visibleState,
    ],
  );

  return <MyPageStoreContext.Provider value={value}>{children}</MyPageStoreContext.Provider>;
}

export function useMyPageStore() {
  const context = useContext(MyPageStoreContext);

  if (!context) {
    throw new Error('useMyPageStore must be used inside MyPageProvider.');
  }

  return context;
}
