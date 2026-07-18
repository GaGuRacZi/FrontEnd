import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { COLORS, TYPOGRAPHY } from '@/src/constants';
import { AuthActionPanel } from '@/src/features/auth/components/AuthActionPanel';
import { AuthBrandHero } from '@/src/features/auth/components/AuthBrandHero';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

export function LoginStartScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();

  return (
    <AppScreen
      contentContainerStyle={styles.scrollContent}
      edges={['top', 'left', 'right']}
      padded={false}
      scrollable
    >
      <AuthBrandHero largeLogo style={styles.hero} tagline="우리 아이 건강을 가장 가까이에서" />

      <AuthActionPanel style={styles.actionPanel}>
        <Text style={styles.title}>파우 시작하기</Text>
        <Text style={styles.description}>카카오 계정으로 빠르게 로그인하세요</Text>

        <AppButton
          accessibilityHint="로그인 화면으로 이동합니다"
          onPress={() => navigateOnce(() => router.replace('/login'))}
          size="medium"
          title="로그인/회원가입 하기"
          variant="secondary"
        />
        <AppButton
          accessibilityLabel="카카오로 시작하기"
          leftIcon={
            <AppIcon accessible={false} color={COLORS.black} name="chatbubble" size={24} />
          }
          title="카카오로 시작하기"
          variant="kakao"
        />
      </AuthActionPanel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    backgroundColor: COLORS.gray100,
  },
  hero: {
    flexGrow: 1,
    minHeight: 500,
  },
  actionPanel: {
    minHeight: 304,
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
