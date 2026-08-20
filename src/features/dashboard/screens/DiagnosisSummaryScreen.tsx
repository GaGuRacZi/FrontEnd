import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { MedicationDetailModal, MedicationSearchModal } from '@/src/components/modal';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import {
  addRemotePrescription,
  deleteRemotePrescription,
  generateRemoteAiSummary,
  getRemoteMedicationDetail,
  getRemoteVisitDetail,
  type RemotePrescription,
  type RemoteVisitDetail,
} from '@/src/features/dashboard/services/visitApi';
import { mapRemotePrescriptionToMedication, useMedicationStore } from '@/src/features/home/MedicationStore';
import { usePetStore } from '@/src/features/pet/PetStore';
import type { MedicationEntry } from '@/src/types/medication';

import { AiSummaryCard } from '../components/AiSummaryCard';
import { BulletItem, DiagnosisSectionCard } from '../components/DiagnosisSectionCard';
import { PrescriptionMedicationCard } from '../components/PrescriptionMedicationCard';
import type { DiagnosisMedication } from '../types';
import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';

const FREQUENCY = {
  asNeeded: 'AS_NEEDED',
  onceDaily: 'ONCE_DAILY',
  threeTimesDaily: 'THREE_TIMES',
  twiceDaily: 'TWICE_DAILY',
} as const;

const MEAL_TIMING = {
  afterMeal: 'AFTER_MEAL',
  anytime: 'ANYTIME',
  beforeMeal: 'BEFORE_MEAL',
  betweenMeals: 'BETWEEN_MEALS',
} as const;

function formatVisitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function DiagnosisSummaryScreen() {
  const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
  const router = useRouter();
  const { hasLoadError: petLoadError, isReady: petsReady, pets, reloadPets } = usePetStore();
  const { reloadMedications } = useMedicationStore();
  const [detail, setDetail] = useState<RemoteVisitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [detailMedication, setDetailMedication] = useState<DiagnosisMedication | null>(null);

  const loadDetail = useCallback(async () => {
    if (!diagnosisId) return;
    const next = await getRemoteVisitDetail(diagnosisId);
    setDetail(next);
  }, [diagnosisId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);
    void loadDetail()
      .catch(() => {
        if (active) setErrorMessage('진료 기록을 불러오지 못했어요. 다시 시도해주세요.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDetail]);

  const handleRetryLoad = () => {
    setIsLoading(true);
    setErrorMessage(null);
    void loadDetail()
      .catch(() => setErrorMessage('진료 기록을 불러오지 못했어요. 다시 시도해주세요.'))
      .finally(() => setIsLoading(false));
  };

  if (isLoading) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 요약">
        <LoadingView label="진료 기록을 불러오고 있어요." />
      </ScreenLayout>
    );
  }

  if (!detail) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 요약">
        <EmptyState
          actionLabel="다시 시도"
          description={errorMessage ?? '진료 기록을 찾을 수 없어요.'}
          onActionPress={handleRetryLoad}
          title="진료 기록을 불러오지 못했어요"
        />
      </ScreenLayout>
    );
  }

  const visitPet = pets.find((pet) => pet.id === detail.petId) ?? null;

  if (!petsReady) {
    return <ScreenLayout headerVariant="auth" title="진료 요약"><LoadingView label="반려동물 정보를 불러오고 있어요." /></ScreenLayout>;
  }

  if (!visitPet) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 요약">
        <EmptyState
          actionLabel={petLoadError ? '다시 시도' : undefined}
          description={petLoadError ? '네트워크 상태를 확인한 뒤 다시 불러와주세요.' : '삭제되었거나 현재 계정에서 확인할 수 없는 반려동물의 진료 기록이에요.'}
          onActionPress={petLoadError ? reloadPets : undefined}
          title="반려동물 정보를 확인할 수 없어요"
        />
      </ScreenLayout>
    );
  }

  const medications = detail.prescriptions.map((prescription) => mapRemotePrescriptionToMedication(prescription));

  const handleAddMedications = (entries: MedicationEntry[]) => {
    if (isSaving) return;
    void (async () => {
      setIsSaving(true);
      setErrorMessage(null);
      const added: RemotePrescription[] = [];
      try {
        for (const entry of entries) {
          added.push(await addRemotePrescription(detail.id, {
            caution: entry.warningNote,
            dosageAmount: entry.quantity,
            dosageUnit: '정',
            frequency: FREQUENCY[entry.frequency],
            ingredient: entry.ingredient,
            medicationId: entry.medicationId,
            mealTiming: MEAL_TIMING[entry.timing],
            nameEn: entry.nameEn,
            nameKo: entry.medicationId ? undefined : entry.name,
            source: entry.medicationId ? 'CATALOG' : 'CUSTOM',
          }));
        }
        setDetail((current) => current
          ? { ...current, prescriptions: [...current.prescriptions, ...added] }
          : current);
        reloadMedications();
        setSearchModalVisible(false);
        void loadDetail().catch(() => undefined);
      } catch {
        setErrorMessage(added.length
          ? '일부 약물만 저장됐어요. 목록을 확인한 뒤 다시 추가해주세요.'
          : '약물을 저장하지 못했어요. 다시 시도해주세요.');
        if (added.length) {
          setDetail((current) => current
            ? { ...current, prescriptions: [...current.prescriptions, ...added] }
            : current);
          setSearchModalVisible(false);
        }
        void loadDetail().catch(() => undefined);
        reloadMedications();
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleDeleteMedication = () => {
    if (!detailMedication || isSaving) return;
    void (async () => {
      setIsSaving(true);
      setErrorMessage(null);
      try {
        await deleteRemotePrescription(detail.id, detailMedication.id);
        const deletedId = detailMedication.id;
        setDetailMedication(null);
        setDetail((current) => current
          ? { ...current, prescriptions: current.prescriptions.filter(({ id }) => id !== deletedId) }
          : current);
        reloadMedications();
        void loadDetail().catch(() => undefined);
      } catch {
        setErrorMessage('약물을 삭제하지 못했어요. 다시 시도해주세요.');
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleOpenMedication = (medication: DiagnosisMedication) => {
    setDetailMedication(medication);
    if (!medication.medicationId) return;
    void getRemoteMedicationDetail(medication.medicationId)
      .then((remote) => {
        setDetailMedication((current) => current?.id === medication.id
          ? {
              ...current,
              description: remote.description,
              dosageLabel: remote.ingredient ?? current.dosageLabel,
              warningNote: remote.precaution,
            }
          : current);
      })
      .catch(() => undefined);
  };

  const handleGenerateSummary = () => {
    if (!detail || isGeneratingSummary) return;
    void (async () => {
      setIsGeneratingSummary(true);
      setErrorMessage(null);
      try {
        const generated = await generateRemoteAiSummary(detail.id);
        setDetail((current) => current
          ? { ...current, aiSummary: generated.summary, aiSummaryStatus: 'DONE' }
          : current);
      } catch {
        setErrorMessage('AI 요약을 생성하지 못했어요. 잠시 후 다시 시도해주세요.');
      } finally {
        setIsGeneratingSummary(false);
      }
    })();
  };

  return (
    <ScreenLayout headerVariant="auth" title="진료 요약">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DiagnosisHeroCard
          actionIcon="volume-high-outline"
          actionLabel="음성&전사문 확인"
          onPressAction={() => router.push(`/dashboard/${detail.id}/transcript` as Href)}
          pet={visitPet}
          subtitle={`${visitPet.name} (${visitPet.breed} · ${calculatePetAgeLabel(visitPet.birthDate)})`}
          title={detail.visitName ?? '진료 요약'}
          topLabel={formatVisitDate(detail.visitedAt)}
        />

        {detail.diagnosisFindings.length > 0 ? (
          <DiagnosisSectionCard
            iconSource={require('@/assets/images/dashboard/Diagnosis.png')}
            innerTitle="진단 소견"
            title="진단 소견"
          >
            {detail.diagnosisFindings.map((finding, index) => (
              <BulletItem key={`${index}-${finding}`} text={finding} />
            ))}
          </DiagnosisSectionCard>
        ) : null}

        {detail.status === 'READY' ? (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>처방 약물</Text>
              <Pressable
                accessibilityLabel="약물 추가"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setSearchModalVisible(true)}
                style={[styles.actionButton, isSaving && styles.actionButtonDisabled]}
              >
                <Image
                  resizeMode="contain"
                  source={require('@/assets/images/dashboard/Plus.png')}
                  style={{ height: 14, width: 14 }}
                />
                <Text style={styles.actionLabel}>약물 추가</Text>
              </Pressable>
            </View>
            {medications.length > 0 ? (
              <View style={styles.medicationList}>
                {medications.map((medication, index) => (
                  <PrescriptionMedicationCard
                    index={index}
                    key={medication.id}
                    medication={medication}
                    onPress={() => handleOpenMedication(medication)}
                  />
                ))}
              </View>
            ) : <Text style={styles.emptyMedication}>등록된 처방 약물이 없어요.</Text>}
          </View>
        ) : null}

        {detail.careItems.length > 0 ? (
          <DiagnosisSectionCard
            iconBgColor={COLORS.cream}
            iconSize={12}
            iconSource={require('@/assets/images/dashboard/Care.png')}
            innerTitle="치료 및 관리"
            title="치료 및 관리"
          >
            {detail.careItems.map((note, index) => (
              <BulletItem dotColor={COLORS.success} key={`${index}-${note}`} text={note} />
            ))}
            {detail.careNote ? (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.careFooterNote}>{detail.careNote}</Text>
              </>
            ) : null}
          </DiagnosisSectionCard>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 요약</Text>
          <View style={styles.aiCard}>
            <AiSummaryCard
              isGenerating={isGeneratingSummary || detail.aiSummaryStatus === 'GENERATING'}
              onGenerate={detail.aiSummaryStatus === 'NONE' ? handleGenerateSummary : undefined}
              summary={detail.aiSummary ?? undefined}
            />
          </View>
        </View>

        {errorMessage ? <Text accessibilityLiveRegion="polite" style={styles.error}>{errorMessage}</Text> : null}
      </ScrollView>

      <MedicationSearchModal
        onClose={() => setSearchModalVisible(false)}
        onSubmit={handleAddMedications}
        visible={searchModalVisible}
      />

      {detailMedication ? (
        <MedicationDetailModal
          description={detailMedication.description}
          dosageMetaLabel={`${detailMedication.doseLabel} · ${detailMedication.frequencyLabel} · ${detailMedication.mealTimingLabel}`}
          ingredientLabel={detailMedication.dosageLabel}
          name={detailMedication.name}
          onClose={() => setDetailMedication(null)}
          onDelete={handleDeleteMedication}
          visible
          warningNote={detailMedication.warningNote}
        />
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
  sectionDivider: { backgroundColor: COLORS.gray200, height: 1, marginVertical: SPACING.xs },
  careFooterNote: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: SPACING.xs },
  section: { gap: SPACING.md },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
  actionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    flexDirection: 'row',
    gap: SPACING.xxs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  actionButtonDisabled: { opacity: 0.55 },
  actionLabel: { ...TYPOGRAPHY.label, color: COLORS.primary },
  medicationList: { gap: SPACING.lg },
  emptyMedication: { ...TYPOGRAPHY.body2, color: COLORS.gray500, paddingVertical: SPACING.lg },
  aiCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxl,
  },
  error: { ...TYPOGRAPHY.caption, color: COLORS.error, textAlign: 'center' },
});
