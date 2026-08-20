import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BrandLogoButton, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { SPACING } from '@/src/constants';
import { PetProfileSelector } from '@/src/features/pet/components';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { MedicalExpenseTab } from '../components/MedicalExpenseTab';
import { SegmentControl } from '../components/SegmentControl';
import { WalkTab } from '../components/WalkTab';
import { WeightTab } from '../components/WeightTab';
import { HealthTabType } from '../types';

export function HealthSummaryScreen() {
	const router = useRouter();
	const { hasLoadError, isReady: petsReady, reloadPets, selectedPet } = usePetStore();
	const { isReady: healthSummaryReady } = useHealthSummaryStore();
	const params = useLocalSearchParams<{ tab?: string }>();
	const [activeTab, setActiveTab] = useState<HealthTabType>('weight');

	useEffect(() => {
		if (params.tab === 'weight' || params.tab === 'walk' || params.tab === 'medical') {
			setActiveTab(params.tab);
		}
	}, [params.tab]);

	if (!petsReady) {
		return <ScreenLayout headerFullWidth leftContent={<BrandLogoButton />}><LoadingView label="반려동물 정보를 불러오고 있어요." /></ScreenLayout>;
	}

	if (!selectedPet) {
		return (
			<ScreenLayout headerFullWidth leftContent={<BrandLogoButton />}>
				<EmptyState
					actionLabel={hasLoadError ? '다시 시도' : '반려동물 등록'}
					description={hasLoadError ? '네트워크 상태를 확인한 뒤 다시 불러와주세요.' : '건강 기록을 시작하려면 반려동물을 먼저 등록해주세요.'}
					onActionPress={hasLoadError ? reloadPets : () => router.push('/pet/add' as Href)}
					title={hasLoadError ? '반려동물 정보를 불러오지 못했어요' : '등록된 반려동물이 없어요'}
				/>
			</ScreenLayout>
		);
	}

	if (!healthSummaryReady) {
		return <ScreenLayout headerFullWidth leftContent={<BrandLogoButton />}><LoadingView label="건강 기록을 불러오고 있어요." /></ScreenLayout>;
	}

	return (
		<ScreenLayout
			centerContent={<PetProfileSelector />}
			headerFullWidth
			leftContent={<BrandLogoButton />}
			onRightPress={() => router.push('/notifications' as Href)}
			rightAccessibilityLabel="알림 열기"
		>
			<SegmentControl activeTab={activeTab} onChangeTab={setActiveTab} />

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				style={styles.scroll}
			>
				{activeTab === 'weight' && <WeightTab />}
				{activeTab === 'walk' && <WalkTab />}
				{activeTab === 'medical' && <MedicalExpenseTab />}
			</ScrollView>
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1, marginTop: SPACING.lg },
	scrollContent: { paddingBottom: 120 },
});
