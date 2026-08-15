import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type ChatEntryButtonProps = {
  onPress: () => void;
  unreadCount: number;
};

export function ChatEntryButton({ onPress, unreadCount }: ChatEntryButtonProps) {
  return (
    <Pressable
      accessibilityLabel={unreadCount ? `채팅 열기, 읽지 않은 메시지 ${unreadCount}개` : '채팅 열기'}
      accessibilityRole="button"
      hitSlop={SPACING.md}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <AppIcon color={COLORS.black} name="chatbubble-outline" size={25} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    borderColor: COLORS.background,
    borderRadius: RADIUS.round,
    borderWidth: 1.5,
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  badgeText: {
    ...TYPOGRAPHY.small,
    color: COLORS.background,
    fontSize: 9,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.55,
  },
});
