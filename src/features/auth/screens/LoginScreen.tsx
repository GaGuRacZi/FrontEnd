import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppCheckbox } from '@/src/components/form/AppCheckbox';
import { AppInput } from '@/src/components/form/AppInput';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { TopHeader } from '@/src/components/layout/TopHeader';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { AuthActionPanel } from '@/src/features/auth/components/AuthActionPanel';
import { AuthBrandHero } from '@/src/features/auth/components/AuthBrandHero';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getEmailError(email: string) {
  const value = email.trim();

  if (!value) {
    return '이메일을 입력해주세요.';
  }

  if (!EMAIL_PATTERN.test(value)) {
    return '이메일 형식을 확인해주세요.';
  }

  return undefined;
}

export function LoginScreen() {
  const router = useRouter();
  const passwordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (emailError) {
      setEmailError(undefined);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (passwordError) {
      setPasswordError(undefined);
    }
  };

  const handleLoginPress = () => {
    setEmailError(getEmailError(email));
    setPasswordError(password ? undefined : '비밀번호를 입력해주세요.');
  };

  return (
    <AppScreen edges={['top', 'left', 'right']} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <AuthBrandHero style={styles.heroArtwork} />
            <TopHeader
              leftAccessibilityLabel="뒤로가기"
              leftIcon="chevron-back"
              onLeftPress={() => router.replace('/')}
              style={styles.heroHeader}
            />
          </View>

          <AuthActionPanel style={styles.formPanel}>
            <View style={styles.credentials}>
              <Text style={styles.title}>파우 로그인</Text>

              <View style={styles.form}>
                <View style={styles.fields}>
                  <AppInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    error={emailError}
                    keyboardType="email-address"
                    label="이메일"
                    leftElement={
                      <AppIcon
                        accessible={false}
                        color={COLORS.gray500}
                        name="mail-outline"
                        size={24}
                      />
                    }
                    onBlur={() => setEmailError(getEmailError(email))}
                    onChangeText={handleEmailChange}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    placeholder="lion14@paw.com"
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />

                  <AppInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    error={passwordError}
                    label="비밀번호"
                    leftElement={
                      <AppIcon
                        accessible={false}
                        color={COLORS.gray500}
                        name="lock-closed-outline"
                        size={24}
                      />
                    }
                    onBlur={() => {
                      if (!password) {
                        setPasswordError('비밀번호를 입력해주세요.');
                      }
                    }}
                    onChangeText={handlePasswordChange}
                    onSubmitEditing={canSubmit ? handleLoginPress : undefined}
                    placeholder="비밀번호를 입력해주세요"
                    ref={passwordInputRef}
                    returnKeyType="done"
                    rightElement={
                      <Pressable
                        accessibilityLabel={
                          isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 표시하기'
                        }
                        accessibilityRole="button"
                        hitSlop={10}
                        onPress={() => setIsPasswordVisible((visible) => !visible)}
                        style={styles.passwordToggle}
                      >
                        <AppIcon
                          accessible={false}
                          color={COLORS.gray500}
                          name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={24}
                        />
                      </Pressable>
                    }
                    secureTextEntry={!isPasswordVisible}
                    textContentType="password"
                    value={password}
                  />
                </View>

                <AppCheckbox
                  checked={keepLoggedIn}
                  label="로그인 유지"
                  onChange={setKeepLoggedIn}
                  size="small"
                />
              </View>
            </View>

            <AppButton
              disabled={!canSubmit}
              onPress={handleLoginPress}
              size="medium"
              title="로그인"
              variant="secondary"
            />
            <AppButton
              accessibilityHint="회원가입 화면으로 이동합니다"
              onPress={() => router.push('/signup')}
              title="회원가입"
            />
          </AuthActionPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    backgroundColor: COLORS.gray100,
    flexGrow: 1,
  },
  hero: {
    flexShrink: 0,
    height: 410,
    position: 'relative',
  },
  heroArtwork: {
    flex: 1,
  },
  heroHeader: {
    left: 18,
    position: 'absolute',
    right: 18,
    top: 24,
  },
  formPanel: {
    flexGrow: 1,
    minHeight: 423,
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    textAlign: 'center',
  },
  credentials: {
    alignItems: 'center',
    gap: SPACING.xl,
    width: '100%',
  },
  form: {
    gap: SPACING.xl,
    width: '100%',
  },
  fields: {
    gap: SPACING.md,
    width: '100%',
  },
  passwordToggle: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});
