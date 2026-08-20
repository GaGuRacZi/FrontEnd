// src/features/home/screens/HomeScreens.tsx
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandLogoButton, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { SPACING } from '@/src/constants';
import { useMedicationStore } from '../MedicationStore';
import { useScheduleTodoStore } from '../ScheduleTodoStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import { EmergencyBanner } from '../components/EmergencyBanner';
import { HealthTipCard } from '../components/HealthTipCard';
import { MedicationSummaryCard } from '../components/MedicationSummaryCard';
import { MonthlyHealthSummaryCard } from '../components/MonthlyHealthSummaryCard';
import { PetProfileCard } from '../components/PetProfileCard';
import { RecentDiagnosisCard } from '../components/RecentDiagnosisCard';
import { TodaySummaryCard } from '../components/TodaySummaryCard';
import {
  MOCK_HEALTH_TIP,
  MOCK_MONTHLY_HEALTH,
  MOCK_RECENT_DIAGNOSIS,
} from '../mock';
import { mapPetEntityToSummary } from '../utils/mapPetToSummary';

export function HomeScreen() {
  const router = useRouter();
  const { isReady, selectedPet } = usePetStore();
  const { medications } = useMedicationStore();
  const { todos: allTodos, toggleTodo } = useScheduleTodoStore();

  // 오늘 날짜 기준 투두만 추출
  const todayDate = new Date();
  const todayTodos = allTodos
    .filter(
      (t) =>
        t.day === todayDate.getDate() &&
        t.month === todayDate.getMonth() &&
        t.year === todayDate.getFullYear(),
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      timeLabel: t.timeLabel,
      status: t.status,
      category: t.category,
    }));

  // 홈 카드에는 추가된 순서 기준 상위 3개만 표시
  const homeMedications = medications.slice(0, 3).map((med) => ({
    id: med.id,
    name: med.name,
    doseLabel: med.frequencyLabel,
  }));

  const handleToggleTodo = (todoId: string) => {
    toggleTodo(todoId);
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
            diagnosis={MOCK_RECENT_DIAGNOSIS}
            onPress={() => router.push('/dashboard' as Href)}
          />
          <MedicationSummaryCard
            medications={homeMedications}
            onPress={() => router.push('/medication' as Href)}
          />
        </View>

        <MonthlyHealthSummaryCard
          metrics={MOCK_MONTHLY_HEALTH}
          onPressMore={() => router.push('/health-summary' as Href)}
        />

        <HealthTipCard tip={MOCK_HEALTH_TIP} />
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
