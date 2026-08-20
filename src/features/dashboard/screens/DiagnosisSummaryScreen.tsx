import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MedicationDetailModal, MedicationSaveConfirmModal, MedicationSearchModal } from '@/src/components/modal';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';
import { FREQUENCY_OPTIONS, TIMING_OPTIONS, type MedicationEntry } from '@/src/types/medication';

import { AiSummaryCard, PLACEHOLDER_SUMMARY } from '../components/AiSummaryCard';
import { AiSummaryCoinModal } from '../components/AiSummaryCoinModal';
import { BulletItem, DiagnosisSectionCard } from '../components/DiagnosisSectionCard';
import { PrescriptionMedicationCard } from '../components/PrescriptionMedicationCard';
import { generateAiSummary, getVisitDetail, ApiError, type VisitDetail } from '../services/visitService';
import type { DiagnosisDetail, DiagnosisMedication } from '../types';
import { calculatePetAgeLabel, DiagnosisHeroCard } from '../components/DiagnosisHeroCard';
import { MOCK_DIAGNOSIS_DETAIL } from '../mock';

// ─── Fallback mock 상세 데이터 ───────────────────────────────────────────────

const FALLBACK_DETAIL: DiagnosisDetail = {
	id: 'mock-fallback',
	date: '2026.07.01',
	diagnosisTitle: '관절염 정기 진료',
	status: 'completed',
	findings: [
		'앞다리 파행 및 기동성 저하',
		'관절 부위 촉진 시 통증 반응',
		'X-ray상 관절 간격 협소 확인',
	],
	findingConclusion: '퇴행성 관절염 진단 (11세 고령견 해당)',
	medications: [
		{
			id: 'mock-med-1',
			name: '카르포펜',
			dosageLabel: 'Carprofen 25mg',
			frequencyLabel: '하루 2회',
			doseLabel: '1정씩',
			mealTimingLabel: '식사 후',
			timings: ['morning', 'dinner'],
			description: '관절 염증과 통증을 줄여주는 비스테로이드 소염진통제(NSAID)예요. 프로스타글란딘 합성을 억제해 염증을 가라앉히고 통증을 완화해요. 퇴행성 관절염이나 수술 후 통증 관리에 주로 쓰여요.',
			warningNote: '다른 소염제와 함께 쓰면 안 돼요\n공복보다는 식후에 주시는 게 위장에 훨씬 부담이 덜해요',
		},
	],
	careNotes: [
		'미끄러운 바닥 피하기 (매트 깔아주기)',
		'격렬 운동·점프 자제, 완만 산책으로 대체',
		'체중 관리로 관절 부담 줄이기',
	],
	careFooterNote: '증상이 심해지거나 식욕 저하 시 즉시 재방문 권장',
	hospitalName: '하얀마음동물병원',
};

// ─── API 값 → 한글 라벨 매핑 ───────────────────────────────────────────────

const FREQ_LABEL: Record<string, string> = {
	ONCE_DAILY: '하루 1회',
	TWICE_DAILY: '하루 2회',
	THREE_TIMES: '하루 3회',
	AS_NEEDED: '필요 시',
};

const MEAL_TIMING_LABEL: Record<string, string> = {
	BEFORE_MEAL: '식사 전',
	AFTER_MEAL: '식사 후',
	BETWEEN_MEALS: '식간',
	ANYTIME: '시간 무관',
};

