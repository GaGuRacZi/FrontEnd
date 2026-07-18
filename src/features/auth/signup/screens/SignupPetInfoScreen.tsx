import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { SelectionButton } from '@/src/components/form/SelectionButton';
import { AppModal } from '@/src/components/modal/AppModal';
import { COLORS, LAYOUT, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';
import {
  formatBirthDate,
  formatBirthDateValue,
  getBirthDateError,
  getRequiredError,
  getWeightError,
  parseBirthDate,
} from '../signupValidation';

export function SignupPetInfoScreen() {
  const router = useRouter();
  const { data, updateField } = useSignup();
  const [nameError, setNameError] = useState<string>();
  const [birthDateError, setBirthDateError] = useState<string>();
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pendingBirthDate, setPendingBirthDate] = useState(
    () => parseBirthDate(data.birthDate) ?? new Date(),
  );
  const [weightError, setWeightError] = useState<string>();

  const canContinue =
    !getRequiredError(data.petName, '이름을 입력해주세요.') &&
    !getBirthDateError(data.birthDate) &&
    !getWeightError(data.weight) &&
    data.petGender !== null &&
    data.neutered !== null;

  const selectBirthDate = (date: Date) => {
    updateField('birthDate', formatBirthDateValue(date));
    setBirthDateError(undefined);
  };

  const handleAndroidDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) {
      selectBirthDate(date);
    }
  };

  const openCalendar = () => {
    const initialDate = parseBirthDate(data.birthDate) ?? new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        maximumDate: new Date(),
        mode: 'date',
        onChange: handleAndroidDateChange,
        value: initialDate,
      });
      return;
    }

    setPendingBirthDate(initialDate);
    setCalendarVisible(true);
  };

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={4}
      nextDisabled={!canContinue}
      onNext={() => router.push('/signup/location')}
      title={'우리 아이 정보를\n입력해주세요'}
    >
      <AppInput
        error={nameError}
        label="이름"
        maxLength={12}
        onBlur={() => setNameError(getRequiredError(data.petName, '이름을 입력해주세요.'))}
        onChangeText={(value) => {
          updateField('petName', value);
          setNameError(undefined);
        }}
        placeholder="반려동물 이름"
        size="compact"
        value={data.petName}
      />

      <AppInput
        error={birthDateError}
        keyboardType="number-pad"
        label="생년월일"
        maxLength={10}
        onBlur={() => setBirthDateError(getBirthDateError(data.birthDate))}
        onChangeText={(value) => {
          updateField('birthDate', formatBirthDate(value));
          setBirthDateError(undefined);
        }}
        placeholder="YYYY.MM.DD"
        rightElement={
          <Pressable
            accessibilityLabel="달력에서 생년월일 선택"
            accessibilityRole="button"
            hitSlop={8}
            onPress={openCalendar}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}
          >
            <AppIcon color={COLORS.black} name="calendar-clear-outline" size={22} />
          </Pressable>
        }
        size="compact"
        value={data.birthDate}
      />

      <AppInput
        error={weightError}
        keyboardType="decimal-pad"
        label="몸무게"
        maxLength={5}
        onBlur={() => setWeightError(getWeightError(data.weight))}
        onChangeText={(value) => {
          const normalized = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
          updateField('weight', normalized);
          setWeightError(undefined);
        }}
        placeholder="0.0"
        rightElement={<Text style={styles.unit}>kg</Text>}
        size="compact"
        value={data.weight}
      />

      <View style={styles.selectionGroup}>
        <Text style={styles.label}>성별</Text>
        <View accessibilityRole="radiogroup" style={styles.selectionRow}>
          <SelectionButton
            label="남아"
            onPress={() => updateField('petGender', 'male')}
            selected={data.petGender === 'male'}
            style={styles.selectionButton}
          />
          <SelectionButton
            label="여아"
            onPress={() => updateField('petGender', 'female')}
            selected={data.petGender === 'female'}
            style={styles.selectionButton}
          />
        </View>
      </View>

      <View style={styles.selectionGroup}>
        <Text style={styles.label}>중성화 여부</Text>
        <View accessibilityRole="radiogroup" style={styles.selectionRow}>
          <SelectionButton
            label="중성화 완료"
            onPress={() => updateField('neutered', true)}
            selected={data.neutered === true}
            style={styles.selectionButton}
          />
          <SelectionButton
            label="중성화 안함"
            onPress={() => updateField('neutered', false)}
            selected={data.neutered === false}
            style={styles.selectionButton}
          />
        </View>
      </View>

      {Platform.OS === 'ios' ? (
        <AppModal
          onClose={() => setCalendarVisible(false)}
          primaryAction={{
            label: '선택',
            onPress: () => {
              selectBirthDate(pendingBirthDate);
              setCalendarVisible(false);
            },
          }}
          secondaryAction={{
            label: '취소',
            onPress: () => setCalendarVisible(false),
          }}
          title="생년월일 선택"
          variant="center"
          visible={calendarVisible}
        >
          <DateTimePicker
            accentColor={COLORS.primary}
            display="inline"
            locale="ko-KR"
            maximumDate={new Date()}
            mode="date"
            onChange={(_, date) => date && setPendingBirthDate(date)}
            themeVariant="light"
            value={pendingBirthDate}
          />
        </AppModal>
      ) : null}
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING.xxl,
    marginTop: 36,
  },
  unit: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
  },
  calendarButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  selectionGroup: {
    gap: SPACING.xl,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: 36,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
  },
  selectionButton: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
