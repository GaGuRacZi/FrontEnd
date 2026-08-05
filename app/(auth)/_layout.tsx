import { Stack } from 'expo-router';

import {
  GuestSessionGuard,
  SIGNUP_COMPLETION_PATHS,
} from '@/src/features/auth/session/AuthSessionGuard';

export default function AuthLayout() {
  return (
    <GuestSessionGuard authenticatedPathExceptions={SIGNUP_COMPLETION_PATHS}>
      <Stack screenOptions={{ headerShown: false }} />
    </GuestSessionGuard>
  );
}
