import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type SelectionButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SelectionButton({
  disabled = false,
  label,
  onPress,
  selected,
  style,
}: SelectionButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selectedButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: SIZE.touchTarget,
    paddingHorizontal: SPACING.xxl,
  },
  selectedButton: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.selection,
    color: COLORS.black,
  },
  selectedLabel: {
    ...TYPOGRAPHY.selectionActive,
    color: COLORS.primary,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
