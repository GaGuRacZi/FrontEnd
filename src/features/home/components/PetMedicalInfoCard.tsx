import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetDetail } from '../types';

type PetMedicalInfoCardProps = {
  pet: PetDetail;
};

export function PetMedicalInfoCard({ pet }: PetMedicalInfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>성별·의료 정보</Text>
      <Text style={styles.description}>헌혈 매칭과 병원 기록에 활용돼요</Text>

      <View style={styles.row}>
        <View style={styles.metricBox}>
          <Text style={styles.label}>성별</Text>
          <Text style={styles.value}>{pet.gender}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.label}>중성화</Text>
          <Text
            style={[styles.value, pet.neuterStatus === '완료' ? styles.positive : styles.neutral]}
          >
            {pet.neuterStatus}
          </Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.label}>헌혈여부</Text>
          <Text
            style={[
              styles.value,
              pet.bloodDonationStatus === '등록' ? styles.positive : styles.negative,
            ]}
          >
            {pet.bloodDonationStatus}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.xxl,
    },
    title: { ...TYPOGRAPHY.title3, color: COLORS.black },
    description: { ...TYPOGRAPHY.caption, color: COLORS.gray600, marginBottom: SPACING.md },
    row: { flexDirection: 'row', gap: SPACING.md },   // gap 추가
    metricBox: {
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderColor: COLORS.gray300,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        flex: 1,
        gap: SPACING.xs,
        paddingVertical: SPACING.lg,
    },
    label: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
    value: { ...TYPOGRAPHY.body1, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
    positive: { color: COLORS.green },
    negative: { color: COLORS.redSoft },
    neutral: { color: COLORS.black },
});