import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { RecentDiagnosis } from '../types';

type RecentDiagnosisCardProps = {
  diagnosis: RecentDiagnosis;
  onPress: () => void;
};

export function RecentDiagnosisCard({ diagnosis, onPress }: RecentDiagnosisCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../../../assets/images/home/diagnosis.png')}
              style={styles.Icon}
            />
          </View>
          <Text style={styles.label}>최근 진료</Text>
        </View>
        <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
      </View>

      <Text numberOfLines={1} style={styles.title}>{diagnosis.title}</Text>

      <Text style={styles.badgeText}>{diagnosis.statusLabel}</Text>


      <Text numberOfLines={1} style={styles.nextVisit}>
        {diagnosis.nextVisitLabel ?? '예약 없음'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    flex: 1,
    gap: SPACING.xs,
    padding: SPACING.xl,
  },
  pressed: { opacity: 0.7 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  Icon: { height: 18, width: 18 },
  label: { ...TYPOGRAPHY.checkboxLabel, color: COLORS.black },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 2,
  },
  badgeText: { ...TYPOGRAPHY.caption, color: COLORS.black },
  nextVisit: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: SPACING.xs },
});