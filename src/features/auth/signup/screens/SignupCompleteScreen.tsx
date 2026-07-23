import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, BackHandler, Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { COLORS, LAYOUT, RADIUS, TYPOGRAPHY } from '@/src/constants';
import {
  getSignupUserId,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { useSignup } from '@/src/features/auth/signup/SignupContext';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';

const PAW_LOGO = require('@/assets/images/paw-logo.png');

export function SignupCompleteScreen() {
  const router = useRouter();
  const { currentUserId } = useAuthSession();
  const { data, signupSessionId } = useSignup();
  const { registerSignupProfile } = useMyPageStore();
  const navigateOnce = useNavigationLock();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);

    return () => subscription.remove();
  }, []);

  return (
    <AppScreen contentContainerStyle={styles.container} scrollable>
      <View style={styles.artwork}>
        <View style={[styles.confetti, styles.blueLeft]} />
        <View style={[styles.confetti, styles.pinkTop]} />
        <View style={[styles.confetti, styles.peachLeft]} />
        <View style={[styles.confetti, styles.blueRight]} />
        <View style={[styles.confetti, styles.yellowRight]} />
        <View style={styles.logoGlow}>
          <Image source={PAW_LOGO} style={styles.logo} />
        </View>
      </View>

      <Text style={styles.title}>회원가입이 완료되었어요!</Text>
      <Text style={styles.description}>
        {'이제 PAW와 함께\n우리 아이의 건강을 관리해볼까요?'}
      </Text>

      <AppButton
        accessibilityHint="홈 화면으로 이동합니다"
        onPress={() =>
          navigateOnce(async () => {
            const userId =
              currentUserId ?? getSignupUserId(data.method, data.email, signupSessionId);
            try {
              await registerSignupProfile(data, userId);
            } catch {
              Alert.alert('프로필 저장을 다시 확인해주세요', '홈으로 이동한 뒤 마이페이지에서 수정할 수 있어요.');
            }
            router.replace('/home');
          })
        }
        style={styles.button}
        title="PAW 시작하기"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
  },
  artwork: {
    aspectRatio: 302 / 300,
    marginTop: 132,
    maxWidth: 302,
    position: 'relative',
    width: '100%',
  },
  logoGlow: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    justifyContent: 'center',
    left: '17%',
    position: 'absolute',
    top: '12%',
    width: '66%',
  },
  logo: {
    height: '88%',
    maxHeight: 175,
    maxWidth: 175,
    resizeMode: 'contain',
    width: '88%',
  },
  confetti: {
    borderRadius: 2,
    height: 18,
    position: 'absolute',
    width: 8,
  },
  blueLeft: {
    backgroundColor: COLORS.confettiBlue,
    left: 6,
    top: 38,
    transform: [{ rotate: '-28deg' }],
  },
  pinkTop: {
    backgroundColor: COLORS.confettiPink,
    right: 51,
    top: 0,
    transform: [{ rotate: '28deg' }],
  },
  peachLeft: {
    backgroundColor: COLORS.confettiPeach,
    bottom: 10,
    left: 30,
    transform: [{ rotate: '-28deg' }],
  },
  blueRight: {
    backgroundColor: COLORS.confettiBlue,
    bottom: 16,
    right: 14,
    transform: [{ rotate: '28deg' }],
  },
  yellowRight: {
    backgroundColor: COLORS.confettiYellow,
    right: 0,
    top: 152,
    transform: [{ rotate: '28deg' }],
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    marginTop: 24,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    lineHeight: 27,
    marginTop: 28,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
    marginTop: 'auto',
  },
});
