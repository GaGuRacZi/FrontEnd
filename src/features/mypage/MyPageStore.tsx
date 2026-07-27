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

import { getPlan, getPlanRank, getUpgradePaymentAmount } from './mypageData';
import { createDefaultMyPageState, signupDataToProfile } from './mypageMappers';
import { mypageRepository } from './services/mypageRepository';
import {
  persistProfileImage,
  removeProfileImage,
  removeUserProfileImages,
} from './services/profileImageStorage';
import type {
  NotificationSettings,
  PaymentHistoryItem,
  PaymentMethod,
  PlanId,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from './types';

type MutationResult =
  | { ok: true }
  | { ok: false; reason: 'error' | 'invalid' | 'not-ready' };

type MyPageStoreContextValue = {
  clearScreenSession: () => void;
  deleteUserProfileData: (userId?: string) => Promise<void>;
  hasLoadError: boolean;
  isReady: boolean;
  notificationSettings: NotificationSettings | null;
  paymentHistory: PaymentHistoryItem[];
  paymentMethods: PaymentMethod[];
  profile: UserProfile | null;
  registerSignupProfile: (
    data: Parameters<typeof signupDataToProfile>[0],
    userId: string,
  ) => Promise<void>;
  scheduleCancelSubscription: () => Promise<MutationResult>;
  subscription: SubscriptionState | null;
  switchPlan: (planId: PlanId) => Promise<MutationResult>;
  updateNotificationSettings: (settings: NotificationSettings) => Promise<MutationResult>;
  updatePaymentMethods: (methods: PaymentMethod[]) => Promise<MutationResult>;
  updateProfile: (profile: UserProfile) => Promise<MutationResult>;
};

const MyPageStoreContext = createContext<MyPageStoreContextValue | null>(null);

const EMPTY_PAYMENT_METHODS: PaymentMethod[] = [];
const EMPTY_PAYMENT_HISTORY: PaymentHistoryItem[] = [];

function createPaymentHistoryItem(currentPlanId: PlanId, nextPlanId: PlanId): PaymentHistoryItem {
  const paidPlan = getPlan(nextPlanId);
  const amount = getUpgradePaymentAmount(currentPlanId, nextPlanId);
  const date = new Date().toISOString().slice(0, 10);
  const isDifferencePayment = currentPlanId !== 'baby-jelly';

  return {
    amount,
    date,
    id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    methodLabel: '간편페이',
    status: 'paid',
    title: isDifferencePayment ? `${paidPlan.name} 차액 결제` : `${paidPlan.name} 결제`,
  };
}

function getNextBillingDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function MyPageProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredMyPageState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const activeUserRef = useRef<string | null>(null);
  const readyUserRef = useRef<string | null>(null);
  const stateRef = useRef<StoredMyPageState | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const applyState = useCallback((nextState: StoredMyPageState) => {
    stateRef.current = nextState;
    setState(nextState);
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

    mypageRepository
      .loadState(currentUserId)
      .then((loadedState) => {
        if (!active || activeUserRef.current !== currentUserId) return;
        readyUserRef.current = currentUserId;
        applyState(loadedState);
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
  }, [applyState, currentUserId, sessionReady]);

  const persist = useCallback(async (userId: string, nextState: StoredMyPageState) => {
    await mypageRepository.saveState(userId, nextState);

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
          return { ok: false, reason: 'error' };
        }
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const registerSignupProfile = useCallback(
    (data: Parameters<typeof signupDataToProfile>[0], userId: string) =>
      enqueueMutation(async () => {
        const previous = await mypageRepository.loadState(userId).catch(() =>
          createDefaultMyPageState(userId),
        );
        const profile = signupDataToProfile(data, userId);
        const profileImageUri = profile.profileImageUri
          ? await persistProfileImage(userId, profile.profileImageUri).catch(
              () => null,
            )
          : null;
        const nextState = { ...previous, profile };
        nextState.profile = { ...profile, profileImageUri };
        await mypageRepository.saveState(userId, nextState);

        if (
          previous.profile.profileImageUri &&
          previous.profile.profileImageUri !== profileImageUri
        ) {
          await removeProfileImage(userId, previous.profile.profileImageUri).catch(
            () => undefined,
          );
        }

        if (activeUserRef.current === userId) {
          readyUserRef.current = userId;
          applyState(nextState);
          setHasLoadError(false);
          setIsReady(true);
        }
      }),
    [applyState, enqueueMutation],
  );

  const updateProfile = useCallback(
    (profile: UserProfile) =>
      mutateState(async (current) => {
        const previousUri = current.profile.profileImageUri;
        const nextProfile = {
          ...profile,
          nickname: profile.nickname.trim(),
          introduction: profile.introduction.trim(),
          location: profile.location.trim(),
          name: profile.name.trim(),
          updatedAt: new Date().toISOString(),
        };

        if (previousUri && previousUri !== nextProfile.profileImageUri) {
          await removeProfileImage(current.profile.id, previousUri).catch(() => undefined);
        }

        return { ...current, profile: nextProfile };
      }),
    [mutateState],
  );

  const updateNotificationSettings = useCallback(
    (settings: NotificationSettings) =>
      mutateState((current) => ({ ...current, notificationSettings: settings })),
    [mutateState],
  );

  const updatePaymentMethods = useCallback(
    (methods: PaymentMethod[]) =>
      mutateState((current) => ({ ...current, paymentMethods: methods })),
    [mutateState],
  );

  const switchPlan = useCallback(
    (planId: PlanId) =>
      mutateState((current) => {
        const currentRank = getPlanRank(current.subscription.currentPlanId);
        const nextRank = getPlanRank(planId);
        if (nextRank === currentRank) return current;

        const isUpgrade = nextRank > currentRank;
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
            isUpgrade && planId !== 'baby-jelly'
              ? [
                  createPaymentHistoryItem(current.subscription.currentPlanId, planId),
                  ...current.paymentHistory,
                ]
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

        if (activeUserRef.current === userId) {
          readyUserRef.current = null;
          stateRef.current = null;
          setState(null);
          setIsReady(false);
        }

        await mypageRepository.deleteUser(userId);
        await removeUserProfileImages(userId).catch(() => undefined);
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
      isReady: storeReady,
      notificationSettings: visibleState?.notificationSettings ?? null,
      paymentHistory: visibleState?.paymentHistory ?? EMPTY_PAYMENT_HISTORY,
      paymentMethods: visibleState?.paymentMethods ?? EMPTY_PAYMENT_METHODS,
      profile: visibleState?.profile ?? null,
      registerSignupProfile,
      scheduleCancelSubscription,
      subscription: visibleState?.subscription ?? null,
      switchPlan,
      updateNotificationSettings,
      updatePaymentMethods,
      updateProfile,
    }),
    [
      clearScreenSession,
      deleteUserProfileData,
      hasLoadError,
      registerSignupProfile,
      scheduleCancelSubscription,
      storeReady,
      switchPlan,
      updateNotificationSettings,
      updatePaymentMethods,
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
