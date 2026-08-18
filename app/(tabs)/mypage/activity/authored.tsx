import { useLocalSearchParams } from 'expo-router';

import { MyAuthoredPostsScreen } from '@/src/features/mypage/screens/MyAuthoredPostsScreen';

export default function MyAuthoredPostsRoute() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  return <MyAuthoredPostsScreen initialFilter={filter} />;
}
