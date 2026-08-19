import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_WALK_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { WalkIntensity, WalkRecord } from '../types';

export function WalkRecordScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ date?: string; startTime?: string; duration?: string }>();

	const [intensity, setIntensity] = useState<WalkIntensity>('moderate');
	const [urination, setUrination] = useState(true);
	const [defecation, setDefecation] = useState(true);
	const [specialNote, setSpecialNote] = useState(false);

	const displayDate = params.date || '2026.07.06';
	const startTime = params.startTime || '18:20';
	const rawDurationParam = params.duration || '45분';

	const parseDurationMinutes = (durationStr: string) => {
		if (durationStr.includes('미만')) return 1;
		const numericOnly = durationStr.replace(/[^0-9]/g, '');
		return numericOnly ? Number(numericOnly) : 45;
	};

	const durationMinutes = parseDurationMinutes(rawDurationParam);

	const calculateEndTime = (start: string, durationMin: number) => {
		const [h, m] = start.split(':').map(Number);
		if (isNaN(h) || isNaN(m)) return '19:05';
		const totalMin = h * 60 + m + durationMin;
		const endH = Math.floor(totalMin / 60) % 24;
		const endM = totalMin % 60;
		return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
	};

	const endTime = calculateEndTime(startTime, durationMinutes);

	const intensityOptions: { key: WalkIntensity; label: string }[] = [
		{ key: 'relaxed', label: '느긋' },
		{ key: 'moderate', label: '보통' },
		{ key: 'active', label: '활발' },
	];

	const handleSaveRecord = () => {
		const newRecord: WalkRecord = {
			id: String(Date.now()),
			date: displayDate,
			dayLabel: '오늘 산책',
			startTime,
			endTime,
			durationMinutes,
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
		<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
			<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="산책 기록하기" />

			<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.rowTwoCards}>
					<View style={styles.metaCard}>
						<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>산책 날짜</Text>
							<Text style={styles.metaValue}>{displayDate}</Text>
						</View>
					</View>
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
						<View style={styles.timeCol}>
							<Text style={styles.timeLabel}>시작</Text>
							<Text style={styles.timeValue}>{startTime}</Text>
						</View>
						<View style={styles.timeCol}>
							<Text style={styles.timeLabel}>종료</Text>
							<Text style={styles.timeValue}>{endTime}</Text>
						</View>
						<View style={styles.timeCol}>
							<Text style={styles.timeLabel}>총 시간</Text>
							<Text style={styles.timeValue}>{rawDurationParam}</Text>
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