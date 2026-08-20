import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { ScreenLayout } from '@/src/components/layout';
import { MedicationSaveConfirmModal, MedicationSearchModal } from '@/src/components/modal';
import { COLORS, LAYOUT, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/src/constants';
import type { DiagnosisMedication, DiagnosisMedicationTiming } from '@/src/features/dashboard/types';
import { FREQUENCY_OPTIONS, TIMING_OPTIONS, type MedicationEntry } from '@/src/types/medication';

import { useMedicationStore } from '../MedicationStore';

const TIMING_CHIP_LABELS: Record<DiagnosisMedicationTiming, string> = {
  morning: '아침',
  lunch: '점심',
  dinner: '저녁',
  bedtime: '취침 전',
};

const ALL_TIMINGS: DiagnosisMedicationTiming[] = ['morning', 'lunch', 'dinner', 'bedtime'];

export function MedicationListScreen() {
  const { medications, addMedications } = useMedicationStore();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [saveConfirmVisible, setSaveConfirmVisible] = useState(false);

  const handleAddMedications = (selectedEntries: MedicationEntry[]) => {
    const newMedications: DiagnosisMedication[] = selectedEntries.map((entry, index) => {
      const freqLabel =
        FREQUENCY_OPTIONS.find((opt) => opt.value === entry.frequency)?.label ?? '';
      const timingLabel =
        TIMING_OPTIONS.find((opt) => opt.value === entry.timing)?.label ?? '';

      return {
        id: `med-list-${Date.now()}-${index}`,
        name: entry.name,
        dosageLabel: entry.ingredient ?? '',
        frequencyLabel: freqLabel,
        doseLabel: `${entry.quantity}정씩`,
        mealTimingLabel: timingLabel,
        timings: [],
        description: entry.description,
        warningNote: entry.warningNote,
      };
    });

    addMedications(newMedications);
    setSearchModalVisible(false);
    setSaveConfirmVisible(true);
  };

  return (
    <ScreenLayout
      headerVariant="auth"
      rightContent={
        <Pressable
          accessibilityLabel="약물 추가"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSearchModalVisible(true)}
          style={styles.editButton}
        >
          <Image
              resizeMode="contain"
              source={require('@/assets/images/Button.png')}
              style={{ height: 24, width: 24 }}
            />
        </Pressable>
      }
      title="복용 약물 목록"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* 배너 */}
        <View style={styles.banner}>
          <View pointerEvents="none" style={[styles.decoCircle, styles.decoCircleLarge]} />
          <View pointerEvents="none" style={[styles.decoCircle, styles.decoCircleSmall]} />
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerSub}>등록된 처방 약물</Text>
            <Text style={styles.bannerMain}>
              {'총 '}
              <Text style={styles.bannerCount}>{medications.length}가지</Text>
            </Text>
            <Text style={styles.bannerHint}>
              {'매일 빠짐없이 챙겨주세요 '}
              <Text style={{ fontFamily: undefined }}>🐾</Text>
            </Text>
          </View>
          {medications.length > 0 ? (
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>{medications.length}종 복용 중</Text>
            </View>
          ) : null}
        </View>

        {/* 약물 카드 목록 */}
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {'아직 등록된 약물이 없어요.\n우측 상단 버튼으로 추가해보세요.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {medications.map((med, index) => (
              <MedicationCard
                index={index}
                key={med.id}
                medication={med}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <MedicationSearchModal
        onClose={() => setSearchModalVisible(false)}
        onSubmit={handleAddMedications}
        visible={searchModalVisible}
      />

      <MedicationSaveConfirmModal
        onConfirm={() => setSaveConfirmVisible(false)}
        onDismiss={() => setSaveConfirmVisible(false)}
        visible={saveConfirmVisible}
      />
    </ScreenLayout>
  );
}

type MedicationCardProps = {
  index: number;
  medication: DiagnosisMedication;
};

