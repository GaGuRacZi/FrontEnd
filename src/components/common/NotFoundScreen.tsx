import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/src/components/layout';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { AppButton } from './AppButton';

export function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppScreen>
        <View style={styles.content}>
          <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
          <Text style={styles.description}>요청한 화면의 주소를 다시 확인해주세요.</Text>
          <AppButton onPress={() => router.replace('/home')} title="홈으로 이동" />
        </View>
      </AppScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: SPACING.xxl,
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
});
