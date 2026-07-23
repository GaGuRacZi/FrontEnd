import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type AppButtonVariant =
  | 'danger'
  | 'ghost'
  | 'kakao'
  | 'outline'
  | 'primary'
  | 'secondary'
  | 'success';
type AppButtonSize = 'large' | 'medium';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  loading?: boolean;
  rightIcon?: ReactNode;
  size?: AppButtonSize;
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: AppButtonVariant;
};

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderWidth: 1,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  outline: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderWidth: 1,
  },
  kakao: {
    backgroundColor: COLORS.kakao,
  },
});

const textVariantStyles = StyleSheet.create({
  primary: {
    color: COLORS.background,
  },
  secondary: {
    color: COLORS.black,
  },
  success: {
    color: COLORS.background,
  },
  danger: {
    color: COLORS.background,
  },
  outline: {
    color: COLORS.black,
  },
  ghost: {
    color: COLORS.gray600,
  },
  kakao: {
    color: COLORS.black,
  },
});

export function AppButton({
  accessibilityLabel,
  accessibilityState,
  disabled = false,
  fullWidth = true,
  leftIcon,
  loading = false,
  rightIcon,
  size = 'large',
  style,
  title,
  variant = 'primary',
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const indicatorColor =
    variant === 'primary' || variant === 'success' || variant === 'danger'
      ? COLORS.background
      : COLORS.black;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: loading,
        disabled: isDisabled,
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.medium,
        variant !== 'ghost' && variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text
            numberOfLines={1}
            style={[
              styles.text,
              variant === 'kakao' && styles.kakaoText,
              textVariantStyles[variant],
            ]}
          >
            {title}
          </Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  large: {
    height: SIZE.buttonHeight,
  },
  medium: {
    height: SIZE.buttonMediumHeight,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...TYPOGRAPHY.button,
    textAlign: 'center',
  },
  kakaoText: {
    ...TYPOGRAPHY.kakaoButton,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.78,
  },
});