/** 백엔드 UPPER_CASE → DiagnosisMedicationTiming */
const TAKE_TIMES_MAP: Record<string, string> = {
	MORNING: 'morning',
	LUNCH: 'lunch',
	EVENING: 'dinner',
	BEDTIME: 'bedtime',
};

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatVisitDate(isoDate: string): string {
	const date = new Date(isoDate);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}.${month}.${day}`;
}

function parseMultilineField(value: string | null): string[] {
	if (!value) return [];
	return value.split('\n').map((s) => s.trim()).filter(Boolean);
}

function mapVisitDetailToLocal(visit: VisitDetail): DiagnosisDetail {
	const medications: DiagnosisMedication[] = visit.prescriptions.map((p) => ({
		description: undefined,
		doseLabel: `${p.dosageAmount}${p.dosageUnit}씩`,
		dosageLabel: p.ingredient || `${p.dosageAmount}${p.dosageUnit}`,
		frequencyLabel: FREQ_LABEL[p.frequency] ?? p.frequency,
		id: String(p.prescriptionId),
		mealTimingLabel: MEAL_TIMING_LABEL[p.mealTiming] ?? p.mealTiming,
		name: p.nameKo,
		timings: (p.takeTimes ?? []).map((t) => TAKE_TIMES_MAP[t] ?? t.toLowerCase()),
		warningNote: p.caution || undefined,
	}));

	return {
		aiSummary: visit.aiSummaryMd ?? undefined,
		careNotes: parseMultilineField(visit.careNotes),
		date: formatVisitDate(visit.visitedAt),
		diagnosisTitle: visit.visitName ?? '진료 기록',
		findings: parseMultilineField(visit.findings),
		id: String(visit.visitId),
		medications,
		status: visit.status === 'READY' ? 'completed' : 'summarizing',
	};
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

const AI_POLL_INTERVAL_MS = 3000;

export function DiagnosisSummaryScreen() {
	const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
	const router = useRouter();
	const { selectedPet } = usePetStore();

	const [detail, setDetail] = useState<DiagnosisDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [fetchError, setFetchError] = useState(false);

	const [aiSummary, setAiSummary] = useState<string | undefined>(undefined);
	const [medications, setMedications] = useState<DiagnosisMedication[]>([]);
	const [coinModalVisible, setCoinModalVisible] = useState(false);
	const [isGeneratingAi, setIsGeneratingAi] = useState(false);
	const [searchModalVisible, setSearchModalVisible] = useState(false);
	const [saveConfirmVisible, setSaveConfirmVisible] = useState(false);
	const [detailMedication, setDetailMedication] = useState<DiagnosisMedication | null>(null);

	/** GENERATING 상태 폴링 ref */
	const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopAiPolling = () => {
		if (aiPollRef.current) {
			clearInterval(aiPollRef.current);
			aiPollRef.current = null;
		}
	};

	/** 진료 상세 불러오기 */
	useEffect(() => {
		if (!diagnosisId) return;

		// mock ID 는 API 호출 없이 바로 표시
		// aiSummary 는 undefined 유지 → AiSummaryCard 가 블러(코인 사용 전) 상태로 표시됨
		const mockDetail = MOCK_DIAGNOSIS_DETAIL[diagnosisId] ?? null;
		if (mockDetail) {
			setDetail(mockDetail);
			setAiSummary(undefined);
			setMedications(mockDetail.medications);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setFetchError(false);

		getVisitDetail(diagnosisId)
			.then((visitDetail) => {
				const mapped = mapVisitDetailToLocal(visitDetail);
				setDetail(mapped);
				setAiSummary(mapped.aiSummary);
				setMedications(mapped.medications);

				// GENERATING 상태 — 완료될 때까지 폴링
				if (visitDetail.aiSummaryStatus === 'GENERATING') {
					setIsGeneratingAi(true);
					aiPollRef.current = setInterval(async () => {
						try {
							const updated = await getVisitDetail(diagnosisId);
							if (updated.aiSummaryStatus !== 'GENERATING') {
								stopAiPolling();
								setAiSummary(updated.aiSummaryMd ?? undefined);
								setIsGeneratingAi(false);
							}
						} catch {
							// 일시적 오류 무시
						}
					}, AI_POLL_INTERVAL_MS);
				}
			})
			.catch(() => {
				setFetchError(true);
			})
			.finally(() => {
				setIsLoading(false);
			});

		return () => {
			stopAiPolling();
		};
	}, [diagnosisId]);

	// 언마운트 시 폴링 정리
	useEffect(() => {
		return () => {
			stopAiPolling();
		};
	}, []);

	/** AI 요약 생성 */
	const handleGenerateAiSummary = async () => {
		if (!diagnosisId) return;

		// mock ID 는 API 없이 placeholder 를 바로 표시
		if (MOCK_DIAGNOSIS_DETAIL[diagnosisId]) {
			setIsGeneratingAi(true);
			await new Promise((resolve) => setTimeout(resolve, 1200));
			setAiSummary(PLACEHOLDER_SUMMARY);
			setIsGeneratingAi(false);
			setCoinModalVisible(false);
			return;
		}

		setIsGeneratingAi(true);
		try {
			const result = await generateAiSummary(diagnosisId);
			setAiSummary(result.aiSummaryMd);
		} catch (error) {
			if (error instanceof ApiError && error.status === 402) {
				// 코인 부족 — 모달에서 처리
			}
		} finally {
			setIsGeneratingAi(false);
			setCoinModalVisible(false);
		}
	};

	/** 약물 추가 */
	const handleAddMedications = (selectedEntries: MedicationEntry[]) => {
		const newMedications: DiagnosisMedication[] = selectedEntries.map((entry, index) => {
			const freqLabel = FREQUENCY_OPTIONS.find((opt) => opt.value === entry.frequency)?.label ?? '';
			const timingLabel = TIMING_OPTIONS.find((opt) => opt.value === entry.timing)?.label ?? '';

			return {
				id: `new-med-${Date.now()}-${index}`,
				name: entry.name,
				dosageLabel: entry.ingredient || '',
				frequencyLabel: freqLabel,
				doseLabel: `${entry.quantity}정씩`,
				mealTimingLabel: timingLabel,
				timings: [],
				description: entry.description,
				warningNote: entry.warningNote,
			};
		});

		setMedications((prev) => [...prev, ...newMedications]);
		setSearchModalVisible(false);
		setSaveConfirmVisible(true);
	};

	if (!selectedPet) return null;

	if (isLoading) {
		return (
			<ScreenLayout headerVariant="auth" title="진료 요약">
				<View style={styles.centered}>
					<ActivityIndicator color={COLORS.primary} size="large" />
				</View>
			</ScreenLayout>
		);
	}

	if (fetchError || !detail) {
		return (
			<ScreenLayout headerVariant="auth" title="진료 요약">
				<View style={styles.centered}>
					<Text style={styles.emptyText}>진료 기록을 불러오지 못했어요.</Text>
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
					onPressAction={() => router.push(`/dashboard/${detail.id}/transcript` as Href)}
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

				{medications.length > 0 ? (
					<View style={styles.section}>
						<View style={styles.headerRow}>
							<Text style={styles.sectionTitle}>처방 약물</Text>
							<Pressable
								accessibilityLabel="약물 추가"
								accessibilityRole="button"
								onPress={() => setSearchModalVisible(true)}
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
							{medications.map((medication, index) => (
								<PrescriptionMedicationCard
									index={index}
									key={medication.id}
									medication={medication}
									onPress={() => setDetailMedication(medication)}
								/>
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
						<AiSummaryCard
							onGenerate={() => setCoinModalVisible(true)}
							summary={isGeneratingAi ? PLACEHOLDER_SUMMARY : aiSummary}
						/>
					</View>
				</View>
			</ScrollView>

			<AiSummaryCoinModal
				onClose={() => setCoinModalVisible(false)}
				onConfirm={handleGenerateAiSummary}
				visible={coinModalVisible}
			/>

			<MedicationSearchModal
				onClose={() => setSearchModalVisible(false)}
				onSubmit={handleAddMedications}
				visible={searchModalVisible}
			/>

			<MedicationSaveConfirmModal
				onConfirm={() => setSaveConfirmVisible(false)}
				onDismiss={() => setSaveConfirmVisible(false)}
				visible={saveConfirmVisible}
			/>

			{detailMedication ? (
				<MedicationDetailModal
					description={detailMedication.description}
					dosageMetaLabel={`${detailMedication.doseLabel} · ${detailMedication.frequencyLabel} · ${detailMedication.mealTimingLabel}`}
					ingredientLabel={detailMedication.dosageLabel}
					name={detailMedication.name}
					onClose={() => setDetailMedication(null)}
					visible={Boolean(detailMedication)}
					warningNote={detailMedication.warningNote}
				/>
			) : null}
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
	centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
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
