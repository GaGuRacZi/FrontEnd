import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type LeftHeaderActionProps =
  | { leftAccessibilityLabel: string; onLeftPress: () => void }
  | { leftAccessibilityLabel?: string; onLeftPress?: undefined };

type RightHeaderActionProps =
  | { onRightPress: () => void; rightAccessibilityLabel: string }
  | { onRightPress?: undefined; rightAccessibilityLabel?: string };

type TopHeaderProps = {
  centerContent?: ReactNode;
  centerContentStyle?: StyleProp<ViewStyle>;
  leftContent?: ReactNode;
  leftDisabled?: boolean;
  leftIcon?: AppIconName;
  rightContent?: ReactNode;
  rightIcon?: AppIconName;
  style?: StyleProp<ViewStyle>;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
} & LeftHeaderActionProps &
  RightHeaderActionProps;

type HeaderActionProps =
  | { accessibilityLabel: string; icon?: AppIconName; onPress: () => void }
  | { accessibilityLabel?: undefined; icon?: AppIconName; onPress?: undefined };

function HeaderAction({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
}: HeaderActionProps & { disabled?: boolean }) {
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
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={SPACING.md}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={SIZE.headerIcon} />
    </Pressable>
  );
}

export function TopHeader({
  centerContent,
  centerContentStyle,
  leftAccessibilityLabel,
  leftContent,
  leftDisabled = false,
  leftIcon,
  onLeftPress,
  onRightPress,
  rightAccessibilityLabel,
  rightContent,
  rightIcon,
  style,
  title,
  titleStyle,
}: TopHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.sideContent}>
        {leftContent ??
          (onLeftPress ? (
            <HeaderAction
              accessibilityLabel={leftAccessibilityLabel}
              disabled={leftDisabled}
              icon={leftIcon}
              onPress={onLeftPress}
            />
          ) : (
            <HeaderAction icon={leftIcon} />
          ))}
      </View>

      <View
        pointerEvents={centerContent ? 'box-none' : 'none'}
        style={[styles.titleContainer, centerContentStyle]}
      >
        {centerContent ??
          (title ? (
            <Text numberOfLines={1} style={[styles.title, titleStyle]}>
              {title}
            </Text>
          ) : null)}
      </View>

      <View style={styles.sideContent}>
        {rightContent ??
          (onRightPress ? (
            <HeaderAction
              accessibilityLabel={rightAccessibilityLabel}
              icon={rightIcon}
              onPress={onRightPress}
            />
          ) : (
            <HeaderAction icon={rightIcon} />
          ))}
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
    borderRadius: RADIUS.lg,
    height: SIZE.touchTarget,
    justifyContent: 'center',
    width: SIZE.touchTarget,
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
