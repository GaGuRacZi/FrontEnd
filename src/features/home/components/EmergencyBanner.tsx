import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type EmergencyBannerProps = {
  onPress: () => void;
};

export function EmergencyBanner({ onPress }: EmergencyBannerProps) {
  return (
    <Pressable
      accessibilityLabel="긴급 수혈 헌혈 연결"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <View style={styles.iconContainer}>
        <AppIcon color={COLORS.redSoft} name="water" size={20} />
      </View>

      <View style={styles.textGroup}>
        <Text style={styles.title}>긴급 수혈 · 헌혈 연결</Text>
        <Text style={styles.subtitle}>혈액형과 체중 기준으로 헌혈 히어로를 찾아요</Text>
      </View>

      <AppIcon color={COLORS.background} name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
  },
  pressed: { opacity: 0.85 },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  textGroup: { flex: 1, gap: SPACING.xs },
  title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.background,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  subtitle: { ...TYPOGRAPHY.small, color: COLORS.background },
});