import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type AppCheckboxLabelProps =
  | { accessibilityLabel: string; label?: string }
  | { accessibilityLabel?: string; label: string };

type AppCheckboxProps = AppCheckboxLabelProps & {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function AppCheckbox({
  accessibilityLabel,
  checked,
  disabled = false,
  label,
  onChange,
}: AppCheckboxProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.box, checked && styles.checkedBox]}>
        {checked ? <AppIcon color={COLORS.background} name="checkmark" size={16} /> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: SIZE.touchTarget,
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
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
