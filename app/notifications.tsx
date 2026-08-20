import { NotificationScreen } from '@/src/features/home/screens/NotificationScreen';
import { AuthSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';

export default function NotificationsRoute() {
  return (
    <AuthSessionGuard>
      <NotificationScreen />
    </AuthSessionGuard>
  );
}
