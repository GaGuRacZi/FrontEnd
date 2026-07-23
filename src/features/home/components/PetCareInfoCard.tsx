import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetCareInfo } from '../types';

type PetCareInfoCardProps = {
  care: PetCareInfo;
};

type CareRowProps = {
  label: string;
  onPress: () => void;
  status: string;
  title: string;
};

function CareRow({ label, onPress, status, title }: CareRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconContainer} />

      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      <Pressable
        accessibilityLabel={`${status} 상세로 이동`}
        accessibilityRole="button"
        hitSlop={SPACING.md}
        onPress={onPress}
        style={({ pressed }) => [styles.statusRow, pressed && styles.pressed]}
      >
        <Text style={styles.statusText}>{status}</Text>
        <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

export function PetCareInfoCard({ care }: PetCareInfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>관리 정보</Text>
      <Text style={styles.cardDescription}>AI 성분 분석과 건강 추천에 연결돼요</Text>

      <View style={styles.list}>
          <CareRow
            label={care.surgeryHistoryLabel}
            onPress={() => {
              // TODO: 수술 이력 상세 화면 라우팅 연결
            }}
            status={care.surgeryHistoryStatus}
            title="수술 이력"
          />
          <CareRow
            label={care.managementAreaLabel}
            onPress={() => {
              // TODO: 관리 부위 상세 화면 라우팅 연결
            }}
            status={care.managementAreaStatus}
            title="관리 부위"
          />
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
    gap: SPACING.xs,
    padding: SPACING.xxl,
  },
  cardTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
  cardDescription: { ...TYPOGRAPHY.caption, color: COLORS.gray600, marginBottom: SPACING.md },
  list: { gap: SPACING.md },
  row: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.lg,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  textGroup: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  label: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  pressed: { opacity: 0.65 },
  statusText: { ...TYPOGRAPHY.label, color: COLORS.primary },
});