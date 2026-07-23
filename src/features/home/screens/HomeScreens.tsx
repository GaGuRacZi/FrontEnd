// src/features/home/HomeScreen.tsx
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { SPACING } from '@/src/constants';

import { EmergencyBanner } from '../components/EmergencyBanner';
import { MedicationSummaryCard } from '../components/MedicationSummaryCard';
import { PetProfileCard } from '../components/PetProfileCard';
import { RecentDiagnosisCard } from '../components/RecentDiagnosisCard';
import { TodaySummaryCard } from '../components/TodaySummaryCard';
import { MonthlyHealthSummaryCard } from '../components/MonthlyHealthSummaryCard';
import { MOCK_MEDICATIONS, MOCK_MONTHLY_HEALTH, MOCK_PETS, MOCK_RECENT_DIAGNOSIS, MOCK_TODOS } from '../mock';

export function HomeScreen() {
  const router = useRouter();
  const [todos, setTodos] = useState(MOCK_TODOS);
  const activePet = MOCK_PETS[0];

  const handleToggleTodo = (todoId: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? { ...todo, status: todo.status === 'done' ? 'pending' : 'done' }
          : todo,
      ),
    );
  };

  if (!activePet) {
    return null;
  }

  return (
    <ScreenLayout
      leftContent={<BrandLogoButton />}
      onRightPress={() => router.push('/notifications' as Href)}
      rightAccessibilityLabel='알림열기'
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={{marginTop: 10}}>
          <PetProfileCard
            onPressAddDiagnosis={() => router.push('/dashboard/record' as Href)}
            onPressDetail={() => router.push('/pet-detail' as Href)}
            pet={activePet}
          />
        </View>

        <TodaySummaryCard
          onPressMore={() => router.push('/schedule' as Href)}
          onToggleTodo={handleToggleTodo}
          todos={todos}
        />

        <EmergencyBanner onPress={() => router.push('/emergency' as Href)} />

        <View style={styles.row}>
          <RecentDiagnosisCard
            diagnosis={MOCK_RECENT_DIAGNOSIS}
            onPress={() => router.push('/dashboard')}
          />
          <MedicationSummaryCard
            medications={MOCK_MEDICATIONS}
            onPress={() => router.push('/medication' as Href)}
          />
        </View>

        <MonthlyHealthSummaryCard
          metrics={MOCK_MONTHLY_HEALTH}
          onPressMore={() => router.push('/health-summary' as Href)}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: SPACING.xl, paddingBottom: SPACING.xxxl },
  row: { flexDirection: 'row', gap: SPACING.xl },
});