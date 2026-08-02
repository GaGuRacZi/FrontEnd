import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { MedicationSummaryItem } from '../types';

type MedicationSummaryCardProps = {
  medications: readonly MedicationSummaryItem[];
  onPress: () => void;
};

export function MedicationSummaryCard({ medications, onPress }: MedicationSummaryCardProps) {
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
              source={require('../../../../assets/images/home/pill.png')}
              style={styles.Icon}
            />
          </View>  
          <Text style={styles.label}>복약 목록</Text>
        </View>
        <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
      </View>

      <View style={styles.list}>
        {medications.map((medication) => (
          <Text key={medication.id} numberOfLines={1} style={styles.item}>
            {medication.name}      {medication.doseLabel}
          </Text>
        ))}
      </View>
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
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  Icon: { height: 14, width: 14 },
  label: { ...TYPOGRAPHY.checkboxLabel, color: COLORS.black },
  list: { gap: 2 },
  item: { ...TYPOGRAPHY.caption, color: COLORS.black },
});