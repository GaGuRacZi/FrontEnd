import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PetAvatar } from '@/src/features/pet/components/PetAvatar';
import { usePetStore } from '@/src/features/pet/PetStore';

import { AiSummaryCard, PLACEHOLDER_SUMMARY } from '../components/AiSummaryCard';
import { AiSummaryCoinModal } from '../components/AiSummaryCoinModal';
import { BulletItem, DiagnosisSectionCard } from '../components/DiagnosisSectionCard';
import { PrescriptionMedicationCard } from '../components/PrescriptionMedicationCard';
import { MOCK_DIAGNOSIS_DETAIL } from '../mock';
import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';

export function DiagnosisSummaryScreen() {
	const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
	const { selectedPet } = usePetStore();
	const detail = diagnosisId ? MOCK_DIAGNOSIS_DETAIL[diagnosisId] : undefined;
	const [aiSummary, setAiSummary] = useState(detail?.aiSummary);
	const [coinModalVisible, setCoinModalVisible] = useState(false);

	if (!selectedPet) return null;

	if (!detail) {
		return (
			<ScreenLayout headerVariant="auth" title="진료 요약">
				<View style={styles.emptyState}>
					<Text style={styles.emptyText}>진료 기록을 찾을 수 없어요.</Text>
				</View>
			</ScreenLayout>
		);
	}

	return (
		<ScreenLayout
			headerVariant="auth"
			onRightPress={() => {
				// TODO: 네이티브 Share API 연동
			}}
			rightAccessibilityLabel="공유하기"
			rightIcon="share-social-outline"
			title="진료 요약"
		>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <DiagnosisHeroCard
                    actionIcon="volume-high-outline"
                    actionLabel="음성&전사문 확인"
                    onPressAction={() => {
                        // TODO: 녹음 오디오 재생 연동
                    }}
                    pet={selectedPet}
                    subtitle={`${selectedPet.name} (${selectedPet.breed} · ${calculatePetAgeLabel(selectedPet.birthDate)})`}
                    title={detail.diagnosisTitle}
                    topLabel={detail.date}
                />

				<DiagnosisSectionCard
                    iconSource={require('@/assets/images/dashboard/Diagnosis.png')}
                    innerTitle="진단 소견"
					title="진단 소견"
				>
					{detail.findings.map((finding, index) => (
						<BulletItem key={`finding-${index}`} text={finding} />
					))}
					{detail.findingConclusion ? (
                        <>
						    <View style={styles.sectionDivider} />
                            <Text style={styles.conclusion}>→ {detail.findingConclusion}</Text>
                        </>
					) : null}
				</DiagnosisSectionCard>
					{detail.medications.length > 0 ? (
						<View style={styles.section}>
							<View style={styles.headerRow}>
								<Text style={styles.sectionTitle}>처방 약물</Text>
								<Pressable
									accessibilityLabel="약물 추가"
									accessibilityRole="button"
									onPress={() => {
										// TODO: 약물 검색/OCR/직접입력
									}}
									style={styles.actionButton}
								>
									<Image
										resizeMode="contain"
										source={require('@/assets/images/dashboard/Plus.png')}
										style={{ height: 14, width: 14 }}
									/>
									<Text style={styles.actionLabel}>약물 추가</Text>
								</Pressable>
							</View>
							<View style={styles.medicationList}>
								{detail.medications.map((medication, index) => (
									<PrescriptionMedicationCard index={index} key={medication.id} medication={medication} />
								))}
							</View>
						</View>
					) : null}
				{detail.careNotes.length > 0 ? (
					<DiagnosisSectionCard
						iconBgColor={COLORS.cream}
						iconSize={12}
						iconSource={require('@/assets/images/dashboard/Care.png')}
						innerTitle="치료 및 관리"
						title="치료 및 관리"
					>
						{detail.careNotes.map((note, index) => (
							<BulletItem dotColor={COLORS.success} key={`care-${index}`} text={note} />
						))}
						{detail.careFooterNote ? (
							<>
								<View style={styles.sectionDivider} />
								<Text style={styles.careFooterNote}>{detail.careFooterNote}</Text>
							</>
						) : null}
					</DiagnosisSectionCard>
				) : null}

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>AI 요약</Text>
					<View style={styles.aiCard}>
						<AiSummaryCard onGenerate={() => setCoinModalVisible(true)} summary={aiSummary} />
					</View>
				</View>
			</ScrollView>

			<AiSummaryCoinModal
				onClose={() => setCoinModalVisible(false)}
				onConfirm={() => {
					setAiSummary(PLACEHOLDER_SUMMARY); // TODO: 실제 AI 요약 API 연동
					setCoinModalVisible(false);
				}}
				visible={coinModalVisible}
			/>
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
	emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center' },
	emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
    sectionDivider: { backgroundColor: COLORS.gray200, height: 1, marginVertical: SPACING.xs },
	conclusion: { ...TYPOGRAPHY.label, color: COLORS.primary, marginTop: SPACING.xs },
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
	actionLabel: { ...TYPOGRAPHY.label, color: COLORS.primary },
	medicationList: { gap: SPACING.lg },
	aiCard: {
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		padding: SPACING.xxl,
	},
});