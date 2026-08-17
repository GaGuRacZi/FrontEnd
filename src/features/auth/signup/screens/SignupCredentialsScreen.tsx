import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { COLORS, SPACING } from '@/src/constants';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';

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
  const { data, updateField } = useSignup();
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordConfirmError, setPasswordConfirmError] = useState<string>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);

  if (data.method !== 'local') return <Redirect href="/signup/user-info" />;

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={2}
      nextDisabled={!hasValidSignupCredentials(data)}
      onNext={() => router.push('/signup/user-info')}
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
