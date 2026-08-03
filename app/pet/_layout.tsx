import { Stack } from 'expo-router';

import { AuthSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';

export default function PetLayout() {
  return (
    <AuthSessionGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthSessionGuard>
  );
}
