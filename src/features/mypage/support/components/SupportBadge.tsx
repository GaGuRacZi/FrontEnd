import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { getSupportBadgeLabel, type SupportBadgeKind } from '../supportValidation';

export function SupportBadge({ kind }: { kind: SupportBadgeKind }) {
  return (
    <View
      accessibilityLabel={getSupportBadgeLabel(kind)}
      accessibilityRole="text"
      accessible
      style={[
        styles.badge,
        kind === 'answered' && styles.answered,
        kind === 'important' && styles.important,
        kind === 'new' && styles.new,
        kind === 'waiting' && styles.waiting,
      ]}
    >
      <Text
        style={[
          styles.label,
          kind === 'answered' && styles.answeredLabel,
          kind === 'important' && styles.importantLabel,
          kind === 'new' && styles.newLabel,
          kind === 'waiting' && styles.waitingLabel,
        ]}
      >
        {getSupportBadgeLabel(kind)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  label: {
    ...TYPOGRAPHY.smallButton,
  },
  answered: {
    backgroundColor: COLORS.gray100,
  },
  answeredLabel: {
    color: COLORS.success,
  },
  important: {
    backgroundColor: COLORS.yellow,
  },
  importantLabel: {
    color: COLORS.gray800,
  },
  new: {
    backgroundColor: COLORS.primarySoft,
  },
  newLabel: {
    color: COLORS.primary,
  },
  waiting: {
    backgroundColor: COLORS.gray100,
  },
  waitingLabel: {
    color: COLORS.gray600,
  },
});
