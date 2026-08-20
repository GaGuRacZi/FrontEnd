import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';
import { AppAlertProvider } from '@/src/components/modal';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { SIGNUP_COMPLETION_PATHS } from '@/src/features/auth/session/AuthSessionGuard';
import {
  AuthSessionProvider,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { TermsProvider } from '@/src/features/auth/terms';
import { ChatDataBridge } from '@/src/features/chat/ChatDataBridge';
import { ChatProvider, useChatStore } from '@/src/features/chat/ChatStore';
import { CommunityProvider } from '@/src/features/community/CommunityStore';
import { MyPageProvider } from '@/src/features/mypage/MyPageStore';
import { SupportProvider } from '@/src/features/mypage/support';
import { HealthSummaryProvider } from '@/src/features/health-summary/HealthSummaryStore';
import { MedicationProvider } from '@/src/features/home/MedicationStore';
import { ScheduleTodoProvider } from '@/src/features/home/ScheduleTodoStore';
import { PetProvider } from '@/src/features/pet/PetStore';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { listenForForegroundPushes, subscribeForegroundPush } from '@/src/services/pushNotifications';

function ForegroundPushBridge() {
  const { isReady, refreshChatRoom, refreshChatRooms } = useChatStore();
  const pendingRoomIdsRef = useRef(new Set<string>());

  const refreshRoom = useCallback((roomId: string) => {
    pendingRoomIdsRef.current.add(roomId);
    if (!isReady) return;
    void Promise.all([refreshChatRoom(roomId), refreshChatRooms()]).then((results) => {
      if (results.some((result) => result.ok)) pendingRoomIdsRef.current.delete(roomId);
    });
  }, [isReady, refreshChatRoom, refreshChatRooms]);

  useEffect(() => {
    const unsubscribe = subscribeForegroundPush((data) => {
      const roomId = data.roomId;
      if (data.type !== 'CHAT_MESSAGE' || data.category !== 'CHAT' || !roomId || !/^\d+$/.test(roomId)) {
        return;
      }
      refreshRoom(roomId);
    });
    const stopListening = listenForForegroundPushes();
    return () => {
      unsubscribe();
      stopListening();
    };
  }, [refreshRoom]);

  useEffect(() => {
    if (!isReady) return;
    pendingRoomIdsRef.current.forEach((roomId) => refreshRoom(roomId));
  }, [isReady, refreshRoom]);

  return null;
}

function AccountDataGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { clearSession, currentUserId, isReady } = useAuthSession();
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
    const userId = currentUserId;

    try {
      await logOut();
    } catch {
      try {
        if (userId) await clearSession(userId);
      } catch {
        setLogoutError('로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
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
