import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, SPACING } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';
import { DiagnosisListCard } from '../components/DiagnosisListCard';
import { MOCK_DIAGNOSIS_LIST } from '../mock';

export function DashboardScreen() {
	const router = useRouter();
	const { pets, selectedPet } = usePetStore();

	if (!selectedPet) return null;

	return (
		<ScreenLayout
			headerFullWidth
			leftContent={<BrandLogoButton />}
			title="진료 요약"
		>
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
					{MOCK_DIAGNOSIS_LIST.map((diagnosis) => (
						<DiagnosisListCard
							diagnosis={diagnosis}
							key={diagnosis.id}
							onPress={() => router.push(`/dashboard/${diagnosis.id}` as Href)}
							petName={selectedPet.name}
						/>
					))}
				</View>
			</ScrollView>
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
	dots: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center' },
	dot: { backgroundColor: COLORS.gray300, borderRadius: 4, height: 6, width: 6 },
	dotActive: { backgroundColor: COLORS.black },
	list: { gap: SPACING.md },
});