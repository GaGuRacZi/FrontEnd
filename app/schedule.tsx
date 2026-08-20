import { useLocalSearchParams } from 'expo-router';

import { AuthSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';
import { ScheduleScreen } from '@/src/features/home/screens/ScheduleScreen';

export default function ScheduleRoute() {
  const { todoId } = useLocalSearchParams<{ todoId?: string }>();

  return (
    <AuthSessionGuard>
      <ScheduleScreen notificationTodoId={todoId} />
    </AuthSessionGuard>
  );
}
