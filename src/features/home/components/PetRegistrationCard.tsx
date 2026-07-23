import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetDetail } from '../types';

type PetRegistrationCardProps = {
  onPressGuardian: () => void;
  onPressPhoto: () => void;
  onPressRegistrationNumber: () => void;
  pet: PetDetail;
};

export function PetRegistrationCard({
  onPressGuardian,
  onPressPhoto,
  onPressRegistrationNumber,
  pet,
}: PetRegistrationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>동물등록증</Text>
      <Text style={styles.description}>등록증 정보를 사진과 함께 보관하세요</Text>

      <View style={styles.row}>
        <Pressable
          onPress={onPressGuardian}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
        >
          <Text style={styles.slotText}>{pet.guardianName ?? '보호자 미입력'}</Text>
        </Pressable>
        <Pressable
          onPress={onPressRegistrationNumber}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
        >
          <Text style={styles.slotText}>{pet.registrationNumber ?? '등록번호 없음'}</Text>
        </Pressable>
        <Pressable
          onPress={onPressPhoto}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
        >
          <Text style={styles.slotText}>{pet.hasRegistrationPhoto ? '사진 등록됨' : '사진 없음'}</Text>
        </Pressable>
      </View>

      <Text style={styles.caption}>병원 방문이나 실종 신고 상황에서 빠르게 확인할 수 있어요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    gap: SPACING.xs,
    padding: SPACING.xxl,
  },
  title: { ...TYPOGRAPHY.title3, color: COLORS.black },
  description: { ...TYPOGRAPHY.caption, color: COLORS.gray600, marginBottom: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  slot: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  pressed: { opacity: 0.7 },
  slotText: { ...TYPOGRAPHY.small, color: COLORS.gray600, textAlign: 'center' },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.gray500, marginTop: SPACING.sm },
});