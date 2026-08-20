import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetFormErrors } from '../petValidation';
import type { PetImageField } from '../services/petImageStorage';
import type { PetFormValues, PetType } from '../types';
import { PetAvatar } from './PetAvatar';
import {
  PetChoiceButton,
  PetInfoCard,
  PetInfoRow,
} from './PetInfoLayout';

type PetFormFieldsProps = {
  disabled?: boolean;
  errors: PetFormErrors;
  onBlur: (field: keyof PetFormErrors) => void;
  onChange: <K extends keyof PetFormValues>(field: K, value: PetFormValues[K]) => void;
  onOpenBreed: () => void;
  onOpenCalendar: () => void;
  onPickImage: (field: PetImageField) => void;
  onRemoveImage: (field: PetImageField) => void;
  values: PetFormValues;
};

function PickerField({
  accessibilityLabel,
  disabled = false,
  error,
  icon,
  onDisabledPress,
  onPress,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  error?: string;
  icon?: AppIconName;
  onDisabledPress?: () => void;
  onPress: () => void;
  placeholder: string;
  value?: string | null;
}) {
  return (
    <View style={styles.controlGroup}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={disabled ? onDisabledPress : onPress}
        style={({ pressed }) => [
          styles.picker,
          error && styles.errorBorder,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {icon ? (
          <View style={styles.pickerIcon}>
            <AppIcon color={COLORS.primary} name={icon} size={18} />
          </View>
        ) : null}
        <Text numberOfLines={1} style={[styles.pickerText, value && styles.pickerValue]}>
          {value || placeholder}
        </Text>
        <AppIcon color={COLORS.gray600} name="chevron-forward" size={19} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ProfilePhoto({
  disabled,
  name,
  onPick,
  onRemove,
  type,
  uri,
}: {
  disabled: boolean;
  name: string;
  onPick: () => void;
  onRemove: () => void;
  type: PetType | null;
  uri: string | null;
}) {
  return (
    <View style={styles.profileArea}>
      <Pressable
        accessibilityLabel={uri ? '프로필 사진 변경' : '프로필 사진 등록'}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPick}
        style={({ pressed }) => [
          styles.profileButton,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <PetAvatar pet={{ name, profileImageUri: uri, type }} size={102} />
        <View style={styles.cameraBadge}>
          <AppIcon color={COLORS.primary} name="camera-outline" size={18} />
        </View>
      </Pressable>
      {uri ? (
        <Pressable
          accessibilityLabel="프로필 사진 삭제"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={SPACING.md}
          onPress={onRemove}
          style={({ pressed }) => [disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.profileGuide}>사진 삭제</Text>
        </Pressable>
      ) : (
        <Text style={styles.profileGuide}>사진은 언제든 추가하거나 변경할 수 있어요</Text>
      )}
    </View>
  );
}

export function PetFormFields({
  disabled = false,
  errors,
  onBlur,
  onChange,
  onOpenBreed,
  onOpenCalendar,
  onPickImage,
  onRemoveImage,
  values,
}: PetFormFieldsProps) {
  return (
    <View style={styles.form}>
      <ProfilePhoto
        disabled={disabled}
        name={values.name}
        onPick={() => onPickImage('profileImageUri')}
        onRemove={() => onRemoveImage('profileImageUri')}
        type={values.type}
        uri={values.profileImageUri}
      />

      <PetInfoCard
        description="반려동물 프로필에 표시되는 기본 정보예요"
        minHeight={362}
        required
        title="기본 정보"
      >
        <PetInfoRow label="종류">
          <View accessibilityRole="radiogroup" style={styles.choiceRow}>
            <PetChoiceButton
              disabled={disabled}
              label="강아지"
              onPress={() => onChange('type', 'dog')}
              selected={values.type === 'dog'}
            />
            <PetChoiceButton
              disabled={disabled}
              label="고양이"
              onPress={() => onChange('type', 'cat')}
              selected={values.type === 'cat'}
            />
          </View>
          {errors.type ? <Text style={styles.errorText}>{errors.type}</Text> : null}
        </PetInfoRow>

        <PetInfoRow label="이름">
          <AppInput
            editable={!disabled}
            error={errors.name}
            maxLength={20}
            onBlur={() => onBlur('name')}
            onChangeText={(value) => onChange('name', value)}
            placeholder="예: 루이"
            size="compact"
            value={values.name}
          />
        </PetInfoRow>

        <PetInfoRow label="품종">
          <PickerField
            accessibilityLabel="견종 또는 묘종 선택"
            disabled={disabled || !values.type}
            error={errors.breed}
            onDisabledPress={disabled ? undefined : () => onBlur('type')}
            onPress={onOpenBreed}
            placeholder="종류를 먼저 선택해주세요"
            value={values.breed}
          />
        </PetInfoRow>

        <PetInfoRow label="생년월일">
          <AppInput
            editable={!disabled}
            error={errors.birthDate}
            keyboardType="number-pad"
            maxLength={10}
            onBlur={() => onBlur('birthDate')}
            onChangeText={(value) => onChange('birthDate', value)}
            placeholder="YYYY.MM.DD"
            rightElement={
              <Pressable
                accessibilityLabel="달력에서 생년월일 선택"
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={SPACING.md}
                onPress={onOpenCalendar}
                style={({ pressed }) => [styles.inlineIconButton, pressed && styles.pressed]}
              >
                <AppIcon color={COLORS.black} name="calendar-clear-outline" size={20} />
              </Pressable>
            }
            size="compact"
            value={values.birthDate}
          />
        </PetInfoRow>

        <PetInfoRow label="몸무게">
          <View style={styles.weightRow}>
            <AppInput
              containerStyle={styles.weightInput}
              editable={!disabled}
              error={errors.weight}
              keyboardType="decimal-pad"
              maxLength={6}
              onBlur={() => onBlur('weight')}
              onChangeText={(value) => onChange('weight', value)}
              placeholder="0.0"
              size="compact"
              value={values.weight}
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
        </PetInfoRow>
      </PetInfoCard>

      <PetInfoCard
        description="성별과 중성화 여부를 기록해요"
        minHeight={180}
        title="성별 정보"
      >
        <PetInfoRow label="성별" required>
          <View accessibilityRole="radiogroup" style={styles.choiceRow}>
            <PetChoiceButton
              compact
              disabled={disabled}
              label="남아"
              onPress={() => onChange('gender', 'male')}
              selected={values.gender === 'male'}
            />
            <PetChoiceButton
              compact
              disabled={disabled}
              label="여아"
              onPress={() => onChange('gender', 'female')}
              selected={values.gender === 'female'}
            />
          </View>
          {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
        </PetInfoRow>

        <PetInfoRow label="중성화" required>
          <View accessibilityRole="radiogroup" style={styles.choiceRow}>
            <PetChoiceButton
              compact
              disabled={disabled}
              label="완료"
              onPress={() => onChange('neutered', true)}
              selected={values.neutered === true}
            />
            <PetChoiceButton
              compact
              disabled={disabled}
              label="안 함"
              onPress={() => onChange('neutered', false)}
              selected={values.neutered === false}
            />
          </View>
          {errors.neutered ? <Text style={styles.errorText}>{errors.neutered}</Text> : null}
        </PetInfoRow>
      </PetInfoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
  profileArea: {
    alignItems: 'center',
    height: 148,
    justifyContent: 'center',
  },
  profileButton: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: 102,
    justifyContent: 'center',
    width: 102,
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    bottom: -2,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    width: 36,
  },
  profileGuide: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
    marginTop: SPACING.md,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlGroup: {
    flex: 1,
  },
  picker: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 13,
  },
  pickerText: {
    ...TYPOGRAPHY.input,
    color: COLORS.gray500,
    flex: 1,
  },
  pickerValue: {
    color: COLORS.black,
  },
  pickerIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 28,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: 28,
  },
  inlineIconButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 30,
  },
  weightRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  weightInput: {
    flex: 1,
  },
  weightUnit: {
    ...TYPOGRAPHY.input,
    color: COLORS.gray800,
    paddingTop: 11,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  errorBorder: {
    borderColor: COLORS.error,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.68,
  },
});
