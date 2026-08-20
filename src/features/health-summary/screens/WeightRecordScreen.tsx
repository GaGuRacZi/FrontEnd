import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, TimePickerSheet } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { AppetiteCondition, BodyCondition, WeightRecord } from '../types';

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatRecordDate = (date: Date) =>
	`${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

const formatRecordTime = (date: Date) => {
	const hours24 = date.getHours();
	const period = hours24 < 12 ? '오전' : '오후';
	const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
	return `${period} ${hours12}:${pad2(date.getMinutes())}`;
};

function parseRecordedAt(date: string, time: string) {
	const [year, month, day] = date.split('.').map(Number);
	const result = new Date(year, (month || 1) - 1, day || 1);
	const match = time.match(/(오전|오후)\s+(\d+):(\d+)/);
	if (!match) return Number.isNaN(result.valueOf()) ? new Date() : result;

	let hour = Number(match[2]);
	if (match[1] === '오후' && hour !== 12) hour += 12;
	if (match[1] === '오전' && hour === 12) hour = 0;
	result.setHours(hour, Number(match[3]), 0, 0);
	return Number.isNaN(result.valueOf()) ? new Date() : result;
}

export function WeightRecordScreen() {
	const router = useRouter();
	const isSaving = useRef(false);
	const { selectedPet } = usePetStore();
	const { deleteWeightRecord, saveWeightRecord, weightRecords } = useHealthSummaryStore();
	const { recordId } = useLocalSearchParams<{ recordId?: string }>();
	const existingRecord = recordId ? weightRecords.find(({ id }) => id === recordId) : undefined;
	const [isEditing, setIsEditing] = useState(!existingRecord);
	const [recordedAt, setRecordedAt] = useState(() =>
		existingRecord ? parseRecordedAt(existingRecord.date, existingRecord.time) : new Date(),
	);
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [timePickerVisible, setTimePickerVisible] = useState(false);
	const [weight, setWeight] = useState(existingRecord ? String(existingRecord.weight) : '');
	const [bodyCondition, setBodyCondition] = useState<BodyCondition>(existingRecord?.bodyCondition ?? 'ideal');
	const [appetite, setAppetite] = useState<AppetiteCondition>(existingRecord?.appetite ?? 'low');
	const [memo, setMemo] = useState(existingRecord?.memo ?? '');
	const [selectedImageUri, setSelectedImageUri] = useState<string | null>(existingRecord?.photoUri ?? null);

	const recordDate = formatRecordDate(recordedAt);
	const recordTime = formatRecordTime(recordedAt);

	const bodyOptions: { key: BodyCondition; label: string }[] = [
		{ key: 'lean', label: '마름' },
		{ key: 'ideal', label: '적정' },
		{ key: 'overweight', label: '과체중' },
	];

	const appetiteOptions: { key: AppetiteCondition; label: string }[] = [
		{ key: 'low', label: '식욕이 떨어짐' },
		{ key: 'normal', label: '식욕 평범' },
		{ key: 'high', label: '식욕이 많음' },
	];

	const handlePickImage = async () => {
		if (!isEditing) return;
		try {
			if (Platform.OS === 'ios') {
				const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (!permission.granted) {
					Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 허용되어야 사진을 추가할 수 있어요.');
					return;
				}
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				allowsEditing: true,
				aspect: [1, 1],
				defaultTab: 'photos',
				mediaTypes: ['images'],
				quality: 0.8,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				setSelectedImageUri(result.assets[0].uri);
			}
		} catch {
			Alert.alert('오류', '사진을 불러오는 중 문제가 발생했어요.');
		}
	};

	const handleSaveRecord = async () => {
		if (isSaving.current) return;
		if (!selectedPet) {
			Alert.alert('반려동물 선택 필요', '체중을 기록할 반려동물을 먼저 선택해주세요.');
			return;
		}
		const parsedWeight = parseFloat(weight);
		if (!parsedWeight || parsedWeight <= 0) {
			Alert.alert('입력 오류', '올바른 체중을 입력해주세요.');
			return;
		}
		isSaving.current = true;
		const newRecord: WeightRecord = {
			id: existingRecord?.id ?? '',
			petId: existingRecord?.petId ?? selectedPet.id,
			date: recordDate,
			time: recordTime,
			weight: parsedWeight,
			bodyCondition,
			appetite,
			memo: memo.trim() || undefined,
			photoUri: selectedImageUri ?? undefined,
			isDirectInput: true,
		};

		try {
			await saveWeightRecord(newRecord);
			router.replace({
				pathname: '/health-summary',
				params: { tab: 'weight' },
			} as Href);
		} catch {
			Alert.alert('저장할 수 없어요', '체중 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
		} finally {
			isSaving.current = false;
		}
	};

	const handleDeleteRecord = () => {
		if (!existingRecord) return;
		Alert.alert('체중 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
			{ style: 'cancel', text: '취소' },
			{
				style: 'destructive',
				text: '삭제',
				onPress: () => {
					void (async () => {
						try {
							await deleteWeightRecord(existingRecord);
							router.replace({ pathname: '/health-summary', params: { tab: 'weight' } } as Href);
						} catch {
							Alert.alert('삭제할 수 없어요', '체중 기록을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
						}
					})();
				},
			},
		]);
	};

	return (
		<>
			<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
				<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="체중 기록하기" />

				<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
					<View style={styles.rowTwoCards}>
						<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setDatePickerVisible(true)} style={styles.metaCard}>
							<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>기록 날짜</Text>
								<Text style={styles.metaValue}>{recordDate}</Text>
							</View>
						</TouchableOpacity>
						<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setTimePickerVisible(true)} style={styles.metaCard}>
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>측정 시간</Text>
								<Text style={styles.metaValue}>{recordTime}</Text>
							</View>
						</TouchableOpacity>
					</View>

					<View style={styles.card}>
						<Text style={styles.cardLabel}>몸무게</Text>
						<View style={styles.inputRow}>
							<TextInput
								editable={isEditing}
								keyboardType="decimal-pad"
								onChangeText={setWeight}
								placeholder="몸무게를 입력해주세요"
								placeholderTextColor={COLORS.gray500}
								style={[styles.inputValue, !weight && styles.inputPlaceholder]}
								value={weight}
							/>
							<Text style={styles.inputUnit}>kg</Text>
						</View>
					</View>

					<View style={styles.card}>
						<Text style={styles.cardLabel}>체형 상태</Text>
						<Text style={styles.cardHint}>육안으로 봤을 때 가장 가까운 상태를 골라요.</Text>
						<View style={styles.chipRow}>
							{bodyOptions.map((opt) => (
								<TouchableOpacity
									activeOpacity={0.8}
									disabled={!isEditing}
									key={opt.key}
									onPress={() => setBodyCondition(opt.key)}
									style={[styles.chip, bodyCondition === opt.key && styles.chipActive]}
								>
									<Text style={[styles.chipText, bodyCondition === opt.key && styles.chipTextActive]}>{opt.label}</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					<View style={[styles.card, { backgroundColor: COLORS.cream, borderColor: COLORS.transparent }]}>
						<Text style={styles.cardLabel}>컨디션 체크</Text>
						<View style={styles.radioGroup}>
							{appetiteOptions.map((opt) => {
								const active = appetite === opt.key;
								return (
									<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} key={opt.key} onPress={() => setAppetite(opt.key)} style={styles.radioOption}>
										<View style={[styles.radioCircle, active && styles.radioCircleActive]}>
											{active && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
										</View>
										<Text style={styles.radioLabel}>{opt.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					<View style={styles.card}>
						<View style={styles.memoHeader}>
							<Text style={styles.cardLabel}>메모</Text>
							<TouchableOpacity
								accessibilityLabel="사진 추가"
								accessibilityRole="button"
								activeOpacity={0.7}
								disabled={!isEditing}
								onPress={handlePickImage}
								style={styles.photoButton}
							>
								<AppIcon color={COLORS.primary} name="camera" size={16} />
								<Text style={styles.photoButtonText}>사진</Text>
							</TouchableOpacity>
						</View>

						{selectedImageUri ? (
							<View style={styles.imagePreviewContainer}>
								<Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
								<TouchableOpacity
									activeOpacity={0.8}
									disabled={!isEditing}
									onPress={() => setSelectedImageUri(null)}
									style={styles.removeImageButton}
								>
									<AppIcon color={COLORS.background} name="close" size={14} />
								</TouchableOpacity>
							</View>
						) : null}

						<TextInput
							editable={isEditing}
							multiline
							scrollEnabled={false}
							onChangeText={setMemo}
							placeholder="식사 후 같은 시간대에 측정했어요."
							placeholderTextColor={COLORS.gray500}
							style={styles.memoInput}
							value={memo}
						/>
					</View>
				</ScrollView>

				<View style={styles.bottomBar}>
					{existingRecord && !isEditing ? (
						<View style={styles.actionRow}>
							<AppButton onPress={() => setIsEditing(true)} style={styles.actionButton} title="수정" />
							<AppButton onPress={handleDeleteRecord} style={styles.actionButton} title="삭제" variant="danger" />
						</View>
					) : (
							<AppButton onPress={() => void handleSaveRecord()} title={existingRecord ? '저장하기' : '체중 기록 저장'} />
					)}
				</View>
			</AppScreen>
			<DatePickerSheet
				onClose={() => setDatePickerVisible(false)}
				onSelect={(date) => setRecordedAt(date)}
				title="기록 날짜 선택"
				value={recordedAt}
				visible={datePickerVisible}
			/>
			<TimePickerSheet
				onClose={() => setTimePickerVisible(false)}
				onSelect={({ hour, minute }) => {
					const updated = new Date(recordedAt);
					updated.setHours(hour, minute, 0, 0);
					setRecordedAt(updated);
				}}
				title="측정 시간 선택"
				value={{ hour: recordedAt.getHours(), minute: recordedAt.getMinutes() }}
				visible={timePickerVisible}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xxl },
	rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
	metaCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
	metaIcon: { height: 22, width: 22 },
	metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
	metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	card: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	cardHint: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginVertical: 4 },
	inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, paddingBottom: SPACING.xs, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
	inputValue: { ...TYPOGRAPHY.title1, color: COLORS.black, flex: 1, fontSize: 28, height: 38, lineHeight: 38, margin: 0, paddingHorizontal: 2, paddingVertical: 0, textAlign: 'left', textAlignVertical: 'center' },
	inputPlaceholder: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 16, lineHeight: 24 },
	inputUnit: { ...TYPOGRAPHY.body1, color: COLORS.gray600 },
	chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
	chip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.round, backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderWidth: 1 },
	chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
	chipText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	chipTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
	radioGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, paddingHorizontal: SPACING.xs },
	radioOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
	radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.gray300, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
	radioCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
	radioLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	memoHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	photoButton: { alignItems: 'center', backgroundColor: COLORS.summarycontainer, borderRadius: RADIUS.round, flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: 6 },
	photoButtonText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
	imagePreviewContainer: { marginTop: SPACING.md, position: 'relative', width: 80, height: 80 },
	previewImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
	removeImageButton: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.gray800, borderRadius: RADIUS.round, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
	memoInput: {
		...TYPOGRAPHY.body2,
		color: COLORS.black,
		marginTop: SPACING.lg,
		padding: 0,
		minHeight: 60,
		textAlignVertical: 'top',
	},
	bottomBar: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
	actionRow: { flexDirection: 'row', gap: SPACING.md },
	actionButton: { flex: 1 },
});
