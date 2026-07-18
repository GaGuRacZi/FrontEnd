import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getEmailError } from '@/src/features/auth/authValidation';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';

import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';
import {
  formatPhone,
  getPasswordConfirmError,
  getPasswordError,
  getPhoneError,
  getRequiredError,
} from '../signupValidation';

type FieldActionButtonProps = {
  completed?: boolean;
  disabled?: boolean;
  onPress: () => void;
  title: string;
};

function FieldActionButton({
  completed = false,
  disabled = false,
  onPress,
  title,
}: FieldActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fieldAction,
        completed && styles.completedAction,
        disabled && styles.disabledAction,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.fieldActionText}>{title}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function SignupUserInfoScreen() {
  const router = useRouter();
  const { data, updateField } = useSignup();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordConfirmError, setPasswordConfirmError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [nicknameError, setNicknameError] = useState<string>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const isLocal = data.method === 'local';

  const hasValidLocalInfo =
    !getEmailError(data.email) &&
    !getPasswordError(data.password) &&
    !getPasswordConfirmError(data.password, data.passwordConfirm) &&
    !getPhoneError(data.phone) &&
    !getRequiredError(data.name, '이름을 입력해주세요.') &&
    !getRequiredError(data.nickname, '닉네임을 입력해주세요.') &&
    data.emailChecked &&
    data.phoneVerified;
  const hasValidKakaoInfo =
    !getRequiredError(data.name, '이름을 입력해주세요.') &&
    !getRequiredError(data.nickname, '닉네임을 입력해주세요.');
  const canContinue = isLocal ? hasValidLocalInfo : hasValidKakaoInfo;

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
          <View style={styles.fieldGroup}>
            <FieldLabel>이메일</FieldLabel>
            <View style={styles.fieldRow}>
              <AppInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                containerStyle={styles.flexField}
                error={emailError}
                keyboardType="email-address"
                leftElement={
                  <AppIcon color={COLORS.gray500} name="mail-outline" size={22} />
                }
                onBlur={() => setEmailError(getEmailError(data.email))}
                onChangeText={(value) => {
                  updateField('email', value);
                  updateField('emailChecked', false);
                  setEmailError(undefined);
                }}
                placeholder="example@email.com"
                textContentType="emailAddress"
                value={data.email}
              />
              <FieldActionButton
                completed={data.emailChecked}
                disabled={Boolean(getEmailError(data.email))}
                onPress={() => updateField('emailChecked', true)}
                title={data.emailChecked ? '확인완료' : '중복확인'}
              />
            </View>
          </View>

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

          <View style={styles.fieldGroup}>
            <FieldLabel>본인인증</FieldLabel>
            <View style={styles.fieldRow}>
              <AppInput
                autoComplete="tel"
                containerStyle={styles.flexField}
                error={phoneError}
                keyboardType="phone-pad"
                leftElement={
                  <AppIcon color={COLORS.gray500} name="call-outline" size={22} />
                }
                maxLength={13}
                onBlur={() => setPhoneError(getPhoneError(data.phone))}
                onChangeText={(value) => {
                  updateField('phone', formatPhone(value));
                  updateField('phoneVerified', false);
                  setPhoneError(undefined);
                }}
                placeholder="010-0000-0000"
                textContentType="telephoneNumber"
                value={data.phone}
              />
              <FieldActionButton
                completed={data.phoneVerified}
                disabled={Boolean(getPhoneError(data.phone))}
                onPress={() => updateField('phoneVerified', true)}
                title={data.phoneVerified ? '인증완료' : '인증하기'}
              />
            </View>
          </View>
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
  fieldGroup: {
    gap: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  fieldRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  flexField: {
    flex: 1,
    width: undefined,
  },
  fieldAction: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: SIZE.inputHeight,
    justifyContent: 'center',
    width: 100,
  },
  fieldActionText: {
    ...TYPOGRAPHY.button,
    color: COLORS.background,
  },
  completedAction: {
    backgroundColor: COLORS.success,
  },
  disabledAction: {
    opacity: 0.45,
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
  pressed: {
    opacity: 0.72,
  },
});
