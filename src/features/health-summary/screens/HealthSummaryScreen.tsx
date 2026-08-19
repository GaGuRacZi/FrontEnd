import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { SPACING } from '@/src/constants';
import { PetProfileSelector } from '@/src/features/pet/components';

import { MedicalExpenseTab } from '../components/MedicalExpenseTab';
import { SegmentControl } from '../components/SegmentControl';
import { WalkTab } from '../components/WalkTab';
import { WeightTab } from '../components/WeightTab';
import { HealthTabType } from '../types';

export function HealthSummaryScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ tab?: string }>();
	const [activeTab, setActiveTab] = useState<HealthTabType>('weight');

	useEffect(() => {
		if (params.tab === 'weight' || params.tab === 'walk' || params.tab === 'medical') {
			setActiveTab(params.tab);
		}
	}, [params.tab]);

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