import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';
import { AppAlertProvider } from '@/src/components/modal';
import {
  AuthSessionProvider,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { TermsProvider } from '@/src/features/auth/terms';
import { CommunityProvider } from '@/src/features/community/CommunityStore';
import {
  MyPageProvider,
  useMyPageStore,
} from '@/src/features/mypage/MyPageStore';
import { PetProvider } from '@/src/features/pet/PetStore';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';

function AccountDataGuard({ children }: PropsWithChildren) {
  const { clearSession, currentUserId, isReady } = useAuthSession();
  const { hasStoredUserProfileData } = useMyPageStore();
  const { resumePendingWithdrawal } = useAccountLifecycle();
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [request, setRequest] = useState(0);

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

  if (!currentUserId || checkedUserId === currentUserId) return children;

  return (
    <AppScreen contentContainerStyle={styles.centered}>
      {hasError ? (
        <EmptyState
          actionLabel="다시 시도"
          description="저장된 계정 정보를 다시 확인해주세요."
          onActionPress={() => setRequest((current) => current + 1)}
          title="계정 정보를 확인하지 못했어요."
        />
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
            <AccountDataGuard>{children}</AccountDataGuard>
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
