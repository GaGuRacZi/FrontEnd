import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AppChipProps = {
  label: string;
  minWidth?: number;
  onPress?: () => void;
  selected?: boolean;
  size?: 'medium' | 'small';
};

export function AppChip({
  label,
  minWidth,
  onPress,
  selected = false,
  size = 'medium',
}: AppChipProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      disabled={!onPress}
      hitSlop={onPress ? SPACING.lg : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'small' ? styles.small : styles.medium,
        minWidth ? { minWidth } : undefined,
        selected && styles.selectedChip,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  small: {
    height: 26,
  },
  medium: {
    height: 32,
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.segment,
    color: COLORS.gray600,
  },
  selectedLabel: {
    color: COLORS.background,
    fontFamily: TYPOGRAPHY.segmentActive.fontFamily,
  },
  pressed: {
    opacity: 0.7,
  },
});
