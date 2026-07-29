import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { BLOOD_TYPES } from '../petValidation';
import type { PetType } from '../types';

type PetBloodTypeModalProps = {
  onClose: () => void;
  onSelect: (bloodType: string | null) => void;
  petType: PetType;
  selectedBloodType: string | null;
  visible: boolean;
};

export function PetBloodTypeModal({
  onClose,
  onSelect,
  petType,
  selectedBloodType,
  visible,
}: PetBloodTypeModalProps) {
  const options: (string | null)[] = [null, ...BLOOD_TYPES[petType]];

  return (
    <AppModal
      animateSheetOnly
      initialHeight={400}
      onClose={onClose}
      title="혈액형 선택"
      visible={visible}
    >
      <Text style={styles.description}>모르는 경우 선택하지 않아도 괜찮아요.</Text>
      <View style={styles.options}>
        {options.map((bloodType) => {
          const selected = bloodType === selectedBloodType;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={bloodType ?? 'none'}
              onPress={() => {
                onSelect(bloodType);
                onClose();
              }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.selectedOption,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.selectedText]}>
                {bloodType ?? '선택 안 함'}
              </Text>
              {selected ? (
                <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  options: {
    gap: SPACING.md,
  },
  option: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
  },
  selectedOption: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.sub,
  },
  optionText: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
  },
  selectedText: {
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.65,
  },
});
