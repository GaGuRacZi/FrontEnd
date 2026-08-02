import { Redirect } from 'expo-router';

import { AuthSessionStateScreen } from '@/src/features/auth/session/AuthSessionGuard';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { LoginStartScreen } from '@/src/features/auth/screens/LoginStartScreen';

export default function IndexRoute() {
  const { currentUserId, isReady, sessionLoadError } = useAuthSession();

  if (!isReady || sessionLoadError) {
    return <AuthSessionStateScreen loadingLabel="PAW를 준비하고 있어요." />;
  }

  if (currentUserId) {
    return <Redirect href="/home" />;
  }

  return <LoginStartScreen />;
}
