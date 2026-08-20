import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Modal, Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BrandLogoButton, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PetProfileSelector } from '@/src/features/pet/components';
import { usePetStore } from '@/src/features/pet/PetStore';
import { useMedicationStore } from '@/src/features/home/MedicationStore';

import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';
import { DiagnosisListCard } from '../components/DiagnosisListCard';
import type { DiagnosisListItem } from '../types';

function formatVisitDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function DashboardScreen() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const { hasLoadError, isReady, reloadMedications, visits } = useMedicationStore();
	const [showSummarizingToast, setShowSummarizingToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('아직 요약 중이에요!\n완료되면 알려 드릴게요.');
	const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasFocusedRef = useRef(false);

	useFocusEffect(useCallback(() => {
		if (hasFocusedRef.current) reloadMedications();
		hasFocusedRef.current = true;
	}, [reloadMedications]));

	const handleDiagnosisPress = (diagnosis: DiagnosisListItem) => {
		if (diagnosis.status !== 'completed') {
			if (toastTimeoutRef.current) {
				clearTimeout(toastTimeoutRef.current);
			}
			setToastMessage(
				diagnosis.status === 'failed'
					? '진료 요약을 완료하지 못했어요.\n잠시 후 다시 확인해주세요.'
					: '아직 요약 중이에요!\n완료되면 알려 드릴게요.',
			);
			setShowSummarizingToast(true);
			toastTimeoutRef.current = setTimeout(() => {
				setShowSummarizingToast(false);
				toastTimeoutRef.current = null;
			}, 2500);
			return;
		}
		router.push(`/dashboard/${diagnosis.id}` as Href);
	};

	useEffect(() => {
		return () => {
			if (toastTimeoutRef.current) {
				clearTimeout(toastTimeoutRef.current);
			}
		};
	}, []);

	if (!selectedPet) return null;

	const filteredList: DiagnosisListItem[] = visits.map((visit) => ({
		date: formatVisitDate(visit.visitedAt),
		diagnosisTitle: visit.visitName ?? (visit.status === 'FAILED' ? '진료 요약 처리 실패' : '진료 요약 생성 중'),
		id: visit.id,
		petId: selectedPet.id,
		status: visit.status === 'READY' ? 'completed' : visit.status === 'FAILED' ? 'failed' : 'summarizing',
		summaryNote: visit.oneLineSummary ?? undefined,
	}));

	return (
		<>
			<ScreenLayout
				centerContent={<PetProfileSelector />}
				headerFullWidth
				leftContent={<BrandLogoButton />}
				onRightPress={() => router.push('/notifications' as Href)}
				rightAccessibilityLabel="알림 열기"
			>
				<View style={styles.body}>
					<ScrollView
						contentContainerStyle={styles.content}
						showsVerticalScrollIndicator={false}
						style={styles.scroll}
					>
						<DiagnosisHeroCard
							actionLabel="진료 기록하기"
							onPressAction={() => router.push('/dashboard/record' as Href)}
							pet={selectedPet}
							subtitle={`${selectedPet.breed} · ${calculatePetAgeLabel(selectedPet.birthDate)}`}
							title={`${selectedPet.name} 진료 요약`}
						/>
						<View style={styles.list}>
						{!isReady ? <LoadingView label="진료 기록을 불러오고 있어요." /> : hasLoadError ? (
							<EmptyState
								actionLabel="다시 시도"
								description="네트워크 상태를 확인한 뒤 다시 불러와주세요."
								onActionPress={reloadMedications}
								title="진료 기록을 불러오지 못했어요"
							/>
						) : filteredList.length === 0 ? (
							<EmptyState
								actionLabel="진료 기록하기"
								description="진료 내용을 녹음하면 이곳에서 확인할 수 있어요."
								onActionPress={() => router.push('/dashboard/record' as Href)}
								title="등록된 진료 기록이 없어요"
							/>
						) : filteredList.map((diagnosis) => (
							<DiagnosisListCard
								diagnosis={diagnosis}
								key={diagnosis.id}
								onPress={() => handleDiagnosisPress(diagnosis)}
								petName={selectedPet.name}
							/>
						))}
						</View>
					</ScrollView>
				</View>
			</ScreenLayout>

			<Modal
				animationType="fade"
				onRequestClose={() => setShowSummarizingToast(false)}
				statusBarTranslucent
				transparent
				visible={showSummarizingToast}
			>
				<Pressable
					accessibilityLabel="닫기"
					accessibilityRole="button"
					onPress={() => setShowSummarizingToast(false)}
					style={styles.toastBackdrop}
				>
					<View style={styles.toastCard}>
						{toastMessage.split('\n').map((message) => <Text key={message} style={styles.toast}>{message}</Text>)}
					</View>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
	list: { gap: SPACING.md },
	body: { flex: 1 },
	toastBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: COLORS.overlay,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10,
		paddingHorizontal: SPACING.xxxl,
	},
	toastCard: {
		alignSelf: 'stretch',
		backgroundColor: COLORS.gray100,
		borderColor: COLORS.primary,
		borderRadius: RADIUS.lg,
		borderWidth: 1.5,
		gap: SPACING.xxs,
		paddingHorizontal: SPACING.xxl,
		paddingVertical: SPACING.xl,
	},
	toast: {
		...TYPOGRAPHY.label,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		textAlign: 'center',
	},
});
