import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';
import { DiagnosisListCard } from '../components/DiagnosisListCard';
import { MOCK_DIAGNOSIS_LIST } from '../mock';

export function DashboardScreen() {
	const router = useRouter();
	const { pets, selectedPet } = usePetStore();
	const [showSummarizingToast, setShowSummarizingToast] = useState(false);
	const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleDiagnosisPress = (diagnosis: (typeof MOCK_DIAGNOSIS_LIST)[number]) => {
		if (diagnosis.status === 'summarizing') {
			if (toastTimeoutRef.current) {
				clearTimeout(toastTimeoutRef.current);
			}
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

	const filteredList = MOCK_DIAGNOSIS_LIST.filter(
		(item) => !item.petId || item.petId === selectedPet.id
	);

	return (
		<>
			<ScreenLayout
				headerFullWidth
				leftContent={<BrandLogoButton />}
				title="진료 요약"
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
						{pets.length > 1 ? (
							<View style={styles.dots}>
								<View style={[styles.dot, styles.dotActive]} />
								<View style={styles.dot} />
							</View>
						) : null}

						<View style={styles.list}>
							{filteredList.map((diagnosis) => (
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
						<Text style={styles.toast}>아직 요약 중이에요!</Text>
						<Text style={styles.toast}>완료되면 알려 드릴게요.</Text>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
	dots: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center' },
	dot: { backgroundColor: COLORS.gray300, borderRadius: 4, height: 6, width: 6 },
	dotActive: { backgroundColor: COLORS.black },
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