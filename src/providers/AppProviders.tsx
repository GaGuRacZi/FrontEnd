import type { PropsWithChildren } from 'react';

import {
  AuthSessionProvider,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { TermsProvider } from '@/src/features/auth/terms';
import { MyPageProvider } from '@/src/features/mypage/MyPageStore';
import { PetProvider } from '@/src/features/pet/PetStore';

function SessionProviders({ children }: PropsWithChildren) {
  const { currentUserId, isReady } = useAuthSession();
  const termsUserId = isReady ? currentUserId : null;

  return (
    <TermsProvider scope="session" userId={termsUserId}>
      <PetProvider>
        <MyPageProvider>{children}</MyPageProvider>
      </PetProvider>
    </TermsProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthSessionProvider>
      <SessionProviders>{children}</SessionProviders>
    </AuthSessionProvider>
  );
}
