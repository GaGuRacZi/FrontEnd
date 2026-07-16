import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

type LoadingViewProps = {
  label?: string;
};

export function LoadingView({ label = '불러오는 중이에요' }: LoadingViewProps) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <ActivityIndicator color={COLORS.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.xxl,
    justifyContent: 'center',
    padding: SPACING.xxxl,
  },
  label: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
