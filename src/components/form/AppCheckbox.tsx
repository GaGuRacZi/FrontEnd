import type { StyleProp, TextStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type AppCheckboxLabelProps =
  | { accessibilityLabel: string; label?: string }
  | { accessibilityLabel?: string; label: string };

type AppCheckboxProps = AppCheckboxLabelProps & {
  checked: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  indeterminate?: boolean;
  labelPosition?: 'left' | 'right';
  labelStyle?: StyleProp<TextStyle>;
  onChange: (checked: boolean) => void;
  size?: 'medium' | 'small';
};

export function AppCheckbox({
  accessibilityLabel,
  checked,
  disabled = false,
  fullWidth = false,
  indeterminate = false,
  label,
  labelPosition = 'right',
  labelStyle,
  onChange,
  size = 'medium',
}: AppCheckboxProps) {
  const isSmall = size === 'small';
  const isMarked = checked || indeterminate;
  const checkbox = (
    <View style={[styles.box, isSmall && styles.smallBox, isMarked && styles.checkedBox]}>
      {isMarked ? (
        <AppIcon
          color={COLORS.background}
          name={indeterminate ? 'remove' : 'checkmark'}
          size={isSmall ? 12 : 16}
        />
      ) : null}
    </View>
  );
  const checkboxLabel = label ? (
    <Text style={[styles.label, isSmall && styles.smallLabel, labelStyle]}>{label}</Text>
  ) : null;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      disabled={disabled}
      hitSlop={isSmall ? 12 : undefined}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.container,
        isSmall ? styles.smallContainer : styles.mediumContainer,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {labelPosition === 'left' ? checkboxLabel : checkbox}
      {labelPosition === 'left' ? checkbox : checkboxLabel}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  mediumContainer: {
    minHeight: SIZE.touchTarget,
  },
  fullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  smallContainer: {
    minHeight: SIZE.checkboxSmall,
  },
  box: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    height: SIZE.checkbox,
    justifyContent: 'center',
    width: SIZE.checkbox,
  },
  smallBox: {
    borderRadius: 0,
    height: SIZE.checkboxSmall,
    width: SIZE.checkboxSmall,
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    flexShrink: 1,
  },
  smallLabel: {
    ...TYPOGRAPHY.checkboxLabel,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
