import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { KeyboardAwareScrollView } from '@/src/components/layout/KeyboardAwareScrollView';
import { TopHeader } from '@/src/components/layout/TopHeader';
import { COLORS, LAYOUT, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getEmailError } from '@/src/features/auth/authValidation';
import { AuthActionPanel } from '@/src/features/auth/components/AuthActionPanel';
import { AuthBrandHero } from '@/src/features/auth/components/AuthBrandHero';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

export function LoginScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { signInWithPassword } = useAuthSession();
  const passwordInputRef = useRef<TextInput>(null);
  const screenActiveRef = useRef(false);
  const submittingRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (emailError) {
      setEmailError(undefined);
    }
    if (formError) {
      setFormError(undefined);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (passwordError) {
      setPasswordError(undefined);
    }
    if (formError) {
      setFormError(undefined);
    }
  };

  const handleLoginPress = async () => {
    if (submittingRef.current) return;

    const nextEmailError = getEmailError(email);
    const nextPasswordError = password ? undefined : '비밀번호를 입력해주세요.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(undefined);

    if (nextEmailError || nextPasswordError) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await signInWithPassword(email, password);
      if (result.status !== 'verified') {
        if (screenActiveRef.current) {
          setFormError('이메일 또는 비밀번호가 일치하지 않아요.');
        }
        return;
      }

    } catch {
      if (screenActiveRef.current) {
        setFormError('로그인 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      submittingRef.current = false;
      if (screenActiveRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleBack = useCallback(() => {
    if (submitting) return;

    navigateOnce(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace('/');
    });
  }, [navigateOnce, router, submitting]);

  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;

      const cleanup = () => {
        screenActiveRef.current = false;
      };

      if (Platform.OS !== 'android') return cleanup;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => {
        cleanup();
        subscription.remove();
      };
    }, [handleBack]),
  );

  return (
    <AppScreen edges={['top', 'left', 'right']} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <KeyboardAwareScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          extraScrollHeight={SPACING.jumbo}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <AuthBrandHero style={styles.heroArtwork} />
            <TopHeader
              leftAccessibilityLabel="뒤로가기"
              leftIcon="chevron-back"
              onLeftPress={handleBack}
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
                    placeholder="example@email.com"
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
                    onSubmitEditing={canSubmit ? () => void handleLoginPress() : undefined}
                    placeholder="비밀번호를 입력해주세요"
                    ref={passwordInputRef}
                    returnKeyType="done"
                    rightElement={
                      <PasswordVisibilityButton
                        onPress={() => setIsPasswordVisible((visible) => !visible)}
                        visible={isPasswordVisible}
                      />
                    }
                    secureTextEntry={!isPasswordVisible}
                    textContentType="password"
                    value={password}
                  />
                </View>
                {formError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.formError}>
                    {formError}
                  </Text>
                ) : null}

              </View>
            </View>

            <AppButton
              disabled={!canSubmit || submitting}
              loading={submitting}
              onPress={() => void handleLoginPress()}
              size="medium"
              title="로그인"
              variant="secondary"
            />
            <AppButton
              accessibilityHint="회원가입 화면으로 이동합니다"
              disabled={submitting}
              onPress={() =>
                navigateOnce(() =>
                  router.push({ pathname: '/signup/terms', params: { method: 'local' } }),
                )
              }
              title="회원가입"
            />
          </AuthActionPanel>
        </KeyboardAwareScrollView>
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
    left: LAYOUT.screenPaddingHorizontal,
    position: 'absolute',
    right: LAYOUT.screenPaddingHorizontal,
    top: SPACING.xxxl,
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
  formError: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    textAlign: 'center',
  },
});
