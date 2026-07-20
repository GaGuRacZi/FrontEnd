import { Stack, useGlobalSearchParams } from 'expo-router';

import { SignupFlowGuard } from '@/src/features/auth/signup/components/SignupFlowGuard';
import { SignupProvider } from '@/src/features/auth/signup/SignupContext';

export default function SignupLayout() {
  const { method } = useGlobalSearchParams<{ method?: string }>();
  const signupMethod = method === 'kakao' || method === 'local' ? method : undefined;

  return (
    <SignupProvider initialMethod={signupMethod}>
      <SignupFlowGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="complete" options={{ gestureEnabled: false }} />
        </Stack>
      </SignupFlowGuard>
    </SignupProvider>
  );
}
