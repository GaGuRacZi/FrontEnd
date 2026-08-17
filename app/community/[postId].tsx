import { useLocalSearchParams } from 'expo-router';

import { CommunityPostDetailScreen } from '@/src/features/community/screens/CommunityScreen';

export default function CommunityPostDetailRoute() {
  const { kind, origin, postId } = useLocalSearchParams<{
    kind?: string;
    origin?: string;
    postId?: string;
  }>();
  const fromMyPageActivity = origin === 'mypage-activity';
  const postKind = kind === 'talk' || kind === 'market' || kind === 'review' ? kind : undefined;

  return (
    <CommunityPostDetailScreen
      defaultOrigin={fromMyPageActivity ? 'mypage-activity' : undefined}
      postId={postId ?? ''}
      postKind={postKind}
    />
  );
}
