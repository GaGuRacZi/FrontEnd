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
import { getPushToken, hasPushPermission } from '@/src/services/pushNotifications';

import {
  getLocalCalendarDate,
  getNextBillingDate,
  getPlan,
  getPlanRank,
  getUpgradePaymentAmount,
  PLAN_DEFINITIONS,
} from './mypageData';
import {
  disablePushNotifications,
  mergeRemoteMyPageProfile,
  mergeRemoteUserProfile,
} from './mypageMappers';
import {
  deleteRemoteProfileImage,
  getRemoteMyPageHome,
  getRemoteMyPageProfile,
  getRemoteNotificationSettings,
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
  PaymentStatus,
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
  hasLoadError: boolean;
  hasStoredUserProfileData: (userId: string) => Promise<StoredProfileStatus>;
  isReady: boolean;
  notificationSettings: NotificationSettings | null;
  paymentHistory: PaymentHistoryItem[];
  profile: UserProfile | null;
  registerRemoteProfile: (
    profile: RemoteUserProfile,
    method?: 'kakao' | 'local',
  ) => Promise<void>;
  reloadMyPage: () => void;
  scheduleCancelSubscription: () => Promise<MutationResult>;
  subscription: SubscriptionState | null;
  switchPlan: (planId: PlanId, paymentStatus?: PaymentStatus) => Promise<MutationResult>;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<MutationResult>;
  updateProfile: (profile: UserProfile) => Promise<MutationResult>;
};

const MyPageStoreContext = createContext<MyPageStoreContextValue | null>(null);

const EMPTY_PAYMENT_HISTORY: PaymentHistoryItem[] = [];

function createPaymentHistoryItem(
  currentPlanId: PlanId,
  nextPlanId: PlanId,
  status: PaymentStatus,
): PaymentHistoryItem {
  const paidPlan = getPlan(nextPlanId);
  const amount = getUpgradePaymentAmount(currentPlanId, nextPlanId);
  const date = getLocalCalendarDate();
  const isDifferencePayment = currentPlanId !== 'baby-jelly';

  return {
    amount,
    date,
    id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status,
    title: isDifferencePayment ? `${paidPlan.name} 차액 결제` : `${paidPlan.name} 결제`,
  };
}

function getRemotePlanId(plan: string, displayName: string): PlanId | null {
  if (plan === 'BASIC') return 'little-jelly';
  return PLAN_DEFINITIONS.find(({ name }) => name === displayName)?.id ?? null;
}

export function MyPageProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredMyPageState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
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
    await mypageRepository.saveState(userId, nextState);
    if (afterSave) await afterSave();

    if (activeUserRef.current === userId && readyUserRef.current === userId) {
      stateRef.current = nextState;
      setState(nextState);
    }
  }, []);

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

    if (!currentUserId) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    const pushPermission = hasPushPermission();
    void pushPermission
      .then(async (hasPermission) => {
        if (!hasPermission) {
          await registerRemotePushToken(null);
          return;
        }

        const pushToken = await getPushToken();
        if (pushToken) await registerRemotePushToken(pushToken);
      })
      .catch(() => undefined);

    Promise.all([
      mypageRepository.loadState(currentUserId),
      getRemoteMyPageHome().catch(() => null),
      getRemoteMyPageProfile(),
      getRemoteNotificationSettings().catch(() => null),
      pushPermission,
    ])
      .then(async ([loadedState, remoteHome, remoteProfile, remoteNotificationSettings, hasNotificationPermission]) => {
        if (!active || activeUserRef.current !== currentUserId) return;
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
          profile: mergeRemoteMyPageProfile(loadedState.profile, remoteProfile),
          subscription: {
            ...loadedState.subscription,
            currentPlanId:
              remoteHome === null
                ? loadedState.subscription.currentPlanId
                : remoteHome.subscription.active
                  ? getRemotePlanId(
                      remoteHome.subscription.plan,
                      remoteHome.subscription.displayName,
                    ) ?? loadedState.subscription.currentPlanId
                  : 'baby-jelly',
          },
        };
        readyUserRef.current = currentUserId;
        await mypageRepository.saveState(currentUserId, initialState);
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

  const reloadMyPage = useCallback(() => {
    setLoadRequest((current) => current + 1);
  }, []);

  const mutateState = useCallback(
    (updater: (current: StoredMyPageState) => Promise<StoredMyPageState> | StoredMyPageState) => {
      const userId = currentUserId;

      return enqueueMutation(async (): Promise<MutationResult> => {
        if (!userId || readyUserRef.current !== userId || !stateRef.current) {
          return { ok: false, reason: 'not-ready' };
        }

        try {
          const nextState = await updater(stateRef.current);
          await persist(userId, nextState);
          return { ok: true };
        } catch {
          return {
            ok: false,
            reason: 'error',
          };
        }
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const hasStoredUserProfileData = useCallback(
    (userId: string) =>
      enqueueMutation(() => mypageRepository.getStoredStateStatus(userId)),
    [enqueueMutation],
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
    (planId: PlanId, paymentStatus: PaymentStatus = 'paid') =>
      mutateState((current) => {
        const currentRank = getPlanRank(current.subscription.currentPlanId);
        const nextRank = getPlanRank(planId);
        if (nextRank === currentRank) return current;

        const isUpgrade = nextRank > currentRank;
        const paymentHistoryItem = isUpgrade
          ? createPaymentHistoryItem(
              current.subscription.currentPlanId,
              planId,
              paymentStatus,
            )
          : null;
        if (paymentHistoryItem && paymentStatus !== 'paid') {
          return {
            ...current,
            paymentHistory: [paymentHistoryItem, ...current.paymentHistory],
          };
        }
        const nextBillingDate = current.subscription.nextBillingDate ?? getNextBillingDate();
        const nextSubscription: SubscriptionState = isUpgrade
          ? {
              currentPlanId: planId,
              nextBillingDate,
              pendingPlanId: null,
              pendingType: null,
            }
          : {
              ...current.subscription,
              nextBillingDate,
              pendingPlanId: planId,
              pendingType: planId === 'baby-jelly' ? 'cancel' : 'downgrade',
            };

        return {
          ...current,
          paymentHistory:
            paymentHistoryItem
              ? [paymentHistoryItem, ...current.paymentHistory]
              : current.paymentHistory,
          subscription: nextSubscription,
        };
      }),
    [mutateState],
  );

  const scheduleCancelSubscription = useCallback(
    () =>
      mutateState((current) => ({
        ...current,
        subscription: {
          ...current.subscription,
          nextBillingDate: current.subscription.nextBillingDate ?? getNextBillingDate(),
          pendingPlanId: 'baby-jelly',
          pendingType: 'cancel',
        },
      })),
    [mutateState],
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
      hasLoadError,
      hasStoredUserProfileData,
      isReady: storeReady,
      notificationSettings: visibleState?.notificationSettings ?? null,
      paymentHistory: visibleState?.paymentHistory ?? EMPTY_PAYMENT_HISTORY,
      profile: visibleState?.profile ?? null,
      registerRemoteProfile,
      reloadMyPage,
      scheduleCancelSubscription,
      subscription: visibleState?.subscription ?? null,
      switchPlan,
      updateNotificationSettings,
      updateProfile,
    }),
    [
      clearScreenSession,
      deleteUserProfileData,
      hasLoadError,
      hasStoredUserProfileData,
      registerRemoteProfile,
      reloadMyPage,
      scheduleCancelSubscription,
      storeReady,
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
