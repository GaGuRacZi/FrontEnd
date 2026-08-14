import { useLocalSearchParams } from 'expo-router';

import { ChatRoomScreen } from '@/src/features/chat/screens/ChatRoomScreen';

export default function ChatRoomRoute() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  return <ChatRoomScreen roomId={roomId ?? ''} />;
}
