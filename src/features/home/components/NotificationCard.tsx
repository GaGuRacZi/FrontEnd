import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { NotificationCategory, NotificationItem } from '../types';

type NotificationCardProps = {
  notification: NotificationItem;
  onPress: () => void;
};

const CATEGORY_META: Record <NotificationCategory,
  { chipColor: string; chipTint: string; icon: ImageSourcePropType; iconSize: number; iconColor: string; iconTint: string }
> = {
  schedule: {
    icon: require('../../../../assets/images/home/pill.png'),
    iconSize: 20,
    iconColor: COLORS.primary,
    iconTint: COLORS.primarySoft,
    chipTint: COLORS.primarySoft,
    chipColor: COLORS.primary,
  },
  ai: {
    icon: require('../../../../assets/images/paw-logo.png'),
    iconSize: 30,
    iconColor: COLORS.primary,
    iconTint: COLORS.cream,
    chipTint: COLORS.cream,
    chipColor: COLORS.primary,
  },
  community: {
    icon: require('../../../../assets/images/home/notification/chat.png'),
    iconSize: 20,
    iconColor: COLORS.community,
    iconTint: COLORS.communityback,
    chipTint: COLORS.communityback,
    chipColor: COLORS.community,
  },
  'blood-donation': {
    icon: require('../../../../assets/images/home/notification/blood.png'),
    iconSize: 20,
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
      <View style={[styles.iconContainer, { backgroundColor: meta.iconTint }]}>
        <Image
          accessibilityIgnoresInvertColors
          source={meta.icon}
          style={[styles.Icon, { height: meta.iconSize, width: meta.iconSize }]}
        />
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

      <View style={styles.rightColumn}>
        <View style={[styles.unreadDot, notification.isRead && styles.unreadDotHidden]} />
        <View style={styles.rightMiddle}>
          <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
        </View>
        <Text style={styles.time}>{notification.timeLabel}</Text>
      </View> 
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'stretch',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    position: 'relative',
  },
  pressed: { opacity: 0.7 },
  unreadDot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 7,
    width: 7,
    marginRight: 3,

  },
  unreadDotHidden: { opacity: 0 },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  Icon: { resizeMode: 'contain' },
  textGroup: { flex: 1, gap: SPACING.xs },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 2,
  },
  chipText: { ...TYPOGRAPHY.caption, fontFamily: TYPOGRAPHY.button.fontFamily },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  description: { ...TYPOGRAPHY.caption, color: COLORS.gray600 },
  time: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
  rightColumn: { alignItems: 'flex-end', justifyContent: 'space-between' },
  rightMiddle: { alignItems: 'flex-end', flex: 1, justifyContent: 'center' },
});