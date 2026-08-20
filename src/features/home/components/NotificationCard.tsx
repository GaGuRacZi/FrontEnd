import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { NotificationCategory, NotificationItem } from '../types';

type NotificationCardProps = {
  actionLabel?: string | null;
  notification: NotificationItem;
  onPress: () => void;
};

const CATEGORY_META: Record < NotificationCategory,
  { chipColor: string; chipTint: string; icon: ImageSourcePropType; iconSize: number; iconTint: string }
> = {
  schedule: {
    icon: require('../../../../assets/images/home/pill.png'),
    iconSize: 20,
    iconTint: COLORS.primarySoft,
    chipTint: COLORS.primarySoft,
    chipColor: COLORS.primary,
  },
  ai: {
    icon: require('../../../../assets/images/paw-logo.png'),
    iconSize: 30,
    iconTint: COLORS.cream,
    chipTint: COLORS.cream,
    chipColor: COLORS.primary,
  },
  chat: {
    icon: require('../../../../assets/images/home/notification/chat.png'),
    iconSize: 20,
    iconTint: COLORS.communityback,
    chipTint: COLORS.communityback,
    chipColor: COLORS.community,
  },
  community: {
    icon: require('../../../../assets/images/home/notification/chat.png'),
    iconSize: 20,
    iconTint: COLORS.communityback,
    chipTint: COLORS.communityback,
    chipColor: COLORS.community,
  },
  emergency: {
    icon: require('../../../../assets/images/home/notification/blood.png'),
    iconSize: 20,
    iconTint: COLORS.bloodbackground,
    chipTint: COLORS.bloodbackground,
    chipColor: COLORS.error,
  },
};

export function NotificationCard({ actionLabel, notification, onPress }: NotificationCardProps) {
  const meta = CATEGORY_META[notification.category];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconContainer, { backgroundColor: meta.iconTint }]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={meta.icon}
          style={[styles.icon, { height: meta.iconSize, width: meta.iconSize }]}
        />
      </View>

      <View style={styles.textGroup}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: meta.chipTint }]}>
            <Text numberOfLines={1} style={[styles.chipText, { color: meta.chipColor }]}>
              {notification.categoryLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{notification.title}</Text>
        <Text numberOfLines={1} style={styles.description}>
          {notification.description}
        </Text>
      </View>

      <View style={styles.rightColumn}>
        <View style={[styles.unreadDot, notification.isRead && styles.unreadDotHidden]} />
        <View style={styles.actionRow}>
          {actionLabel ? <Text numberOfLines={1} style={styles.actionLabel}>{actionLabel}</Text> : null}
          <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
        </View>
        <Text style={styles.time}>{notification.timeLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  pressed: { opacity: 0.7 },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  icon: {},
  textGroup: { flex: 1 },
  chipRow: { flexDirection: 'row' },
  chip: {
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 2,
  },
  chipText: { ...TYPOGRAPHY.caption, fontFamily: TYPOGRAPHY.button.fontFamily },
  title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    marginTop: SPACING.xs,
  },
  description: { ...TYPOGRAPHY.caption, color: COLORS.gray600, marginTop: 2 },
  unreadDot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 7,
    width: 7,
  },
  unreadDotHidden: { opacity: 0 },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: 2, maxWidth: 88 },
  actionLabel: { ...TYPOGRAPHY.caption, color: COLORS.primary },
  time: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
  rightColumn: { alignItems: 'flex-end', gap: SPACING.sm },
});
