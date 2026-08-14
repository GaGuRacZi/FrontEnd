import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { ChatListScreen } from '@/src/features/chat/screens/ChatListScreen';
import { CommunityScreen } from '@/src/features/community/screens/CommunityScreen';

type CommunityTabParamList = {
  community: { view?: string } | undefined;
};

export default function CommunityTab() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const navigation =
    useNavigation<BottomTabNavigationProp<CommunityTabParamList, 'community'>>();
  const router = useRouter();

  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (view === 'chat') {
          router.replace('/community');
        }
      }),
    [navigation, router, view],
  );

  return view === 'chat' ? <ChatListScreen /> : <CommunityScreen />;
}
