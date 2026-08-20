import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, TimePickerSheet } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { WalkIntensity, WalkRecord } from '../types';

const WEATHER_OPTIONS = ['맑음', '흐림', '비', '눈', '바람'] as const;

function parseTemperature(value: string) {
	const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
	const decimalIndex = normalized.indexOf('.');
	const withoutExtraDecimals =
		decimalIndex === -1
			? normalized
			: `${normalized.slice(0, decimalIndex + 1)}${normalized.slice(decimalIndex + 1).replace(/\./g, '')}`;
	return withoutExtraDecimals.slice(0, 5);
}

function isTemperature(value: string) {
	const temperature = Number(value);
	return value.trim() !== '' && Number.isInteger(temperature) && temperature >= -50 && temperature <= 60;
}

export function WalkRecordScreen() {
	const router = useRouter();
	const isSaving = useRef(false);
	const { selectedPet } = usePetStore();
	const { deleteWalkRecord, saveWalkRecord, walkRecords } = useHealthSummaryStore();
	const params = useLocalSearchParams<{ automatic?: string; date?: string; durationSeconds?: string; recordId?: string; startTime?: string }>();
	const isAutomatic = params.automatic === 'true';
	const existingRecord = params.recordId ? walkRecords.find(({ id }) => id === params.recordId) : undefined;
	const [isEditing, setIsEditing] = useState(!existingRecord);

	const [intensity, setIntensity] = useState<WalkIntensity>(existingRecord?.intensity ?? 'moderate');
	const [urination, setUrination] = useState(existingRecord?.excrement.urination ?? true);
	const [defecation, setDefecation] = useState(existingRecord?.excrement.defecation ?? true);
	const [specialNote, setSpecialNote] = useState(existingRecord?.excrement.specialNote ?? false);
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [weatherModalVisible, setWeatherModalVisible] = useState(false);
	const [weatherText, setWeatherText] = useState<string | null>(existingRecord?.weatherText ?? null);
	const [temperatureText, setTemperatureText] = useState(
		existingRecord?.temperatureText?.replace(/[^0-9.-]/g, '') ?? '',
	);
	const [weatherDraft, setWeatherDraft] = useState<string | null>(null);
	const [temperatureDraft, setTemperatureDraft] = useState('');

	const pad2Walk = (n: number) => String(n).padStart(2, '0');
	const formatWalkDate = (date: Date) =>
		`${date.getFullYear()}.${pad2Walk(date.getMonth() + 1)}.${pad2Walk(date.getDate())}`;
	const parseParamDate = (dateStr?: string): Date => {
		if (!dateStr) return new Date();
		const [y, m, d] = dateStr.split('.').map(Number);
		const parsed = new Date(y, (m || 1) - 1, d || 1);
		return isNaN(parsed.getTime()) ? new Date() : parsed;
	};

	const [recordedAt, setRecordedAt] = useState<Date>(() => parseParamDate(existingRecord?.date ?? params.date));
	const displayDate = formatWalkDate(recordedAt);

	const parseTimeStr = (timeStr?: string, fallbackH = 18, fallbackM = 20): { hour: number; minute: number } => {
		if (!timeStr) return { hour: fallbackH, minute: fallbackM };
		const match = /(?:T|^)(\d{1,2}):(\d{2})/.exec(timeStr);
		if (!match) return { hour: fallbackH, minute: fallbackM };
		return { hour: Number(match[1]), minute: Number(match[2]) };
	};

	const automaticDurationSeconds = Number(params.durationSeconds);
	const hasAutomaticDuration = isAutomatic && Number.isFinite(automaticDurationSeconds) && automaticDurationSeconds >= 0;
	const initialDuration = existingRecord?.durationMinutes ?? (hasAutomaticDuration ? Math.max(1, Math.ceil(automaticDurationSeconds / 60)) : 0);
	const initialStart = parseTimeStr(existingRecord?.startTime ?? params.startTime);
	const initialEndTotal = initialStart.hour * 60 + initialStart.minute + initialDuration;

	const [startHour, setStartHour] = useState(initialStart.hour);
	const [startMinute, setStartMinute] = useState(initialStart.minute);
	const existingEnd = parseTimeStr(existingRecord?.endTime, Math.floor(initialEndTotal / 60) % 24, initialEndTotal % 60);
	const [endHour, setEndHour] = useState(existingEnd.hour);
	const [endMinute, setEndMinute] = useState(existingEnd.minute);
	const [startTimeSelected, setStartTimeSelected] = useState(Boolean(existingRecord || isAutomatic));
	const [endTimeSelected, setEndTimeSelected] = useState(Boolean(existingRecord || isAutomatic));
	const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end'>('start');
	const [timePickerVisible, setTimePickerVisible] = useState(false);

	const startTimeStr = `${pad2Walk(startHour)}:${pad2Walk(startMinute)}`;
	const endTimeStr = `${pad2Walk(endHour)}:${pad2Walk(endMinute)}`;
	const startTotalMin = startHour * 60 + startMinute;
	const endTotalMin = endHour * 60 + endMinute;
	const totalMinutes = startTimeSelected && endTimeSelected && endTotalMin > startTotalMin ? endTotalMin - startTotalMin : 0;
	const displayTotalTime = hasAutomaticDuration
		? `${Math.floor(automaticDurationSeconds / 60)}분 ${automaticDurationSeconds % 60}초`
		: totalMinutes === 0
		? '-'
		: totalMinutes < 60
		? `${totalMinutes}분`
		: `${Math.floor(totalMinutes / 60)}시간${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60}분` : ''}`;

	const intensityOptions: { key: WalkIntensity; label: string }[] = [
		{ key: 'relaxed', label: '느긋' },
		{ key: 'moderate', label: '보통' },
		{ key: 'active', label: '활발' },
	];

	const handleSaveRecord = async () => {
		if (isSaving.current) return;
		if (!selectedPet) {
			Alert.alert('반려동물 선택 필요', '산책을 기록할 반려동물을 먼저 선택해주세요.');
			return;
		}
		if (!isAutomatic && totalMinutes === 0) {
			Alert.alert('입력 오류', '종료 시간은 시작 시간보다 늦어야 해요.');
			return;
		}
		if (!weatherText || !isTemperature(temperatureText)) {
			Alert.alert('날씨를 확인해주세요', '날씨와 기온을 입력해주세요.');
			return;
		}
		isSaving.current = true;
		const newRecord: WalkRecord = {
			id: existingRecord?.id ?? '',
			petId: existingRecord?.petId ?? selectedPet.id,
			date: displayDate,
			dayLabel: existingRecord?.dayLabel ?? '오늘 산책',
			startTime: startTimeStr,
			endTime: endTimeStr,
			durationMinutes: hasAutomaticDuration ? Math.max(1, Math.ceil(automaticDurationSeconds / 60)) : totalMinutes,
			distanceKm: existingRecord?.distanceKm ?? 0,
			intensity,
			weatherText,
			temperatureText: `${temperatureText}°C`,
			routePoints: existingRecord?.routePoints,
			significant: existingRecord?.significant,
			excrement: { urination, defecation, specialNote },
		};

		try {
			await saveWalkRecord(newRecord, isAutomatic);
			router.replace({
				pathname: '/health-summary',
				params: { tab: 'walk' },
			} as Href);
		} catch {
			Alert.alert('저장할 수 없어요', '산책 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
		} finally {
			isSaving.current = false;
		}
	};

	const handleDeleteRecord = () => {
		if (!existingRecord) return;
		Alert.alert('산책 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
			{ style: 'cancel', text: '취소' },
			{
				style: 'destructive',
				text: '삭제',
				onPress: () => {
					void (async () => {
						try {
							await deleteWalkRecord(existingRecord);
							router.replace({ pathname: '/health-summary', params: { tab: 'walk' } } as Href);
						} catch {
							Alert.alert('삭제할 수 없어요', '산책 기록을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
						}
					})();
				},
			},
		]);
	};

	const weatherLabel = weatherText && isTemperature(temperatureText)
		? `${weatherText} · ${temperatureText}°C`
		: '날씨를 등록해주세요';

	const openWeatherModal = () => {
		if (!isEditing) return;
		setWeatherDraft(weatherText);
		setTemperatureDraft(temperatureText);
		setWeatherModalVisible(true);
	};

	return (
		<>
			<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
				<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="산책 기록하기" />

				<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
					<View style={styles.rowTwoCards}>
						<TouchableOpacity activeOpacity={0.8} disabled={!isEditing || isAutomatic} onPress={() => setDatePickerVisible(true)} style={styles.metaCard}>
							<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>산책 날짜</Text>
								<Text style={styles.metaValue}>{displayDate}</Text>
							</View>
						</TouchableOpacity>
						<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={openWeatherModal} style={styles.metaCard}>
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>날씨</Text>
								<Text style={[styles.metaValue, (!weatherText || !isTemperature(temperatureText)) && styles.placeholderText]}>{weatherLabel}</Text>
							</View>
						</TouchableOpacity>
					</View>

					<View style={styles.card}>
						<Text style={styles.cardLabel}>산책 시간</Text>
						<View style={styles.timeGrid}>
							<TouchableOpacity
								activeOpacity={0.8}
								disabled={!isEditing || isAutomatic}
								onPress={() => { setTimePickerTarget('start'); setTimePickerVisible(true); }}
								style={styles.timeCol}
							>
								<Text style={styles.timeLabel}>시작</Text>
								<Text style={styles.timeValue}>{startTimeSelected ? startTimeStr : '-'}</Text>
							</TouchableOpacity>
							<TouchableOpacity
								activeOpacity={0.8}
								disabled={!isEditing || isAutomatic}
								onPress={() => { setTimePickerTarget('end'); setTimePickerVisible(true); }}
								style={styles.timeCol}
							>
								<Text style={styles.timeLabel}>종료</Text>
								<Text style={styles.timeValue}>{endTimeSelected ? endTimeStr : '-'}</Text>
							</TouchableOpacity>
							<View style={styles.timeCol}>
								<Text style={styles.timeLabel}>총 시간</Text>
								<Text style={styles.timeValue}>{displayTotalTime}</Text>
							</View>
						</View>
					</View>

					<View style={styles.card}>
						<View style={styles.courseRow}>
							<View style={styles.courseLeft}>
								<View style={styles.courseBadge}>
									<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.pin} style={styles.courseBadgeIcon} />
								</View>
								<View>
									<Text style={styles.cardLabel}>산책 코스</Text>
									<Text style={styles.distanceValue}>거리 <Text style={styles.distanceHighlight}>기록 전</Text></Text>
								</View>
							</View>
							<View style={styles.mapThumbWrapper}>
								<View style={styles.mapPinOverlay}>
									<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.pin} style={styles.pinIcon} />
								</View>
							</View>
						</View>
					</View>

					<View style={[styles.card, styles.intensityCard]}>
						<Text style={styles.cardLabel}>산책 강도</Text>
						<View style={styles.chipRow}>
							{intensityOptions.map((opt) => (
								<TouchableOpacity
									activeOpacity={0.8}
									disabled={!isEditing}
									key={opt.key}
									onPress={() => setIntensity(opt.key)}
									style={[styles.chip, intensity === opt.key && styles.chipActive]}
								>
									<Text style={[styles.chipText, intensity === opt.key && styles.chipTextActive]}>{opt.label}</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					<View style={styles.card}>
						<View style={styles.checkRow}>
							<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setUrination(!urination)} style={styles.checkOption}>
								<View style={[styles.checkCircle, urination && styles.checkCircleActive]}>
									{urination && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>소변</Text>
							</TouchableOpacity>
							<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setDefecation(!defecation)} style={styles.checkOption}>
								<View style={[styles.checkCircle, defecation && styles.checkCircleActive]}>
									{defecation && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>대변</Text>
							</TouchableOpacity>
							<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setSpecialNote(!specialNote)} style={styles.checkOption}>
								<View style={[styles.checkCircle, specialNote && styles.checkCircleActive]}>
									{specialNote && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>특이사항</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>

				<View style={styles.bottomBar}>
					{existingRecord && !isEditing ? (
						<View style={styles.actionRow}>
							<AppButton onPress={() => setIsEditing(true)} style={styles.actionButton} title="수정" variant="success" />
							<AppButton onPress={handleDeleteRecord} style={styles.actionButton} title="삭제" variant="danger" />
						</View>
					) : (
						<AppButton onPress={() => void handleSaveRecord()} style={{ backgroundColor: COLORS.success }} title={existingRecord ? '저장하기' : '산책 기록 저장'} />
					)}
				</View>
			</AppScreen>
			<DatePickerSheet
				onClose={() => setDatePickerVisible(false)}
				onSelect={(date) => setRecordedAt(date)}
				title="산책 날짜 선택"
				value={recordedAt}
				visible={datePickerVisible}
			/>
			<TimePickerSheet
				onClose={() => setTimePickerVisible(false)}
				onSelect={({ hour, minute }) => {
					if (timePickerTarget === 'start') {
						setStartHour(hour);
						setStartMinute(minute);
						setStartTimeSelected(true);
					} else {
						setEndHour(hour);
						setEndMinute(minute);
						setEndTimeSelected(true);
					}
				}}
				title={timePickerTarget === 'start' ? '시작 시간 선택' : '종료 시간 선택'}
				value={timePickerTarget === 'start'
					? { hour: startHour, minute: startMinute }
					: { hour: endHour, minute: endMinute }
				}
				visible={timePickerVisible}
			/>
			<AppModal
				onClose={() => setWeatherModalVisible(false)}
				primaryAction={{
					disabled: !weatherDraft || !isTemperature(temperatureDraft),
					label: '확인',
					onPress: () => {
						setWeatherText(weatherDraft);
						setTemperatureText(temperatureDraft);
						setWeatherModalVisible(false);
					},
				}}
				secondaryAction={{
					label: '취소',
					onPress: () => setWeatherModalVisible(false),
				}}
				title="날씨 등록"
				variant="center"
				visible={weatherModalVisible}
			>
				<View style={styles.weatherModalContent}>
					<Text style={styles.weatherModalLabel}>날씨</Text>
					<View style={styles.weatherOptions}>
						{WEATHER_OPTIONS.map((option) => (
							<TouchableOpacity
								activeOpacity={0.8}
								key={option}
								onPress={() => setWeatherDraft(option)}
								style={[styles.weatherOption, weatherDraft === option && styles.weatherOptionActive]}
							>
								<Text style={[styles.weatherOptionText, weatherDraft === option && styles.weatherOptionTextActive]}>{option}</Text>
							</TouchableOpacity>
						))}
					</View>
					<AppInput
						inputMode="decimal"
						keyboardType="decimal-pad"
						label="기온"
						maxLength={5}
						onChangeText={(value) => setTemperatureDraft(parseTemperature(value))}
						placeholder="예: 24"
						rightElement={<Text style={styles.temperatureUnit}>°C</Text>}
						value={temperatureDraft}
					/>
				</View>
			</AppModal>
		</>
	);
}

const styles = StyleSheet.create({
	scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.md },
	rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
	metaCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
	metaIcon: { height: 22, width: 22 },
	metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
	metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	placeholderText: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 13 },
	card: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	intensityCard: { backgroundColor: COLORS.successSoft, borderColor: 'transparent' },
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	timeGrid: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
	timeCol: { flex: 1, alignItems: 'center', backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.lg },
	timeLabel: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
	timeValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily, marginTop: 4 },
	courseRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    courseLeft: { alignItems: 'flex-start', flexDirection: 'row', gap: SPACING.md },
	courseBadge: { alignItems: 'center', backgroundColor: COLORS.successSoft, borderRadius: RADIUS.round, height: 44, justifyContent: 'center', width: 44 },
	courseBadgeIcon: { height: 22, width: 22 },
	distanceValue: { ...TYPOGRAPHY.body1, color: COLORS.black, marginTop: SPACING.md },
	distanceHighlight: { color: COLORS.success, fontFamily: TYPOGRAPHY.title2.fontFamily },
	mapThumbWrapper: { backgroundColor: COLORS.gray100, borderColor: COLORS.gray200, borderWidth: 1, borderRadius: RADIUS.md, height: 64, width: 64, position: 'relative' },
	mapPinOverlay: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
	pinIcon: { height: 32, width: 32 },
	chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
	chip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.round, backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderWidth: 1 },
	chipActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
	chipText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	chipTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
	checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.sm },
	checkOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
	checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.gray300, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
	checkCircleActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
	checkLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	bottomBar: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
	actionRow: { flexDirection: 'row', gap: SPACING.md },
	actionButton: { flex: 1 },
	weatherModalContent: { gap: SPACING.lg, paddingVertical: SPACING.sm },
	weatherModalLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	weatherOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
	weatherOption: { borderColor: COLORS.gray200, borderRadius: RADIUS.round, borderWidth: 1, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
	weatherOptionActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
	weatherOptionText: { ...TYPOGRAPHY.caption, color: COLORS.gray600 },
	weatherOptionTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
	temperatureUnit: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
});
