import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
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
import { RequiredTermsGuard } from '@/src/features/auth/terms/components/RequiredTermsGuard';
import { ChatDataBridge } from '@/src/features/chat/ChatDataBridge';
import { ChatProvider } from '@/src/features/chat/ChatStore';
import { CommunityProvider } from '@/src/features/community/CommunityStore';
import {
  MyPageProvider,
  useMyPageStore,
} from '@/src/features/mypage/MyPageStore';
import { PetProvider } from '@/src/features/pet/PetStore';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';

function AccountDataGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { clearSession, currentUserId, isReady } = useAuthSession();
  const { hasStoredUserProfileData } = useMyPageStore();
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

      const profileStatus = await hasStoredUserProfileData(userId);
      if (!active) return;

      if (profileStatus === 'missing') {
        await clearSession(userId);
        return;
      }
      if (profileStatus !== 'valid') {
        throw new Error('account-profile-invalid');
      }
      setCheckedUserId(userId);
    })().catch(() => {
      if (active) setHasError(true);
    });

    return () => {
      active = false;
    };
  }, [
    clearSession,
    currentUserId,
    hasStoredUserProfileData,
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
      <PetProvider>
        <MyPageProvider>
          <CommunityProvider>
            <ChatProvider>
              <AccountDataGuard>
                <ChatDataBridge />
                <RequiredTermsGuard userId={termsUserId}>
                  {children}
                </RequiredTermsGuard>
              </AccountDataGuard>
            </ChatProvider>
          </CommunityProvider>
        </MyPageProvider>
      </PetProvider>
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
