import { useLocalSearchParams } from 'expo-router';

import { ChatListScreen } from '@/src/features/chat/screens/ChatListScreen';
import { CommunityScreen } from '@/src/features/community/screens/CommunityScreen';

export default function CommunityTab() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return view === 'chat' ? <ChatListScreen /> : <CommunityScreen />;
}
