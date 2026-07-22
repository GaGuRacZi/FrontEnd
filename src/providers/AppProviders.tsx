import type { PropsWithChildren } from 'react';

import { AuthSessionProvider } from '@/src/features/auth/session/AuthSessionStore';
import { PetProvider } from '@/src/features/pet/PetStore';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthSessionProvider>
      <PetProvider>{children}</PetProvider>
    </AuthSessionProvider>
  );
}
