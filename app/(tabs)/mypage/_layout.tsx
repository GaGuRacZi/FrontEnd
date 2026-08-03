import { Stack } from 'expo-router';

import { MyPageStateGuard } from '@/src/features/mypage/components';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function MyPageLayout() {
  return (
    <MyPageStateGuard>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </MyPageStateGuard>
  );
}
