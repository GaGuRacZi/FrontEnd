import { useLocalSearchParams } from 'expo-router';

import { MyCommunityEngagementScreen } from '@/src/features/mypage/screens/MyCommunityEngagementScreen';

export default function MyCommunityEngagementRoute() {
  const { filter, tab } = useLocalSearchParams<{ filter?: string; tab?: string }>();

  return <MyCommunityEngagementScreen initialFilter={filter} initialTab={tab} />;
}
