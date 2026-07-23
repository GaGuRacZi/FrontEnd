import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { NotificationCategory, NotificationItem } from '../types';

type NotificationCardProps = {
  notification: NotificationItem;
  onPress: () => void;
};

const CATEGORY_META: Record <NotificationCategory,
  { chipColor: string; chipTint: string; icon: AppIconName; iconColor: string; iconTint: string }
> = {
  schedule: {
    icon: 'medkit-outline',
    iconColor: COLORS.primary,
    iconTint: COLORS.primarySoft,
    chipTint: COLORS.primarySoft,
    chipColor: COLORS.primary,
  },
  ai: {
    icon: 'sparkles-outline',
    iconColor: COLORS.primary,
    iconTint: COLORS.cream,
    chipTint: COLORS.cream,
    chipColor: COLORS.primary,
  },
  community: {
    icon: 'chatbubble-outline',
    iconColor: COLORS.community,
    iconTint: COLORS.communityback,
    chipTint: COLORS.communityback,
    chipColor: COLORS.community,
  },
  'blood-donation': {
    icon: 'water',
    iconColor: COLORS.redSoft,
    iconTint: COLORS.bloodbackground,
    chipTint: COLORS.bloodbackground,
    chipColor: COLORS.redSoft,
  },
};

export function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const meta = CATEGORY_META[notification.category];
 
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {!notification.isRead ? <View style={styles.unreadDot} /> : null}

      <View style={[styles.iconContainer, { backgroundColor: meta.iconTint }]}>
        <AppIcon color={meta.iconColor} name={meta.icon} size={18} />
      </View>

      <View style={styles.textGroup}>
        <View style={[styles.chip, { backgroundColor: meta.chipTint }]}>
          <Text style={[styles.chipText, { color: meta.chipColor }]}>
            {notification.categoryLabel}
          </Text>
        </View>

        <Text style={styles.title}>{notification.title}</Text>
        <Text numberOfLines={1} style={styles.description}>
          {notification.description}
        </Text>
      </View>

      <Text style={styles.time}>{notification.timeLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.xl,
    position: 'relative',
  },
  pressed: { opacity: 0.7 },
  unreadDot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 7,
    position: 'absolute',
    right: SPACING.lg,
    top: SPACING.lg,
    width: 7,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  textGroup: { flex: 1, gap: SPACING.xs },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 2,
  },
  chipText: { ...TYPOGRAPHY.caption, fontFamily: TYPOGRAPHY.button.fontFamily },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  description: { ...TYPOGRAPHY.caption, color: COLORS.gray600 },
  time: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
});