import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { MonthlyHealthMetric } from '../types';

type MonthlyHealthSummaryCardProps = {
  metrics: readonly MonthlyHealthMetric[];
  onPressMore: () => void;
};

const METRIC_COLOR_META: Record<string, string> = {
  weight: COLORS.redSoft,
  walk: COLORS.green,
  medical: COLORS.primary,
};

export function MonthlyHealthSummaryCard({ metrics, onPressMore }: MonthlyHealthSummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <AppIcon color={COLORS.primary} name="stats-chart" size={14} />
          </View>
          <Text style={styles.headerTitle}>이번 달 건강 요약</Text>
        </View>

        <Pressable
          accessibilityLabel="건강 요약 더보기"
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={onPressMore}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.moreLabel}>더보기</Text>
        </Pressable>
      </View>

      <View style={styles.metricRow}>
        {metrics.map((metric) => (
          <View key={metric.id} style={styles.metricColumn}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.valueLabel}</Text>
            <Text style={[styles.metricChange, { color: METRIC_COLOR_META[metric.id] ?? COLORS.gray600 }]}>
              {metric.changeLabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.sm,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  headerTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
  moreLabel: { ...TYPOGRAPHY.label, color: COLORS.gray600 },
  pressed: { opacity: 0.65 },
  metricRow: { flexDirection: 'row' },
  metricColumn: { alignItems: 'center', flex: 1, gap: SPACING.xs },
  metricLabel: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
  metricValue: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  metricChange: { ...TYPOGRAPHY.caption, fontFamily: TYPOGRAPHY.button.fontFamily },

});