import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type ChatSafetyBannerProps = {
  compact?: boolean;
  onGuidePress?: () => void;
};

export function ChatSafetyBanner({ compact = false, onGuidePress }: ChatSafetyBannerProps) {
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.iconContainer}>
        <AppIcon color={COLORS.primary} name="shield-checkmark-outline" size={22} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{compact ? 'PAW 안전 채팅' : '안전한 PAW 채팅'}</Text>
        <Text numberOfLines={2} style={styles.description}>
          {compact
            ? '개인정보 공유 주의 · 전문의약품 거래 금지'
            : '거래·산책 약속은 앱 안에서 안전하게 남겨요.'}
        </Text>
      </View>
      {onGuidePress ? (
        <Pressable
          accessibilityLabel="안전 채팅 가이드 보기"
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={onGuidePress}
          style={({ pressed }) => [styles.guideButton, pressed && styles.pressed]}
        >
          <Text style={styles.guideText}>가이드</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.borderBlue,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 84,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  compactContainer: {
    minHeight: 64,
    paddingVertical: SPACING.sm,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  textContainer: {
    flex: 1,
    marginLeft: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  description: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    marginTop: SPACING.xxs,
  },
  guideButton: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  guideText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.6,
  },
});
