import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/src/components/layout';
import { AuthSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';

export default function TabLayout() {
  return (
    <AuthSessionGuard>
      <Tabs
        backBehavior="initialRoute"
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: false,
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="health-summary" options={{ title: '건강요약' }} />
        <Tabs.Screen name="dashboard" options={{ title: '대시보드' }} />
        <Tabs.Screen name="home" options={{ title: '홈' }} />
        <Tabs.Screen name="community" options={{ title: '커뮤니티' }} />
        <Tabs.Screen name="mypage" options={{ title: '마이페이지' }} />
      </Tabs>
    </AuthSessionGuard>
  );
}
