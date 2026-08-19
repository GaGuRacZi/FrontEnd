import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, SPACING } from '@/src/constants';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

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
    data,
    flushSignupDraft,
    updateField,
  } = useSignup();
  const {
    pendingRemoteSignupMethod,
    pendingRemoteSignupUserId,
  } = useAuthSession();
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordConfirmError, setPasswordConfirmError] = useState<string>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (data.method !== 'local') return <Redirect href="/signup/user-info" />;

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
      router.push('/signup/user-info');
    } catch {
      showAlert('회원가입 정보를 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
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
