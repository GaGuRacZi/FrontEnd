import { Stack } from 'expo-router';

import { GuestSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';

const SIGNUP_COMPLETION_PATHS = ['/signup/location', '/signup/complete'];

export default function AuthLayout() {
  return (
    <GuestSessionGuard authenticatedPathExceptions={SIGNUP_COMPLETION_PATHS}>
      <Stack screenOptions={{ headerShown: false }} />
    </GuestSessionGuard>
  );
}
