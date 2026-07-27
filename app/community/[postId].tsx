import { useLocalSearchParams } from 'expo-router';

import { CommunityPostDetailScreen } from '@/src/features/community/screens/CommunityScreen';

export default function CommunityPostDetailRoute() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();

  return <CommunityPostDetailScreen postId={postId ?? ''} />;
}
