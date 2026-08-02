import { Redirect, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';

import { useAuthSession } from './AuthSessionStore';

type GuestSessionGuardProps = PropsWithChildren<{
  authenticatedPathExceptions?: readonly string[];
}>;

export function AuthSessionStateScreen({ loadingLabel }: { loadingLabel: string }) {
  const { isReady, retrySessionLoad, sessionLoadError } = useAuthSession();

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
        <EmptyState
          actionLabel="다시 시도"
          description="저장된 로그인 정보를 다시 확인해주세요."
          onActionPress={retrySessionLoad}
          title="로그인 정보를 불러오지 못했어요."
        />
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

  if (currentUserId && !authenticatedPathExceptions.includes(pathname)) {
    return <Redirect href="/home" />;
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
});