function MedicationCard({ index, medication }: MedicationCardProps) {
  return (
    <View style={styles.card}>
      {/* 헤더: 번호 배지 + 이름/성분 + 복용 횟수 */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <View style={styles.nameGroup}>
            <Text style={styles.medName}>{medication.name}</Text>
            {medication.dosageLabel ? (
              <Text style={styles.medDosage}>{medication.dosageLabel}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.frequencyBadge}>
          <Text style={styles.frequencyText}>{medication.frequencyLabel}</Text>
        </View>
      </View>

      {/* 구분선 */}
      <View style={styles.divider} />

      {/* 복용량 · 식사 타이밍 */}
      <View style={styles.chipRow}>
        <DotChip label={medication.doseLabel} />
        <DotChip label={medication.mealTimingLabel} />
      </View>

      {/* 복용 시간대 칩 (항상 표시) */}
      <View style={styles.timeRow}>
        <AppIcon color={COLORS.gray500} name="time-outline" size={14} />
        <View style={styles.timeChips}>
          {ALL_TIMINGS.map((timing) => {
            const active = medication.timings.includes(timing);
            return (
              <View
                key={timing}
                style={[styles.timeChip, active && styles.timeChipActive]}
              >
                <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                  {TIMING_CHIP_LABELS[timing]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 주의사항 */}
      {medication.warningNote ? (
        <View style={styles.warningRow}>
          <AppIcon color={COLORS.danger} name="alert-circle-outline" size={13} />
          <Text style={styles.warningText}>{medication.warningNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DotChip({ label }: { label: string }) {
  return (
    <View style={styles.dotChip}>
      <View style={styles.dot} />
      <Text style={styles.dotChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── 화면 ───────────────────────────────────────────────
  scroll: {
    backgroundColor: COLORS.pageBackground,
    flex: 1,
  },
  content: {
    gap: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingTop: SPACING.xxl,
  },

  editButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  // ─── 배너 ───────────────────────────────────────────────
  banner: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 18,
  },
  decoCircle: {
    backgroundColor: COLORS.white10,
    borderRadius: RADIUS.round,
    position: 'absolute',
  },
  decoCircleLarge: { height: 100, right: 60, top: -30, width: 100 },
  decoCircleSmall: { bottom: -44, height: 90, right: 10, width: 90 },
  bannerLeft: { gap: 3 },
  bannerSub: { ...TYPOGRAPHY.caption, color: COLORS.white70 },
  bannerMain: { ...TYPOGRAPHY.title2, color: COLORS.background },
  bannerCount: { ...TYPOGRAPHY.title2, color: COLORS.background },
  bannerHint: { ...TYPOGRAPHY.small, color: COLORS.white70 },
  bannerBadge: {
    backgroundColor: COLORS.white20,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  bannerBadgeText: { ...TYPOGRAPHY.badge, color: COLORS.background },

  // ─── 목록 ───────────────────────────────────────────────
  list: { gap: SPACING.xl },

  // ─── 카드 ───────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    gap: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xxl,
    ...SHADOWS.segment,
  },

  // 카드 헤더
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: SPACING.xl,
  },

  // 번호 배지 — 둥근 사각형, primarySoft 배경
  numberBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.sm,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  numberText: {
    color: COLORS.primary,
    fontFamily: 'NotoSansKR_700Bold',
    fontSize: 13,
    lineHeight: 18,
  },

  // 이름 / 성분 그룹
  nameGroup: { flex: 1, gap: 2 },
  medName: {
    color: COLORS.black,
    fontFamily: 'NotoSansKR_700Bold',
    fontSize: 15,
    lineHeight: 22,
  },
  medDosage: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
  frequencyText: {
    color: COLORS.primary,
    fontFamily: 'NotoSansKR_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  // ─── 구분선 ─────────────────────────────────────────────
  divider: {
    backgroundColor: COLORS.gray200,
    height: 1,
    marginHorizontal: -SPACING.xxl,
  },

  // ─── 복용량 칩 ──────────────────────────────────────────
  chipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  dotChip: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  dot: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  dotChipText: {
    color: COLORS.gray800,
    fontFamily: 'NotoSansKR_500Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  frequencyBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },

  // ─── 시간대 칩 ──────────────────────────────────────────
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  timeChips: { flexDirection: 'row', gap: SPACING.xs },
  timeChip: {
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  timeChipActive: { backgroundColor: COLORS.primary },
  timeChipText: {
    color: COLORS.gray500,
    fontFamily: 'NotoSansKR_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  timeChipTextActive: { color: COLORS.background },

  // ─── 주의사항 ────────────────────────────────────────────
  warningRow: {
    alignItems: 'center',
    backgroundColor: COLORS.errorBackground,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  warningText: { ...TYPOGRAPHY.caption, color: COLORS.danger, flex: 1 },

  // ─── 빈 상태 ─────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray500,
    lineHeight: 22,
    textAlign: 'center',
  },
});
