import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, TimePickerSheet } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_WALK_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { WalkIntensity, WalkRecord } from '../types';

export function WalkRecordScreen() {
	const router = useRouter();
	const isSaving = useRef(false);
	const params = useLocalSearchParams<{ date?: string; startTime?: string; duration?: string }>();

	const [intensity, setIntensity] = useState<WalkIntensity>('moderate');
	const [urination, setUrination] = useState(true);
	const [defecation, setDefecation] = useState(true);
	const [specialNote, setSpecialNote] = useState(false);
	const [datePickerVisible, setDatePickerVisible] = useState(false);

	const pad2Walk = (n: number) => String(n).padStart(2, '0');
	const formatWalkDate = (date: Date) =>
		`${date.getFullYear()}.${pad2Walk(date.getMonth() + 1)}.${pad2Walk(date.getDate())}`;
	const parseParamDate = (dateStr?: string): Date => {
		if (!dateStr) return new Date();
		const [y, m, d] = dateStr.split('.').map(Number);
		const parsed = new Date(y, (m || 1) - 1, d || 1);
		return isNaN(parsed.getTime()) ? new Date() : parsed;
	};

	const [recordedAt, setRecordedAt] = useState<Date>(() => parseParamDate(params.date));
	const displayDate = formatWalkDate(recordedAt);

	const parseTimeStr = (timeStr?: string, fallbackH = 18, fallbackM = 20): { hour: number; minute: number } => {
		if (!timeStr) return { hour: fallbackH, minute: fallbackM };
		const [h, m] = timeStr.split(':').map(Number);
		return { hour: isNaN(h) ? fallbackH : h, minute: isNaN(m) ? fallbackM : m };
	};

	const parseDurationMinutes = (durationStr: string) => {
		if (durationStr.includes('미만')) return 1;
		const numericOnly = durationStr.replace(/[^0-9]/g, '');
		return numericOnly ? Number(numericOnly) : 45;
	};

	const initialDuration = parseDurationMinutes(params.duration || '45');
	const initialStart = parseTimeStr(params.startTime);
	const initialEndTotal = initialStart.hour * 60 + initialStart.minute + initialDuration;

	const [startHour, setStartHour] = useState(initialStart.hour);
	const [startMinute, setStartMinute] = useState(initialStart.minute);
	const [endHour, setEndHour] = useState(Math.floor(initialEndTotal / 60) % 24);
	const [endMinute, setEndMinute] = useState(initialEndTotal % 60);
	const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end'>('start');
	const [timePickerVisible, setTimePickerVisible] = useState(false);

	const startTimeStr = `${pad2Walk(startHour)}:${pad2Walk(startMinute)}`;
	const endTimeStr = `${pad2Walk(endHour)}:${pad2Walk(endMinute)}`;
	const startTotalMin = startHour * 60 + startMinute;
	const endTotalMin = endHour * 60 + endMinute;
	const totalMinutes = endTotalMin > startTotalMin
		? endTotalMin - startTotalMin
		: endTotalMin < startTotalMin
		? 24 * 60 - startTotalMin + endTotalMin
		: 0;
	const displayTotalTime = totalMinutes === 0
		? '-'
		: totalMinutes < 60
		? `${totalMinutes}분`
		: `${Math.floor(totalMinutes / 60)}시간${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60}분` : ''}`;

	const intensityOptions: { key: WalkIntensity; label: string }[] = [
		{ key: 'relaxed', label: '느긋' },
		{ key: 'moderate', label: '보통' },
		{ key: 'active', label: '활발' },
	];

	const handleSaveRecord = () => {
		if (isSaving.current) return;
		if (totalMinutes === 0) {
			Alert.alert('입력 오류', '시작 시간과 종료 시간이 같아요. 올바른 시간을 입력해주세요.');
			return;
		}
		isSaving.current = true;
		const newRecord: WalkRecord = {
			id: String(Date.now()),
			date: displayDate,
			dayLabel: '오늘 산책',
			startTime: startTimeStr,
			endTime: endTimeStr,
			durationMinutes: totalMinutes,
			distanceKm: 1.8,
			intensity,
			weatherText: '맑음',
			temperatureText: '24°C',
			excrement: { urination, defecation, specialNote },
		};

		MOCK_WALK_RECORDS.unshift(newRecord);

		router.replace({
			pathname: '/health-summary',
			params: { tab: 'walk' },
		} as Href);
	};

	return (
		<>
			<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
				<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="산책 기록하기" />

				<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
					<View style={styles.rowTwoCards}>
						<TouchableOpacity activeOpacity={0.8} onPress={() => setDatePickerVisible(true)} style={styles.metaCard}>
							<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>산책 날짜</Text>
								<Text style={styles.metaValue}>{displayDate}</Text>
							</View>
						</TouchableOpacity>
						<View style={styles.metaCard}>
							<View style={styles.metaTextGroup}>
								<Text style={styles.metaLabel}>날씨</Text>
								<Text style={styles.metaValue}>맑음 · 24°C</Text>
							</View>
						</View>
					</View>

					<View style={styles.card}>
						<Text style={styles.cardLabel}>산책 시간</Text>
						<View style={styles.timeGrid}>
							<TouchableOpacity
								activeOpacity={0.8}
								onPress={() => { setTimePickerTarget('start'); setTimePickerVisible(true); }}
								style={styles.timeCol}
							>
								<Text style={styles.timeLabel}>시작</Text>
								<Text style={styles.timeValue}>{startTimeStr}</Text>
							</TouchableOpacity>
							<TouchableOpacity
								activeOpacity={0.8}
								onPress={() => { setTimePickerTarget('end'); setTimePickerVisible(true); }}
								style={styles.timeCol}
							>
								<Text style={styles.timeLabel}>종료</Text>
								<Text style={styles.timeValue}>{endTimeStr}</Text>
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
	                                <Text style={styles.distanceValue}>거리 <Text style={styles.distanceHighlight}>1.8km</Text></Text>
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
							<TouchableOpacity activeOpacity={0.8} onPress={() => setUrination(!urination)} style={styles.checkOption}>
								<View style={[styles.checkCircle, urination && styles.checkCircleActive]}>
									{urination && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>소변</Text>
							</TouchableOpacity>
							<TouchableOpacity activeOpacity={0.8} onPress={() => setDefecation(!defecation)} style={styles.checkOption}>
								<View style={[styles.checkCircle, defecation && styles.checkCircleActive]}>
									{defecation && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>대변</Text>
							</TouchableOpacity>
							<TouchableOpacity activeOpacity={0.8} onPress={() => setSpecialNote(!specialNote)} style={styles.checkOption}>
								<View style={[styles.checkCircle, specialNote && styles.checkCircleActive]}>
									{specialNote && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
								</View>
								<Text style={styles.checkLabel}>특이사항</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>

				<View style={styles.bottomBar}>
					<AppButton onPress={handleSaveRecord} style={{ backgroundColor: COLORS.success }} title="산책 기록 저장" />
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
					} else {
						setEndHour(hour);
						setEndMinute(minute);
					}
				}}
				title={timePickerTarget === 'start' ? '시작 시간 선택' : '종료 시간 선택'}
				value={timePickerTarget === 'start'
					? { hour: startHour, minute: startMinute }
					: { hour: endHour, minute: endMinute }
				}
				visible={timePickerVisible}
			/>
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
});
