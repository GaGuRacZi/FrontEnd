import { useLocalSearchParams } from 'expo-router';

import { ScheduleScreen } from '@/src/features/home/screens/ScheduleScreen';

export default function ScheduleRoute() {
  const { todoId } = useLocalSearchParams<{ todoId?: string }>();

  return <ScheduleScreen notificationTodoId={todoId} />;
}
