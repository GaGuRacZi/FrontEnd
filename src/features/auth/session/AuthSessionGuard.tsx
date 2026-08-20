import { Redirect, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';

import { useAuthSession } from './AuthSessionStore';

type GuestSessionGuardProps = PropsWithChildren<{
  authenticatedPathExceptions?: readonly string[];
}>;

export const SIGNUP_COMPLETION_PATHS = ['/signup/pet-info', '/signup/complete'] as const;

export function AuthSessionStateScreen({ loadingLabel }: { loadingLabel: string }) {
  const {
    discardStoredSession,
    isReady,
    retrySessionLoad,
    sessionLoadError,
  } = useAuthSession();

  if (!isReady) {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <LoadingView label={loadingLabel} />
      </AppScreen>
    );
  }

  if (sessionLoadError) {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <View style={styles.errorState}>
          <EmptyState
            actionLabel="다시 시도"
            description="잠시 후 다시 시도해주세요."
            onActionPress={retrySessionLoad}
            title="로그인 정보를 불러오지 못했어요."
          />
          <AppButton
            fullWidth={false}
            onPress={() => void discardStoredSession()}
            size="medium"
            style={styles.loginAction}
            title="로그인 화면으로"
            variant="outline"
          />
        </View>
      </AppScreen>
    );
  }

  return null;
}

export function AuthSessionGuard({ children }: PropsWithChildren) {
  const { currentUserId, isReady, sessionLoadError } = useAuthSession();

  if (!isReady || sessionLoadError) {
    return <AuthSessionStateScreen loadingLabel="로그인 정보를 확인하고 있어요." />;
  }

  if (!currentUserId) {
    return <Redirect href="/" />;
  }

  return children;
}

export function GuestSessionGuard({
  authenticatedPathExceptions = [],
  children,
}: GuestSessionGuardProps) {
  const pathname = usePathname();
  const { currentUserId, isReady, sessionLoadError } = useAuthSession();

  if (!isReady || sessionLoadError) {
    return <AuthSessionStateScreen loadingLabel="로그인 정보를 확인하고 있어요." />;
  }

  const isAuthenticatedPathException = authenticatedPathExceptions.some(
    (exception) => pathname === exception || pathname.startsWith(`${exception}/`),
  );

  if (currentUserId && !isAuthenticatedPathException) {
    return <Redirect href="/home" />;
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  errorState: {
    alignItems: 'center',
  },
  loginAction: {
    marginTop: 4,
  },
});
