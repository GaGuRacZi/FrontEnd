import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';

import { EmailVerificationField } from '../components/EmailVerificationField';
import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';
import {
  getPasswordConfirmError,
  getPasswordError,
  getRequiredError,
  hasValidSignupUserInfo,
} from '../signupValidation';

export function SignupUserInfoScreen() {
  const router = useRouter();
  const { data, updateField } = useSignup();
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordConfirmError, setPasswordConfirmError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [nicknameError, setNicknameError] = useState<string>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const isLocal = data.method === 'local';
  const canContinue = hasValidSignupUserInfo(data);

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={2}
      nextDisabled={!canContinue}
      onNext={() => router.push('/signup/pet-type')}
      title={'보호자(회원) 정보를\n입력해주세요'}
    >
      {isLocal ? (
        <>
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
        </>
      ) : null}

      <AppInput
        autoComplete="name"
        error={nameError}
        label="이름"
        onBlur={() => setNameError(getRequiredError(data.name, '이름을 입력해주세요.'))}
        onChangeText={(value) => {
          updateField('name', value);
          setNameError(undefined);
        }}
        placeholder="이름을 입력해주세요"
        textContentType="name"
        value={data.name}
      />

      <AppInput
        error={nicknameError}
        label="닉네임"
        leftElement={
          isLocal ? <AppIcon color={COLORS.gray500} name="person-outline" size={22} /> : undefined
        }
        maxLength={12}
        onBlur={() =>
          setNicknameError(getRequiredError(data.nickname, '닉네임을 입력해주세요.'))
        }
        onChangeText={(value) => {
          updateField('nickname', value);
          setNicknameError(undefined);
        }}
        placeholder="파우"
        value={data.nickname}
      />

      <View>
        <AppInput
          inputStyle={styles.introductionInput}
          label="한 줄 소개 (선택)"
          maxLength={30}
          multiline
          onChangeText={(value) => updateField('introduction', value)}
          placeholder="나와 반려동물을 소개해주세요"
          value={data.introduction}
        />
        <Text style={styles.counter}>{data.introduction.length}/30</Text>
      </View>
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING.xxl,
    marginTop: 46,
  },
  introductionInput: {
    paddingBottom: 30,
  },
  counter: {
    ...TYPOGRAPHY.caption,
    bottom: SPACING.xl,
    color: COLORS.gray500,
    position: 'absolute',
    right: SPACING.xxl,
  },
});
