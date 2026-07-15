import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { AppIcon, type AppIconName } from './AppIcon';

type AppToastProps = {
  icon?: AppIconName;
  message?: string;
  onPress?: () => void;
  title: string;
  visible: boolean;
};

export function AppToast({
  icon = 'notifications-outline',
  message,
  onPress,
  title,
  visible,
}: AppToastProps) {
  if (!visible) {
    return null;
  }

  const content = (
    <>
      <View style={styles.iconContainer}>
        <AppIcon color={COLORS.background} name={icon} size={22} />
      </View>
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {message ? (
          <Text numberOfLines={2} style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="alert" style={styles.container}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.toastBackground,
    borderRadius: RADIUS.toast,
    flexDirection: 'row',
    gap: SPACING.lg,
    minHeight: 66,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SPACING.lg,
    height: SIZE.toastIcon,
    justifyContent: 'center',
    width: SIZE.toastIcon,
  },
  content: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.segmentActive,
    color: COLORS.black,
  },
  message: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
  },
  pressed: {
    opacity: 0.72,
  },
});
