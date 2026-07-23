import { Image, StyleSheet, Text, View } from 'react-native';

import { AppChip, AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetDetail } from '../types';

type PetDetailProfileCardProps = {
  pet: PetDetail;
};

export function PetDetailProfileCard({ pet }: PetDetailProfileCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.profileRow}>
        {pet.photoUrl ? (
            <Image source={{ uri: pet.photoUrl }} style={styles.photo} />
        ) : (
            <View style={styles.photoPlaceholder}>
                <AppIcon color={COLORS.primary} name="paw" size={20} />
            </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name}>{pet.name}</Text>
          <View style={styles.chipRow}>
            <AppChip label={pet.speciesLabel} size="small" />
            <AppChip label={pet.breedLabel} size="small" />
          </View>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>나이</Text>
          <Text style={styles.metricValue}>{pet.ageLabel}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>몸무게</Text>
          <Text style={[styles.metricValue, styles.weightValue]}>{pet.weightLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.button,
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  photo: { borderRadius: RADIUS.round, height: 64, width: 64 },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  photoPlaceholderText: { ...TYPOGRAPHY.title2, color: COLORS.primary },
  info: { gap: 8 },
  name: { ...TYPOGRAPHY.title1, color: COLORS.black },
  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  metricRow: { flexDirection: 'row', gap: SPACING.xl },
  metricBox: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    flex: 1,
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
  },
  metricLabel: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
  metricValue: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  weightValue: { color: COLORS.primary },
});