import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, SPACING } from '@/src/constants';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import type {
  KakaoLinkChallenge,
  KakaoSession,
} from '@/src/features/auth/services/kakaoAuthContract';
import {
  confirmKakaoLinkWithKakaoAccessToken,
  getKakaoAccessToken,
  KakaoAuthError,
  loadRemoteUserProfile,
} from '@/src/features/auth/services/kakaoAuthService';
import {
  LocalAuthError,
  signUpWithLocalCredentials,
} from '@/src/features/auth/services/localAuthService';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';

import { EmailVerificationField } from '../components/EmailVerificationField';
import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';
import {
  getPasswordConfirmError,
  getPasswordError,
  hasValidSignupCredentials,
} from '../signupValidation';

export function SignupCredentialsScreen() {
  const router = useRouter();
  const showAlert = useAppAlert();
  const {
    clearSignupDraft,
    data,
    flushSignupDraft,
    signupSessionId,
    updateField,
  } = useSignup();
  const {
    activateRemoteSession,
    pendingRemoteSignupMethod,
    pendingRemoteSignupUserId,
    prepareRemoteSignup,
  } = useAuthSession();
  const { registerRemoteProfile } = useMyPageStore();
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordConfirmError, setPasswordConfirmError] = useState<string>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (data.method !== 'local') return <Redirect href="/signup/user-info" />;

  const finishLinkedKakaoSession = async (session: KakaoSession) => {
    if (session.isNew) {
      await prepareRemoteSignup(session, 'local', signupSessionId);
      router.push('/signup/user-info');
      return;
    }

    const profile = await loadRemoteUserProfile(session.accessToken);
    if (profile.uid !== session.uid || profile.isNew) {
      throw new Error('linked-kakao-profile-mismatch');
    }
    await registerRemoteProfile(profile, 'local');
    await registerRemoteProfile(profile, 'kakao');
    await clearSignupDraft();
    await activateRemoteSession(session);
  };

  const confirmKakaoAccountLink = async (challenge: KakaoLinkChallenge) => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const accessToken = await getKakaoAccessToken();
      const session = await confirmKakaoLinkWithKakaoAccessToken(
        challenge.linkToken,
        accessToken,
      );
      await finishLinkedKakaoSession(session);
    } catch (error) {
      if (error instanceof KakaoAuthError && error.kind === 'cancelled') return;

      showAlert(
        '계정 연결을 완료하지 못했어요',
        error instanceof KakaoAuthError ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (submittingRef.current) return;

    if (pendingRemoteSignupUserId && pendingRemoteSignupMethod === 'local') {
      router.push('/signup/user-info');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await flushSignupDraft();
      const outcome = await signUpWithLocalCredentials(data.email, data.password);

      if (outcome.kind === 'link-required') {
        if (outcome.challenge.existingProvider !== 'KAKAO') {
          throw new Error('unsupported-local-signup-link-challenge');
        }
        showAlert(
          '카카오 계정이 있어요',
          '카카오 계정으로 본인 확인을 하면 이메일 로그인과 연결할 수 있어요.',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '카카오로 확인',
              onPress: () => void confirmKakaoAccountLink(outcome.challenge),
            },
          ],
        );
        return;
      }

      if (!outcome.session.isNew) {
        await clearSignupDraft();
        showAlert('이미 가입된 이메일이에요', '로그인 화면에서 로그인해주세요.', [
          { text: '확인', onPress: () => router.dismissTo('/login') },
        ]);
        return;
      }

      await prepareRemoteSignup(outcome.session, 'local', signupSessionId);
      router.push('/signup/user-info');
    } catch (error) {
      showAlert(
        '회원가입을 시작하지 못했어요',
        error instanceof LocalAuthError
          ? error.message
          : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={2}
      nextDisabled={!hasValidSignupCredentials(data) || submitting}
      nextLoading={submitting}
      onNext={handleNext}
      title={'비밀번호를\n설정해주세요'}
    >
      <EmailVerificationField />

      <AppInput
        autoCapitalize="none"
        autoComplete="new-password"
        error={passwordError}
        helperText="8자 이상, 영문 대소문자와 숫자 포함"
        label="비밀번호"
        leftElement={
          <AppIcon color={COLORS.gray500} name="lock-closed-outline" size={22} />
        }
        onBlur={() => setPasswordError(getPasswordError(data.password))}
        onChangeText={(value) => {
          updateField('password', value);
          setPasswordError(undefined);
          if (data.passwordConfirm) {
            setPasswordConfirmError(getPasswordConfirmError(value, data.passwordConfirm));
          }
        }}
        placeholder="비밀번호를 입력해주세요"
        rightElement={
          <PasswordVisibilityButton
            onPress={() => setPasswordVisible((current) => !current)}
            visible={passwordVisible}
          />
        }
        secureTextEntry={!passwordVisible}
        textContentType="newPassword"
        value={data.password}
      />

      <AppInput
        autoCapitalize="none"
        autoComplete="new-password"
        error={passwordConfirmError}
        label="비밀번호 확인"
        leftElement={
          <AppIcon color={COLORS.gray500} name="lock-closed-outline" size={22} />
        }
        onBlur={() =>
          setPasswordConfirmError(
            getPasswordConfirmError(data.password, data.passwordConfirm),
          )
        }
        onChangeText={(value) => {
          updateField('passwordConfirm', value);
          setPasswordConfirmError(undefined);
        }}
        placeholder="비밀번호를 다시 입력해주세요"
        rightElement={
          <PasswordVisibilityButton
            onPress={() => setPasswordConfirmVisible((current) => !current)}
            visible={passwordConfirmVisible}
          />
        }
        secureTextEntry={!passwordConfirmVisible}
        textContentType="newPassword"
        value={data.passwordConfirm}
      />
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING.xxl,
    marginTop: 46,
  },
});
