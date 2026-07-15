import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type TopHeaderProps = {
  leftAccessibilityLabel?: string;
  leftContent?: ReactNode;
  leftIcon?: AppIconName;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  rightContent?: ReactNode;
  rightIcon?: AppIconName;
  style?: StyleProp<ViewStyle>;
  title?: string;
};

type HeaderActionProps = {
  accessibilityLabel?: string;
  icon?: AppIconName;
  onPress?: () => void;
};

function HeaderAction({ accessibilityLabel, icon, onPress }: HeaderActionProps) {
  if (!icon) {
    return <View style={styles.action} />;
  }

  if (!onPress) {
    return (
      <View style={styles.action}>
        <AppIcon name={icon} size={SIZE.headerIcon} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={SPACING.md}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={SIZE.headerIcon} />
    </Pressable>
  );
}

export function TopHeader({
  leftAccessibilityLabel,
  leftContent,
  leftIcon,
  onLeftPress,
  onRightPress,
  rightAccessibilityLabel,
  rightContent,
  rightIcon,
  style,
  title,
}: TopHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.sideContent}>
        {leftContent ?? (
          <HeaderAction
            accessibilityLabel={leftAccessibilityLabel}
            icon={leftIcon}
            onPress={onLeftPress}
          />
        )}
      </View>

      <View pointerEvents="none" style={styles.titleContainer}>
        {title ? (
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.sideContent}>
        {rightContent ?? (
          <HeaderAction
            accessibilityLabel={rightAccessibilityLabel}
            icon={rightIcon}
            onPress={onRightPress}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    height: SIZE.topHeaderHeight,
    justifyContent: 'space-between',
    position: 'relative',
  },
  action: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
    borderRadius: RADIUS.lg,
  },
  titleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 90,
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  sideContent: {
    zIndex: 1,
  },
});
