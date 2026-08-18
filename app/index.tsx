import { Redirect } from 'expo-router';

import { AuthSessionStateScreen } from '@/src/features/auth/session/AuthSessionGuard';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { LoginStartScreen } from '@/src/features/auth/screens/LoginStartScreen';

export default function IndexRoute() {
  const {
    currentUserId,
    isReady,
    pendingRemoteSignupMethod,
    pendingRemoteSignupUserId,
    sessionLoadError,
  } = useAuthSession();

  if (!isReady || sessionLoadError) {
    return <AuthSessionStateScreen loadingLabel="PAW를 불러오고 있어요." />;
  }

  if (currentUserId) {
    return <Redirect href="/home" />;
  }

  if (pendingRemoteSignupUserId) {
    if (pendingRemoteSignupMethod === 'local') {
      return <Redirect href="/signup/user-info" />;
    }

    return (
      <Redirect
        href={{
          pathname: '/signup/terms',
          params: { method: pendingRemoteSignupMethod ?? 'kakao' },
        }}
      />
    );
  }

  return <LoginStartScreen />;
}
