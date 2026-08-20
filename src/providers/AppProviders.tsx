import { usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';
import { AppAlertProvider } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { SIGNUP_COMPLETION_PATHS } from '@/src/features/auth/session/AuthSessionGuard';
import {
  AuthSessionProvider,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { TermsProvider } from '@/src/features/auth/terms';
import { ChatDataBridge } from '@/src/features/chat/ChatDataBridge';
import { ChatProvider, useChatStore } from '@/src/features/chat/ChatStore';
import { CommunityProvider, useCommunityStore } from '@/src/features/community/CommunityStore';
import { MyPageProvider } from '@/src/features/mypage/MyPageStore';
import { SupportProvider } from '@/src/features/mypage/support';
import { HealthSummaryProvider } from '@/src/features/health-summary/HealthSummaryStore';
import { MedicationProvider, useMedicationStore } from '@/src/features/home/MedicationStore';
import { ScheduleTodoProvider, useScheduleTodoStore } from '@/src/features/home/ScheduleTodoStore';
import { PetProvider } from '@/src/features/pet/PetStore';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import {
  configurePushNotifications,
  getChatRoomIdFromPush,
  getPushTargetFromPush,
  listenForForegroundPushes,
  listenForNotificationOpens,
  subscribeForegroundPush,
  type PushTarget,
} from '@/src/services/pushNotifications';

function getPushHref(target: Exclude<PushTarget, null>): Href | null {
  if (target.type === 'todo') {
    return { pathname: '/schedule', params: { todoId: target.id } };
  }
  if (target.type === 'visit') {
    return { pathname: '/dashboard/[diagnosisId]', params: { diagnosisId: target.id } };
  }
  if (target.type === 'post') {
    return { pathname: '/community/[postId]', params: { postId: target.id } };
  }
  if (target.type === 'map') return '/health-summary';
  return null;
}

function ForegroundPushBridge() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const { isReady: chatReady, refreshChatRoom, refreshChatRooms } = useChatStore();
  const { reloadCommunity } = useCommunityStore();
  const { reloadMedications } = useMedicationStore();
  const { reloadSchedule } = useScheduleTodoStore();
  const [noticeRoomId, setNoticeRoomId] = useState<string | null>(null);
  const [retryRequest, setRetryRequest] = useState(0);
  const activeUserIdRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  const pendingOpenRoomIdRef = useRef<string | null>(null);
  const pendingOpenTargetRef = useRef<Exclude<PushTarget, null> | null>(null);
  const pendingRoomIdsRef = useRef(new Set<string>());
  const refreshingRoomIdsRef = useRef(new Set<string>());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNoticeRoomId(null);
  }, []);

  const showNotice = useCallback((roomId: string) => {
    if (pathnameRef.current === `/chat/${roomId}`) return;
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNoticeRoomId(roomId);
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null;
      setNoticeRoomId(null);
    }, 4_000);
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryRequest((current) => current + 1);
    }, 3_000);
  }, []);

  const refreshRoom = useCallback((roomId: string) => {
    pendingRoomIdsRef.current.add(roomId);
    const userId = currentUserId;
    if (!chatReady || !userId || refreshingRoomIdsRef.current.has(roomId)) return;
    refreshingRoomIdsRef.current.add(roomId);
    void Promise.all([refreshChatRoom(roomId), refreshChatRooms()])
      .then(([roomResult]) => {
        if (activeUserIdRef.current !== userId) return;
        if (roomResult.ok) pendingRoomIdsRef.current.delete(roomId);
        else scheduleRetry();
      })
      .finally(() => refreshingRoomIdsRef.current.delete(roomId));
  }, [chatReady, currentUserId, refreshChatRoom, refreshChatRooms, scheduleRetry]);

  const openChatRoom = useCallback((roomId: string) => {
    dismissNotice();
    pendingOpenRoomIdRef.current = roomId;
    refreshRoom(roomId);
    if (!sessionReady || !currentUserId || !chatReady) return;
    pendingOpenRoomIdRef.current = null;
    if (pathnameRef.current === `/chat/${roomId}`) return;
    router.push({ pathname: '/chat/[roomId]', params: { roomId } });
  }, [chatReady, currentUserId, dismissNotice, refreshRoom, router, sessionReady]);

  const openPushTarget = useCallback((target: Exclude<PushTarget, null>) => {
    if (target.type === 'chat_room') {
      openChatRoom(target.id);
      return;
    }
    pendingOpenTargetRef.current = target;
    if (!sessionReady || !currentUserId) return;
    const href = getPushHref(target);
    pendingOpenTargetRef.current = null;
    if (href) router.push(href);
  }, [currentUserId, openChatRoom, router, sessionReady]);

  useEffect(() => {
    void configurePushNotifications();
    const unsubscribe = subscribeForegroundPush((data) => {
      const roomId = getChatRoomIdFromPush(data);
      const target = getPushTargetFromPush(data);
      if (roomId) {
        refreshRoom(roomId);
        showNotice(roomId);
      }
      if (target?.type === 'post') void reloadCommunity();
      if (target?.type === 'visit') reloadMedications();
      if (target?.type === 'todo') reloadSchedule();
    });
    const stopListening = listenForForegroundPushes((data) => {
      const roomId = getChatRoomIdFromPush(data);
      return !roomId || pathnameRef.current !== `/chat/${roomId}`;
    });
    const stopOpening = listenForNotificationOpens((data) => {
      const target = getPushTargetFromPush(data);
      if (target) openPushTarget(target);
    });
    return () => {
      unsubscribe();
      stopListening();
      stopOpening();
    };
  }, [openPushTarget, refreshRoom, reloadCommunity, reloadMedications, reloadSchedule, showNotice]);

  useEffect(() => {
    if (!sessionReady) return;
    if (
      !currentUserId ||
      (activeUserIdRef.current && activeUserIdRef.current !== currentUserId)
    ) {
      pendingOpenRoomIdRef.current = null;
      pendingOpenTargetRef.current = null;
      pendingRoomIdsRef.current.clear();
      refreshingRoomIdsRef.current.clear();
      dismissNotice();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    activeUserIdRef.current = currentUserId;
  }, [currentUserId, dismissNotice, sessionReady]);

  useEffect(() => {
    if (!chatReady) return;
    pendingRoomIdsRef.current.forEach((roomId) => refreshRoom(roomId));
  }, [chatReady, refreshRoom, retryRequest]);

  useEffect(() => {
    if (!sessionReady || !currentUserId || !chatReady || !pendingOpenRoomIdRef.current) return;
    const roomId = pendingOpenRoomIdRef.current;
    pendingOpenRoomIdRef.current = null;
    router.push({ pathname: '/chat/[roomId]', params: { roomId } });
  }, [chatReady, currentUserId, router, sessionReady]);

  useEffect(() => {
    if (!sessionReady || !currentUserId || !pendingOpenTargetRef.current) return;
    const target = pendingOpenTargetRef.current;
    pendingOpenTargetRef.current = null;
    const href = getPushHref(target);
    if (href) router.push(href);
  }, [currentUserId, router, sessionReady]);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  return noticeRoomId ? (
    <Pressable
      accessibilityLabel="새 채팅 메시지 확인하기"
      accessibilityRole="button"
      onPress={() => openChatRoom(noticeRoomId)}
      style={({ pressed }) => [
        styles.pushNotice,
        { top: insets.top + SPACING.sm },
        pressed && styles.pushNoticePressed,
      ]}
    >
      <Text style={styles.pushNoticeTitle}>새 채팅 메시지가 도착했어요</Text>
      <Text style={styles.pushNoticeDescription}>눌러서 대화를 확인해보세요.</Text>
    </Pressable>
  ) : null;
}

function AccountDataGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { currentUserId, isReady } = useAuthSession();
  const { logOut, resumePendingWithdrawal } = useAccountLifecycle();
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string>();
  const [request, setRequest] = useState(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (!currentUserId) {
      setCheckedUserId(null);
      setHasError(false);
      return;
    }

    let active = true;
    const userId = currentUserId;
    setHasError(false);

    void (async () => {
      const resumedWithdrawal = await resumePendingWithdrawal();
      if (!active || resumedWithdrawal) return;

      setCheckedUserId(userId);
    })().catch(() => {
      if (active) setHasError(true);
    });

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    isReady,
    request,
    resumePendingWithdrawal,
  ]);

  const isSignupCompletionPath = SIGNUP_COMPLETION_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const exit = async () => {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;
    setLoggingOut(true);
    setLogoutError(undefined);
    try {
      await logOut();
    } catch {
      setLogoutError('로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  };

  if (!currentUserId || checkedUserId === currentUserId || isSignupCompletionPath) {
    return children;
  }

  return (
    <AppScreen contentContainerStyle={styles.centered}>
      {hasError ? (
        <>
          <EmptyState
            actionLabel="다시 시도"
            description="저장된 계정 정보를 다시 확인해주세요."
            onActionPress={() => setRequest((current) => current + 1)}
            title="계정 정보를 확인하지 못했어요."
          />
          <View style={styles.errorActions}>
            {logoutError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {logoutError}
              </Text>
            ) : null}
            <AppButton
              fullWidth={false}
              loading={loggingOut}
              onPress={() => void exit()}
              size="medium"
              title="로그아웃"
              variant="ghost"
            />
          </View>
        </>
      ) : (
        <LoadingView label="계정 정보를 확인하고 있어요." />
      )}
    </AppScreen>
  );
}

function SessionProviders({ children }: PropsWithChildren) {
  const { currentUserId, isReady } = useAuthSession();
  const termsUserId = isReady ? currentUserId : null;

  return (
    <TermsProvider scope="session" userId={termsUserId}>
      <ScheduleTodoProvider>
      <PetProvider>
        <MedicationProvider>
          <HealthSummaryProvider>
            <MyPageProvider>
              <SupportProvider>
                <CommunityProvider>
                  <ChatProvider>
                    <AccountDataGuard>
                      <ChatDataBridge />
                      <ForegroundPushBridge />
                      {children}
                    </AccountDataGuard>
                  </ChatProvider>
                </CommunityProvider>
              </SupportProvider>
            </MyPageProvider>
          </HealthSummaryProvider>
        </MedicationProvider>
      </PetProvider>
      </ScheduleTodoProvider>
    </TermsProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  error: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
  },
  errorActions: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  pushNotice: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    elevation: 8,
    left: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    position: 'absolute',
    right: SPACING.xl,
    shadowColor: COLORS.black,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    zIndex: 1000,
  },
  pushNoticeDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xxs,
  },
  pushNoticePressed: {
    opacity: 0.72,
  },
  pushNoticeTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppAlertProvider>
      <AuthSessionProvider>
        <SessionProviders>{children}</SessionProviders>
      </AuthSessionProvider>
    </AppAlertProvider>
  );
}
