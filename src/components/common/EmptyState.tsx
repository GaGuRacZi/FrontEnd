import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';

type EmptyStateProps = {
  actionLabel?: string;
  description?: string;
  icon?: ReactNode;
  onActionPress?: () => void;
  title: string;
};

export function EmptyState({
  actionLabel,
  description,
  icon,
  onActionPress,
  title,
}: EmptyStateProps) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <View style={styles.iconContainer}>
        {icon ?? <AppIcon color={COLORS.primary} name="paw-outline" size={30} />}
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onActionPress ? (
        <AppButton
          fullWidth={false}
          onPress={onActionPress}
          size="medium"
          style={styles.action}
          title={actionLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xxxl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: SPACING.md,
    width: 56,
  },
  title: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  action: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxxl,
  },
});
