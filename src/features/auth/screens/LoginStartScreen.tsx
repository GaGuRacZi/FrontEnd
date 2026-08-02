import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, TYPOGRAPHY } from '@/src/constants';
import { AuthActionPanel } from '@/src/features/auth/components/AuthActionPanel';
import { AuthBrandHero } from '@/src/features/auth/components/AuthBrandHero';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

export function LoginStartScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();

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
        <Text style={styles.description}>이메일로 로그인하거나 회원가입하세요</Text>

        <AppButton
          accessibilityHint="로그인 화면으로 이동합니다"
          onPress={() => navigateOnce(() => router.replace('/login'))}
          size="medium"
          title="로그인/회원가입 하기"
          variant="secondary"
        />
        <AppButton
          accessibilityHint="카카오 로그인 준비 상태를 안내합니다"
          accessibilityLabel="카카오로 시작하기"
          leftIcon={
            <AppIcon accessible={false} color={COLORS.black} name="chatbubble" size={24} />
          }
          onPress={() =>
            showAlert(
              '카카오 로그인 준비 중이에요',
              '카카오 로그인 연결이 완료되면 사용할 수 있어요.',
            )
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
