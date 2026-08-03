import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';
import {
  getRequiredError,
  hasValidSignupProfileInfo,
} from '../signupValidation';

export function SignupUserInfoScreen() {
  const router = useRouter();
  const { data, updateField } = useSignup();
  const [nameError, setNameError] = useState<string>();
  const [nicknameError, setNicknameError] = useState<string>();
  const isLocal = data.method === 'local';
  const canContinue = hasValidSignupProfileInfo(data);

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={2}
      nextDisabled={!canContinue}
      onNext={() => router.push('/signup/location')}
      title={'보호자(회원) 정보를\n입력해주세요'}
    >
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
