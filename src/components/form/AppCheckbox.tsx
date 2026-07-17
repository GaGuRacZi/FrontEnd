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
  size?: 'medium' | 'small';
};

export function AppCheckbox({
  accessibilityLabel,
  checked,
  disabled = false,
  label,
  onChange,
  size = 'medium',
}: AppCheckboxProps) {
  const isSmall = size === 'small';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={isSmall ? 12 : undefined}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.container,
        isSmall ? styles.smallContainer : styles.mediumContainer,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.box, isSmall && styles.smallBox, checked && styles.checkedBox]}>
        {checked ? (
          <AppIcon color={COLORS.background} name="checkmark" size={isSmall ? 12 : 16} />
        ) : null}
      </View>
      {label ? <Text style={[styles.label, isSmall && styles.smallLabel]}>{label}</Text> : null}
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
