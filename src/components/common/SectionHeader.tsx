import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type SectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  title: string;
};

export function SectionHeader({ actionLabel, onActionPress, title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: SIZE.touchTarget,
  },
  title: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZE.touchTarget,
    minWidth: SIZE.touchTarget,
  },
  actionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.65,
  },
});
