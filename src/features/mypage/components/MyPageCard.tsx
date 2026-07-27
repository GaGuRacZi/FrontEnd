import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type MyPageCardProps = {
  children: ReactNode;
  title?: string;
};

type MyPageRowProps = {
  description?: string;
  iconName?: AppIconName;
  onPress?: () => void;
  rightElement?: ReactNode;
  title: string;
};

export function MyPageCard({ children, title }: MyPageCardProps) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function MyPageRow({
  description,
  iconName,
  onPress,
  rightElement,
  title,
}: MyPageRowProps) {
  const content = (
    <>
      {iconName ? (
        <View style={styles.iconCircle}>
          <AppIcon color={COLORS.primary} name={iconName} size={21} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        {description ? (
          <Text numberOfLines={1} style={styles.rowDescription}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightElement ?? (onPress ? <AppIcon name="chevron-forward" size={20} /> : null)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function MyPageDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.checkboxLabel,
    color: COLORS.black,
    marginBottom: SPACING.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
    minHeight: 52,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    lineHeight: 22,
  },
  rowDescription: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  },
  divider: {
    backgroundColor: COLORS.gray300,
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.65,
  },
});
