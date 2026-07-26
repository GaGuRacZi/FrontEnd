import { Redirect } from 'expo-router';

import { LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { LoginStartScreen } from '@/src/features/auth/screens/LoginStartScreen';

export default function IndexRoute() {
  const { currentUserId, isReady } = useAuthSession();

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingView label="PAW를 준비하고 있어요." />
      </AppScreen>
    );
  }

  if (currentUserId) {
    return <Redirect href="/home" />;
  }

  return <LoginStartScreen />;
}
