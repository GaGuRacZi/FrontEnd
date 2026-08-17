import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/src/constants';

import { SignupScaffold } from '../components/SignupScaffold';

const SIGNUP_PETS = require('@/assets/images/signup/signup-pets.png');

export function SignupIntroScreen() {
  const router = useRouter();

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      buttonTitle="시작하기"
      currentStep={1}
      onNext={() => router.push('/signup/profile')}
      title={'환영해요!\n회원가입을 시작해볼까요?'}
    >
      <Text style={styles.description}>
        {'PAW 이용에 필요한\n정보를 차례로 입력해주세요.'}
      </Text>
      <Image accessibilityIgnoresInvertColors source={SIGNUP_PETS} style={styles.image} />
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
  },
  description: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.gray600,
    marginTop: 58,
    textAlign: 'center',
  },
  image: {
    aspectRatio: 266 / 224,
    marginTop: 48,
    maxWidth: 266,
    resizeMode: 'contain',
    width: '100%',
  },
});
