// src/features/home/screens/HomeScreens.tsx
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandLogoButton, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { SPACING } from '@/src/constants';
import { useMedicationStore } from '../MedicationStore';
import { useScheduleTodoStore } from '../ScheduleTodoStore';
import { formatTodoApiDate } from '../services/todoApi';
import { usePetStore } from '@/src/features/pet/PetStore';
import { useHealthSummaryStore } from '@/src/features/health-summary/HealthSummaryStore';
import {
  getMedicalExpenseOverview,
  getWalkOverview,
  getWeightOverview,
} from '@/src/features/health-summary/healthSummarySelectors';

import { EmergencyBanner } from '../components/EmergencyBanner';
import { HealthTipCard } from '../components/HealthTipCard';
import { MedicationSummaryCard } from '../components/MedicationSummaryCard';
import { MonthlyHealthSummaryCard } from '../components/MonthlyHealthSummaryCard';
import { PetProfileCard } from '../components/PetProfileCard';
import { RecentDiagnosisCard } from '../components/RecentDiagnosisCard';
import { TodaySummaryCard } from '../components/TodaySummaryCard';
import { HOME_HEALTH_TIP } from '../homeContent';
import { mapPetEntityToSummary } from '../utils/mapPetToSummary';
import { getTagCfg } from '../utils/scheduleConfig';

export function HomeScreen() {
  const router = useRouter();
  const { isReady, selectedPet } = usePetStore();
  const { medications, visits } = useMedicationStore();
  const { customTags, getTodosForDate, toggleTodo } = useScheduleTodoStore();
  const { medicalExpenseRecords, walkRecords, weightRecords } = useHealthSummaryStore();

  const todayDate = new Date();
  const todayKey = formatTodoApiDate(todayDate);
  const todayTodos = getTodosForDate(todayKey)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      timeLabel: t.timeLabel,
      status: t.status,
      category: t.category,
      tagColor: getTagCfg(t.tag, customTags).bg,
    }));

  const homeMedications = medications.slice(0, 3).map((med) => ({
    id: med.id,
    name: med.name,
    doseLabel: med.frequencyLabel,
  }));

  const handleToggleTodo = (todoId: string) => {
    void toggleTodo(todoId, todayKey).catch(() => undefined);
  };

  if (!isReady) {
    return (
      <ScreenLayout headerFullWidth leftContent={<BrandLogoButton />}>
        <View style={styles.stateContent}>
          <LoadingView label="반려동물 정보를 불러오고 있어요." />
        </View>
      </ScreenLayout>
    );
  }

  if (!selectedPet) {
    return (
      <ScreenLayout headerFullWidth leftContent={<BrandLogoButton />}>
        <View style={styles.stateContent}>
          <EmptyState
            actionLabel="반려동물 등록"
            description="반려동물 정보를 등록하면 홈에서 관리할 수 있어요."
            onActionPress={() => router.push('/pet/add' as Href)}
            title="등록된 반려동물이 없어요"
          />
        </View>
      </ScreenLayout>
    );
  }

  const activePet = mapPetEntityToSummary(selectedPet);
  const petWeightRecords = weightRecords.filter((record) => record.petId === selectedPet.id);
  const petWalkRecords = walkRecords.filter((record) => record.petId === selectedPet.id);
  const petMedicalExpenseRecords = medicalExpenseRecords.filter((record) => record.petId === selectedPet.id);
  const weightOverview = getWeightOverview(petWeightRecords);
  const walkOverview = getWalkOverview(petWalkRecords);
  const medicalExpenseOverview = getMedicalExpenseOverview(petMedicalExpenseRecords);
  const monthlyHealthMetrics = [
    {
      changeLabel: weightOverview.difference === null
        ? '-'
        : `${weightOverview.difference > 0 ? '+' : ''}${weightOverview.difference}kg`,
      id: 'weight',
      label: '체중',
      valueLabel: weightOverview.currentWeight === null ? '-' : `${weightOverview.currentWeight.toFixed(1)}kg`,
    },
    {
      changeLabel: walkOverview.difference === null
        ? '-'
        : `지난주 ${walkOverview.difference > 0 ? '+' : ''}${walkOverview.difference}분`,
      id: 'walk',
      label: '산책',
      valueLabel: walkOverview.average === null ? '-' : `평균 ${walkOverview.average}분`,
    },
    {
      changeLabel: `${medicalExpenseOverview.difference > 0 ? '+' : ''}${medicalExpenseOverview.difference.toLocaleString()}원`,
      id: 'medical',
      label: '의료비',
      valueLabel: `${medicalExpenseOverview.currentTotal.toLocaleString()}원`,
    },
  ];
  const latestVisit = visits[0];
  const recentDiagnosis = latestVisit
    ? {
        id: latestVisit.id,
        statusLabel:
          latestVisit.status === 'PROCESSING'
            ? 'AI 요약 진행 중'
            : latestVisit.status === 'FAILED'
              ? 'AI 요약을 완료하지 못했어요'
              : latestVisit.aiSummaryGenerated
              ? 'AI 요약 완료'
              : 'AI 요약 미진행',
        title: latestVisit.visitName ?? '진료 요약을 생성하고 있어요',
      }
    : {
        id: 'empty-diagnosis',
        statusLabel: '진료 기록을 추가해보세요',
        title: '진료 기록이 없어요',
      };

  return (
    <ScreenLayout
      headerFullWidth
      leftContent={<BrandLogoButton />}
      onRightPress={() => router.push('/notifications' as Href)}
      rightAccessibilityLabel="알림 열기"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <PetProfileCard
          onPressAddDiagnosis={() => router.push('/dashboard/record' as Href)}
          onPressDetail={() => router.push(`/pet/${selectedPet.id}` as Href)}
          pet={activePet}
          rawPet={selectedPet}
        />

        <TodaySummaryCard
          onPressMore={() => router.push('/schedule' as Href)}
          onToggleTodo={handleToggleTodo}
          todos={todayTodos}
        />

        <EmergencyBanner onPress={() => router.push('/emergency' as Href)} />

        <View style={styles.row}>
          <RecentDiagnosisCard
            diagnosis={recentDiagnosis}
            onPress={() => router.push(
              latestVisit?.status === 'READY'
                ? `/dashboard/${latestVisit.id}` as Href
                : '/dashboard' as Href,
            )}
          />
          <MedicationSummaryCard
            medications={homeMedications}
            onPress={() => router.push('/medication' as Href)}
          />
        </View>

        <MonthlyHealthSummaryCard
          metrics={monthlyHealthMetrics}
          onPressMore={() => router.push('/health-summary' as Href)}
        />

        <HealthTipCard tip={HOME_HEALTH_TIP} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
  row: { flexDirection: 'row', gap: SPACING.xl },
  stateContent: { flex: 1, justifyContent: 'center' },
});
