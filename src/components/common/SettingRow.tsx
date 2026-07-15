import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type SettingRowProps = {
  description?: string;
  icon?: ReactNode;
  onPress?: () => void;
  rightElement?: ReactNode;
  title: string;
  variant?: 'card' | 'plain';
};

export function SettingRow({
  description,
  icon,
  onPress,
  rightElement,
  title,
  variant = 'card',
}: SettingRowProps) {
  const content = (
    <>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <View style={styles.textContainer}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text numberOfLines={2} style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightElement ?? (onPress ? <AppIcon name="chevron-forward" size={20} /> : null)}
    </>
  );
  const rowStyle = [styles.row, variant === 'card' ? styles.card : styles.plain];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
    minHeight: SIZE.settingRowHeight,
    paddingHorizontal: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.button,
    borderWidth: 1,
  },
  plain: {
    minHeight: 52,
    paddingHorizontal: 0,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    lineHeight: 22,
  },
  description: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.65,
  },
});
